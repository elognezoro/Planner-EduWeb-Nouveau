"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { sanitiserHtmlRiche } from "@/lib/html-riche";
import { synthetiserForumCours } from "@/lib/ia/synthese-forum";
import type { EtatLms } from "./actions";

/**
 * Forum de discussion par cours : fils (sujets) + messages nominatifs + synthèse par EduWeb
 * Planner. Accès en écriture réservé aux apprenants INSCRITS (cours publié), aux tuteurs du
 * cours et à l'admin ; la synthèse et la modération (épingler/fermer/supprimer un fil) sont
 * réservées au tuteur/formateur ou à l'admin. Contenus sanitisés à l'enregistrement.
 */

const BASE = "/app/aide-formation";
const TITRE_MAX = 200;
const DESC_MAX = 5_000;
const MESSAGE_MAX = 20_000;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function estTuteurOuAdmin(utilisateurId: string, roleReel: string, coursId: string): Promise<boolean> {
  if (roleReel === "admin") return true;
  const t = await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId, utilisateurId } }, select: { id: true } });
  return !!t;
}

/** Accès en écriture au forum : apprenant inscrit à un cours PUBLIÉ, tuteur du cours ou admin. */
async function accesForum(utilisateurId: string, roleReel: string, coursId: string): Promise<boolean> {
  if (await estTuteurOuAdmin(utilisateurId, roleReel, coursId)) return true;
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { statut: true } });
  if (cours?.statut !== "publie") return false;
  const insc = await prisma.inscriptionCours.findUnique({
    where: { utilisateurId_coursId: { utilisateurId, coursId } },
    select: { id: true },
  });
  return !!insc;
}

async function revaliderForum(coursId: string, sujetId?: string) {
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { slug: true } });
  if (!cours) return;
  revalidatePath(`${BASE}/cours/${cours.slug}/forum`);
  if (sujetId) revalidatePath(`${BASE}/cours/${cours.slug}/forum/${sujetId}`);
}

// ── Fils (sujets) ────────────────────────────────────────────

