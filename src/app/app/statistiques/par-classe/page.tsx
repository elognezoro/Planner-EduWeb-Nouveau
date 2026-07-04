import type { Metadata } from "next";
import { Users, BookOpen, CalendarCheck } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import {
  ChartMoyennesDiscipline,
  ChartAssiduite,
  ChartBarVertical,
} from "../etablissement/charts";

export const metadata: Metadata = { title: "Statistiques — Par classe" };
export const dynamic = "force-dynamic";

const BASE = "/app/statistiques/par-classe";

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 font-display text-base font-bold text-forest-900">{titre}</h2>
      {children}
    </Card>
  );
}

export default async function StatsParClassePage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string; classe?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "chef_etablissement",
    "adjoint_chef_etablissement",
    "inspecteur_orientation",
    "enseignant",
  ]);
  const sp = await searchParams;

  let classes: { id: string; nom: string }[] = [];
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let adminSansEtab = false;
  let erreur = false;

  try {
    if (u.roleReel === "enseignant") {
      classes = await prisma.classe.findMany({
        where: { affectations: { some: { enseignantId: u.id } } },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      });
    } else if (
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "inspecteur_orientation"
    ) {
      etabId = u.portee.etablissementId;
      if (etabId)
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
    } else {
      const ctx = await resoudreEtablissement(u, sp.etab);
      etablissements = ctx.etablissements;
      etabId = ctx.etabId;
      if (!etabId) adminSansEtab = true;
      else
        classes = await prisma.classe.findMany({
          where: { etablissementId: etabId },
          orderBy: { nom: "asc" },
          select: { id: true, nom: true },
        });
    }
  } catch (e) {
    console.error("[stats-classe] résolution :", e);
    erreur = true;
  }

  if (adminSansEtab) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Statistiques — Par classe" description="Choisissez un établissement." />
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
      </div>
    );
  }

  const classeSel = classes.find((c) => c.id === sp.classe) ?? null;

  let effectif = 0;
  let nbNotes = 0;
  let tauxPresence = 0;
  let moyennes: { discipline: string; moyenne: number }[] = [];
  let assiduite: { statut: string; valeur: number }[] = [];
  let distribution: { label: string; valeur: number }[] = [];

  if (!erreur && classeSel) {
    try {
      const [inscriptions, notes, presGroupes] = await Promise.all([
        prisma.inscription.count({ where: { classeId: classeSel.id } }),
        prisma.note.findMany({
          where: { classeId: classeSel.id },
          select: { eleveId: true, valeur: true, sur: true, discipline: { select: { nom: true } } },
        }),
        prisma.presence.groupBy({
          by: ["statut"],
          where: { appel: { classeId: classeSel.id } },
          _count: { _all: true },
        }),
      ]);

      effectif = inscriptions;
      nbNotes = notes.length;

      // Moyennes par discipline + moyenne générale par élève.
      const aggDisc = new Map<string, { somme: number; n: number }>();
      const aggEleve = new Map<string, { somme: number; n: number }>();
      for (const note of notes) {
        if (!note.sur) continue;
        const sur20 = (note.valeur / note.sur) * 20;
        const d = aggDisc.get(note.discipline.nom) ?? { somme: 0, n: 0 };
        d.somme += sur20;
        d.n += 1;
        aggDisc.set(note.discipline.nom, d);
        const e = aggEleve.get(note.eleveId) ?? { somme: 0, n: 0 };
        e.somme += sur20;
        e.n += 1;
        aggEleve.set(note.eleveId, e);
      }
      moyennes = [...aggDisc.entries()]
        .map(([discipline, v]) => ({ discipline, moyenne: Math.round((v.somme / v.n) * 10) / 10 }))
        .sort((a, b) => b.moyenne - a.moyenne);

      const buckets = [0, 0, 0, 0]; // [0-5), [5-10), [10-15), [15-20]
      for (const e of aggEleve.values()) {
        const m = e.somme / e.n;
        const i = m < 5 ? 0 : m < 10 ? 1 : m < 15 ? 2 : 3;
        buckets[i] += 1;
      }
      distribution = [
        { label: "0–5", valeur: buckets[0] },
        { label: "5–10", valeur: buckets[1] },
        { label: "10–15", valeur: buckets[2] },
        { label: "15–20", valeur: buckets[3] },
      ];

      const compteur = (s: string) => presGroupes.find((g) => g.statut === s)?._count._all ?? 0;
      const present = compteur("present");
      const total = presGroupes.reduce((a, g) => a + g._count._all, 0);
      tauxPresence = total > 0 ? Math.round((present / total) * 100) : 0;
      assiduite = [
        { statut: "Présences", valeur: present },
        { statut: "Absences", valeur: compteur("absent") },
        { statut: "Retards", valeur: compteur("retard") },
        { statut: "Excusés", valeur: compteur("excuse") },
      ];
    } catch (e) {
      console.error("[stats-classe] agrégation :", e);
      erreur = true;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Statistiques — Par classe"
        description="Indicateurs pédagogiques d'une classe : moyennes, assiduité, répartition."
      />

      {u.roleReel === "admin" && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les statistiques.</p>
        </Card>
      ) : classes.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            {u.roleReel === "enseignant"
              ? "Vous n'êtes affecté à aucune classe."
              : "Aucune classe disponible."}
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
              {etabId && <input type="hidden" name="etab" value={etabId} />}
              <div className="min-w-[12rem] flex-1">
                <label className="mb-1.5 block text-sm font-medium text-forest-900">Classe</label>
                <select
                  name="classe"
                  defaultValue={classeSel?.id ?? ""}
                  className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
              >
                Afficher
              </button>
            </form>
          </Card>

          {classeSel && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard libelle="Élèves" valeur={effectif} icone={<Users size={22} />} />
                <StatCard libelle="Notes saisies" valeur={nbNotes} icone={<BookOpen size={22} />} ton="gold" />
                <StatCard
                  libelle="Taux de présence"
                  valeur={`${tauxPresence}%`}
                  icone={<CalendarCheck size={22} />}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Bloc titre={`Moyennes par discipline — ${classeSel.nom}`}>
                  <ChartMoyennesDiscipline data={moyennes} />
                </Bloc>
                <Bloc titre="Assiduité de la classe">
                  <ChartAssiduite data={assiduite} />
                </Bloc>
                <Bloc titre="Répartition des moyennes générales">
                  <ChartBarVertical
                    data={distribution}
                    nomSerie="Élèves"
                    couleur="#246a48"
                    vide="Aucune note pour calculer les moyennes."
                  />
                </Bloc>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
