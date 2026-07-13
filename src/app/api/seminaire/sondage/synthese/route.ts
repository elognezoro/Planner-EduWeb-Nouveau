import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { synthetiserForum, type MessageForum } from "@/lib/ia/synthese-forum";
import { limiteDebitOk } from "@/lib/ia/limite-debit";
import { contexteFormateur, nuageDeMots, parametresValides } from "@/lib/sondage";

/**
 * Synthèse IA (formateur) des idées d'un sondage + statistiques (nuage de mots).
 * Réservé aux formateurs/admin. Garde-fous de coût STRICTS (débit, plafonds).
 * La clé Claude reste côté serveur ; les idées ne sont pas re-persistées.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MESSAGES = 80;
const MAX_CHARS_MSG = 600;
const MAX_CHARS_TOTAL = 10000;

function ipDe(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { seminaire?: unknown; activite?: unknown };
  const seminaire = typeof b.seminaire === "string" ? b.seminaire : "";
  const activite = typeof b.activite === "string" ? b.activite : "";
  if (!parametresValides(seminaire, activite)) return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });

  const { u, estFormateur } = await contexteFormateur(seminaire);
  if (!u) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!estFormateur) return NextResponse.json({ erreur: "Réservé aux formateurs du séminaire." }, { status: 403 });
  if (!limiteDebitOk(`sondage-synthese:${ipDe(req)}`, 6, 5 * 60_000)) {
    return NextResponse.json({ erreur: "Trop de synthèses. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const [ideesBrut, nuage, nbReponses] = await Promise.all([
    prisma.reponseSondage.findMany({ where: { seminaire, activite, idee: { not: null } }, select: { idee: true }, take: 200 }),
    nuageDeMots(seminaire, activite),
    prisma.reponseSondage.count({ where: { seminaire, activite, mot: { not: null } } }),
  ]);

  let cumul = 0;
  const messages: MessageForum[] = [];
  for (const r of ideesBrut) {
    if (messages.length >= MAX_MESSAGES) break;
    const t = (r.idee ?? "").trim().slice(0, MAX_CHARS_MSG);
    if (!t) continue;
    if (cumul + t.length > MAX_CHARS_TOTAL) break;
    cumul += t.length;
    messages.push({ texte: t });
  }

  const stats = { nuage, nbReponses, nbIdees: messages.length };
  if (messages.length === 0) {
    return NextResponse.json({ erreur: "Aucune idée à synthétiser pour le moment.", stats }, { status: 400 });
  }

  const question =
    "À partir des mots choisis (nuage de mots) et des idées exprimées ci-dessous par les participants, dégage la ou les idées maîtresses en quelques points clairs. Rappel du cadre : l'IA suscite à la fois enthousiasme et inquiétude ; l'enjeu est de dépasser cette opposition pour entrer dans un discernement responsable.";
  const { synthese, source } = await synthetiserForum(question, messages);
  return NextResponse.json({ synthese, source, stats });
}
