"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { peutModifierVisite } from "@/lib/inspection/droits-visite";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import {
  TOUTES_CLES,
  estCodeAppreciation,
  SEANCE_VIDE,
  type ReponsesGrille,
  type SeanceObservee,
} from "@/lib/inspection/grille-supervision";
import type { EtatForm } from "../../actions";

const BASE = "/app/inspection/visites";
const MAX_TEXTE_SYNTHESE = 4000;
const MAX_CHAMP_SEANCE = 200;

/** Texte libre de synthèse : bornes serveur strictes (jamais confiées au client). */
function lireTexteSynthese(formData: FormData, champ: string): string | null {
  return String(formData.get(champ) ?? "").trim().slice(0, MAX_TEXTE_SYNTHESE) || null;
}

/**
 * Enregistre (crée ou met à jour) la GRILLE DE SUPERVISION d'une visite d'inspection :
 * réponses par indicateur (validation serveur STRICTE : clés du référentiel uniquement,
 * codes de l'échelle uniquement), volet « séance observée » et synthèse. Mêmes droits que
 * le compte-rendu de la visite (garde unique `peutModifierVisite`, jamais dupliquée).
 */
export async function enregistrerGrilleSupervision(
  visiteId: string,
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!visiteId) return { ok: false, message: "Visite invalide." };

  // ── Validation serveur stricte des réponses : SEULES les clés du référentiel (TOUTES_CLES)
  // et les valeurs de l'échelle (TS/S/P/I) sont retenues — tout le reste est ignoré. ──
  const reponses: ReponsesGrille = {};
  for (const cle of TOUTES_CLES) {
    const valeur = formData.get(`rep-${cle}`);
    if (typeof valeur === "string" && estCodeAppreciation(valeur)) reponses[cle] = valeur;
  }

  // Volet « séance observée » : champs libres bornés (200 caractères chacun).
  const seance: SeanceObservee = { ...SEANCE_VIDE };
  for (const champ of Object.keys(SEANCE_VIDE) as (keyof SeanceObservee)[]) {
    seance[champ] = String(formData.get(`seance-${champ}`) ?? "").trim().slice(0, MAX_CHAMP_SEANCE);
  }
  const seanceRenseignee = Object.values(seance).some((v) => v !== "");

  // Synthèse (3 textes libres, bornés à 4000 caractères).
  const pointsForts = lireTexteSynthese(formData, "pointsForts");
  const pointsAmeliorer = lireTexteSynthese(formData, "pointsAmeliorer");
  const propositions = lireTexteSynthese(formData, "propositions");

  try {
    // Garde unique (auteur OU admin OU gestionnaire dont le périmètre couvre l'établissement) —
    // DANS le try : une exception ici est une erreur technique, pas un refus d'autorisation.
    if (!(await peutModifierVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };

    const donnees = {
      reponses: reponses as Prisma.InputJsonValue,
      seance: seanceRenseignee ? ({ ...seance } as Prisma.InputJsonValue) : Prisma.JsonNull,
      pointsForts,
      pointsAmeliorer,
      propositions,
      rempliParId: u.id,
    };
    await prisma.grilleSupervision.upsert({
      where: { visiteId },
      create: { visiteId, ...donnees },
      update: donnees,
    });

    revalidatePath(BASE);
    revalidatePath(`${BASE}/${visiteId}/grille`);
    revalidatePath(`${BASE}/${visiteId}/grille/imprimer`);
  } catch (e) {
    console.error("[inspection] grille de supervision :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Grille de supervision enregistrée." };
}
