import "server-only";

/**
 * Transcription vocale (dictée : audio → texte) via un fournisseur compatible OpenAI
 * `POST /v1/audio/transcriptions` (Whisper / gpt-4o-transcribe). Réutilise la MÊME clé et
 * la MÊME base que la synthèse vocale (« clé voix OpenAI ») : une seule variable à poser.
 *
 * Entièrement CÔTÉ SERVEUR, gated par `TTS_API_KEY` : sans clé, la dictée est indisponible
 * (le bouton se masque). Variables : TTS_API_KEY, TTS_BASE_URL (défaut api.openai.com/v1),
 * TRANSCRIPTION_MODEL (défaut « gpt-4o-mini-transcribe »).
 */

/** Taille maximale d'un enregistrement accepté (protège du coût / des abus). */
export const TRANSCRIPTION_MAX_OCTETS = 15 * 1024 * 1024; // 15 Mo

export function transcriptionConfiguree(): boolean {
  return Boolean(process.env.TTS_API_KEY);
}

function extensionDepuisType(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

/** Transcrit un enregistrement audio en texte (français). Renvoie null si non configuré / échec. */
export async function transcrireAudio(audio: ArrayBuffer, mimeType: string): Promise<string | null> {
  const cle = process.env.TTS_API_KEY;
  if (!cle) return null;
  if (audio.byteLength === 0) return null;

  const base = (process.env.TTS_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe";
  const type = mimeType || "audio/webm";

  try {
    const fd = new FormData();
    fd.append("file", new Blob([audio], { type }), `audio.${extensionDepuisType(type)}`);
    fd.append("model", model);
    fd.append("language", "fr");

    const rep = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}` },
      body: fd,
    });
    if (!rep.ok) {
      console.error("[transcription] échec fournisseur :", rep.status, await rep.text().catch(() => ""));
      return null;
    }
    const data = (await rep.json().catch(() => null)) as { text?: unknown } | null;
    return data && typeof data.text === "string" ? data.text.trim() : null;
  } catch (err) {
    console.error("[transcription] erreur réseau :", err);
    return null;
  }
}
