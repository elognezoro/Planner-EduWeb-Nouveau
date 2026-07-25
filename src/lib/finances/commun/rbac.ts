import "server-only";
import { getUtilisateurCourant } from "@/lib/auth/session";

/**
 * Garde RBAC UNIQUE du module Finance (CLAUDE.md §3 : jamais dupliquée par page).
 *
 * Qui gère les FINANCES d'un établissement : admin système, et — pour LEUR établissement —
 * l'Économe, le Chef, l'ACE et l'Admin Établissements. Aperçu de rôle = jamais d'écriture.
 */
export async function peutGererFinances(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || !etablissementId) return null;
  if (u.roleReel === "admin") return u;
  if (
    (u.roleReel === "econome" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "etablissements_admin") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  return null;
}

/**
 * Même périmètre en LECTURE seule : l'aperçu de rôle est autorisé (la page Finances est
 * consultable en aperçu via `requireRole` — `roleActif` porte le rôle prévisualisé), les
 * écritures restant refusées par `peutGererFinances`.
 */
export async function peutConsulterFinances(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || !etablissementId) return null;
  if (u.roleReel === "admin") return u;
  if (
    (u.roleActif === "econome" ||
      u.roleActif === "chef_etablissement" ||
      u.roleActif === "adjoint_chef_etablissement" ||
      u.roleActif === "etablissements_admin") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  return null;
}
