import type { Metadata } from "next";
import { Stamp, CalendarClock, CheckCircle2, ListChecks } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { etablissementsOperationnels } from "@/lib/etablissements/operationnels";
import { PageHeader, Card, StatCard } from "@/components/app/ui";
import { NouvelleVisiteForm, VisiteCard, type VisiteVue } from "./components";

export const metadata: Metadata = { title: "Inspection — Visites" };
export const dynamic = "force-dynamic";

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function VisitesPage() {
  const u = await requireRole(["admin", "inspecteur", "drena"]);
  const gerable = !u.apercuActif && (u.roleReel === "admin" || u.roleReel === "inspecteur");

  let etablissements: { id: string; nom: string }[] = [];
  let visites: VisiteVue[] = [];
  let erreur = false;

  try {
    // Établissements proposés à la planification (limités aux opérationnels —
    // le répertoire national complet dépasse 40 000 entrées).
    if (u.roleReel === "admin") {
      etablissements = await etablissementsOperationnels();
    } else if (u.roleReel === "inspecteur" && u.portee.regionId) {
      etablissements = await etablissementsOperationnels({ regionId: u.portee.regionId });
    }

    // Visites visibles selon le rôle / périmètre.
    const where =
      u.roleReel === "admin"
        ? {}
        : u.roleReel === "inspecteur"
          ? { inspecteurId: u.id }
          : { etablissement: { regionId: u.portee.regionId ?? "__aucune__" } };

    const brutes = await prisma.visite.findMany({
      where,
      orderBy: { date: "desc" },
      take: 50,
      include: {
        etablissement: { select: { nom: true } },
        inspecteur: { select: { prenoms: true, nom: true, email: true } },
        enseignant: { select: { prenoms: true, nom: true, email: true } },
        recommandations: { orderBy: { creeLe: "asc" } },
      },
    });

    visites = brutes.map((v) => ({
      id: v.id,
      etablissementNom: v.etablissement.nom,
      inspecteurNom: nomComplet(v.inspecteur),
      enseignantNom: v.enseignant ? nomComplet(v.enseignant) : null,
      date: v.date.toISOString(),
      type: v.type,
      statut: v.statut,
      objet: v.objet,
      observations: v.observations,
      noteGlobale: v.noteGlobale,
      recommandations: v.recommandations.map((r) => ({
        id: r.id,
        texte: r.texte,
        priorite: r.priorite,
        statut: r.statut,
      })),
    }));
  } catch (e) {
    console.error("[inspection] chargement :", e);
    erreur = true;
  }

  const kpis = {
    total: visites.length,
    planifiees: visites.filter((v) => v.statut === "planifiee").length,
    realisees: visites.filter((v) => v.statut === "realisee").length,
    recosOuvertes: visites.reduce(
      (a, v) => a + v.recommandations.filter((r) => r.statut !== "traitee").length,
      0,
    ),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titre="Inspection — Visites"
        description="Planification des visites, comptes-rendus et suivi des recommandations."
      />

      {erreur ? (
        <Card>
          <p className="text-sm text-ink-700/70">Impossible de charger les visites d&apos;inspection.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard libelle="Visites" valeur={kpis.total} icone={<Stamp size={22} />} />
            <StatCard libelle="Planifiées" valeur={kpis.planifiees} icone={<CalendarClock size={22} />} ton="gold" />
            <StatCard libelle="Réalisées" valeur={kpis.realisees} icone={<CheckCircle2 size={22} />} />
            <StatCard libelle="Recommandations à suivre" valeur={kpis.recosOuvertes} icone={<ListChecks size={22} />} ton="gold" />
          </div>

          {gerable && (
            <Card>
              <h2 className="mb-4 font-display text-base font-bold text-forest-900">Planifier une visite</h2>
              {etablissements.length === 0 ? (
                <p className="text-sm text-ink-700/65">
                  Aucun établissement dans votre périmètre. Vérifiez votre rattachement régional.
                </p>
              ) : (
                <NouvelleVisiteForm etablissements={etablissements} />
              )}
            </Card>
          )}

          <div className="space-y-4">
            <h2 className="font-display text-base font-bold text-forest-900">
              {gerable ? "Mes visites" : "Visites de la région"}
            </h2>
            {visites.length === 0 ? (
              <Card>
                <p className="text-sm text-ink-700/65">Aucune visite enregistrée pour le moment.</p>
              </Card>
            ) : (
              visites.map((v) => <VisiteCard key={v.id} visite={v} gerable={gerable} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
