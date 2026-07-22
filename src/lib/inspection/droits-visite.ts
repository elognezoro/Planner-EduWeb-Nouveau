import "server-only";
import { prisma } from "@/lib/prisma";
import type { UtilisateurCourant } from "@/lib/auth/session";
import type { RoleId } from "@/lib/rbac";

/**
 * Droits sur les VISITES D'INSPECTION — garde UNIQUE et fail-closed, partagée par les actions
 * serveur des visites (`visites/actions.ts`) ET par celles de la grille de supervision
 * (`visites/[id]/grille/actions.ts`) : la logique de permission n'est JAMAIS dupliquée.
 */

/** Rôles admis sur les pages Visites (liste ET pages de détail — même socle `requireRole`). */
export const ROLES_PAGES_VISITES: RoleId[] = [
  "admin",
  "inspecteur",
  "conseiller_pedagogique",
  "drena",
  "adjoint_chef_etablissement",
];

/**
 * Inspecteur, Conseiller Pédagogique (établissements couverts par son antenne), ACE (visites
 * de classe pour évaluer l'exercice professionnel des enseignants de SON établissement) ou
 * admin, hors mode aperçu.
 */
export function peutInspecter(u: UtilisateurCourant): boolean {
  return (
    !u.apercuActif &&
    (u.roleReel === "admin" ||
      u.roleReel === "inspecteur" ||
      u.roleReel === "conseiller_pedagogique" ||
      u.roleReel === "adjoint_chef_etablissement")
  );
}

/** L'établissement est-il dans le périmètre de l'utilisateur ? (refusé par défaut) */
export async function etablissementAccessible(u: UtilisateurCourant, etabId: string): Promise<boolean> {
  if (u.roleReel === "admin") return true;
  // L'ACE visite les classes de SON établissement uniquement.
  if (u.roleReel === "adjoint_chef_etablissement") return etabId === u.portee.etablissementId;
  // Conseiller pédagogique : UNIQUEMENT les établissements COUVERTS par son antenne
  // (CouvertureApfc) — fail-closed : sans antenne ou sans couverture, aucun accès.
  if (u.roleReel === "conseiller_pedagogique") {
    if (!u.portee.apfcId) return false;
    const couverture = await prisma.couvertureApfc.findUnique({
      where: { etablissementId: etabId },
      select: { apfcId: true },
    });
    return couverture?.apfcId === u.portee.apfcId;
  }
  // Inspecteur : sa région (périmètre inchangé).
  const etab = await prisma.etablissement.findUnique({
    where: { id: etabId },
    select: { regionId: true },
  });
  if (!etab) return false;
  return etab.regionId != null && etab.regionId === u.portee.regionId;
}

/**
 * Peut MODIFIER cette visite (compte-rendu, statut, recommandations, grille de supervision) :
 * garde UNIQUE et fail-closed réutilisée par toutes les actions d'écriture (jamais dupliquée) —
 * - admin : partout, hors mode aperçu ;
 * - l'AUTEUR de la visite (inspecteur/conseiller/ACE) : TOUJOURS sur ses propres visites,
 *   même si son périmètre a changé depuis (ex. réaffectation régionale) ;
 * - sinon, un autre inspecteur/conseiller/ACE gestionnaire de la page DONT LE PÉRIMÈTRE
 *   COURANT couvre l'établissement de la visite (même logique que `etablissementAccessible`
 *   — région pour l'inspecteur, couverture APFC pour le conseiller, établissement propre
 *   pour l'ACE — réutilisée ici, pas redéfinie).
 * Une exception levée pendant cette résolution (ex. incident base de données) doit être
 * traitée comme une ERREUR TECHNIQUE par l'appelant, PAS comme un refus d'autorisation —
 * c'est pourquoi cette garde est toujours invoquée à l'intérieur du bloc try/catch de
 * l'action appelante.
 */
export async function peutModifierVisite(u: UtilisateurCourant, visiteId: string): Promise<boolean> {
  if (u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  if (
    u.roleReel !== "inspecteur" &&
    u.roleReel !== "conseiller_pedagogique" &&
    u.roleReel !== "adjoint_chef_etablissement"
  )
    return false;
  const v = await prisma.visite.findUnique({
    where: { id: visiteId },
    select: { inspecteurId: true, etablissementId: true },
  });
  if (!v) return false;
  if (v.inspecteurId === u.id) return true;
  return etablissementAccessible(u, v.etablissementId);
}

/**
 * Peut VOIR cette visite (pages de détail : grille de supervision, fiche imprimable) — reproduit
 * EXACTEMENT le périmètre de LECTURE de la liste « Mes visites » (`visites/page.tsx`), refusé
 * par défaut :
 * - admin : toutes les visites ;
 * - inspecteur / conseiller pédagogique / ACE : LEURS visites uniquement (auteur) ;
 * - DRENA : les visites des établissements de SA région (lecture seule).
 */
export function peutVoirVisite(
  u: UtilisateurCourant,
  visite: { inspecteurId: string; etablissement: { regionId: string | null } },
): boolean {
  if (u.roleReel === "admin") return true;
  if (
    u.roleReel === "inspecteur" ||
    u.roleReel === "conseiller_pedagogique" ||
    u.roleReel === "adjoint_chef_etablissement"
  ) {
    return visite.inspecteurId === u.id;
  }
  if (u.roleReel === "drena") {
    return (
      visite.etablissement.regionId != null &&
      u.portee.regionId != null &&
      visite.etablissement.regionId === u.portee.regionId
    );
  }
  return false;
}
