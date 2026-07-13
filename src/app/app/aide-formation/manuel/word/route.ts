import { getUtilisateurCourant } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { chargerManuel } from "@/lib/manuel/donnees";
import { construireManuelHtml } from "@/lib/manuel/html";
import { contexteManuel } from "@/lib/manuel/contexte";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Téléchargement du manuel au format Word (document HTML compatible Word, généré à la volée). */
export async function GET(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return new Response("Connexion requise.", { status: 401 });
  const origin = new URL(req.url).origin;
  const dbu = await prisma.utilisateur.findUnique({ where: { id: u.id }, select: { pays: true } });
  const data = await chargerManuel();
  const ctx = contexteManuel(origin, dbu?.pays ?? null);
  const html = construireManuelHtml(data, ctx, { pourWord: true });
  return new Response(html, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="Manuel-Formation-EduWeb-${data.reference}.doc"`,
    },
  });
}
