import type { Metadata } from "next";
import { BookOpenCheck, Stamp, ListChecks } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatCard } from "@/components/app/ui";

export const metadata: Metadata = { title: "Rapports Pédagogiques Disciplinaires" };
export const dynamic = "force-dynamic";

const DISCIPLINE_NON_RENSEIGNEE = "Discipline non renseignée";

export default async function RapportsDisciplinairesPage() {
  const u = await requireRole(["admin", "inspecteur", "drena"]);

  const where =
    u.roleReel === "inspecteur"
      ? { inspecteurId: u.id }
      : u.roleReel === "drena"
        ? { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } }
        : {};

  let lignes: { discipline: string; visites: number; recosOuvertes: number; moyenne: number | null }[] = [];
  let erreur = false;

  try {
    const visites = await prisma.visite.findMany({
      where: { ...where, enseignantId: { not: null } },
      select: {
        enseignantId: true,
        noteGlobale: true,
        recommandations: { select: { statut: true } },
      },
    });

    const enseignantIds = [...new Set(visites.map((v) => v.enseignantId).filter((id): id is string => id != null))];

    const affectations =
      enseignantIds.length > 0
        ? await prisma.affectationEnseignant.findMany({
            where: { enseignantId: { in: enseignantIds } },
            select: { enseignantId: true, discipline: { select: { nom: true } } },
          })
        : [];

    // Un enseignant peut être affecté à plusieurs disciplines : on retient la première déclarée.
    const disciplineParEnseignant = new Map<string, string>();
    for (const a of affectations) {
      if (!disciplineParEnseignant.has(a.enseignantId)) disciplineParEnseignant.set(a.enseignantId, a.discipline.nom);
    }

    const parDiscipline = new Map<string, { visites: number; recosOuvertes: number; sommeNote: number; nNote: number }>();
    for (const v of visites) {
      const discipline = disciplineParEnseignant.get(v.enseignantId as string) ?? DISCIPLINE_NON_RENSEIGNEE;
      const o = parDiscipline.get(discipline) ?? { visites: 0, recosOuvertes: 0, sommeNote: 0, nNote: 0 };
      o.visites += 1;
      o.recosOuvertes += v.recommandations.filter((r) => r.statut !== "traitee").length;
      if (v.noteGlobale != null) {
        o.sommeNote += v.noteGlobale;
        o.nNote += 1;
      }
      parDiscipline.set(discipline, o);
    }

    lignes = [...parDiscipline.entries()]
      .map(([discipline, o]) => ({
        discipline,
        visites: o.visites,
        recosOuvertes: o.recosOuvertes,
        moyenne: o.nNote > 0 ? Math.round((o.sommeNote / o.nNote) * 10) / 10 : null,
      }))
      .sort((a, b) => b.visites - a.visites);
  } catch (e) {
    console.error("[rapports-disciplinaires] chargement :", e);
    erreur = true;
  }

  const kpis = {
    disciplines: lignes.length,
    visites: lignes.reduce((s, l) => s + l.visites, 0),
    recosOuvertes: lignes.reduce((s, l) => s + l.recosOuvertes, 0),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Rapports Pédagogiques Disciplinaires"
        description="Résultats d'inspection agrégés par discipline enseignée."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les rapports par discipline.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard libelle="Disciplines couvertes" valeur={kpis.disciplines} icone={<BookOpenCheck size={22} />} />
            <StatCard libelle="Visites concernées" valeur={kpis.visites} icone={<Stamp size={22} />} ton="gold" />
            <StatCard libelle="Recommandations à suivre" valeur={kpis.recosOuvertes} icone={<ListChecks size={22} />} />
          </div>

          <Card>
            <h2 className="mb-3 font-display text-base font-bold text-forest-900">Par discipline</h2>
            {lignes.length === 0 ? (
              <p className="text-sm text-ink-700/60">
                Aucune visite avec enseignant identifié n&apos;est enregistrée pour le moment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-cream-200 text-left text-xs text-ink-700/65">
                      <th className="py-2.5 pr-3 font-semibold">Discipline</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Visites</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Reco. à suivre</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Moy. /20</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.discipline} className="border-b border-cream-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-forest-900">{l.discipline}</td>
                        <td className="px-2 py-2.5 text-right text-ink-700/80">{l.visites}</td>
                        <td className="px-2 py-2.5 text-right text-gold-700">{l.recosOuvertes}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-forest-800">{l.moyenne ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
