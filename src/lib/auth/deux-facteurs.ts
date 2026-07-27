import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hacherMotDePasse, verifierMotDePasse } from "@/lib/auth/password";

/**
 * Double authentification (2FA) par code à 6 chiffres.
 *
 * Le code est envoyé à l'utilisateur (e-mail en Étape 1) et n'est JAMAIS stocké en clair :
 * seul son hachage bcrypt est conservé dans `Jeton.token`. La vérification est bornée
 * (expiration courte + nombre de tentatives) pour rendre la force brute des 6 chiffres inutile.
 *
 * Deux usages, distingués par le type de jeton :
 *  - `connexion_2fa`  : validation d'une connexion quand la 2FA est active.
 *  - `activation_2fa` : confirmation de l'activation de la 2FA depuis « Mon Profil ».
 */
export type TypeCode2FA = "connexion_2fa" | "activation_2fa";

export const DUREE_CODE_2FA_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_TENTATIVES_2FA = 5;

/** Code numérique à 6 chiffres, tiré uniformément (crypto), zéros de tête conservés. */
function genererCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Crée un nouveau code 2FA pour l'utilisateur et renvoie sa valeur en clair (à envoyer).
 * Invalide au préalable les éventuels codes du même type encore en attente (un seul code actif).
 */
export async function creerCode2FA(
  utilisateurId: string,
  type: TypeCode2FA,
): Promise<string> {
  // Un seul code actif à la fois : on consomme les précédents non utilisés.
  await prisma.jeton.updateMany({
    where: { utilisateurId, type, utiliseLe: null },
    data: { utiliseLe: new Date() },
  });

  const code = genererCode();
  await prisma.jeton.create({
    data: {
      token: await hacherMotDePasse(code),
      type,
      utilisateurId,
      expireLe: new Date(Date.now() + DUREE_CODE_2FA_MS),
    },
  });
  return code;
}

/**
 * Vérifie un code 2FA saisi. Consomme le jeton en cas de succès. En cas d'échec, incrémente
 * le compteur de tentatives et invalide le code au-delà de `MAX_TENTATIVES_2FA`.
 * Renvoie `true` uniquement si le code est valide, non expiré et dans la limite de tentatives.
 */
export async function verifierCode2FA(
  utilisateurId: string,
  type: TypeCode2FA,
  code: string,
): Promise<boolean> {
  const saisie = (code ?? "").trim();
  if (!/^\d{6}$/.test(saisie)) return false;

  const jeton = await prisma.jeton.findFirst({
    where: { utilisateurId, type, utiliseLe: null },
    orderBy: { creeLe: "desc" },
  });
  if (!jeton) return false;
  if (jeton.expireLe.getTime() < Date.now()) return false;
  if (jeton.tentatives >= MAX_TENTATIVES_2FA) return false;

  const valide = await verifierMotDePasse(saisie, jeton.token);
  if (!valide) {
    // Échec : on consigne la tentative et on brûle le code au-delà du plafond.
    const tentatives = jeton.tentatives + 1;
    await prisma.jeton.update({
      where: { id: jeton.id },
      data: {
        tentatives,
        ...(tentatives >= MAX_TENTATIVES_2FA ? { utiliseLe: new Date() } : {}),
      },
    });
    return false;
  }

  await prisma.jeton.update({
    where: { id: jeton.id },
    data: { utiliseLe: new Date() },
  });
  return true;
}
