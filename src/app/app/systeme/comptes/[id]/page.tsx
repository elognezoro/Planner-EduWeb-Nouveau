import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock4 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { estRoleValide, ROLE_PAR_DEFAUT, ROLES, utilisateurDansPortee, type RoleId } from "@/lib/rbac";
import { termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { GestionCompte, type CompteVue, type Listes } from "./gestion";

export const metadata: Metadata = { title: "Gestion du compte" };
export const dynamic = "force-dynamic";

const BASE = "/app/systeme/comptes";
const libelleStatut: Record<string, string> = {
  en_attente_verification: "E-mail non confirmé",
  actif: "Actif",
  suspendu: "Suspendu",
};

function nomComplet(p: { prenoms: string | null; nom: string | null; email: string }) {
  return [p.prenoms, p.nom].filter(Boolean).join(" ") || p.email;
}

export default async function FicheComptePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireRole(["admin", "superviseur_international", "superviseur_national", "representant_pays", "etablissements_admin", "cafop_admin", "apfc_admin"]);

  const compte = await prisma.utilisateur.findUnique({
    where: { id },
    include: {
      roleActif: true,
      etablissement: { select: { nom: true, regionId: true } },
      region: { select: { nom: true } },
      cafop: { select: { nom: true } },
      apfc: { select: { nom: true } },
      demandes: { where: { statut: "en_attente" }, take: 1, include: { roleDemande: true } },
    },
  });
  if (!compte) redirect(BASE);

  // Contrôle de périmètre — REFUSÉ PAR DÉFAUT : seul l'admin voit tout compte ; les autres
  // rôles n'accèdent qu'aux comptes de leur périmètre (centralisé, jamais réécrit ici).
  const dansPortee = utilisateurDansPortee(u.portee, {
    etablissementId: compte.etablissementId,
    cafopId: compte.cafopId,
    apfcId: compte.apfcId,
    regionId: compte.regionId ?? compte.etablissement?.regionId ?? null,
    pays: compte.pays,
  });
  if (!dansPortee) redirect(BASE);

  const roleTech: RoleId = estRoleValide(compte.roleActif.nomTechnique) ? compte.roleActif.nomTechnique : ROLE_PAR_DEFAUT;
  const portee = ROLES[roleTech].portee;
  const affectationNom =
    portee === "etablissement" ? compte.etablissement?.nom
    : portee === "region" ? compte.region?.nom
    : portee === "cafop" ? compte.cafop?.nom
    : portee === "apfc" ? compte.apfc?.nom
    : null;

  // L'établissement s'affecte via une recherche à la volée (répertoire de 41 000+ entrées) ;
  // seuls les référentiels courts (régions, CAFOP, APFC) sont chargés en liste.
  const [regions, cafops, apfcs] = await Promise.all([
    prisma.region.findMany({ orderBy: [{ pays: "asc" }, { nom: "asc" }], select: { id: true, nom: true, pays: true } }),
    prisma.cafop.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.apfc.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
  ]);
  const plusieursPays = new Set(regions.map((r) => r.pays)).size > 1;
  const listes: Listes = {
    regions: regions.map((r) => ({ id: r.id, nom: plusieursPays ? `${r.nom} (${r.pays})` : r.nom })),
    cafops,
    apfcs,
  };
  const etabActuel = compte.etablissementId && compte.etablissement
    ? { id: compte.etablissementId, nom: compte.etablissement.nom }
    : null;

  const vue: CompteVue = {
    id: compte.id,
    prenoms: compte.prenoms,
    nom: compte.nom,
    email: compte.email,
    telephone: compte.telephone,
    statut: compte.statutCompte,
    roleTech,
    etablissementId: compte.etablissementId,
    regionId: compte.regionId,
    cafopId: compte.cafopId,
    apfcId: compte.apfcId,
  };

  const demande = compte.demandes[0] ?? null;
  const terme = await termeCafopCourant(); // terme local des CAFOP (libellés de rôle « … CAFOP »)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={BASE} className="inline-flex items-center gap-2 text-sm font-medium text-forest-700 hover:text-forest-900">
        <ArrowLeft size={16} /> Tous les comptes
      </Link>

      <PageHeader titre={nomComplet(compte)} description={compte.email} />

      {/* Résumé */}
      <Card className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest-800 text-base font-bold text-gold-300">
          {(compte.nom || compte.email).slice(0, 1).toUpperCase()}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge ton="neutre">{appliquerTerme(compte.roleActif.libelle, terme)}</Badge>
          <Badge ton={compte.statutCompte === "actif" ? "succes" : compte.statutCompte === "suspendu" ? "refus" : "attente"}>
            {libelleStatut[compte.statutCompte] ?? compte.statutCompte}
          </Badge>
          {affectationNom && <Badge ton="neutre">{affectationNom}</Badge>}
        </div>
      </Card>

      {demande && (
        <Card className="border-gold-200 bg-gold-50/40">
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink-700/80">
            <Clock4 size={15} className="text-gold-700" />
            Demande de rôle en attente : <strong className="text-forest-900">{appliquerTerme(demande.roleDemande.libelle, terme)}</strong>.
            <Link href="/app/systeme/approbations" className="font-medium text-gold-700 hover:underline">
              Traiter dans Approbations →
            </Link>
          </p>
        </Card>
      )}

      <GestionCompte compte={vue} listes={listes} etabActuel={etabActuel} estSoi={compte.id === u.id} terme={terme} />
    </div>
  );
}
