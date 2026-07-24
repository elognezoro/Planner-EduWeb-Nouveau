"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { MAX_TITRE_RAPPORT, MAX_TITRE_ZONE, type EnteteRapport } from "@/lib/inspection/rapport-commun";
import {
  VERSION_CONTENU_ANTENNE,
  depouillerPourModele,
  estDateIsoValide,
  estTypeRapportAntenne,
  fenetrePeriode,
  lirePeriode,
  lireSectionsPlan,
  typeModeleAntenne,
  type ContenuRapportAntenne,
  type SectionPlan,
  type StructureModeleAntenne,
} from "@/lib/inspection/rapport-antenne";
import { chainePeriode, peutAvoirModeleRapport, peutModifierRapportApfc } from "./rapport-serveur";
import type { EtatForm } from "../visites/actions";

const CHEMIN_PAGE = "/app/inspection/rapports-antennes";

/** Texte borné côté serveur (jamais confié au client). */
function lireTexte(formData: FormData, champ: string, max: number): string {
  return String(formData.get(champ) ?? "").trim().slice(0, max);
}

/** Champ JSON — mal formé = ignoré (fail-closed, jamais d'exception). */
function lireJson(formData: FormData, champ: string): unknown {
  try {
    return JSON.parse(String(formData.get(champ) ?? "null"));
  } catch {
    return null;
  }
}

/** Les 6 mentions d'en-tête (bornées à 200, jamais requises — vide = défaut à l'affichage). */
function lireEnteteForm(formData: FormData): EnteteRapport {
  return {
    ministere: lireTexte(formData, "entete-ministere", MAX_TITRE_ZONE),
    directionRegionale: lireTexte(formData, "entete-directionRegionale", MAX_TITRE_ZONE),
    antenne: lireTexte(formData, "entete-antenne", MAX_TITRE_ZONE),
    coordination: lireTexte(formData, "entete-coordination", MAX_TITRE_ZONE),
    republique: lireTexte(formData, "entete-republique", MAX_TITRE_ZONE),
    devise: lireTexte(formData, "entete-devise", MAX_TITRE_ZONE),
  };
}

/** PLAN soumis (JSON) — lecteur TOLÉRANT et borné du module pur (fail-closed). */
function lirePlanForm(formData: FormData): SectionPlan[] {
  return lireSectionsPlan(lireJson(formData, "sections"));
}

/**
 * Enregistre (crée ou met à jour) un RAPPORT D'ANTENNE v2 « plan hiérarchique » pour une
 * période. Validation serveur : type/période revalidés, PLAN borné et assaini (≤ 80 sections,
 * ≤ 10 tableaux par section, ≤ 12 colonnes, ≤ 40 lignes, cellules ≤ 400, niveaux 1-3, sources
 * de blocs et diagrammes du catalogue uniquement), fenêtre de données validée (début ≤ fin,
 * repli sur la fenêtre de la période). Garde d'écriture UNIQUE partagée
 * `peutModifierRapportApfc` (admin, superviseur international, Admin APFC / Chef d'antenne
 * de CETTE antenne) — les autres rôles de la page restent en lecture seule.
 */
export async function enregistrerRapportAntenne(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const apfcId = String(formData.get("apfcId") ?? "").trim();
  const typeBrut = String(formData.get("type") ?? "");
  if (!apfcId || !estTypeRapportAntenne(typeBrut)) return { ok: false, message: "Paramètres invalides." };
  const periode = lirePeriode(typeBrut, formData.get("periode"));
  if (!periode) return { ok: false, message: "Paramètres invalides." };

  // Fenêtre de données STOCKÉE dans le contenu (repli : fenêtre par défaut de la période).
  const debutBrut = String(formData.get("periode-debut") ?? "");
  const finBrut = String(formData.get("periode-fin") ?? "");
  let fenetre: { debut: string; fin: string };
  if (estDateIsoValide(debutBrut) && estDateIsoValide(finBrut) && debutBrut <= finBrut) {
    fenetre = { debut: debutBrut, fin: finBrut };
  } else {
    const defaut = fenetrePeriode(periode);
    fenetre = {
      debut: defaut.debut.toISOString().slice(0, 10),
      fin: new Date(defaut.fin.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };
  }

  const sections = lirePlanForm(formData);
  if (sections.length === 0) return { ok: false, message: "Le plan du rapport est vide." };

  const titre = lireTexte(formData, "titre", MAX_TITRE_RAPPORT);
  const contenu: ContenuRapportAntenne = {
    version: VERSION_CONTENU_ANTENNE,
    periode: fenetre,
    sections,
    entete: lireEnteteForm(formData),
    signataire: lireTexte(formData, "signataire", MAX_TITRE_RAPPORT),
  };

  try {
    // Garde d'écriture DANS le try : une exception ici est une erreur technique, pas un refus.
    const apfc = await prisma.apfc.findUnique({
      where: { id: apfcId },
      select: { id: true, region: { select: { pays: true } } },
    });
    if (!apfc || !peutModifierRapportApfc(u, { id: apfc.id, pays: apfc.region?.pays ?? null })) {
      return { ok: false, message: "Action non autorisée." };
    }
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };

    const donnees = {
      titre: titre || null,
      contenu: contenu as unknown as Prisma.InputJsonValue,
      rempliParId: u.id,
    };
    await prisma.rapportAntenne.upsert({
      where: { apfcId_type_periode: { apfcId, type: typeBrut, periode: chainePeriode(periode) } },
      create: { apfcId, type: typeBrut, periode: chainePeriode(periode), ...donnees },
      update: donnees,
    });

    revalidatePath(CHEMIN_PAGE);
  } catch (e) {
    console.error("[rapports-antennes] enregistrement :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Rapport enregistré." };
}

/**
 * Enregistre le PLAN COURANT (sans les chiffres : les lignes des tableaux AUTO sont vidées
 * et re-générées à l'application) comme MODÈLE PERSONNEL du type de rapport — un modèle par
 * compte et par type (« antenne-trimestriel » / « antenne-annuel », upsert). Mêmes rôles que
 * l'écriture (`peutAvoirModeleRapport`, jamais dupliqué) ; le modèle est personnel, aucune
 * portée APFC à vérifier.
 */
export async function enregistrerModeleRapportAntenne(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const typeBrut = String(formData.get("type") ?? "");
  if (!estTypeRapportAntenne(typeBrut)) return { ok: false, message: "Paramètres invalides." };

  const structure: StructureModeleAntenne = {
    titre: lireTexte(formData, "titre", MAX_TITRE_RAPPORT),
    entete: lireEnteteForm(formData),
    sections: depouillerPourModele(lirePlanForm(formData)),
  };

  try {
    if (!peutAvoirModeleRapport(u)) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };

    await prisma.modeleRapport.upsert({
      where: {
        proprietaireId_typeRapport: { proprietaireId: u.id, typeRapport: typeModeleAntenne(typeBrut) },
      },
      create: {
        proprietaireId: u.id,
        typeRapport: typeModeleAntenne(typeBrut),
        structure: structure as unknown as Prisma.InputJsonValue,
      },
      update: { structure: structure as unknown as Prisma.InputJsonValue },
    });

    revalidatePath(CHEMIN_PAGE);
  } catch (e) {
    console.error("[rapports-antennes] modèle personnel :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Modèle personnel enregistré — il s'appliquera à vos nouveaux rapports." };
}
