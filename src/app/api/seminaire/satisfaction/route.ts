import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

/**
 * Enregistrement d'une réponse ANONYME à l'enquête de satisfaction de fin de séminaire.
 * Point d'API PUBLIC (les séminaires sont en accès libre) → garde-fous stricts :
 * limite de débit par IP, validation/bornage des notes, troncature des champs libres.
 * Aucune donnée nominative n'est demandée ni stockée.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBIT_MAX = 4; // 4 soumissions / 10 min / IP
const DEBIT_FENETRE_MS = 10 * 60_000;
const SEMINAIRES = new Set(["magnifica-humanitas", "communication-pastorale", "ia-communication-pastorale"]);

function ipDe(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
}

/** Note entière bornée [min, max], sinon null. */
function note(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Texte libre nettoyé et tronqué, sinon null. */
function texte(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

export async function POST(req: Request) {
  if (!limiteDebitOk(`satisfaction:${ipDe(req)}`, DEBIT_MAX, DEBIT_FENETRE_MS)) {
    return NextResponse.json({ erreur: "Trop de soumissions. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const seminaireBrut = typeof b.seminaire === "string" ? b.seminaire : "magnifica-humanitas";
  const seminaire = SEMINAIRES.has(seminaireBrut) ? seminaireBrut : "magnifica-humanitas";

  const data = {
    seminaire,
    appreciationGlobale: note(b.appreciationGlobale, 1, 5),
    contenuClair: note(b.contenuClair, 1, 5),
    contenuPertinent: note(b.contenuPertinent, 1, 5),
    activitesUtiles: note(b.activitesUtiles, 1, 5),
    rythmeAdapte: note(b.rythmeAdapte, 1, 5),
    navigationAisee: note(b.navigationAisee, 1, 5),
    applicationConcrete: note(b.applicationConcrete, 1, 5),
    usageResponsable: note(b.usageResponsable, 1, 5),
    recommandation: note(b.recommandation, 0, 10),
    pointsForts: texte(b.pointsForts),
    pointsAmeliorer: texte(b.pointsAmeliorer),
    suggestions: texte(b.suggestions),
    role: texte(b.role, 80),
    pays: texte(b.pays, 80),
  };

  // Refuse une soumission entièrement vide (aucune note, aucun texte).
  const auMoinsUneReponse =
    data.appreciationGlobale !== null ||
    data.recommandation !== null ||
    [data.contenuClair, data.contenuPertinent, data.activitesUtiles, data.rythmeAdapte, data.navigationAisee, data.applicationConcrete, data.usageResponsable].some((n) => n !== null) ||
    [data.pointsForts, data.pointsAmeliorer, data.suggestions].some((t) => t !== null);
  if (!auMoinsUneReponse) {
    return NextResponse.json({ erreur: "Merci de renseigner au moins une réponse." }, { status: 400 });
  }

  try {
    await prisma.enqueteSatisfaction.create({ data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[satisfaction] enregistrement échoué :", e);
    return NextResponse.json({ erreur: "Enregistrement impossible pour le moment." }, { status: 500 });
  }
}
