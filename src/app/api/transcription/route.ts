import { NextResponse } from "next/server";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { transcrireAudio, transcriptionConfiguree, TRANSCRIPTION_MAX_OCTETS } from "@/lib/ia/transcription";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

/**
 * Dictée vocale : reçoit un enregistrement audio (corps brut) et renvoie sa transcription.
 * Réservé aux comptes pleinement habilités ; limité en débit (maîtrise du coût).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBIT_MAX = 20;
const DEBIT_FENETRE_MS = 60_000;

export async function POST(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Non authentifié." }, { status: 401 });
  if (u.accesRestreint) return NextResponse.json({ repli: true }, { status: 403 });
  if (!limiteDebitOk(`stt:${u.id}`, DEBIT_MAX, DEBIT_FENETRE_MS)) return NextResponse.json({ repli: true }, { status: 429 });
  if (!transcriptionConfiguree()) return NextResponse.json({ repli: true }, { status: 503 });

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) return NextResponse.json({ erreur: "Audio manquant." }, { status: 400 });
  if (audio.byteLength > TRANSCRIPTION_MAX_OCTETS) return NextResponse.json({ erreur: "Enregistrement trop volumineux." }, { status: 413 });

  const type = req.headers.get("content-type") || "audio/webm";
  const texte = await transcrireAudio(audio, type);
  if (texte == null) return NextResponse.json({ repli: true }, { status: 503 });
  return NextResponse.json({ texte });
}
