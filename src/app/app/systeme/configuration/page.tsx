import type { Metadata } from "next";
import { Settings, CalendarRange, MapPin, BookOpen, Table2, Hourglass } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { trouverPays } from "@/lib/referentiels/pays";
import { PageHeader, Card } from "@/components/app/ui";
import { ConfigForm, EssaiDefautForm, AnneeForm, RegionForm, DisciplineForm, DisciplineChip } from "./forms";
import { FiltrePaysConfiguration, GrilleNationaleForm } from "./grille-nationale-form";

export const metadata: Metadata = { title: "Configuration générale" };
export const dynamic = "force-dynamic";

async function charger(pays: string) {
  try {
    const [config, annees, regions, niveaux, disciplines, grilles] = await Promise.all([
      prisma.configuration.findUnique({ where: { id: "global" } }),
      prisma.anneeScolaire.findMany({ orderBy: { libelle: "desc" } }),
      prisma.region.findMany({ orderBy: { nom: "asc" } }),
      prisma.niveau.findMany({ orderBy: { ordre: "asc" } }),
      prisma.discipline.findMany({ orderBy: { nom: "asc" } }),
      // Grille horaire NATIONALE du pays sélectionné (les établissements du pays en héritent).
      prisma.grilleHoraire.findMany({ where: { etablissementId: null, pays } }),
    ]);
    return { config, annees, regions, niveaux, disciplines, grilles, ok: true as const };
  } catch (e) {
    console.error("[configuration] DB indisponible :", e);
    return { ok: false as const };
  }
}

export default async function ConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ pays?: string }>;
}) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  // Pays dont on définit les conditions nationales : paramètre validé, sinon pays consulté.
  const pays = (sp.pays && trouverPays(sp.pays)?.nom) || (await paysConsulte());
  const data = await charger(pays);

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

      {/* Filtre pays : les conditions nationales ci-dessous sont définies pays par pays. */}
      <FiltrePaysConfiguration pays={pays} />

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

      <Card>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Hourglass size={18} /> Période d&apos;essai par défaut
        </h2>
        <EssaiDefautForm
          valeur={config?.essaiDureeValeur ?? 7}
          unite={config?.essaiDureeUnite ?? "jour"}
          heure={config?.essaiHeureFin ?? null}
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

      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Table2 size={18} /> Grille horaire nationale — {pays} (heures / semaine)
        </h2>
        <p className="mb-4 text-sm text-ink-700/65">
          Modèle par défaut appliqué aux établissements de {pays}. Chaque établissement peut le
          personnaliser dans sa console (bloc « Volumes horaires par niveau et par discipline »).
          Vide = pas de cours pour ce niveau.
        </p>
        {niveaux.length === 0 || disciplines.length === 0 ? (
          <p className="text-sm text-ink-700/60">
            Référentiels non initialisés. Exécutez « npm run db:seed ».
          </p>
        ) : (
          <GrilleNationaleForm
            pays={pays}
            niveaux={niveaux.map((n) => ({ id: n.id, nom: n.nom }))}
            disciplines={disciplines.map((d) => ({ id: d.id, nom: d.nom, couleur: d.couleur }))}
            heures={Object.fromEntries(heures)}
          />
        )}
      </Card>
    </div>
  );
}
