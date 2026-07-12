import "server-only";

/**
 * Synthèse vocale neuronale (TTS) — lecture audio « voix naturelle » des narratifs
 * (cours, consignes, feedbacks…). ⚠️ Anthropic/Claude NE FAIT PAS de synthèse vocale :
 * on s'appuie donc sur un fournisseur TTS externe compatible avec l'API OpenAI
 * `POST /v1/audio/speech` (OpenAI, ou toute passerelle compatible).
 *
 * Entièrement CÔTÉ SERVEUR et « gated » par la clé : si `TTS_API_KEY` est absente,
 * la fonctionnalité est désactivée et le client retombe sur la voix du navigateur
 * (SpeechSynthesis) — aucune régression.
 *
 * Variables d'environnement (serveur uniquement, jamais exposées au navigateur) :
 *   TTS_API_KEY   (requis)  — clé du fournisseur TTS.
 *   TTS_BASE_URL  (option)  — défaut « https://api.openai.com/v1 ».
 *   TTS_MODEL     (option)  — défaut « gpt-4o-mini-tts ».
 *   TTS_VOICE     (option)  — défaut « alloy ».
 */

/** Longueur maximale d'un segment envoyé au fournisseur (protège du coût et des limites d'API). */
export const TTS_MAX_CARACTERES = 4000;

export function ttsConfigure(): boolean {
  return Boolean(process.env.TTS_API_KEY);
}

/**
 * Synthétise `texte` en audio (MP3) via le fournisseur configuré.
 * Renvoie l'ArrayBuffer audio, ou `null` si le TTS n'est pas configuré / en cas d'échec.
 */
export async function synthetiserVocal(texte: string): Promise<ArrayBuffer | null> {
  const cle = process.env.TTS_API_KEY;
  if (!cle) return null;

  const base = (process.env.TTS_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.TTS_MODEL ?? "gpt-4o-mini-tts";
  const voice = process.env.TTS_VOICE ?? "alloy";
  const entree = texte.trim().slice(0, TTS_MAX_CARACTERES);
  if (!entree) return null;

  try {
    const rep = await fetch(`${base}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: entree, response_format: "mp3" }),
    });
    if (!rep.ok) {
      console.error("[tts] échec fournisseur :", rep.status, await rep.text().catch(() => ""));
      return null;
    }
    return await rep.arrayBuffer();
  } catch (err) {
    console.error("[tts] erreur réseau :", err);
    return null;
  }
}
