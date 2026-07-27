import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executerPasseAlertes } from "@/lib/alertes/moteur";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tâche planifiée (Vercel Cron, quotidienne) : passe d'alertes AUTOMATIQUE pour tous les
 * établissements ayant activé le canal SMS (un paramétrage existe). Le moteur calcule les
 * compteurs (absences/retards non justifiés, moyennes) et envoie les SMS aux parents des élèves
 * qui franchissent un seuil (dé-doublonné sur la journée). Protégé par CRON_SECRET.
 */
const ETAB_MAX = 500; // borne par exécution

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

  const parametrages = await prisma.parametrageAlertesSMS.findMany({
    where: { canalSms: true },
    select: { etablissementId: true },
    take: ETAB_MAX,
  });

  let etablissements = 0;
  let smsTraites = 0;
  for (const p of parametrages) {
    try {
      const r = await executerPasseAlertes(p.etablissementId, "systeme@eduweb.ci");
      smsTraites += r.smsEnvoyes + r.smsSimules;
      etablissements += 1;
    } catch (e) {
      console.error(`[cron alertes] ${p.etablissementId} :`, e);
    }
  }

  return NextResponse.json({ ok: true, etablissements, smsTraites });
}
