import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * VERSION DÉPLOYÉE — route PUBLIQUE de diagnostic.
 *
 * Pourquoi elle existe : rien, dans l'application, ne permettait de savoir QUEL commit est
 * réellement servi. Deux incidents de déploiement ont été diagnostiqués à l'aveugle faute de cette
 * information (build figé sur un commit ancien, sans erreur visible). Un simple appel à cette
 * route répond désormais à la question en une seconde, sans authentification.
 *
 * Ces valeurs sont injectées par Vercel AU MOMENT DU BUILD : elles décrivent donc exactement le
 * code servi, et non l'état du dépôt.
 *
 * Aucune donnée sensible : un identifiant de commit public et une date. Rien sur la base, les
 * comptes ou les secrets.
 */
export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json(
    {
      commit: sha ? sha.slice(0, 7) : "inconnu (build local)",
      commitComplet: sha,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      branche: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environnement: process.env.VERCEL_ENV ?? "local",
      // Horodatage figé à la construction : deux appels successifs renvoient la même valeur tant
      // qu'aucun nouveau déploiement n'a eu lieu — c'est précisément ce qui rend le test probant.
      construitLe: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
