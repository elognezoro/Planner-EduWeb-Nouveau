"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export interface EtatForm {
  ok: boolean;
  message?: string;
  erreurs?: Record<string, string[] | undefined>;
}

/** Réservé à l'administrateur système, hors mode aperçu (lecture seule). */
async function exigerAdmin() {
  const u = await getUtilisateurCourant();
  if (!u || u.roleReel !== "admin" || u.apercuActif) return null;
  return u;
}

export async function mettreAJourConfiguration(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const regime = String(formData.get("regimeNotation") ?? "");
  const annee = String(formData.get("anneeScolaireCourante") ?? "").trim() || null;
  if (regime !== "trimestre" && regime !== "semestre") {
    return { ok: false, message: "Régime de notation invalide." };
  }

  try {
    await prisma.configuration.upsert({
      where: { id: "global" },
      update: { regimeNotation: regime, anneeScolaireCourante: annee },
      create: { id: "global", regimeNotation: regime, anneeScolaireCourante: annee },
    });
    if (annee) {
      // L'année courante devient l'année active.
      await prisma.anneeScolaire.updateMany({ data: { active: false } });
      await prisma.anneeScolaire.updateMany({ where: { libelle: annee }, data: { active: true } });
    }
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[config] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Configuration enregistrée." };
}

const schemaAnnee = z.object({
  libelle: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "Format attendu : AAAA-AAAA (ex : 2025-2026)."),
});

export async function creerAnneeScolaire(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const parsed = schemaAnnee.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Libellé invalide." };
  }
  try {
    await prisma.anneeScolaire.upsert({
      where: { libelle: parsed.data.libelle },
      update: {},
      create: { libelle: parsed.data.libelle },
    });
    revalidatePath("/app/systeme/configuration");
  } catch (e) {
    console.error("[annee] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Année scolaire ajoutée." };
}

const schemaRegion = z.object({
  nom: z.string().trim().min(2, "Nom de région requis.").max(80),
});

export async function creerRegion(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };

  const parsed = schemaRegion.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }
  try {
    const existe = await prisma.region.findUnique({
      where: { pays_nom: { pays: "Côte d'Ivoire", nom: parsed.data.nom } },
    });
    if (existe) return { ok: false, message: "Cette région existe déjà." };
    await prisma.region.create({ data: { nom: parsed.data.nom, pays: "Côte d'Ivoire" } });
    revalidatePath("/app/systeme/configuration");
    revalidatePath("/app/systeme/etablissements");
  } catch (e) {
    console.error("[region] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Région ajoutée." };
}
