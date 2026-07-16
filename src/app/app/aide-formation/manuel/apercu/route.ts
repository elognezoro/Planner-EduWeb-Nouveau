import { getUtilisateurCourant } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { chargerManuel } from "@/lib/manuel/donnees";
import { construireManuelHtml } from "@/lib/manuel/html";
import { contexteManuel } from "@/lib/manuel/contexte";
import { estFormateurDesigne } from "@/lib/manuel/formateurs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Rendu HTML autonome du manuel du formateur (iframe) — formateurs désignés uniquement. */
export async function GET(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return new Response("Connexion requise.", { status: 401 });
  if (!(await estFormateurDesigne(u))) {
    return new Response("Document réservé aux formateurs désignés.", { status: 403 });
  }
  const origin = new URL(req.url).origin;
  const dbu = await prisma.utilisateur.findUnique({ where: { id: u.id }, select: { pays: true } });
  const data = await chargerManuel();
  const ctx = contexteManuel(origin, dbu?.pays ?? null);
  const html = construireManuelHtml(data, ctx, { autoImpression: false });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
