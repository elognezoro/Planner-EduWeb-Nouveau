"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

const PAGE = "/app/systeme/departements";

export type EtatDep = { ok: boolean; message?: string };

/** Garde : administrateur système, hors mode aperçu. */
async function gardeAdmin(): Promise<EtatDep | null> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return null;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string): number => {
  const n = parseInt(str(fd, k), 10);
  return Number.isFinite(n) ? n : 0;
};

const CATEGORIES = ["produit", "pedagogie", "support", "pilotage", "general"];
const COULEURS = ["forest", "gold"];

/** Crée ou met à jour un département (useActionState). */
export async function enregistrerDepartement(_prev: EtatDep, fd: FormData): Promise<EtatDep> {
  const refus = await gardeAdmin();
  if (refus) return refus;

  const id = str(fd, "id");
  const nom = str(fd, "nom");
  if (!nom) return { ok: false, message: "Le nom du département est obligatoire." };

  const categorie = CATEGORIES.includes(str(fd, "categorie")) ? str(fd, "categorie") : "general";
  const couleur = COULEURS.includes(str(fd, "couleur")) ? str(fd, "couleur") : "forest";
  const data = {
    nom: nom.slice(0, 120),
    description: str(fd, "description").slice(0, 400) || null,
    categorie,
    icone: str(fd, "icone").slice(0, 60) || null,
    couleur,
    ordre: num(fd, "ordre"),
    actif: str(fd, "actif") !== "off",
  };

  try {
    if (id) await prisma.departement.update({ where: { id }, data });
    else await prisma.departement.create({ data });
    revalidatePath(PAGE);
    revalidatePath("/");
  } catch (e) {
    console.error("[departements] enregistrement :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: id ? "Département mis à jour." : "Département ajouté." };
}

/** Supprime un département. */
export async function supprimerDepartement(id: string): Promise<EtatDep> {
  const refus = await gardeAdmin();
  if (refus) return refus;
  try {
    await prisma.departement.delete({ where: { id } });
    revalidatePath(PAGE);
    revalidatePath("/");
  } catch (e) {
    console.error("[departements] suppression :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Département supprimé." };
}

/** Active / désactive l'affichage d'un département sur la page d'accueil. */
export async function basculerActifDepartement(id: string, actif: boolean): Promise<EtatDep> {
  const refus = await gardeAdmin();
  if (refus) return refus;
  try {
    await prisma.departement.update({ where: { id }, data: { actif } });
    revalidatePath(PAGE);
    revalidatePath("/");
  } catch (e) {
    console.error("[departements] bascule :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}
