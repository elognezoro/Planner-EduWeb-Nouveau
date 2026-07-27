import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche planifiée (Vercel Cron, quotidienne) : RÉTENTION du journal d'activité.
 * La capture automatique (extension Prisma) écrit 1 ligne par écriture métier → sans purge, la
 * table journal_activite croît sans borne (cf. audit de scalabilité). On applique une rétention :
 *   - source = "auto"      → conservée 90 jours (volumineuse, faible valeur à long terme) ;
 *   - source = "securite"/"metier" → conservée 365 jours.
 * Suppression PAR LOTS (5 000) pour éviter un verrou long et le bloat ; le reste part au passage
 * suivant. Sécurité : protégé par CRON_SECRET (Vercel envoie « Authorization: Bearer <secret> »).
 */

const JOUR_MS = 86_400_000;
const RETENTION_AUTO_J = 90;
const RETENTION_LONGUE_J = 365;
const TAILLE_LOT = 5000;
const LOTS_MAX = 20; // borne par exécution (100 000 lignes max/passage)

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const autorisation = req.headers.get("authorization");
  if (secret) {
    if (autorisation !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 500 });
  }

  const maintenant = Date.now();
  const seuilAuto = new Date(maintenant - RETENTION_AUTO_J * JOUR_MS);
  const seuilLong = new Date(maintenant - RETENTION_LONGUE_J * JOUR_MS);
  const filtre = {
    OR: [
      { source: "auto", creeLe: { lt: seuilAuto } },
      { creeLe: { lt: seuilLong } }, // toute source au-delà de la rétention longue
    ],
  };

  let supprime = 0;
  try {
    for (let i = 0; i < LOTS_MAX; i++) {
      const lot = await prisma.journalActivite.findMany({ where: filtre, select: { id: true }, take: TAILLE_LOT });
      if (lot.length === 0) break;
      const r = await prisma.journalActivite.deleteMany({ where: { id: { in: lot.map((x) => x.id) } } });
      supprime += r.count;
      if (lot.length < TAILLE_LOT) break;
    }
  } catch (e) {
    console.error("[cron purge-journal] erreur :", e);
    return NextResponse.json({ ok: false, supprime }, { status: 500 });
  }

  return NextResponse.json({ ok: true, supprime });
}
