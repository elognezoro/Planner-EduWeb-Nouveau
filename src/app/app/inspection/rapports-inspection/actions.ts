"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { peutModifierVisite } from "@/lib/inspection/droits-visite";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "../visites/actions";

const BASE = "/app/inspection";
const MAX_TEXTE = 4000;

/** Texte libre du rapport : bornes serveur strictes (jamais confiées au client). */
function lireTexte(formData: FormData, champ: string): string | null {
  return String(formData.get(champ) ?? "").trim().slice(0, MAX_TEXTE) || null;
}

/**
 * VALIDE le rapport d'inspection d'une visite : enregistre les trois rubriques de synthèse
 * (points forts / axes d'amélioration / recommandations) sur la GRILLE DE SUPERVISION de la
 * visite (mêmes champs que la page « Grille de supervision » — liaison bidirectionnelle
 * assumée), SANS toucher aux réponses par indicateur ni au volet « séance observée », puis
 * passe la visite au statut « réalisée » (même sémantique que l'enregistrement du
 * compte-rendu). Droits : garde unique `peutModifierVisite` (jamais dupliquée).
 */
export async function validerRapportInspection(
  visiteId: string,
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!visiteId) return { ok: false, message: "Visite invalide." };

  const pointsForts = lireTexte(formData, "pointsForts");
  const pointsAmeliorer = lireTexte(formData, "pointsAmeliorer");
  const propositions = lireTexte(formData, "propositions");

  try {
    // Garde unique (auteur OU admin OU gestionnaire dont le périmètre couvre l'établissement) —
    // DANS le try : une exception ici est une erreur technique, pas un refus d'autorisation.
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };

    // UPSERT de la grille : SEULES les trois rubriques de synthèse sont écrites — les réponses
    // par indicateur et la séance observée ne sont JAMAIS touchées par le rapport.
    await prisma.grilleSupervision.upsert({
      where: { visiteId },
      create: {
        visiteId,
        reponses: {} as Prisma.InputJsonValue,
        pointsForts,
        pointsAmeliorer,
        propositions,
        rempliParId: u.id,
      },
      update: { pointsForts, pointsAmeliorer, propositions, rempliParId: u.id },
    });

    // Valider le rapport = la visite est réalisée (même sémantique que le compte-rendu).
    await prisma.visite.update({ where: { id: visiteId }, data: { statut: "realisee" } });

    revalidatePath(`${BASE}/rapports-inspection`);
    revalidatePath(`${BASE}/visites`);
    revalidatePath(`${BASE}/visites/${visiteId}/grille`);
    revalidatePath(`${BASE}/visites/${visiteId}/grille/imprimer`);
  } catch (e) {
    console.error("[inspection] rapport d'inspection :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Rapport d'inspection validé — visite marquée « réalisée »." };
}
