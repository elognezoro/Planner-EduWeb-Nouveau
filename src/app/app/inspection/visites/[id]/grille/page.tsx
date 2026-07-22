import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLES_PAGES_VISITES, peutVoirVisite, peutModifierVisite } from "@/lib/inspection/droits-visite";
import { lireReponsesGrille, lireSeanceObservee } from "@/lib/inspection/grille-supervision";
import { PageHeader, Card } from "@/components/app/ui";
import { GrilleSupervisionForm, type GrilleInitiale } from "./components";

export const metadata: Metadata = { title: "Grille de supervision" };
export const dynamic = "force-dynamic";

const LIBELLE_TYPE: Record<string, string> = {
  classe: "Visite de classe",
  etablissement: "Visite d'établissement",
  suivi: "Visite de suivi",
};
const LIBELLE_STATUT: Record<string, string> = {
  planifiee: "Planifiée",
  realisee: "Réalisée",
  annulee: "Annulée",
};
const LIBELLE_MODALITE: Record<string, string> = {
  programmee: "Programmée (annoncée)",
  inopinee: "Inopinée (non annoncée)",
};

const dateLongue = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
const nomComplet = (p: { prenoms: string | null; nom: string | null; email: string }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;

export default async function GrilleSupervisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(ROLES_PAGES_VISITES);

  const visite = await prisma.visite.findUnique({
    where: { id },
    include: {
      etablissement: { select: { nom: true, regionId: true } },
      inspecteur: { select: { prenoms: true, nom: true, email: true } },
      enseignant: { select: { prenoms: true, nom: true, email: true } },
      grille: {
        include: { rempliPar: { select: { prenoms: true, nom: true, email: true } } },
      },
    },
  });
  // Même périmètre de LECTURE que la liste « Mes visites » (fail-closed, cf. droits-visite).
  if (!visite || !peutVoirVisite(u, visite)) notFound();

  // Écriture : garde unique partagée avec les actions (auteur / admin / gestionnaire couvrant
  // l'établissement, hors mode aperçu) — sinon, toute la grille est affichée en lecture seule.
  const modifiable = await peutModifierVisite(u, visite.id);

  const initiale: GrilleInitiale = {
    reponses: lireReponsesGrille(visite.grille?.reponses),
    seance: lireSeanceObservee(visite.grille?.seance),
    pointsForts: visite.grille?.pointsForts ?? "",
    pointsAmeliorer: visite.grille?.pointsAmeliorer ?? "",
    propositions: visite.grille?.propositions ?? "",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app/inspection/visites"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"
        >
          <ArrowLeft size={15} /> Retour aux visites
        </Link>
        <Link
          href={`/app/inspection/visites/${visite.id}/grille/imprimer`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50"
        >
          <Printer size={15} /> Fiche imprimable
        </Link>
      </div>

      <PageHeader
        titre="Grille de supervision"
        description="Grille de supervision des professeurs du secondaire (référentiel officiel) remplie pour cette visite d'inspection."
      />

      {/* Rappel de la visite concernée. */}
      <Card>
        <h2 className="mb-3 font-display text-base font-bold text-forest-900">Visite concernée</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Champ terme="Établissement" valeur={visite.etablissement.nom} />
          <Champ terme="Enseignant.e" valeur={visite.enseignant ? nomComplet(visite.enseignant) : "—"} />
          <Champ terme="Classe" valeur={visite.classeNom ?? "—"} />
          <Champ
            terme="Date"
            valeur={`${dateLongue(visite.date)}${visite.heureSeance ? ` · ${visite.heureSeance}` : ""}`}
          />
          <Champ terme="Type" valeur={LIBELLE_TYPE[visite.type] ?? visite.type} />
          <Champ terme="Modalité" valeur={LIBELLE_MODALITE[visite.modalite] ?? visite.modalite} />
          <Champ terme="Statut" valeur={LIBELLE_STATUT[visite.statut] ?? visite.statut} />
          <Champ terme="Encadreur" valeur={nomComplet(visite.inspecteur)} />
          <Champ terme="Objet" valeur={visite.objet} />
        </dl>
        {visite.grille && (
          <p className="mt-4 text-xs text-ink-700/55">
            Dernier enregistrement le {dateLongue(visite.grille.majLe)}
            {visite.grille.rempliPar ? ` par ${nomComplet(visite.grille.rempliPar)}` : ""}.
          </p>
        )}
      </Card>

      <GrilleSupervisionForm visiteId={visite.id} lectureSeule={!modifiable} initiale={initiale} />
    </div>
  );
}

function Champ({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">{terme}</dt>
      <dd className="mt-0.5 text-sm font-medium text-forest-900">{valeur}</dd>
    </div>
  );
}
