import { NextResponse } from "next/server";
import { synthetiserForum, type MessageForum } from "@/lib/ia/synthese-forum";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

/**
 * Synthèse IA des contributions d'un forum de séminaire.
 * Point d'API PUBLIC (les séminaires sont en accès libre) → garde-fous de coût STRICTS :
 * limite de débit par IP, plafond de messages et de caractères. La clé Claude reste
 * exclusivement côté serveur. Aucune donnée n'est persistée.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBIT_MAX = 6; // 6 synthèses / 5 min / IP
const DEBIT_FENETRE_MS = 5 * 60_000;
const MAX_MESSAGES = 60;
const MAX_CHARS_MSG = 1000;
const MAX_CHARS_TOTAL = 8000;

function ipDe(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
}

export async function POST(req: Request) {
  if (!limiteDebitOk(`synthese-forum:${ipDe(req)}`, DEBIT_MAX, DEBIT_FENETRE_MS)) {
    return NextResponse.json({ erreur: "Trop de demandes de synthèse. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const corps = (await req.json().catch(() => ({}))) as { question?: unknown; messages?: unknown };
  const question = typeof corps.question === "string" ? corps.question.trim().slice(0, 500) : "";
  const brut = Array.isArray(corps.messages) ? corps.messages : [];

  let cumul = 0;
  const messages: MessageForum[] = [];
  for (const m of brut) {
    if (messages.length >= MAX_MESSAGES) break;
    const texte = m && typeof (m as { texte?: unknown }).texte === "string" ? (m as { texte: string }).texte.trim().slice(0, MAX_CHARS_MSG) : "";
    if (!texte) continue;
    if (cumul + texte.length > MAX_CHARS_TOTAL) break;
    cumul += texte.length;
    messages.push({ texte });
  }

  if (messages.length === 0) {
    return NextResponse.json({ erreur: "Aucun message à synthétiser." }, { status: 400 });
  }

  const { synthese, source } = await synthetiserForum(question, messages);
  return NextResponse.json({ synthese, source });
}
