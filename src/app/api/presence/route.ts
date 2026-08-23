import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Balise de PRÉSENCE (navigation) : enregistre la page touchée par l'utilisateur connecté
 * (une ligne par changement de route, chemin SANS paramètres de requête) et rafraîchit son
 * dernier accès — alimente « Utilisateurs connectés » (liste + détail par utilisateur).
 *
 * Écritures BRUTES ($executeRaw) : hors extension d'audit — la navigation n'est pas une
 * « action » du journal d'activité RGPD, elle a sa propre table purgée à 13 mois.
 * L'identité vient de la SESSION (jamais du corps) et c'est toujours l'utilisateur RÉEL
 * (l'aperçu/l'assistance n'existent qu'après résolution complète, jamais dans le JWT).
 * Réponse toujours 204 : sendBeacon n'attend rien, un échec ne doit jamais gêner la navigation.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const id = session?.user?.id;
    if (!id) return new NextResponse(null, { status: 204 });

    let chemin = "";
    try {
      const corps = (await req.json()) as { chemin?: unknown };
      chemin = typeof corps.chemin === "string" ? corps.chemin : "";
    } catch {
      /* corps absent ou malformé : ignoré */
    }
    // Chemin nettoyé : espace /app uniquement, sans requête ni ancre, borné — jamais de
    // donnée personnelle en URL (règle projet), et rien d'autre n'a d'intérêt ici.
    chemin = chemin.split("?")[0].split("#")[0];
    if (!chemin.startsWith("/app") || chemin.length > 300) {
      return new NextResponse(null, { status: 204 });
    }

    const idLigne = crypto.randomUUID();
    await prisma.$executeRaw`INSERT INTO "acces_pages" ("id", "utilisateurId", "chemin") VALUES (${idLigne}, ${id}, ${chemin})`;
    await prisma.$executeRaw`UPDATE "utilisateurs" SET "dernierAccesLe" = NOW() WHERE "id" = ${id}`;
  } catch {
    /* jamais d'erreur propagée : la présence est un signal best-effort */
  }
  return new NextResponse(null, { status: 204 });
}
