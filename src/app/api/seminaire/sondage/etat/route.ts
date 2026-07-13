import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contexteFormateur, parametresValides } from "@/lib/sondage";

/** Pilotage par le formateur : partage du nuage aux élèves / ouverture de la collecte d'idées. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { seminaire?: unknown; activite?: unknown; nuagePartage?: unknown; ideesOuvertes?: unknown };
  const seminaire = typeof b.seminaire === "string" ? b.seminaire : "";
  const activite = typeof b.activite === "string" ? b.activite : "";
  if (!parametresValides(seminaire, activite)) return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });

  const { u, estFormateur } = await contexteFormateur(seminaire);
  if (!u) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!estFormateur) return NextResponse.json({ erreur: "Réservé aux formateurs du séminaire." }, { status: 403 });

  const data: { nuagePartage?: boolean; ideesOuvertes?: boolean } = {};
  if (typeof b.nuagePartage === "boolean") data.nuagePartage = b.nuagePartage;
  if (typeof b.ideesOuvertes === "boolean") data.ideesOuvertes = b.ideesOuvertes;
  if (Object.keys(data).length === 0) return NextResponse.json({ erreur: "Rien à modifier." }, { status: 400 });

  try {
    const etat = await prisma.etatSondage.upsert({
      where: { seminaire_activite: { seminaire, activite } },
      create: { seminaire, activite, ...data },
      update: data,
    });
    return NextResponse.json({ ok: true, nuagePartage: etat.nuagePartage, ideesOuvertes: etat.ideesOuvertes });
  } catch (e) {
    console.error("[sondage] état :", e);
    return NextResponse.json({ erreur: "Enregistrement impossible." }, { status: 500 });
  }
}
