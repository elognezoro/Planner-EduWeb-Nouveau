"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { SLUGS_SEMINAIRES, IMAGES_SEMINAIRE, type TypeImageSeminaire } from "@/lib/seminaires";

export type EtatConfig = { ok: boolean; message?: string };

const BASE = "/app/aide-formation";
const TAILLE_MAX = 4 * 1024 * 1024; // 4 Mo

async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Enregistre les champs texte de configuration d'un séminaire (upsert par slug). */
export async function enregistrerConfigSeminaire(_prev: EtatConfig, fd: FormData): Promise<EtatConfig> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const slug = s(fd, "slug");
  if (!SLUGS_SEMINAIRES.has(slug)) return { ok: false, message: "Séminaire inconnu." };
  // Formateurs habilités : liste d'e-mails (séparés par virgule / point-virgule / retour ligne).
  const formateurs = s(fd, "formateurs")
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const data = {
    formateurs: Array.from(new Set(formateurs)),
    organisation: s(fd, "organisation") || null,
    formateur: s(fd, "formateur") || null,
    directeur: s(fd, "directeur") || null,
    directeurFonction: s(fd, "directeurFonction") || null,
    dateSignature: s(fd, "dateSignature") || null,
    lieu: s(fd, "lieu") || null,
    certificatModele: s(fd, "certificatModele") || null,
  };
  try {
    await prisma.configSeminaire.upsert({ where: { slug }, create: { slug, ...data }, update: data });
    revalidatePath(`${BASE}/seminaires`);
    revalidatePath(`${BASE}/formations`);
  } catch (e) {
    console.error("[config-seminaire] enregistrer :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Paramétrage enregistré." };
}

/** Téléverse une image (couverture / logo / signature / cachet / QR) d'un séminaire. */
export async function televerserImageSeminaire(_prev: EtatConfig, fd: FormData): Promise<EtatConfig> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const slug = s(fd, "slug");
  const type = s(fd, "type") as TypeImageSeminaire;
  if (!SLUGS_SEMINAIRES.has(slug)) return { ok: false, message: "Séminaire inconnu." };
  const champ = IMAGES_SEMINAIRE[type];
  if (!champ) return { ok: false, message: "Type d'image inconnu." };
  const fichier = fd.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Aucun fichier." };
  if (!fichier.type.startsWith("image/")) return { ok: false, message: "Déposez une image (PNG, JPG, SVG…)." };
  if (fichier.size > TAILLE_MAX) return { ok: false, message: "Image trop volumineuse (max 4 Mo)." };
  try {
    // Garantit l'existence de la ligne, puis lit l'ancienne image pour nettoyer le Blob.
    await prisma.configSeminaire.upsert({ where: { slug }, create: { slug }, update: {} });
    const actuel = await prisma.configSeminaire.findUnique({ where: { slug } });
    const ancienne = actuel ? actuel[champ] : null;
    const ext = (fichier.name.split(".").pop() || "png").toLowerCase();
    const blob = await put(`seminaires/${slug}/${type}-${Date.now()}.${ext}`, fichier, { access: "public", addRandomSuffix: true });
    await prisma.configSeminaire.update({ where: { slug }, data: { [champ]: blob.url } });
    if (ancienne) await del(ancienne).catch(() => {});
    revalidatePath(`${BASE}/seminaires`);
    revalidatePath(`${BASE}/formations`);
  } catch (e) {
    console.error("[config-seminaire] image :", e);
    return { ok: false, message: "Échec du téléversement." };
  }
  return { ok: true, message: "Image enregistrée." };
}

/** Retire une image d'un séminaire (efface le champ + supprime le Blob). */
export async function supprimerImageSeminaire(fd: FormData): Promise<void> {
  const g = await gardeAdmin();
  if (!g.ok) return;
  const slug = s(fd, "slug");
  const type = s(fd, "type") as TypeImageSeminaire;
  if (!SLUGS_SEMINAIRES.has(slug)) return;
  const champ = IMAGES_SEMINAIRE[type];
  if (!champ) return;
  try {
    const actuel = await prisma.configSeminaire.findUnique({ where: { slug } });
    if (!actuel) return;
    const url = actuel[champ];
    await prisma.configSeminaire.update({ where: { slug }, data: { [champ]: null } });
    if (url) await del(url).catch(() => {});
    revalidatePath(`${BASE}/seminaires`);
    revalidatePath(`${BASE}/formations`);
  } catch (e) {
    console.error("[config-seminaire] suppr image :", e);
  }
}
