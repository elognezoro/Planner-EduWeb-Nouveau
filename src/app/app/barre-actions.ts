"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

// Préférences de la barre supérieure. Noms de cookies : « eduweb_pays » / « eduweb_annee »
// (lus aussi par src/app/app/layout.tsx — garder synchronisés).
const UN_AN = 60 * 60 * 24 * 365;

/** Pays consulté (préférence d'affichage, persistée un an). */
export async function changerPays(formData: FormData) {
  const pays = String(formData.get("pays") ?? "").trim().slice(0, 60);
  if (!pays) return;
  const store = await cookies();
  store.set("eduweb_pays", pays, { sameSite: "lax", path: "/", maxAge: UN_AN });
  revalidatePath("/app", "layout");
}

/** Année scolaire consultée (préférence d'affichage). */
export async function changerAnnee(formData: FormData) {
  const annee = String(formData.get("annee") ?? "").trim().slice(0, 30);
  if (!annee) return;
  const store = await cookies();
  store.set("eduweb_annee", annee, { sameSite: "lax", path: "/", maxAge: UN_AN });
  revalidatePath("/app", "layout");
}

/** Langue d'affichage du compte (persistée sur le profil utilisateur). */
export async function changerLangue(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return;
  const langue = String(formData.get("langue") ?? "");
  if (!["fr", "en"].includes(langue)) return;
  try {
    await prisma.utilisateur.update({ where: { id: u.id }, data: { langue } });
    revalidatePath("/app", "layout");
  } catch (e) {
    console.error("[barre/langue] erreur :", e);
  }
}
