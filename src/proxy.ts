import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

/**
 * Proxy d'authentification (ex-"middleware", convention Next 16 — runtime edge).
 * Instance NextAuth construite UNIQUEMENT sur la config edge-safe (sans Prisma ni bcrypt).
 * Le contrôle fin par rôle/périmètre est réalisé côté serveur dans la mise en page de /app
 * et sur chaque page sensible.
 *
 * Il transmet aussi le chemin demandé via l'en-tête `x-pathname`, afin que la garde
 * centrale de /app (matrice des droits dynamique) sache quel module est visé.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const entetes = new Headers(req.headers);
  entetes.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: entetes } });
});

export const config = {
  // Exécute le proxy partout sauf assets statiques, images Next et API auth.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
