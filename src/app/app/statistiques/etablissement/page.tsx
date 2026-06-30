import type { Metadata } from "next";
import { Users, School, DoorOpen, CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";
import {
  ChartEffectifsNiveau,
  ChartRepartitionCycle,
  ChartAssiduite,
  ChartMoyennesDiscipline,
} from "./charts";

export const metadata: Metadata = { title: "Statistiques — Établissement" };
export const dynamic = "force-dynamic";

const BASE = "/app/statistiques/etablissement";

const LIBELLE_CYCLE: Record<string, string> = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 font-display text-base font-bold text-forest-900">{titre}</h2>
      {children}
    </Card>
  );
}

export default async function StatsEtablissementPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string }>;
}) {
  const u = await requireRole(["admin", "chef_etablissement", "etablissements_admin", "drena"]);
  const sp = await searchParams;

  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  let etabNom = "";
  let erreur = false;

  try {
    if (u.roleReel === "admin") {
      const ctx = await resoudreEtablissement(u, sp.etab);
      etablissements = ctx.etablissements;
      etabId = ctx.etabId;
    } else {
      etabId = u.portee.etablissementId;
    }
  } catch (e) {
    console.error("[stats-etab] résolution :", e);
    erreur = true;
  }

  // Sélection d'établissement requise (admin) ou périmètre non résolu.
  if (!erreur && !etabId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          titre="Statistiques — Établissement"
          description="Choisissez un établissement pour afficher ses indicateurs."
        />
        {u.roleReel === "admin" ? (
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/70">
              {"Aucun établissement n'est rattaché à votre périmètre."}
            </p>
          </Card>
        )}
      </div>
    );
  }

  // Agrégations.
  let kpis = { classes: 0, eleves: 0, salles: 0, creneaux: 0 };
  let effectifsNiveau: { niveau: string; eleves: number; ordre: number }[] = [];
  let parCycle: { cycle: string; eleves: number }[] = [];
  let assiduite: { statut: string; valeur: number }[] = [];
  let moyennes: { discipline: string; moyenne: number }[] = [];

  if (!erreur && etabId) {
    try {
      const etab = await prisma.etablissement.findUnique({
        where: { id: etabId },
        select: { nom: true },
      });
      etabNom = etab?.nom ?? "";

      const [classes, salles, creneaux, presGroupes, notes] = await Promise.all([
        prisma.classe.findMany({
          where: { etablissementId: etabId },
          select: {
            niveau: { select: { nom: true, cycle: true, ordre: true } },
            _count: { select: { inscriptions: true } },
          },
        }),
        prisma.salle.count({ where: { etablissementId: etabId } }),
        prisma.creneau.count({ where: { etablissementId: etabId } }),
        prisma.presence.groupBy({
          by: ["statut"],
          where: { appel: { classe: { etablissementId: etabId } } },
          _count: { _all: true },
        }),
        prisma.note.findMany({
          where: { classe: { etablissementId: etabId } },
          select: { valeur: true, sur: true, discipline: { select: { nom: true } } },
        }),
      ]);

      const totalEleves = classes.reduce((a, c) => a + c._count.inscriptions, 0);
      kpis = { classes: classes.length, eleves: totalEleves, salles, creneaux };

      // Effectifs par niveau.
      const parNiveau = new Map<string, { eleves: number; ordre: number }>();
      const parCycleMap = new Map<string, number>();
      for (const c of classes) {
        const n = parNiveau.get(c.niveau.nom) ?? { eleves: 0, ordre: c.niveau.ordre };
        n.eleves += c._count.inscriptions;
        parNiveau.set(c.niveau.nom, n);
        parCycleMap.set(c.niveau.cycle, (parCycleMap.get(c.niveau.cycle) ?? 0) + c._count.inscriptions);
      }
      effectifsNiveau = [...parNiveau.entries()]
        .map(([niveau, v]) => ({ niveau, eleves: v.eleves, ordre: v.ordre }))
        .sort((a, b) => a.ordre - b.ordre);
      parCycle = [...parCycleMap.entries()]
        .map(([cycle, eleves]) => ({ cycle: LIBELLE_CYCLE[cycle] ?? cycle, eleves }))
        .filter((c) => c.eleves > 0);

      // Assiduité.
      const compteur = (s: string) =>
        presGroupes.find((g) => g.statut === s)?._count._all ?? 0;
      assiduite = [
        { statut: "Présences", valeur: compteur("present") },
        { statut: "Absences", valeur: compteur("absent") },
        { statut: "Retards", valeur: compteur("retard") },
        { statut: "Excusés", valeur: compteur("excuse") },
      ];

      // Moyennes par discipline (normalisées /20).
      const aggDisc = new Map<string, { somme: number; n: number }>();
      for (const note of notes) {
        if (!note.sur) continue;
        const sur20 = (note.valeur / note.sur) * 20;
        const d = aggDisc.get(note.discipline.nom) ?? { somme: 0, n: 0 };
        d.somme += sur20;
        d.n += 1;
        aggDisc.set(note.discipline.nom, d);
      }
      moyennes = [...aggDisc.entries()]
        .map(([discipline, v]) => ({ discipline, moyenne: Math.round((v.somme / v.n) * 10) / 10 }))
        .sort((a, b) => b.moyenne - a.moyenne)
        .slice(0, 8);
    } catch (e) {
      console.error("[stats-etab] agrégation :", e);
      erreur = true;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Statistiques — Établissement"
        description={etabNom ? `Indicateurs clés de ${etabNom}.` : "Indicateurs clés de l'établissement."}
      />

      {u.roleReel === "admin" && etabId && (
        <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />
      )}

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger les statistiques. Vérifiez la connexion à la base de données.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard libelle="Classes" valeur={kpis.classes} icone={<School size={22} />} />
            <StatCard libelle="Élèves inscrits" valeur={kpis.eleves} icone={<Users size={22} />} ton="gold" />
            <StatCard libelle="Salles" valeur={kpis.salles} icone={<DoorOpen size={22} />} />
            <StatCard libelle="Créneaux planifiés" valeur={kpis.creneaux} icone={<CalendarDays size={22} />} ton="gold" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Bloc titre="Effectifs par niveau">
              <ChartEffectifsNiveau data={effectifsNiveau.map(({ niveau, eleves }) => ({ niveau, eleves }))} />
            </Bloc>
            <Bloc titre="Répartition des élèves par cycle">
              <ChartRepartitionCycle data={parCycle} />
            </Bloc>
            <Bloc titre="Assiduité (séances d'appel)">
              <ChartAssiduite data={assiduite} />
            </Bloc>
            <Bloc titre="Moyennes par discipline (/20)">
              <ChartMoyennesDiscipline data={moyennes} />
            </Bloc>
          </div>
        </>
      )}
    </div>
  );
}
