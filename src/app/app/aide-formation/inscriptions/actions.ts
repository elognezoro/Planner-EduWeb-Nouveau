"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export type EtatInscription = { ok: boolean; message?: string };

const BASE = "/app/aide-formation";
const PAGE = `${BASE}/inscriptions`;

/** Garde : admin système, hors mode aperçu (écriture réservée). */
async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}

/** Inscrit nominativement un utilisateur à un cours (admin). Idempotent. */
export async function inscrireUtilisateurCours(coursId: string, utilisateurId: string): Promise<EtatInscription> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  if (!coursId || !utilisateurId) return { ok: false, message: "Paramètres manquants." };
  const [cours, util] = await Promise.all([
    prisma.cours.findUnique({ where: { id: coursId }, select: { id: true } }),
    prisma.utilisateur.findUnique({ where: { id: utilisateurId }, select: { id: true } }),
  ]);
  if (!cours) return { ok: false, message: "Cours introuvable." };
  if (!util) return { ok: false, message: "Utilisateur introuvable." };
  try {
    await prisma.inscriptionCours.upsert({
      where: { utilisateurId_coursId: { utilisateurId, coursId } },
      create: { utilisateurId, coursId, source: "nominative" },
      update: { derniereActivite: new Date() }, // déjà inscrit : ne change pas la source
    });
    revalidatePath(PAGE);
  } catch (e) {
    console.error("[inscriptions] inscrire :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Utilisateur inscrit." };
}

/** Désinscrit un utilisateur d'un cours (admin). Supprime aussi ses progressions (cascade). */
export async function desinscrireUtilisateurCours(coursId: string, utilisateurId: string): Promise<EtatInscription> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  if (!coursId || !utilisateurId) return { ok: false, message: "Paramètres manquants." };
  try {
    await prisma.inscriptionCours.deleteMany({ where: { coursId, utilisateurId } });
    revalidatePath(PAGE);
  } catch (e) {
    console.error("[inscriptions] désinscrire :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Utilisateur désinscrit." };
}
