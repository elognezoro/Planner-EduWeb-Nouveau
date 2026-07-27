import "server-only";

/* ============================================================================
   Adaptateur FOURNISSEUR SMS — la brique « envoi réel ».

   Toute la couche métier (src/lib/sms/envoyer.ts) appelle une interface unique
   SmsProvider.send(to, message). Fournisseurs :
     - console : par défaut, N'ENVOIE RIEN (log serveur) → tourne sans secret ;
     - twilio  : envoi RÉEL via l'API REST Twilio (fetch + Basic Auth, 0 dépendance) ;
     - orange / mtn / moov : squelette agrégateur HTTP JSON À ADAPTER au contrat opérateur.

   Le fournisseur actif est choisi par la variable d'env SMS_PROVIDER ; tant que ses
   secrets ne sont pas configurés, on RETOMBE sur console (jamais de faux « envoyé »).
   Fichier SERVEUR uniquement (lit des secrets d'environnement).
   ========================================================================== */

export interface SmsSendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  send(to: string, message: string): Promise<SmsSendResult>;
}

/** Normalise un numéro : retire espaces/séparateurs, conserve un « + » de tête (E.164). */
export function normaliserTelephone(brut: string): string {
  const t = (brut ?? "").trim();
  const plus = t.startsWith("+");
  const chiffres = t.replace(/\D/g, "");
  return plus ? `+${chiffres}` : chiffres;
}

/* ------------------------- Fournisseur « console » ------------------------- */
export const consoleProvider: SmsProvider = {
  name: "console",
  async send(to, message) {
    const num = normaliserTelephone(to);
    console.log(`[SMS:console] → ${num} :: ${message}`);
    return { ok: true, providerMessageId: `console-${num}` };
  },
};

/* --------------------------- Fournisseur Twilio --------------------------- */
export interface TwilioEnv {
  accountSid: string;
  authToken: string;
  from: string; // numéro expéditeur E.164, ex. +14155552671
}

/** Envoi RÉEL via l'API REST Twilio (POST Messages.json, Basic Auth). fetch natif, 0 dépendance. */
export function twilioProvider(env: TwilioEnv): SmsProvider {
  return {
    name: "twilio",
    async send(to, message) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}/Messages.json`;
      const body = new URLSearchParams({ To: normaliserTelephone(to), From: env.from, Body: message });
      const auth = Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (!res.ok) return { ok: false, error: data?.message ?? `Twilio HTTP ${res.status}` };
        return { ok: true, providerMessageId: data.sid };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Échec réseau Twilio." };
      }
    },
  };
}

/* --------------- Squelette agrégateur générique (Orange/MTN/Moov) ---------- */
export interface AgregateurEnv {
  endpoint: string; // endpoint POST de l'agrégateur
  token: string; // jeton Bearer / clé API
  senderId: string; // expéditeur enregistré (sender ID)
}

/**
 * Squelette pour un agrégateur africain (Orange CI / MTN / Moov via bulk-SMS HTTP JSON).
 * ⚠️ À ADAPTER : `body` et le parsing dépendent du contrat exact de l'opérateur.
 */
export function agregateurProvider(nom: string, env: AgregateurEnv): SmsProvider {
  return {
    name: nom,
    async send(to, message) {
      try {
        const res = await fetch(env.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ to: normaliserTelephone(to), from: env.senderId, message }),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string; error?: string };
        if (!res.ok) return { ok: false, error: data?.error ?? `${nom} HTTP ${res.status}` };
        return { ok: true, providerMessageId: data.id ?? data.messageId };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : `Échec réseau ${nom}.` };
      }
    },
  };
}

/* -------------------------------- Fabrique -------------------------------- */
/** Résout le fournisseur ; retombe sur console tant que les secrets ne sont pas configurés. */
export function getProvider(providerId: string): SmsProvider {
  const env = process.env;
  switch (providerId) {
    case "twilio":
      if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
        return twilioProvider({
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN,
          from: env.TWILIO_FROM,
        });
      }
      return consoleProvider;
    case "orange":
    case "mtn":
    case "moov":
      if (env.SMS_AGGREGATOR_ENDPOINT && env.SMS_AGGREGATOR_TOKEN && env.SMS_SENDER_ID) {
        return agregateurProvider(providerId, {
          endpoint: env.SMS_AGGREGATOR_ENDPOINT,
          token: env.SMS_AGGREGATOR_TOKEN,
          senderId: env.SMS_SENDER_ID,
        });
      }
      return consoleProvider;
    default:
      return consoleProvider;
  }
}

/** Fournisseur configuré (id demandé + fournisseur EFFECTIF), pour l'affichage honnête du statut. */
export function etatFournisseurSMS(): { demande: string; effectif: string; reel: boolean } {
  const demande = (process.env.SMS_PROVIDER ?? "console").toLowerCase();
  const effectif = getProvider(demande).name;
  return { demande, effectif, reel: effectif !== "console" };
}
