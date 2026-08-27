"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { estRoleValide } from "@/lib/rbac/roles";
import type { EtatLms } from "./actions";

/**
 * Lien d'inscription DIRECTE à un cours, généré par un TUTEUR du cours ou l'ADMIN et partagé aux
 * participants : quiconque l'ouvre (connecté) rejoint le cours en un clic (inscription source
 * « invitation », sans validation supplémentaire — le lien vaut autorisation du tuteur/admin).
 */

const BASE = "/app/aide-formation";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOuNull = (fd: FormData, k: string): number | null => {
  const b = str(fd, k);
  if (b === "") return null;
  const v = Number(b);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
};

async function estTuteurOuAdmin(utilisateurId: string, roleReel: string, coursId: string): Promise<boolean> {
  if (roleReel === "admin") return true;
  const t = await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId, utilisateurId } }, select: { id: true } });
  return !!t;
}

async function revaliderCours(coursId: string) {
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { slug: true } });
  if (cours) revalidatePath(`${BASE}/cours/${cours.slug}`);
}

// ── Génération / gestion des liens (tuteur du cours ou admin) ─────────────────

export async function creerInvitationCours(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const coursId = str(fd, "coursId");
  if (!coursId) return { ok: false, message: "Cours introuvable." };
  if (!(await estTuteurOuAdmin(u.id, u.roleReel, coursId))) return { ok: false, message: "Réservé au tuteur du cours ou à l'admin." };
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { statut: true } });
  if (!cours) return { ok: false, message: "Cours introuvable." };
  if (cours.statut !== "publie") return { ok: false, message: "Publiez d'abord le cours pour générer un lien d'inscription." };
  const placesMax = numOuNull(fd, "placesMax");
  const expRaw = str(fd, "expiration");
  const expiration = expRaw ? new Date(expRaw) : null;
  // Rôle visé (facultatif) : le lien scoppé transmet ce rôle à l'inscription (gestion « par rôle »).
  const roleRaw = str(fd, "roleCible");
  const roleCible = roleRaw && estRoleValide(roleRaw) ? roleRaw : null;
  try {
    await prisma.invitationCours.create({
      data: {
        coursId,
        placesMax,
        roleCible,
        expiration: expiration && !isNaN(expiration.getTime()) ? expiration : null,
        creeParId: u.id,
      },
    });
    await revaliderCours(coursId);
    return { ok: true, message: "Lien d'inscription généré." };
  } catch (e) {
    console.error("[invitation-cours] création :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function basculerInvitationCours(id: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const inv = await prisma.invitationCours.findUnique({ where: { id }, select: { actif: true, coursId: true } });
  if (!inv) return { ok: false, message: "Lien introuvable." };
  if (!(await estTuteurOuAdmin(u.id, u.roleReel, inv.coursId))) return { ok: false, message: "Réservé au tuteur du cours ou à l'admin." };
  try {
    await prisma.invitationCours.update({ where: { id }, data: { actif: !inv.actif } });
    await revaliderCours(inv.coursId);
    return { ok: true, message: inv.actif ? "Lien désactivé." : "Lien réactivé." };
  } catch (e) {
    console.error("[invitation-cours] bascule :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function regenererTokenInvitationCours(id: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const inv = await prisma.invitationCours.findUnique({ where: { id }, select: { coursId: true } });
  if (!inv) return { ok: false, message: "Lien introuvable." };
  if (!(await estTuteurOuAdmin(u.id, u.roleReel, inv.coursId))) return { ok: false, message: "Réservé au tuteur du cours ou à l'admin." };
  try {
    await prisma.invitationCours.update({ where: { id }, data: { token: randomUUID() } });
    await revaliderCours(inv.coursId);
    return { ok: true, message: "Nouveau lien généré (l'ancien ne fonctionne plus)." };
  } catch (e) {
    console.error("[invitation-cours] régénération :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerInvitationCours(id: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const inv = await prisma.invitationCours.findUnique({ where: { id }, select: { coursId: true } });
  if (!inv) return { ok: false, message: "Lien introuvable." };
  if (!(await estTuteurOuAdmin(u.id, u.roleReel, inv.coursId))) return { ok: false, message: "Réservé au tuteur du cours ou à l'admin." };
  try {
    await prisma.invitationCours.delete({ where: { id } });
    await revaliderCours(inv.coursId);
    return { ok: true, message: "Lien supprimé." };
  } catch (e) {
    console.error("[invitation-cours] suppression :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Adhésion du participant via le lien ───────────────────────────────────────

export type ResultatInvitationCours = { ok: boolean; message: string; slug?: string; dejaInscrit?: boolean };

/** Le participant ouvre le lien et rejoint le cours (inscription directe, idempotente). */
export async function rejoindreCoursParInvitation(token: string): Promise<ResultatInvitationCours> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité pour l'instant." };
  const inv = await prisma.invitationCours.findUnique({
    where: { token },
    select: { actif: true, expiration: true, placesMax: true, coursId: true, roleCible: true, cours: { select: { statut: true, slug: true } } },
  });
  if (!inv || !inv.actif) return { ok: false, message: "Lien d'inscription invalide ou désactivé." };
  if (inv.expiration && inv.expiration < new Date()) return { ok: false, message: "Ce lien d'inscription a expiré." };
  if (inv.cours.statut !== "publie") return { ok: false, message: "Ce cours n'est pas disponible à l'inscription." };

  const existante = await prisma.inscriptionCours.findUnique({
    where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: inv.coursId } },
    select: { id: true },
  });
  if (existante) return { ok: true, message: "Vous êtes déjà inscrit à ce cours.", slug: inv.cours.slug, dejaInscrit: true };

  // Plafond éventuel de places atteint via ce lien (compté sur les inscriptions « invitation »).
  if (inv.placesMax != null && inv.placesMax > 0) {
    const nb = await prisma.inscriptionCours.count({ where: { coursId: inv.coursId, source: "invitation" } });
    if (nb >= inv.placesMax) return { ok: false, message: "Le nombre de places de ce lien est atteint." };
  }
  try {
    // Le rôle du lien (roleCible) est enregistré sur l'inscription (gestion « par rôle », souple).
    await prisma.inscriptionCours.create({ data: { utilisateurId: u.id, coursId: inv.coursId, source: "invitation", roleCible: inv.roleCible } });
    revalidatePath(`${BASE}/cours/${inv.cours.slug}`);
    revalidatePath(`${BASE}/guides`);
    return { ok: true, message: "Inscription réussie — bienvenue dans le cours !", slug: inv.cours.slug };
  } catch (e) {
    console.error("[invitation-cours] adhésion :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
