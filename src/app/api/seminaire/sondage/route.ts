import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { limiteDebitOk } from "@/lib/ia/limite-debit";
import { contexteFormateur, nuageDeMots, parametresValides } from "@/lib/sondage";

/**
 * Activité de sondage d'un séminaire (nuage de mots + idées), réponses NOMINATIVES.
 * GET : état pour l'utilisateur courant (sa réponse, partage, nuage si autorisé).
 * POST : enregistre/modifie sa réponse (mot et/ou idée).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seminaire = url.searchParams.get("seminaire") ?? "";
  const activite = url.searchParams.get("activite") ?? "";
  if (!parametresValides(seminaire, activite)) return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });

  const { u, estFormateur } = await contexteFormateur(seminaire);
  const etat = await prisma.etatSondage.findUnique({ where: { seminaire_activite: { seminaire, activite } } });
  const nuagePartage = etat?.nuagePartage ?? false;
  const ideesOuvertes = etat?.ideesOuvertes ?? false;

  const maReponse = u
    ? await prisma.reponseSondage.findUnique({
        where: { seminaire_activite_utilisateurId: { seminaire, activite, utilisateurId: u.id } },
        select: { mot: true, idee: true },
      })
    : null;

  const nbReponses = await prisma.reponseSondage.count({ where: { seminaire, activite, mot: { not: null } } });
  const voirNuage = estFormateur || nuagePartage;
  const nuage = voirNuage ? await nuageDeMots(seminaire, activite) : null;
  const nbIdees = estFormateur ? await prisma.reponseSondage.count({ where: { seminaire, activite, idee: { not: null } } }) : undefined;

  return NextResponse.json({
    connecte: !!u,
    estFormateur,
    maReponse: maReponse ?? null,
    nuagePartage,
    ideesOuvertes,
    nuage,
    nbReponses,
    nbIdees,
  });
}

export async function POST(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Connexion requise pour répondre." }, { status: 401 });
  if (u.apercuActif) return NextResponse.json({ erreur: "Action indisponible en mode aperçu." }, { status: 403 });
  if (!limiteDebitOk(`sondage:${u.id}`, 40, 5 * 60_000)) {
    return NextResponse.json({ erreur: "Trop de soumissions. Patientez un instant." }, { status: 429 });
  }

  const b = (await req.json().catch(() => ({}))) as { seminaire?: unknown; activite?: unknown; mot?: unknown; idee?: unknown };
  const seminaire = typeof b.seminaire === "string" ? b.seminaire : "";
  const activite = typeof b.activite === "string" ? b.activite : "";
  if (!parametresValides(seminaire, activite)) return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });

  const patch: { mot?: string; idee?: string } = {};
  if (typeof b.mot === "string") {
    const mot = b.mot.trim().slice(0, 60);
    if (mot) patch.mot = mot;
  }
  if (typeof b.idee === "string") {
    // Une idée ne peut être soumise que si la collecte est ouverte par le formateur.
    const etat = await prisma.etatSondage.findUnique({ where: { seminaire_activite: { seminaire, activite } }, select: { ideesOuvertes: true } });
    if (!etat?.ideesOuvertes) return NextResponse.json({ erreur: "La collecte d'idées n'est pas ouverte." }, { status: 403 });
    const idee = b.idee.trim().slice(0, 600);
    if (idee) patch.idee = idee;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ erreur: "Rien à enregistrer." }, { status: 400 });

  try {
    await prisma.reponseSondage.upsert({
      where: { seminaire_activite_utilisateurId: { seminaire, activite, utilisateurId: u.id } },
      create: { seminaire, activite, utilisateurId: u.id, ...patch },
      update: patch,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sondage] enregistrement :", e);
    return NextResponse.json({ erreur: "Enregistrement impossible." }, { status: 500 });
  }
}
