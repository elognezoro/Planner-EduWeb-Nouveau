import "server-only";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  estPermissionLecture, permissionsDuRole, ROLES_FINANCE, type PermissionFinance,
} from "./permissions";

/**
 * Garde RBAC UNIQUE du module Finance (CLAUDE.md §3 : jamais dupliquée par page) —
 * implémentation du 97-RBAC (RM-2600/2601/2604/2605) sur le RBAC rang+périmètre existant :
 *
 *  - RM-2600/2601 : `exigerPermissionFinance` vérifie une permission ATOMIQUE explicite
 *    (matrice rôle → permissions de ./permissions.ts) AVANT toute opération ;
 *  - RM-2605 (multi-tenant) : le périmètre établissement est TOUJOURS vérifié
 *    (portee.etablissementId === etablissementId ; admin système = seul accès transverse) ;
 *  - RM-2604 : les permissions manquantes au rôle peuvent venir d'une DÉLÉGATION active
 *    (delegations_finance) — l'expiration s'évalue ICI, à la vérification (fin < maintenant
 *    → inactive), jamais par cron ; une délégation révoquée (annuleLe) est ignorée ;
 *  - Aperçu de rôle : LECTURES autorisées, écritures toujours refusées.
 */

/** L'utilisateur courant appartient-il au périmètre Finance de cet établissement ? */
function dansPerimetre(u: UtilisateurCourant, etablissementId: string): boolean {
  return u.roleReel === "admin" || u.portee.etablissementId === etablissementId;
}

/** Délégation ACTIVE portant la permission (RM-2604 : bornée par debut/fin, non révoquée). */
async function delegationActive(
  utilisateurId: string,
  etablissementId: string,
  permission: PermissionFinance,
): Promise<boolean> {
  const maintenant = new Date();
  const delegation = await prisma.delegationFinance.findFirst({
    where: {
      etablissementId,
      beneficiaireId: utilisateurId,
      annuleLe: null,
      debut: { lte: maintenant },
      fin: { gte: maintenant },
      permissions: { array_contains: [permission] },
    },
    select: { id: true },
  });
  return delegation !== null;
}

/**
 * POINT UNIQUE de contrôle des actions Finance : retourne l'utilisateur courant s'il détient
 * la permission (rôle ∪ délégations actives) SUR cet établissement, sinon null
 * (l'action répond « Action non autorisée. »).
 */
export async function exigerPermissionFinance(
  etablissementId: string,
  permission: PermissionFinance,
): Promise<UtilisateurCourant | null> {
  const u = await getUtilisateurCourant();
  if (!u || !etablissementId) return null;
  const lecture = estPermissionLecture(permission);
  // Aperçu de rôle : lecture seule, jamais d'écriture (règle transverse de la plateforme).
  if (u.apercuActif && !lecture) return null;
  if (!dansPerimetre(u, etablissementId)) return null;
  // En lecture, l'aperçu emprunte le rôle PRÉVISUALISÉ (roleActif) ; en écriture, le rôle réel.
  const role = lecture ? u.roleActif : u.roleReel;
  if (permissionsDuRole(role).has(permission)) return u;
  // Délégations : uniquement pour l'utilisateur réel (jamais en aperçu).
  if (!u.apercuActif && (await delegationActive(u.id, etablissementId, permission))) return u;
  return null;
}

/**
 * Garde GROSSIÈRE historique (écriture) : l'utilisateur appartient-il à un rôle Finance avec
 * au moins un droit d'écriture sur cet établissement ? Conservée pour les besoins de niveau
 * page — les ACTIONS utilisent toutes `exigerPermissionFinance` (permission atomique).
 */
export async function peutGererFinances(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || !etablissementId) return null;
  if (u.roleReel === "admin") return u;
  if (!ROLES_FINANCE.includes(u.roleReel)) return null;
  if (u.portee.etablissementId !== etablissementId) return null;
  // Au moins une permission d'écriture (les rôles en lecture seule ne « gèrent » pas).
  for (const p of permissionsDuRole(u.roleReel)) {
    if (!estPermissionLecture(p)) return u;
  }
  return null;
}

/**
 * Même périmètre en LECTURE seule : l'aperçu de rôle est autorisé (la page Finances est
 * consultable en aperçu via `requireRole` — `roleActif` porte le rôle prévisualisé).
 */
export async function peutConsulterFinances(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || !etablissementId) return null;
  if (u.roleReel === "admin") return u;
  if (!ROLES_FINANCE.includes(u.roleActif)) return null;
  if (u.portee.etablissementId !== etablissementId) return null;
  return u;
}
