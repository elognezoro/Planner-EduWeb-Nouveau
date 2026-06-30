import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resoudreEtablissement } from "@/lib/vie-scolaire/contexte";
import { PageHeader, Card } from "@/components/app/ui";
import { SelecteurEtablissement } from "@/components/app/selecteur-etablissement";

export const metadata: Metadata = { title: "Emplois du temps" };
export const dynamic = "force-dynamic";

const BASE = "/app/vie-scolaire/emplois-du-temps";
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface CreneauVue {
  classeNom: string;
  disciplineNom: string;
  enseignantNom: string;
  salleNom: string;
  jour: number;
  periode: number;
}

function Grille({ creneaux, modeEnseignant }: { creneaux: CreneauVue[]; modeEnseignant: boolean }) {
  if (creneaux.length === 0) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-ink-700/60">
        <CalendarDays size={16} /> Aucun emploi du temps disponible. Générez-le depuis la console
        de configuration de l&apos;établissement.
      </p>
    );
  }
  const maxPeriode = Math.max(...creneaux.map((c) => c.periode));
  const periodes = Array.from({ length: maxPeriode + 1 }, (_, i) => i);
  const map = new Map<string, CreneauVue>();
  for (const c of creneaux) map.set(`${c.jour}|${c.periode}`, c);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="w-16 border border-cream-200 bg-cream-50 p-2 font-semibold text-ink-700/60">Période</th>
            {JOURS.map((j) => (
              <th key={j} className="border border-cream-200 bg-cream-50 p-2 font-semibold text-forest-800">{j}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periodes.map((p) => (
            <tr key={p}>
              <td className="border border-cream-200 bg-cream-50/60 p-2 text-center font-semibold text-ink-700/60">P{p + 1}</td>
              {JOURS.map((_, j) => {
                const c = map.get(`${j}|${p}`);
                return (
                  <td key={j} className="border border-cream-200 p-1.5 align-top">
                    {c ? (
                      <div className="rounded-lg bg-forest-50 px-2 py-1.5">
                        <p className="font-semibold text-forest-900">{c.disciplineNom}</p>
                        <p className="text-ink-700/65">{modeEnseignant ? c.classeNom : c.enseignantNom}</p>
                        <p className="text-[0.65rem] text-ink-700/45">{c.salleNom}</p>
                      </div>
                    ) : (
                      <span className="block h-8" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function creneauxDe(where: object): Promise<CreneauVue[]> {
  const liste = await prisma.creneau.findMany({
    where,
    orderBy: [{ jour: "asc" }, { periode: "asc" }],
    select: { classeNom: true, disciplineNom: true, enseignantNom: true, salleNom: true, jour: true, periode: true },
  });
  return liste;
}

export default async function EmploisDuTempsPage({
  searchParams,
}: {
  searchParams: Promise<{ etab?: string; classe?: string }>;
}) {
  const u = await requireRole([
    "admin",
    "chef_etablissement",
    "educateur",
    "enseignant",
    "parent",
    "eleve",
    "drena",
    "inspecteur",
  ]);
  const sp = await searchParams;

  // Enseignant : son propre emploi du temps.
  if (u.roleReel === "enseignant") {
    const creneaux = await creneauxDe({ enseignantId: u.id });
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Mon emploi du temps" description="Vos cours de la semaine." />
        <Card>
          <Grille creneaux={creneaux} modeEnseignant />
        </Card>
      </div>
    );
  }

  // Élève : l'emploi du temps de sa classe.
  if (u.roleReel === "eleve") {
    const insc = await prisma.inscription.findFirst({
      where: { eleveId: u.id },
      orderBy: { creeLe: "desc" },
      select: { classeId: true, classe: { select: { nom: true } } },
    });
    const creneaux = insc ? await creneauxDe({ classeId: insc.classeId }) : [];
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Emploi du temps" description={insc ? `Classe ${insc.classe.nom}` : "Aucune classe"} />
        <Card>
          <Grille creneaux={creneaux} modeEnseignant={false} />
        </Card>
      </div>
    );
  }

  // Parent : classes de ses enfants (sélection).
  if (u.roleReel === "parent") {
    const liens = await prisma.lienParentEleve.findMany({ where: { parentId: u.id }, select: { eleveId: true } });
    const inscriptions = await prisma.inscription.findMany({
      where: { eleveId: { in: liens.map((l) => l.eleveId) } },
      select: { classeId: true, classe: { select: { id: true, nom: true } } },
    });
    const classes = [...new Map(inscriptions.map((i) => [i.classe.id, i.classe.nom])).entries()].map(([id, nom]) => ({ id, nom }));
    const classeSel = classes.find((c) => c.id === sp.classe) ?? classes[0] ?? null;
    const creneaux = classeSel ? await creneauxDe({ classeId: classeSel.id }) : [];
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Emploi du temps" description="L'emploi du temps de vos enfants." />
        {classes.length > 1 && (
          <Card>
            <form method="get" action={BASE} className="flex items-end gap-3">
              <select name="classe" defaultValue={classeSel?.id ?? ""} className="h-11 flex-1 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400">
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
              <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">Afficher</button>
            </form>
          </Card>
        )}
        <Card>
          <Grille creneaux={creneaux} modeEnseignant={false} />
        </Card>
      </div>
    );
  }

  // Personnel / pilotage : sélection établissement + classe.
  const peutChoisir = ["admin", "drena", "inspecteur"].includes(u.roleReel);
  let etablissements: { id: string; nom: string }[] = [];
  let etabId: string | null = null;
  if (peutChoisir) {
    const ctx = await resoudreEtablissement(u, sp.etab);
    etablissements = ctx.etablissements;
    etabId = ctx.etabId;
  } else {
    etabId = u.portee.etablissementId;
  }

  if (!etabId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader titre="Emplois du temps" description="Choisissez un établissement." />
        {peutChoisir ? (
          <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={null} />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/70">Aucun établissement rattaché à votre périmètre.</p>
          </Card>
        )}
      </div>
    );
  }

  const classes = await prisma.classe.findMany({ where: { etablissementId: etabId }, orderBy: { nom: "asc" }, select: { id: true, nom: true } });
  const classeSel = classes.find((c) => c.id === sp.classe) ?? classes[0] ?? null;
  const creneaux = classeSel ? await creneauxDe({ classeId: classeSel.id }) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader titre="Emplois du temps" description="Consultez l'emploi du temps d'une classe." />
      {peutChoisir && <SelecteurEtablissement basePath={BASE} etablissements={etablissements} etabId={etabId} />}
      <Card>
        <form method="get" action={BASE} className="flex flex-wrap items-end gap-3">
          {etabId && <input type="hidden" name="etab" value={etabId} />}
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Classe</label>
            <select name="classe" defaultValue={classeSel?.id ?? ""} className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400">
              {classes.length === 0 && <option value="">Aucune classe</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700">Afficher</button>
        </form>
      </Card>
      {classeSel && (
        <Card>
          <h2 className="mb-3 font-display text-base font-bold text-forest-900">{classeSel.nom}</h2>
          <Grille creneaux={creneaux} modeEnseignant={false} />
        </Card>
      )}
    </div>
  );
}
