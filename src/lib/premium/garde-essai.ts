import "server-only";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { enEssai, CONTACT_WHATSAPP, LIEN_ACADEMIE_PREMIUM } from "@/lib/premium/essai";

/**
 * Garde « période d'essai » : pendant l'essai, SEUL l'espace « Emplois du temps » est éditable ;
 * toutes les autres actions d'écriture sont refusées (le reste de la plateforme reste consultable).
 * À appeler dans les actions d'écriture des espaces AUTRES que l'élaboration des EDT, juste à côté
 * de la vérification existante du mode aperçu (`apercuActif`).
 *
 * Message unique rappelant l'essai, le contact officiel WhatsApp et le lien Académie Prémium.
 */
export function messageEssai(): string {
  return (
    "Période d'essai : seul l'espace « Emplois du temps » est modifiable. Pour un accès complet " +
    `sur l'année académique en cours, abonnez-vous à l'Académie Prémium (${LIEN_ACADEMIE_PREMIUM}) ` +
    `— WhatsApp ${CONTACT_WHATSAPP}.`
  );
}

/** Refus si l'utilisateur DÉJÀ chargé est en période d'essai, sinon null (variante synchrone). */
export function refusEssaiPour(u: { essaiFinLe: Date | null } | null | undefined): string | null {
  return u && enEssai(u.essaiFinLe) ? messageEssai() : null;
}

/** Refus si l'utilisateur COURANT est en période d'essai, sinon null (variante autonome). */
export async function refusEssai(): Promise<string | null> {
  const u = await getUtilisateurCourant();
  return refusEssaiPour(u);
}
