import { NextResponse } from "next/server";
import { requireUtilisateur } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { genererLivretPdf } from "@/lib/lms-livret-pdf";
import type { CoursDoc } from "@/lib/lms-livret-docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

/**
 * Export PDF PAGINÉ du livret d'un cours (numéros de page « Page X / Y » sur chaque page).
 * Deux versions : apprenant (défaut) et formateur (?corrige=1, réservé admin/tuteur). Un apprenant
 * qui demande la version corrigée obtient la version sans réponses.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const u = await requireUtilisateur();
  const { slug } = await params;
  const corrigeParam = new URL(req.url).searchParams.get("corrige") === "1";

  const cours = await prisma.cours.findUnique({
    where: { slug },
    select: {
      id: true, titre: true, description: true, dureeMinutes: true, niveau: true, statut: true, estSeminaire: true, modulesGroupes: true,
      attestationSignataire: true, attestationFonction: true,
      categorie: { select: { nom: true } },
      modules: {
        orderBy: { ordre: "asc" },
        select: {
          id: true, titre: true, type: true, contenu: true, fichierNom: true, fichierUrl: true, dureeMinutes: true,
          quiz: {
            select: {
              consigne: true, mode: true, seuilReussite: true,
              questions: {
                orderBy: { ordre: "asc" },
                select: { id: true, enonce: true, type: true, points: true, explication: true, choix: { orderBy: { ordre: "asc" }, select: { id: true, texte: true, correct: true, apparie: true, ordre: true } } },
              },
            },
          },
          devoir: { select: { consigne: true, noteSur: true, dateLimite: true, accepteTexte: true, accepteFichier: true } },
        },
      },
    },
  });
  if (!cours) return NextResponse.redirect(new URL(`${BASE}/guides`, req.url));

  const estAdmin = u.roleActif === "admin" || u.roleReel === "admin";
  if (cours.statut !== "publie" && !estAdmin) return NextResponse.redirect(new URL(`${BASE}/guides`, req.url));
  if (slug.startsWith("demo-") && !estAdmin) return NextResponse.redirect(new URL(`${BASE}/guides`, req.url));

  const estTuteur = estAdmin || Boolean(
    await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId: cours.id, utilisateurId: u.id } }, select: { id: true } }),
  );
  const corrige = corrigeParam && estTuteur;

  let logo: Uint8Array | null = null;
  try {
    const res = await fetch(new URL("/logo.png", req.url));
    if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
  } catch {
    /* logo indisponible : le document est généré sans blason */
  }

  const pdf = await genererLivretPdf({ cours: cours as CoursDoc, corrige, logo });
  const nom = `livret-${slug}-${corrige ? "formateur" : "apprenant"}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "no-store",
    },
  });
}
