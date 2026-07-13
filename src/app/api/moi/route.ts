import { NextResponse } from "next/server";
import { getUtilisateurCourant } from "@/lib/auth/session";

/**
 * Identité minimale de l'utilisateur connecté — utilisée par les pages statiques
 * (séminaires) pour pré-remplir automatiquement le nom du bénéficiaire d'un certificat.
 * Ne renvoie que le nom d'affichage (aucune donnée sensible). Vide si non connecté.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const u = await getUtilisateurCourant();
  if (!u) return NextResponse.json({});
  return NextResponse.json({
    nomComplet: u.nomComplet,
    nom: u.nom ?? undefined,
    prenoms: u.prenoms ?? undefined,
    role: u.libelleRoleActif,
  });
}
