"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin") return u;
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId === etablissementId) {
    return u;
  }
  return null;
}

/**
 * Enregistre la grille horaire d'un NIVEAU pour un établissement (surcharge du modèle national).
 * Champs attendus : etablissementId, niveauId, et `heures_<disciplineId>` par discipline.
 * Valeur vide → on supprime la surcharge (l'établissement retombe sur le modèle national).
 */
export async function enregistrerGrilleNiveau(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const niveauId = String(formData.get("niveauId") ?? "");
  if (!etablissementId || !niveauId) return { ok: false, message: "Données invalides." };

  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const operations: Promise<unknown>[] = [];
    for (const [cle, valeurBrute] of formData.entries()) {
      if (!cle.startsWith("heures_")) continue;
      const disciplineId = cle.slice("heures_".length);
      const valeur = String(valeurBrute).trim();

      if (valeur === "") {
        // Pas de surcharge : on supprime la ligne établissement éventuelle.
        operations.push(
          prisma.grilleHoraire.deleteMany({
            where: { etablissementId, niveauId, disciplineId },
          }),
        );
        continue;
      }
      const heures = Number(valeur);
      if (Number.isNaN(heures) || heures < 0) continue;

      operations.push(
        prisma.grilleHoraire.upsert({
          where: {
            niveauId_disciplineId_etablissementId: { niveauId, disciplineId, etablissementId },
          },
          update: { heuresHebdo: heures },
          create: {
            niveauId,
            disciplineId,
            etablissementId,
            heuresHebdo: heures,
            coefficient: heures,
          },
        }),
      );
    }
    await Promise.all(operations);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/grille`);
  } catch (e) {
    console.error("[grille] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Grille enregistrée." };
}
