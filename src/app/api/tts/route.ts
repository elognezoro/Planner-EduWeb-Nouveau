import { NextResponse } from "next/server";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { synthetiserVocal, ttsConfigure, TTS_MAX_CARACTERES } from "@/lib/ia/synthese-vocale";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

// Garde-fou de coût : au plus 30 lectures par minute et par utilisateur.
const DEBIT_MAX = 30;
const DEBIT_FENETRE_MS = 60_000;

/**
 * Lecture audio « voix neuronale » d'un narratif. Réservé aux utilisateurs connectés
 * (maîtrise du coût). Renvoie un flux MP3 si un fournisseur TTS est configuré ; sinon
 * 503 → le client retombe sur la voix du navigateur (SpeechSynthesis).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });
  // Comptes en attente de rôle : pas d'accès aux appels TTS payants → repli voix navigateur.
  if (u.accesRestreint) return NextResponse.json({ repli: true }, { status: 403 });
  if (!limiteDebitOk(`tts:${u.id}`, DEBIT_MAX, DEBIT_FENETRE_MS)) {
    return NextResponse.json({ repli: true }, { status: 429 });
  }
  if (!ttsConfigure()) return NextResponse.json({ repli: true }, { status: 503 });

  const corps = (await req.json().catch(() => ({}))) as { texte?: unknown };
  const texte = typeof corps.texte === "string" ? corps.texte.trim() : "";
  if (!texte) return NextResponse.json({ erreur: "Texte manquant." }, { status: 400 });

  const audio = await synthetiserVocal(texte.slice(0, TTS_MAX_CARACTERES));
  if (!audio) return NextResponse.json({ repli: true }, { status: 503 });

  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