export async function creerSujetForum(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const coursId = str(fd, "coursId");
  const titre = str(fd, "titre");
  const descriptionBrut = str(fd, "description");
  const premierMessageBrut = str(fd, "premierMessage");
  if (!coursId || !titre) return { ok: false, message: "Le titre du fil est obligatoire." };
  if (titre.length > TITRE_MAX) return { ok: false, message: "Titre trop long (max 200 caractères)." };
  if (descriptionBrut.length > DESC_MAX) return { ok: false, message: "Description trop longue (max 5 000 caractères)." };
  if (premierMessageBrut.length > MESSAGE_MAX) return { ok: false, message: "Message trop long (max 20 000 caractères)." };
  if (!(await accesForum(u.id, u.roleReel, coursId))) return { ok: false, message: "Inscrivez-vous au cours pour participer au forum." };
  const description = sanitiserHtmlRiche(descriptionBrut) || null;
  const premierMessage = sanitiserHtmlRiche(premierMessageBrut);
  try {
    const sujet = await prisma.sujetForum.create({
      data: {
        coursId,
        titre,
        description,
        creeParId: u.id,
        ...(premierMessage ? { messages: { create: { auteurId: u.id, contenu: premierMessage } } } : {}),
      },
      select: { id: true },
    });
    await revaliderForum(coursId, sujet.id);
    return { ok: true, message: "Fil de discussion ouvert." };
  } catch (e) {
    console.error("[forum] création sujet :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Épingler / désépingler ou fermer / rouvrir un fil (tuteur / admin). */
export async function moderationSujetForum(sujetId: string, champ: "epingle" | "ferme", valeur: boolean): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const sujet = await prisma.sujetForum.findUnique({ where: { id: sujetId }, select: { coursId: true } });
  if (!sujet) return { ok: false, message: "Fil introuvable." };
  if (!(await estTuteurOuAdmin(u.id, u.roleReel, sujet.coursId))) return { ok: false, message: "Réservé au formateur / tuteur." };
  try {
    await prisma.sujetForum.update({ where: { id: sujetId }, data: { [champ]: valeur } });
    await revaliderForum(sujet.coursId, sujetId);
    return { ok: true, message: "Fil mis à jour." };
  } catch (e) {
    console.error("[forum] modération :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerSujetForum(sujetId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const sujet = await prisma.sujetForum.findUnique({ where: { id: sujetId }, select: { coursId: true, creeParId: true } });
  if (!sujet) return { ok: false, message: "Fil introuvable." };
  const autorise = sujet.creeParId === u.id || (await estTuteurOuAdmin(u.id, u.roleReel, sujet.coursId));
  if (!autorise) return { ok: false, message: "Seul l'auteur du fil, un tuteur ou l'admin peut le supprimer." };
  try {
    await prisma.sujetForum.delete({ where: { id: sujetId } });
    await revaliderForum(sujet.coursId);
    return { ok: true, message: "Fil supprimé." };
  } catch (e) {
    console.error("[forum] suppression sujet :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Messages ─────────────────────────────────────────────────

export async function posterMessageForum(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const sujetId = str(fd, "sujetId");
  const contenuBrut = str(fd, "contenu");
  if (!sujetId || !contenuBrut) return { ok: false, message: "Votre message est vide." };
  if (contenuBrut.length > MESSAGE_MAX) return { ok: false, message: "Message trop long (max 20 000 caractères)." };
  const sujet = await prisma.sujetForum.findUnique({ where: { id: sujetId }, select: { coursId: true, ferme: true } });
  if (!sujet) return { ok: false, message: "Fil introuvable." };
  if (sujet.ferme) return { ok: false, message: "Ce fil est clos : plus de nouveaux messages." };
  if (!(await accesForum(u.id, u.roleReel, sujet.coursId))) return { ok: false, message: "Inscrivez-vous au cours pour participer au forum." };
  const contenu = sanitiserHtmlRiche(contenuBrut);
  if (!contenu) return { ok: false, message: "Votre message est vide." };
  try {
    await prisma.$transaction([
      prisma.messageForum.create({ data: { sujetId, auteurId: u.id, contenu } }),
      prisma.sujetForum.update({ where: { id: sujetId }, data: { misAJourLe: new Date() } }),
    ]);
    await revaliderForum(sujet.coursId, sujetId);
    return { ok: true, message: "Message publié." };
  } catch (e) {
    console.error("[forum] message :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function modifierMessageForum(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const messageId = str(fd, "messageId");
  const contenuBrut = str(fd, "contenu");
  if (!messageId || !contenuBrut) return { ok: false, message: "Votre message est vide." };
  if (contenuBrut.length > MESSAGE_MAX) return { ok: false, message: "Message trop long (max 20 000 caractères)." };
  const message = await prisma.messageForum.findUnique({ where: { id: messageId }, select: { auteurId: true, sujet: { select: { id: true, coursId: true } } } });
  if (!message) return { ok: false, message: "Message introuvable." };
  const autorise = message.auteurId === u.id || (await estTuteurOuAdmin(u.id, u.roleReel, message.sujet.coursId));
  if (!autorise) return { ok: false, message: "Vous ne pouvez modifier que vos propres messages." };
  const contenu = sanitiserHtmlRiche(contenuBrut);
  try {
    await prisma.messageForum.update({ where: { id: messageId }, data: { contenu } });
    await revaliderForum(message.sujet.coursId, message.sujet.id);
    return { ok: true, message: "Message modifié." };
  } catch (e) {
    console.error("[forum] modification message :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerMessageForum(messageId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const message = await prisma.messageForum.findUnique({ where: { id: messageId }, select: { auteurId: true, sujet: { select: { id: true, coursId: true } } } });
  if (!message) return { ok: false, message: "Message introuvable." };
  const autorise = message.auteurId === u.id || (await estTuteurOuAdmin(u.id, u.roleReel, message.sujet.coursId));
  if (!autorise) return { ok: false, message: "Vous ne pouvez supprimer que vos propres messages." };
  try {
    await prisma.messageForum.delete({ where: { id: messageId } });
    await revaliderForum(message.sujet.coursId, message.sujet.id);
    return { ok: true, message: "Message supprimé." };
  } catch (e) {
    console.error("[forum] suppression message :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Synthèse IA (tuteur / formateur / admin) ─────────────────

/** Génère et ENREGISTRE une synthèse des échanges d'un fil (réservée au formateur / tuteur / admin). */
export async function genererSyntheseForum(sujetId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const sujet = await prisma.sujetForum.findUnique({
    where: { id: sujetId },
    select: {
      coursId: true,
      titre: true,
      description: true,
      cours: { select: { titre: true } },
      messages: { orderBy: { creeLe: "asc" }, select: { contenu: true } },
    },
  });
  if (!sujet) return { ok: false, message: "Fil introuvable." };
  if (!(await estTuteurOuAdmin(u.id, u.roleReel, sujet.coursId))) return { ok: false, message: "Réservé au formateur / tuteur." };
  if (sujet.messages.length === 0) return { ok: false, message: "Aucun message à synthétiser dans ce fil." };
  try {
    // Le texte des messages est du HTML sanitisé : on le réduit en texte pour la synthèse.
    const messages = sujet.messages.map((m) => ({ texte: m.contenu.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }));
    const { synthese, source } = await synthetiserForumCours({
      coursTitre: sujet.cours.titre,
      sujetTitre: sujet.titre,
      sujetDescription: sujet.description,
      messages,
    });
    await prisma.syntheseForum.create({
      data: { sujetId, contenu: synthese, nbMessages: sujet.messages.length, genereeParId: u.id },
    });
    await revaliderForum(sujet.coursId, sujetId);
    return { ok: true, message: source === "ia" ? "Synthèse générée par EduWeb Planner." : "Synthèse indisponible (assistance IA absente) — repli enregistré." };
  } catch (e) {
    console.error("[forum] synthèse :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
