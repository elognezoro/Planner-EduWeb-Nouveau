import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Trafic du site — alimente le widget « temps réel » de la page d'accueil.
 * POST : enregistre une visite (appelé une fois par session de navigation).
 * GET  : statistiques agrégées (compteur total, visiteurs actifs, série 24 h).
 * Données strictement anonymes : aucun identifiant, aucune IP — uniquement des compteurs.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const corps = (await req.json().catch(() => ({}))) as { chemin?: unknown };
    const chemin = typeof corps.chemin === "string" ? corps.chemin.slice(0, 120) : null;
    await prisma.visiteSite.create({ data: { type: "visite", chemin } });
  } catch (e) {
    console.error("[visites] enregistrement impossible :", e);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    const maintenant = Date.now();
    const il24h = new Date(maintenant - 24 * 3600 * 1000);
    const il5min = new Date(maintenant - 5 * 60 * 1000);

    const [totalVisites, totalConnexions, actifs, recents] = await Promise.all([
      prisma.visiteSite.count({ where: { type: "visite" } }),
      prisma.visiteSite.count({ where: { type: "connexion" } }),
      prisma.visiteSite.count({ where: { type: "visite", creeLe: { gte: il5min } } }),
      prisma.visiteSite.findMany({
        where: { creeLe: { gte: il24h } },
        select: { type: true, creeLe: true },
      }),
    ]);

    // Série des 24 dernières heures, un seau par heure (libellé « 14h », « 15h »…).
    const serie: { heure: string; visites: number; connexions: number }[] = [];
    for (let h = 23; h >= 0; h--) {
      const debut = maintenant - (h + 1) * 3600 * 1000;
      const fin = maintenant - h * 3600 * 1000;
      const duSeau = recents.filter((r) => {
        const t = r.creeLe.getTime();
        return t >= debut && t < fin;
      });
      serie.push({
        heure: `${new Date(fin).getHours()}h`,
        visites: duSeau.filter((r) => r.type === "visite").length,
        connexions: duSeau.filter((r) => r.type === "connexion").length,
      });
    }

    return NextResponse.json(
      { totalVisites, totalConnexions, actifs, serie },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[visites] statistiques indisponibles :", e);
    return NextResponse.json({ totalVisites: 0, totalConnexions: 0, actifs: 0, serie: [] }, { status: 200 });
  }
}
