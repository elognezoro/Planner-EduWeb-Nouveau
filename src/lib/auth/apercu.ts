import "server-only";
import { cookies } from "next/headers";
import {
  estRoleValide,
  peutUtiliserApercu,
  rolesConsultablesEnApercu,
  type RoleId,
} from "@/lib/rbac";

/**
 * Mode Aperçu de rôle (cahier §4.5, §4.6) — stockage de l'état dans un cookie.
 * L'aperçu est purement une surcouche d'AFFICHAGE : l'utilisateur réel reste l'administrateur,
 * et toute écriture est bloquée (lecture seule). Voir getUtilisateurCourant pour l'application.
 */
export const COOKIE_APERCU = "eduweb_apercu";
/** Aperçu « Voir comme » ciblant un UTILISATEUR précis (id) — réservé à l'admin système. */
export const COOKIE_APERCU_UTILISATEUR = "eduweb_apercu_utilisateur";

/**
 * Renvoie le rôle prévisualisé valide pour cet administrateur, ou null.
 * Vérifie que l'administrateur a le droit d'aperçu ET que le rôle ciblé est dans son périmètre.
 */
export async function lireApercu(roleReel: RoleId): Promise<RoleId | null> {
  if (!peutUtiliserApercu(roleReel)) return null;
  const store = await cookies();
  const valeur = store.get(COOKIE_APERCU)?.value;
  if (!valeur || !estRoleValide(valeur)) return null;
  if (!rolesConsultablesEnApercu(roleReel).includes(valeur)) return null;
  return valeur;
}

/**
 * Renvoie l'identifiant de l'utilisateur incarné (« Voir comme »), ou null.
 * Seul l'administrateur SYSTÈME peut incarner un utilisateur ; l'aperçu reste en
 * lecture seule (toutes les écritures vérifient `apercuActif`).
 */
export async function lireApercuUtilisateur(roleReel: RoleId): Promise<string | null> {
  if (roleReel !== "admin") return null;
  const store = await cookies();
  return store.get(COOKIE_APERCU_UTILISATEUR)?.value || null;
}
