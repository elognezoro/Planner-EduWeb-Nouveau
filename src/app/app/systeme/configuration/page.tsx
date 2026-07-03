import type { Metadata } from "next";
import { Settings, CalendarRange, MapPin, BookOpen, Table2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { ConfigForm, AnneeForm, RegionForm, DisciplineForm, DisciplineChip } from "./forms";

export const metadata: Metadata = { title: "Configuration générale" };
export const dynamic = "force-dynamic";

async function charger() {
  try {
    const [config, annees, regions, niveaux, disciplines, grilles] = await Promise.all([
      prisma.configuration.findUnique({ where: { id: "global" } }),
      prisma.anneeScolaire.findMany({ orderBy: { libelle: "desc" } }),
      prisma.region.findMany({ orderBy: { nom: "asc" } }),
      prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
      prisma.discipline.findMany({ orderBy: { nom: "asc" } }),
      prisma.grilleHoraire.findMany({ where: { etablissementId: null } }),
    ]);
    return { config, annees, regions, niveaux, disciplines, grilles, ok: true as const };
  } catch (e) {
    console.error("[configuration] DB indisponible :", e);
    return { ok: false as const };
  }
}

export default async function ConfigurationPage() {
  await requireRole(["admin"]);
  const data = await charger();

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader titre="Configuration générale" />
        <Card>
          <p className="text-sm text-ink-700/70">
            Impossible de charger la configuration. Vérifiez la connexion à la base de données
            (DATABASE_URL) puis exécutez « npm run db:seed ».
          </p>
        </Card>
      </div>
    );
  }

  const { config, annees, regions, niveaux, disciplines, grilles } = data;
  const heures = new Map<string, number>();
  for (const g of grilles) heures.set(`${g.niveauId}:${g.disciplineId}`, g.heuresHebdo);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        titre="Configuration générale"
        description="Paramètres nationaux par défaut : année scolaire, régime de notation, régions et grille horaire — base du futur module Emplois du temps."
      />

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Settings size={18} /> Paramètres généraux
        </h2>
        <ConfigForm
          regimeNotation={config?.regimeNotation ?? "trimestre"}
          anneeCourante={config?.anneeScolaireCourante ?? null}
          annees={annees.map((a) => a.libelle)}
        />
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
            <CalendarRange size={18} /> Années scolaires
          </h2>
          <ul className="mb-4 flex flex-wrap gap-2">
            {annees.length === 0 && (
              <li className="text-sm text-ink-700/60">Aucune année définie.</li>
            )}
            {annees.map((a) => (
              <li
                key={a.id}
                className={`rounded-full px-3 py-1 text-sm ${
                  a.active
                    ? "bg-forest-100 font-semibold text-forest-800"
                    : "bg-cream-200 text-ink-700"
                }`}
              >
                {a.libelle}
                {a.active && " · active"}
              </li>
            ))}
          </ul>
          <AnneeForm />
        </Card>

        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
            <MapPin size={18} /> Régions
          </h2>
          <ul className="mb-4 flex flex-wrap gap-2">
            {regions.length === 0 && (
              <li className="text-sm text-ink-700/60">Aucune région définie.</li>
            )}
            {regions.map((r) => (
              <li
                key={r.id}
                className="rounded-full bg-cream-200 px-3 py-1 text-sm text-forest-800"
              >
                {r.nom}
              </li>
            ))}
          </ul>
          <RegionForm />
        </Card>
      </div>

      {/* Disciplines : référentiel national — ajout et suppression protégée. */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <BookOpen size={18} /> Disciplines
        </h2>
        <p className="mb-4 text-sm text-ink-700/65">
          Référentiel des matières enseignées. Une discipline utilisée (affectations, notes,
          cahier de texte) ne peut pas être supprimée.
        </p>
        <ul className="mb-4 flex flex-wrap gap-2">
          {disciplines.length === 0 && (
            <li className="text-sm text-ink-700/60">Aucune discipline définie.</li>
          )}
          {disciplines.map((d) => (
            <DisciplineChip key={d.id} id={d.id} nom={d.nom} couleur={d.couleur} />
          ))}
        </ul>
        <DisciplineForm />
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Table2 size={18} /> Grille horaire nationale (heures / semaine)
        </h2>
        <p className="mb-4 text-sm text-ink-700/65">
          Modèle national par défaut, modifiable par établissement lors de la configuration des
          emplois du temps (Phase 4).
        </p>
        {niveaux.length === 0 || disciplines.length === 0 ? (
          <p className="text-sm text-ink-700/60">
            Référentiels non initialisés. Exécutez « npm run db:seed ».
          </p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-200 text-left">
                <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Discipline</th>
                {niveaux.map((n) => (
                  <th key={n.id} className="px-2 py-2.5 text-center font-semibold text-ink-700/70">
                    {n.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {disciplines.map((d) => (
                <tr key={d.id} className="border-b border-cream-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-forest-900">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ backgroundColor: d.couleur ?? "#999" }}
                    />
                    {d.nom}
                  </td>
                  {niveaux.map((n) => {
                    const h = heures.get(`${n.id}:${d.id}`);
                    return (
                      <td key={n.id} className="px-2 py-2 text-center text-ink-800">
                        {h ? h : <span className="text-ink-700/25">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
