import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { limiteDebitOk } from "@/lib/ia/limite-debit";
import { contexteFormateur, parametresProductionValides } from "@/lib/sondage";

/**
 * Productions NOMINATIVES d'un participant à une activité de séminaire (auto-évaluation,
 * QCM, atelier, engagement). GET : ma production + (si formateur) l'« espace formateur »
 * listant les productions des élèves. POST : enregistre/modifie ma production.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const nomComplet = (nom: string | null, prenoms: string | null, email: string) =>
  [nom, prenoms].filter(Boolean).join(" ").trim() || email;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seminaire = url.searchParams.get("seminaire") ?? "";
  const activite = url.searchParams.get("activite") ?? "";
  if (!parametresProductionValides(seminaire, activite)) return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });

  const { u, estFormateur } = await contexteFormateur(seminaire);

  const maProduction = u
    ? await prisma.productionSeminaire.findUnique({
        where: { seminaire_activite_utilisateurId: { seminaire, activite, utilisateurId: u.id } },
        select: { contenu: true, misAJourLe: true },
      })
    : null;

  let productions: { nom: string; role: string | null; contenu: string | null; date: string }[] | undefined;
  let nbProductions: number | undefined;
  if (estFormateur) {
    const rows = await prisma.productionSeminaire.findMany({
      where: { seminaire, activite },
      orderBy: [{ misAJourLe: "desc" }],
      take: 300,
      select: { utilisateurId: true, contenu: true, misAJourLe: true },
    });
    nbProductions = rows.length;
    const users = await prisma.utilisateur.findMany({
      where: { id: { in: rows.map((r) => r.utilisateurId) } },
      select: { id: true, nom: true, prenoms: true, email: true, roleActif: { select: { nomTechnique: true } } },
    });
    const parId = new Map(users.map((x) => [x.id, x]));
    productions = rows.map((r) => {
      const x = parId.get(r.utilisateurId);
      return {
        nom: x ? nomComplet(x.nom, x.prenoms, x.email) : "Utilisateur",
        role: x?.roleActif?.nomTechnique ?? null,
        contenu: r.contenu,
        date: r.misAJourLe.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      };
    });
  }

  return NextResponse.json({ connecte: !!u, estFormateur, maProduction: maProduction?.contenu ?? null, productions, nbProductions });
}

export async function POST(req: Request) {
  const u = await getUtilisateurCourant();
  if (!u) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  if (u.apercuActif) return NextResponse.json({ erreur: "Action indisponible en mode aperçu." }, { status: 403 });
  if (!limiteDebitOk(`production:${u.id}`, 60, 5 * 60_000)) {
    return NextResponse.json({ erreur: "Trop de soumissions. Patientez un instant." }, { status: 429 });
  }

  const b = (await req.json().catch(() => ({}))) as { seminaire?: unknown; activite?: unknown; contenu?: unknown };
  const seminaire = typeof b.seminaire === "string" ? b.seminaire : "";
  const activite = typeof b.activite === "string" ? b.activite : "";
  if (!parametresProductionValides(seminaire, activite)) return NextResponse.json({ erreur: "Paramètres invalides." }, { status: 400 });
  const contenu = typeof b.contenu === "string" ? b.contenu.slice(0, 5000) : "";
  if (!contenu.trim()) return NextResponse.json({ erreur: "Rien à enregistrer." }, { status: 400 });

  try {
    await prisma.productionSeminaire.upsert({
      where: { seminaire_activite_utilisateurId: { seminaire, activite, utilisateurId: u.id } },
      create: { seminaire, activite, utilisateurId: u.id, contenu },
      update: { contenu },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[production] enregistrement :", e);
    return NextResponse.json({ erreur: "Enregistrement impossible." }, { status: 500 });
  }
}
