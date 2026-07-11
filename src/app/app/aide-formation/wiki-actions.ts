"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { sanitiserHtmlRiche } from "@/lib/html-riche";
import type { EtatLms } from "./actions";

const BASE = "/app/aide-formation";
// Bornes des entrées exposées aux apprenants (défense contre les charges démesurées).
const TITRE_MAX = 200;
const CONTENU_MAX = 100_000;
const COMMENTAIRE_MAX = 20_000;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Formateur/tuteur du cours : admin (rôle réel) ou tuteur désigné. */
async function estTuteurOuAdmin(utilisateurId: string, roleReel: string, coursId: string): Promise<boolean> {
  if (roleReel === "admin") return true;
  const t = await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId, utilisateurId } }, select: { id: true } });
  return !!t;
}

/** Accès en écriture au wiki d'un cours : apprenant inscrit à un cours PUBLIÉ, tuteur du cours ou admin. */
async function accesEcritureWiki(utilisateurId: string, roleReel: string, coursId: string): Promise<boolean> {
  if (await estTuteurOuAdmin(utilisateurId, roleReel, coursId)) return true;
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { statut: true } });
  if (cours?.statut !== "publie") return false; // pas de contribution sur un cours dépublié
  const insc = await prisma.inscriptionCours.findUnique({
    where: { utilisateurId_coursId: { utilisateurId, coursId } },
    select: { id: true },
  });
  return !!insc;
}

async function revalidupliWiki(coursId: string, pageId?: string) {
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { slug: true } });
  if (!cours) return;
  revalidatePath(`${BASE}/cours/${cours.slug}/wiki`);
  if (pageId) revalidatePath(`${BASE}/cours/${cours.slug}/wiki/${pageId}`);
}

// ── Pages ───────────────────────────────────────────────────

export async function creerPageWiki(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const coursId = str(fd, "coursId");
  const titre = str(fd, "titre");
  const contenuBrut = str(fd, "contenu");
  if (!coursId || !titre) return { ok: false, message: "Le titre de la page est obligatoire." };
  if (titre.length > TITRE_MAX) return { ok: false, message: "Titre trop long (max 200 caractères)." };
  if (contenuBrut.length > CONTENU_MAX) return { ok: false, message: "Contenu trop long (max 100 000 caractères)." };
  const contenu = sanitiserHtmlRiche(contenuBrut);
  if (!(await accesEcritureWiki(u.id, u.roleReel, coursId))) return { ok: false, message: "Inscrivez-vous au cours pour contribuer au wiki." };
  try {
    await prisma.pageWiki.create({
      data: {
        coursId, titre, contenu,
        creeParId: u.id, misAJourParId: u.id,
        revisions: { create: { contenu, auteurId: u.id } },
      },
    });
    await revalidupliWiki(coursId);
  } catch (e) {
    console.error("[wiki] création :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Page créée." };
}

export async function modifierPageWiki(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const pageId = str(fd, "pageId");
  const titre = str(fd, "titre");
  const contenuBrut = str(fd, "contenu");
  if (!pageId || !titre) return { ok: false, message: "Le titre de la page est obligatoire." };
  if (titre.length > TITRE_MAX) return { ok: false, message: "Titre trop long (max 200 caractères)." };
  if (contenuBrut.length > CONTENU_MAX) return { ok: false, message: "Contenu trop long (max 100 000 caractères)." };
  const contenu = sanitiserHtmlRiche(contenuBrut);
  const page = await prisma.pageWiki.findUnique({ where: { id: pageId }, select: { coursId: true } });
  if (!page) return { ok: false, message: "Page introuvable." };
  if (!(await accesEcritureWiki(u.id, u.roleReel, page.coursId))) return { ok: false, message: "Inscrivez-vous au cours pour contribuer au wiki." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.pageWiki.update({
        where: { id: pageId },
        data: { titre, contenu, misAJourParId: u.id, revisions: { create: { contenu, auteurId: u.id } } },
      });
      // Contribuer invalide une éventuelle évaluation « pair » de l'auteur : devenu contributeur,
      // il ne peut plus être évaluateur-pair (sinon sa note fausserait durablement la moyenne des pairs).
      await tx.evaluationWiki.deleteMany({ where: { pageId, evaluateurId: u.id, type: "pair" } });
    });
    await revalidupliWiki(page.coursId, pageId);
  } catch (e) {
    console.error("[wiki] modification :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Page enregistrée (révision ajoutée à l'historique)." };
}

export async function supprimerPageWiki(pageId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const page = await prisma.pageWiki.findUnique({ where: { id: pageId }, select: { coursId: true, creeParId: true } });
  if (!page) return { ok: false, message: "Page introuvable." };
  const autorise = page.creeParId === u.id || (await estTuteurOuAdmin(u.id, u.roleReel, page.coursId));
  if (!autorise) return { ok: false, message: "Seul l'auteur de la page, un tuteur ou l'admin peut la supprimer." };
  try {
    await prisma.pageWiki.delete({ where: { id: pageId } });
    await revalidupliWiki(page.coursId);
  } catch (e) {
    console.error("[wiki] suppression :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Page supprimée." };
}

// ── Évaluations (pairs + formateur/tuteur) ──────────────────

export async function evaluerPageWiki(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const pageId = str(fd, "pageId");
  const noteBrute = str(fd, "note");
  // Rejet explicite d'une note invalide (jamais de coercion silencieuse en 0/20).
  const n = Number(noteBrute);
  if (noteBrute !== "" && (!Number.isInteger(n) || n < 0 || n > 20)) return { ok: false, message: "La note doit être un entier entre 0 et 20." };
  const note = noteBrute === "" ? null : n;
  const commentaireBrut = str(fd, "commentaire");
  if (commentaireBrut.length > COMMENTAIRE_MAX) return { ok: false, message: "Commentaire trop long (max 20 000 caractères)." };
  const commentaire = sanitiserHtmlRiche(commentaireBrut) || null;
  if (!pageId) return { ok: false, message: "Page introuvable." };
  if (note === null && !commentaire) return { ok: false, message: "Donnez une note et/ou un commentaire." };

  const page = await prisma.pageWiki.findUnique({ where: { id: pageId }, select: { coursId: true, creeParId: true } });
  if (!page) return { ok: false, message: "Page introuvable." };

  const tuteur = await estTuteurOuAdmin(u.id, u.roleReel, page.coursId);
  if (!tuteur) {
    // Évaluation par les pairs : réservée aux inscrits, hors auteur ET hors contributeur de la page.
    if (!(await accesEcritureWiki(u.id, u.roleReel, page.coursId))) return { ok: false, message: "Inscrivez-vous au cours pour évaluer." };
    if (page.creeParId === u.id) return { ok: false, message: "Vous ne pouvez pas évaluer votre propre page." };
    const aContribue = await prisma.revisionWiki.findFirst({ where: { pageId, auteurId: u.id }, select: { id: true } });
    if (aContribue) return { ok: false, message: "Vous avez contribué à cette page : vous ne pouvez pas l'évaluer (évaluation par les pairs)." };
  }
  try {
    await prisma.evaluationWiki.upsert({
      where: { pageId_evaluateurId: { pageId, evaluateurId: u.id } },
      create: { pageId, evaluateurId: u.id, type: tuteur ? "tuteur" : "pair", note, commentaire },
      update: { type: tuteur ? "tuteur" : "pair", note, commentaire },
    });
    await revalidupliWiki(page.coursId, pageId);
  } catch (e) {
    console.error("[wiki] évaluation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: tuteur ? "Évaluation du formateur enregistrée." : "Évaluation par les pairs enregistrée." };
}
