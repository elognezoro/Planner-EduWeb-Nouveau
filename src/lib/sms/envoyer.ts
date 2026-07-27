import "server-only";
import { getProvider } from "./fournisseur";

export type StatutSMS = "simule" | "envoye" | "echec";

/**
 * Envoi d'un SMS via le fournisseur configuré (variable d'env `SMS_PROVIDER`).
 *  - Aucun fournisseur configuré (ou secrets absents) → repli « console » : SIMULÉ (statut "simule").
 *  - Fournisseur réel (twilio / orange / mtn / moov) → envoi réel : statut "envoye" ou "echec".
 *
 * Variables d'env (serveur uniquement) :
 *  - SMS_PROVIDER = twilio | orange | mtn | moov | console (défaut : console)
 *  - Twilio    : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
 *  - Agrégateur: SMS_AGGREGATOR_ENDPOINT, SMS_AGGREGATOR_TOKEN, SMS_SENDER_ID
 */
export async function envoyerSMS(telephone: string, message: string): Promise<StatutSMS> {
  const provider = getProvider((process.env.SMS_PROVIDER ?? "console").toLowerCase());

  // Repli console : on journalise sans transmettre (mode simulé).
  if (provider.name === "console") {
    console.log(`[SMS simulé] → ${telephone} : ${message}`);
    return "simule";
  }

  const resultat = await provider.send(telephone, message);
  if (!resultat.ok) {
    console.error(`[SMS] échec (${provider.name}) :`, resultat.error);
    return "echec";
  }
  return "envoye";
}
