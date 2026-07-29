import "server-only";
import { prisma, prismaBase } from "@/lib/prisma";

/** Taux de commission du parrain sur ce que paie son filleul (pourcentage). */
export const TAUX_PARRAINAGE = 10;

/**
 * URL CANONIQUE de la plateforme, jamais l'URL Vercel.
 * Les liens de parrainage doivent porter le domaine officiel (`planning.eduweb.ci`), pas une
 * adresse `*.vercel.app`. On s'appuie sur la même variable que les e-mails transactionnels
 * (NEXT_PUBLIC_APP_URL) ; le repli code un domaine officiel — jamais VERCEL_URL.
 */
export function urlCanonique(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://planning.eduweb.ci").replace(/\/$/, "");
}

/** Alphabet sans caractères ambigus (ni O/0, ni I/1/L) : un code lu au téléphone reste fiable. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function codeAleatoire(longueur = 8): string {
  let s = "";
  for (let i = 0; i < longueur; i += 1) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

/**
 * Garantit un code de parrainage à cet utilisateur et le renvoie. Généré à la DEMANDE (première
 * ouverture de « Mon parrainage ») : pas de reprise de données pour les comptes existants.
 * Idempotent : renvoie le code déjà présent le cas échéant.
 */
export async function assurerCodeParrainage(utilisateurId: string): Promise<string | null> {
  const u = await prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { codeParrainage: true } });
  if (!u) return null;
  if (u.codeParrainage) return u.codeParrainage;
  // Quelques tentatives en cas de collision improbable sur l'index unique.
  for (let essai = 0; essai < 6; essai += 1) {
    const code = codeAleatoire();
    try {
      await prisma.utilisateur.update({ where: { id: utilisateurId }, data: { codeParrainage: code } });
      return code;
    } catch {
      // Course entre deux requêtes : quelqu'un a peut-être posé le code entre-temps.
      const relu = await prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { codeParrainage: true } });
      if (relu?.codeParrainage) return relu.codeParrainage;
    }
  }
  return null;
}

/** Lien d'invitation complet à partager (domaine officiel + code sur la page d'inscription). */
export function lienParrainage(code: string): string {
  return `${urlCanonique()}/inscription?parrain=${encodeURIComponent(code)}`;
}

/**
 * Résout un code de parrainage (issu de `?parrain=`) en identifiant de parrain, pour l'inscription.
 * Renvoie null si le code est inconnu — une invitation invalide ne bloque jamais une inscription.
 */
export async function resoudreParrain(code: string | null | undefined): Promise<string | null> {
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return null;
  const p = await prisma.utilisateur.findUnique({ where: { codeParrainage: c }, select: { id: true } });
  return p?.id ?? null;
}

/**
 * Enregistre la COMMISSION due au parrain d'un filleul qui vient de payer un abonnement.
 * Appelée après la création de l'abonnement. Sans effet si le filleul n'a pas de parrain.
 *
 * - Récurrent : une ligne par abonnement. L'unicité `abonnementId` (index + upsert) rend l'appel
 *   idempotent — un rejeu ne crédite jamais deux fois.
 * - Écrite via le client de BASE (non étendu) pour ne pas déclencher la capture d'audit générique
 *   sur une ligne financière technique ; jamais bloquant pour la souscription.
 */
export async function enregistrerCommission(abonnement: {
  id: string;
  souscritParId: string;
  montantFinal: number;
}): Promise<void> {
  try {
    const filleul = await prismaBase.utilisateur.findUnique({
      where: { id: abonnement.souscritParId },
      select: { id: true, parrainId: true },
    });
    // Pas de parrain, ou garde-fou anti auto-parrainage : rien à créditer.
    if (!filleul?.parrainId || filleul.parrainId === filleul.id) return;
    const montant = Math.round((abonnement.montantFinal * TAUX_PARRAINAGE) / 100);
    if (montant <= 0) return;
    await prismaBase.commissionParrainage.upsert({
      where: { abonnementId: abonnement.id },
      update: {}, // déjà enregistrée : on ne double pas
      create: {
        parrainId: filleul.parrainId,
        filleulId: filleul.id,
        abonnementId: abonnement.id,
        montantBase: abonnement.montantFinal,
        taux: TAUX_PARRAINAGE,
        montant,
      },
    });
  } catch (e) {
    // La commission ne doit jamais faire échouer la souscription du filleul.
    console.error("[parrainage] commission non enregistrée :", e);
  }
}
