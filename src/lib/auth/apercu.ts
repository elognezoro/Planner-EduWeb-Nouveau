import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  estRoleValide,
  peutUtiliserApercu,
  rolesConsultablesEnApercu,
  ROLES_ASSISTANCE,
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

/** Durée de vie d'une session d'assistance. Au-delà, le jeton devient inerte. */
export const ASSISTANCE_DUREE_MS = 30 * 60 * 1000;

function secretAssistance(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function signature(charge: string): string {
  return createHmac("sha256", secretAssistance()).update(charge).digest("hex");
}

/**
 * Jeton d'incarnation SIGNÉ : `cibleId.operateurId.expiration.signature`.
 *
 * Le cookie ne peut donc pas être forgé, et il LIE l'incarnation à son opérateur et à une
 * échéance. Deux failles fermées : la reprise silencieuse d'une incarnation par un autre compte
 * sur le même navigateur (l'opérateur est vérifié), et l'oubli de sortie du mode (expiration).
 */
export function creerJetonAssistance(cibleId: string, operateurId: string): string {
  const expire = Date.now() + ASSISTANCE_DUREE_MS;
  const charge = `${cibleId}.${operateurId}.${expire}`;
  return `${charge}.${signature(charge)}`;
}

/** Décode et VÉRIFIE un jeton d'assistance (signature, échéance). Null si invalide. */
export function lireJetonAssistance(jeton: string): { cibleId: string; operateurId: string; expire: number } | null {
  const parts = jeton.split(".");
  if (parts.length !== 4) return null;
  const [cibleId, operateurId, expireBrut, sig] = parts;
  const charge = `${cibleId}.${operateurId}.${expireBrut}`;
  const attendue = signature(charge);
  // Comparaison à temps constant (longueurs égales garanties par le hex de même taille).
  if (sig.length !== attendue.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(attendue))) return null;
  const expire = Number(expireBrut);
  if (!Number.isFinite(expire) || Date.now() > expire) return null;
  return { cibleId, operateurId, expire };
}

/**
 * Renvoie l'identifiant de l'utilisateur incarné (« Voir comme »), ou null.
 *
 * Habilités : l'administrateur système et les Super Admin (mode ASSISTANCE — cf.
 * ROLES_ASSISTANCE). Le jeton doit être signé, non expiré, ET émis POUR l'opérateur courant :
 * un cookie orphelin (déconnexion, autre compte sur le même navigateur) est inerte.
 * Le contrôle de PÉRIMÈTRE (pays, hiérarchie, famille de structure) est rejoué à chaque requête
 * par l'appelant via `peutIncarnerUtilisateur`.
 */
export async function lireApercuUtilisateur(roleReel: RoleId, operateurId: string): Promise<string | null> {
  if (!ROLES_ASSISTANCE.includes(roleReel)) return null;
  const store = await cookies();
  const brut = store.get(COOKIE_APERCU_UTILISATEUR)?.value;
  if (!brut) return null;
  const jeton = lireJetonAssistance(brut);
  if (!jeton) return null;
  if (jeton.operateurId !== operateurId) return null;
  return jeton.cibleId;
}
