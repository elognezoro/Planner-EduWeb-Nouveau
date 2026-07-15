import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritFinEssai } from "@/lib/email/templates";
import { CONTACT_WHATSAPP, LIEN_ACADEMIE_PREMIUM } from "@/lib/premium/essai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche planifiée (Vercel Cron, quotidienne) : envoie l'e-mail AUTOMATIQUE de fin de période
 * d'essai aux comptes dont l'essai est ÉCHU et qui n'ont pas encore été notifiés
 * (`essaiFinNotifieLe` nul). Idempotent : chaque compte n'est notifié qu'une fois par essai —
 * le drapeau est réarmé (remis à null) lorsqu'un nouvel essai est fixé par l'admin.
 *
 * Sécurité : protégé par CRON_SECRET (Vercel envoie « Authorization: Bearer <CRON_SECRET> »).
 */

// Domaine public pour les liens et le flyer de l'e-mail (jamais localhost, sinon l'image casse
// dans les clients de messagerie). Priorité à la variable d'environnement, repli sur la prod.
const SITE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://planning.eduweb.ci").replace(/\/$/, "");
const LOT_MAX = 200; // borne par exécution (le reste part au prochain passage quotidien)

const dateLongue = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);

export async function GET(req: Request) {
  // Authentification de la tâche planifiée.
  const secret = process.env.CRON_SECRET;
  const autorisation = req.headers.get("authorization");
  if (secret) {
    if (autorisation !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 500 });
  }

  const maintenant = new Date();
  let concernes: { id: string; email: string; prenoms: string | null; essaiFinLe: Date | null }[];
  try {
    concernes = await prisma.utilisateur.findMany({
      where: {
        statutCompte: "actif",
        essaiFinLe: { not: null, lte: maintenant },
        essaiFinNotifieLe: null,
      },
      select: { id: true, email: true, prenoms: true, essaiFinLe: true },
      take: LOT_MAX,
    });
  } catch (e) {
    console.error("[cron fin-essai] lecture impossible :", e);
    return NextResponse.json({ error: "Base de données indisponible." }, { status: 503 });
  }

  const lienAbonnement = `${SITE}${LIEN_ACADEMIE_PREMIUM}`;
  const flyerUrl = `${SITE}/email/flyer-eduweb-planner.png`;

  let envoyes = 0;
  let echecs = 0;
  for (const u of concernes) {
    try {
      const { subject, html } = gabaritFinEssai({
        prenom: u.prenoms,
        dateFin: u.essaiFinLe ? dateLongue(u.essaiFinLe) : "",
        lienAbonnement,
        flyerUrl,
        contactWhatsapp: CONTACT_WHATSAPP,
      });
      await envoyerEmail({ to: u.email, subject, html, lienDebug: lienAbonnement });
      // Marqué notifié UNIQUEMENT après un envoi réussi (un échec sera retenté au prochain passage).
      await prisma.utilisateur.update({ where: { id: u.id }, data: { essaiFinNotifieLe: new Date() } });
      envoyes++;
    } catch (e) {
      console.error(`[cron fin-essai] échec pour ${u.email} :`, e);
      echecs++;
    }
  }

  return NextResponse.json({ examines: concernes.length, envoyes, echecs });
}
