"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { FILTRE_CATHOLIQUE } from "@/lib/rbac/scope";
import { diocesesDuPays } from "@/lib/referentiels/dioceses";

export interface ResultatAffectation {
  ok: boolean;
  message?: string;
  /** Nombre d'établissements effectivement mis à jour. */
  nb?: number;
}

async function journaliser(acteurId: string, acteurEmail: string, action: string, cible: string, details: Prisma.InputJsonValue) {
  try {
    await prisma.journalActivite.create({ data: { utilisateurId: acteurId, acteurEmail, action, cible, details } });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

/**
 * Affectation groupée d'un diocèse à des établissements catholiques (réseau SEDEC).
 * Admin système et superviseur international : tous pays ; Super Admin Établissements :
 * cloisonné à SON pays. Seuls les établissements catholiques du périmètre sont touchés
 * (filtre serveur, jamais confiance aux ids du client).
 */
export async function affecterDioceses(ids: string[], diocese: string): Promise<ResultatAffectation> {
  const u = await getUtilisateurCourant();
  if (
    !u ||
    u.apercuActif ||
    (u.roleReel !== "admin" && u.roleReel !== "super_admin_etablissements" && u.roleReel !== "superviseur_international")
  ) {
    return { ok: false, message: "Action réservée à l'administrateur (hors aperçu)." };
  }
  if (u.roleReel === "super_admin_etablissements" && !u.portee.pays) {
    return { ok: false, message: "Votre compte n'est rattaché à aucun pays." };
  }

  const dioceseNet = diocese.trim();
  const propres = [...new Set(ids)].filter((id) => typeof id === "string" && id.length > 0).slice(0, 500);
  if (!dioceseNet) return { ok: false, message: "Choisissez un diocèse." };
  if (propres.length === 0) return { ok: false, message: "Sélectionnez au moins un établissement." };

  const where: Prisma.EtablissementWhereInput = {
    id: { in: propres },
    ...FILTRE_CATHOLIQUE,
    ...(u.roleReel === "super_admin_etablissements" ? { pays: u.portee.pays } : {}),
  };

  // Le diocèse doit appartenir au référentiel du pays de CHAQUE établissement visé
  // (pas de rattachement d'un établissement ivoirien à un diocèse d'un autre pays).
  const cibles = await prisma.etablissement.findMany({ where, select: { id: true, pays: true } });
  if (cibles.length === 0) {
    return { ok: false, message: "Aucun établissement catholique (réseau SEDEC) dans votre périmètre parmi la sélection." };
  }
  const horsReferentiel = cibles.filter((e) => {
    const liste = diocesesDuPays(e.pays);
    return liste.length > 0 && !liste.includes(dioceseNet);
  });
  if (horsReferentiel.length > 0) {
    return {
      ok: false,
      message: `« ${dioceseNet} » n'appartient pas au référentiel des diocèses de tous les établissements sélectionnés.`,
    };
  }

  const r = await prisma.etablissement.updateMany({
    where: { id: { in: cibles.map((e) => e.id) } },
    data: { diocese: dioceseNet },
  });

  await journaliser(u.id, u.email, "etablissement.dioceses_affectes", `Etablissements:${r.count}`, {
    diocese: dioceseNet,
    nb: r.count,
  });
  revalidatePath("/app/systeme/etablissements/dioceses");
  revalidatePath("/app/systeme/etablissements");
  return { ok: true, nb: r.count };
}
