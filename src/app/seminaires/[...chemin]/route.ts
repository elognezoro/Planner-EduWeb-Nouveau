import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { avecRetour } from "@/lib/auth/retour";
import { cheminSeminaireSur, coursSlugPourChemin, typeMimeSeminaire } from "@/lib/seminaires-contenu";

/**
 * Sert le contenu des séminaires « figés » (pages interactives autonomes) SOUS CONDITION
 * D'INSCRIPTION. Ces fichiers vivent sous `content/seminaires/` (hors `public/`, donc jamais
 * servis directement par le CDN). Règle d'accès identique au lecteur LMS :
 * autorisé = administrateur OU tuteur du cours OU inscrit au cours-miroir.
 *  - visiteur anonyme        → connexion (retour vers la fiche LMS du séminaire) ;
 *  - connecté mais non inscrit → fiche LMS « Formation réservée aux inscrits » ;
 *  - inscrit / admin / tuteur → le fichier est servi.
 * Les guides d'utilisateurs ne passent PAS par ici (ils restent librement consultables).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RACINE = join(process.cwd(), "content", "seminaires");

export async function GET(req: Request, ctx: { params: Promise<{ chemin: string[] }> }) {
  const { chemin } = await ctx.params;
  const rel = cheminSeminaireSur(chemin ?? []);
  if (!rel) return new NextResponse("Introuvable", { status: 404 });

  const coursSlug = coursSlugPourChemin(rel);
  if (!coursSlug) return new NextResponse("Introuvable", { status: 404 });

  const ficheLms = `/app/aide-formation/cours/${coursSlug}`;

  // 1) Authentification.
  const u = await getUtilisateurCourant();
  if (!u) {
    return NextResponse.redirect(new URL(avecRetour("/connexion", ficheLms), req.url));
  }

  // 2) Inscription (mêmes règles que le lecteur LMS).
  const cours = await prisma.cours.findUnique({ where: { slug: coursSlug }, select: { id: true, estGuide: true } });
  if (!cours) {
    // Cours-miroir absent : aucun moyen de s'inscrire → on renvoie au catalogue.
    return NextResponse.redirect(new URL("/app/aide-formation/formations", req.url));
  }
  const estAdmin = u.roleActif === "admin";
  let autorise = estAdmin || cours.estGuide;
  if (!autorise) {
    const [inscrit, tuteur] = await Promise.all([
      prisma.inscriptionCours.findUnique({
        where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: cours.id } },
        select: { id: true },
      }),
      prisma.tuteurCours.findUnique({
        where: { coursId_utilisateurId: { coursId: cours.id, utilisateurId: u.id } },
        select: { id: true },
      }),
    ]);
    autorise = Boolean(inscrit) || Boolean(tuteur);
  }
  if (!autorise) {
    return NextResponse.redirect(new URL(ficheLms, req.url));
  }

  // 3) Lecture du fichier (protégée contre la remontée de répertoire).
  const chemComplet = normalize(join(RACINE, rel));
  if (chemComplet !== RACINE && !chemComplet.startsWith(RACINE + sep)) {
    return new NextResponse("Introuvable", { status: 404 });
  }
  try {
    const data = await readFile(chemComplet);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "content-type": typeMimeSeminaire(rel),
        "cache-control": "private, no-store, max-age=0",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch {
    return new NextResponse("Introuvable", { status: 404 });
  }
}
