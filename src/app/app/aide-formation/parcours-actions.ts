"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, requireUtilisateur } from "@/lib/auth/session";
import { slugifier } from "@/lib/lms";
import { recalculerInscriptionParcours, recalculerInscriptionsDuParcours } from "@/lib/lms-parcours";
import type { EtatLms } from "./actions";

const BASE = "/app/aide-formation";
const GESTION = `${BASE}/gestion/parcours`;

async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const roles = (fd: FormData): string[] => fd.getAll("publicCible").map((v) => String(v)).filter(Boolean);

async function slugUniqueParcours(base: string, exclureId: string | null): Promise<string> {
  const racine = base || "parcours";
  let slug = racine;
  let i = 2;
  while (true) {
    const existe = await prisma.parcours.findFirst({ where: { slug, ...(exclureId ? { id: { not: exclureId } } : {}) }, select: { id: true } });
    if (!existe) return slug;
    slug = `${racine}-${i++}`;
  }
}

// ── Badges ──────────────────────────────────────────────────

export async function enregistrerBadge(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const id = str(fd, "id") || null;
  const nom = str(fd, "nom");
  if (!nom) return { ok: false, message: "Le nom du badge est obligatoire." };
  const data = { nom, description: str(fd, "description") || null, icone: str(fd, "icone") || null, couleur: str(fd, "couleur") || "gold" };
  try {
    if (id) await prisma.badge.update({ where: { id }, data });
    else await prisma.badge.create({ data });
    revalidatePath(GESTION);
  } catch (e) {
    console.error("[lms] badge :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Badge enregistré." };
}

export async function supprimerBadge(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.badge.delete({ where: { id } });
    revalidatePath(GESTION);
  } catch (e) {
    console.error("[lms] suppr badge :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Badge supprimé." };
}

// ── Parcours ────────────────────────────────────────────────

export async function enregistrerParcours(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const id = str(fd, "id") || null;
  const titre = str(fd, "titre");
  if (!titre) return { ok: false, message: "Le titre du parcours est obligatoire." };
  const data = {
    titre,
    description: str(fd, "description") || null,
    niveau: str(fd, "niveau") || null,
    publicCible: roles(fd),
    badgeId: str(fd, "badgeId") || null,
  };
  try {
    if (id) {
      await prisma.parcours.update({ where: { id }, data });
    } else {
      const slug = await slugUniqueParcours(slugifier(titre), null);
      await prisma.parcours.create({ data: { ...data, slug } });
    }
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] parcours :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Parcours enregistré." };
}

export async function basculerPublicationParcours(id: string, publier: boolean): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.parcours.update({ where: { id }, data: { statut: publier ? "publie" : "brouillon" } });
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] publication parcours :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: publier ? "Parcours publié." : "Parcours dépublié." };
}

export async function supprimerParcours(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.parcours.delete({ where: { id } });
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] suppr parcours :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Parcours supprimé." };
}

// ── Étapes (cours du parcours) ──────────────────────────────

export async function ajouterEtape(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const parcoursId = str(fd, "parcoursId");
  const coursId = str(fd, "coursId");
  if (!parcoursId || !coursId) return { ok: false, message: "Cours manquant." };
  try {
    const deja = await prisma.etapeParcours.findUnique({ where: { parcoursId_coursId: { parcoursId, coursId } }, select: { id: true } });
    if (deja) return { ok: false, message: "Ce cours est déjà dans le parcours." };
    const dernier = await prisma.etapeParcours.aggregate({ where: { parcoursId }, _max: { ordre: true } });
    await prisma.etapeParcours.create({ data: { parcoursId, coursId, ordre: (dernier._max.ordre ?? -1) + 1 } });
    await recalculerInscriptionsDuParcours(parcoursId);
    revalidatePath(`${GESTION}/${parcoursId}`);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] ajout étape :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Cours ajouté au parcours." };
}

export async function retirerEtape(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const e = await prisma.etapeParcours.findUnique({ where: { id }, select: { parcoursId: true } });
    await prisma.etapeParcours.delete({ where: { id } });
    if (e) {
      await recalculerInscriptionsDuParcours(e.parcoursId);
      revalidatePath(`${GESTION}/${e.parcoursId}`);
    }
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] retrait étape :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Cours retiré." };
}

export async function deplacerEtape(id: string, sens: "haut" | "bas"): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const cur = await prisma.etapeParcours.findUnique({ where: { id }, select: { id: true, parcoursId: true, ordre: true } });
    if (!cur) return { ok: false, message: "Étape introuvable." };
    const voisin = await prisma.etapeParcours.findFirst({
      where: { parcoursId: cur.parcoursId, ordre: sens === "haut" ? { lt: cur.ordre } : { gt: cur.ordre } },
      orderBy: { ordre: sens === "haut" ? "desc" : "asc" },
      select: { id: true, ordre: true },
    });
    if (!voisin) return { ok: true };
    await prisma.$transaction([
      prisma.etapeParcours.update({ where: { id: cur.id }, data: { ordre: voisin.ordre } }),
      prisma.etapeParcours.update({ where: { id: voisin.id }, data: { ordre: cur.ordre } }),
    ]);
    revalidatePath(`${GESTION}/${cur.parcoursId}`);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] déplacer étape :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

// ── Inscription apprenant ───────────────────────────────────

export async function basculerInscriptionParcours(parcoursId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  try {
    const existante = await prisma.inscriptionParcours.findUnique({
      where: { utilisateurId_parcoursId: { utilisateurId: u.id, parcoursId } },
      select: { id: true },
    });
    if (existante) {
      await prisma.inscriptionParcours.delete({ where: { id: existante.id } });
      revalidatePath(`${BASE}/parcours`);
      return { ok: true, message: "Désinscription effectuée." };
    }
    const parcours = await prisma.parcours.findFirst({ where: { id: parcoursId, statut: "publie" }, select: { id: true } });
    if (!parcours) return { ok: false, message: "Parcours indisponible." };
    const insc = await prisma.inscriptionParcours.create({ data: { utilisateurId: u.id, parcoursId }, select: { id: true } });
    // Prend en compte les cours déjà terminés au moment de l'inscription.
    await recalculerInscriptionParcours(insc.id).catch((e) => console.error("[lms] recalcul parcours :", e));
    revalidatePath(`${BASE}/parcours`);
    return { ok: true, message: "Inscription au parcours confirmée." };
  } catch (e) {
    console.error("[lms] inscription parcours :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
