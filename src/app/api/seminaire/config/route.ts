import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limiteDebitOk } from "@/lib/ia/limite-debit";
import { SLUGS_SEMINAIRES } from "@/lib/seminaires";

/**
 * Configuration PUBLIQUE d'un séminaire (les pages de séminaire sont en accès libre) :
 * couverture + paramétrage du certificat (logo, formateur, signataire, QR, modèle…).
 * Alimente le pré-remplissage du certificat côté client et l'affichage des couvertures.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBIT_MAX = 30; // 30 requêtes / 5 min / IP (lecture)
const DEBIT_FENETRE_MS = 5 * 60_000;

function ipDe(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
}

export async function GET(req: Request) {
  if (!limiteDebitOk(`seminaire-config:${ipDe(req)}`, DEBIT_MAX, DEBIT_FENETRE_MS)) {
    return NextResponse.json({ erreur: "Trop de requêtes." }, { status: 429 });
  }
  const slug = new URL(req.url).searchParams.get("seminaire") ?? "";
  if (!SLUGS_SEMINAIRES.has(slug)) return NextResponse.json({}, { status: 200 });

  const c = await prisma.configSeminaire.findUnique({ where: { slug } });
  if (!c) return NextResponse.json({}, { status: 200 });

  // Renvoie uniquement les champs utiles au client (nom de champ « qrImage » attendu par le certificat).
  return NextResponse.json({
    organisation: c.organisation ?? undefined,
    couvertureUrl: c.couvertureUrl ?? undefined,
    logoUrl: c.logoUrl ?? undefined,
    formateur: c.formateur ?? undefined,
    directeur: c.directeur ?? undefined,
    directeurFonction: c.directeurFonction ?? undefined,
    signatureUrl: c.signatureUrl ?? undefined,
    cachetUrl: c.cachetUrl ?? undefined,
    qrImage: c.qrImageUrl ?? undefined,
    dateSignature: c.dateSignature ?? undefined,
    certificatModele: c.certificatModele ?? undefined,
    lieu: c.lieu ?? undefined,
  });
}
