"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import {
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  MAX_TITRE_ZONE,
  estTableauValide,
  lireSectionsLibres,
  lireSectionsMasqueesParmi,
  lireZonesSupplementairesParmi,
  type EnteteRapport,
} from "@/lib/inspection/rapport-commun";
import {
  CLES_TABLEAUX_ANTENNE,
  TABLEAUX_RAPPORT_ANTENNE,
  estMatriceValide,
  estSectionAntenne,
  estTypeRapportAntenne,
  lirePeriode,
  typeModeleAntenne,
  type ContenuRapportAntenne,
  type StructureModeleAntenne,
} from "@/lib/inspection/rapport-antenne";
import { chainePeriode, peutAvoirModeleRapport, peutModifierRapportApfc } from "./rapport-serveur";
import type { EtatForm } from "../visites/actions";

const CHEMIN_PAGE = "/app/inspection/rapports-antennes";

/** Texte narratif borné côté serveur (jamais confié au client). */
function lireTexte(formData: FormData, champ: string, max = MAX_TEXTE_RAPPORT): string {
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

/**
 * CONFIGURATION du formulaire (mêmes champs que l'enregistrement du rapport) : titre type,
 * en-tête, sections retirées, zones supplémentaires, sections libres — partagée entre
 * l'enregistrement du rapport d'antenne et celui du MODÈLE personnel.
 */
function lireConfigurationForm(formData: FormData): StructureModeleAntenne {
  return {
    titre: lireTexte(formData, "titre", MAX_TITRE_RAPPORT),
    entete: {
      ministere: lireTexte(formData, "entete-ministere", MAX_TITRE_ZONE),
      directionRegionale: lireTexte(formData, "entete-directionRegionale", MAX_TITRE_ZONE),
      antenne: lireTexte(formData, "entete-antenne", MAX_TITRE_ZONE),
      coordination: lireTexte(formData, "entete-coordination", MAX_TITRE_ZONE),
      republique: lireTexte(formData, "entete-republique", MAX_TITRE_ZONE),
      devise: lireTexte(formData, "entete-devise", MAX_TITRE_ZONE),
    } satisfies EnteteRapport,
    sectionsMasquees: lireSectionsMasqueesParmi(lireJson(formData, "sectionsMasquees"), estSectionAntenne),
    zonesSupplementaires: lireZonesSupplementairesParmi(lireJson(formData, "zonesSupplementaires"), estSectionAntenne),
    sectionsLibres: lireSectionsLibres(lireJson(formData, "sectionsLibres")),
  };
}

/**
 * Enregistre (crée ou met à jour) un RAPPORT D'ANTENNE (trimestriel ou annuel) pour une
 * période. Validation serveur STRICTE : type et période revalidés, tableaux simples et
 * MATRICES par discipline conformes à la structure attendue (bornes 40 lignes / 20 colonnes-
 * disciplines / cellules 400), textes bornés. Garde d'écriture UNIQUE partagée
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

  // ── Tableaux simples (JSON strict) ──
  const tableaux = {} as Record<(typeof CLES_TABLEAUX_ANTENNE)[number], string[][]>;
  for (const cle of CLES_TABLEAUX_ANTENNE) {
    const valeur = lireJson(formData, cle);
    if (!estTableauValide(valeur, TABLEAUX_RAPPORT_ANTENNE[cle])) return { ok: false, message: "Erreur technique." };
    tableaux[cle] = valeur;
  }
  // ── Matrices par discipline (JSON strict) ──
  const matriceCafop = lireJson(formData, "programmesCafop");
  const matriceSecondaire = lireJson(formData, "programmesSecondaire");
  if (!estMatriceValide(matriceCafop) || !estMatriceValide(matriceSecondaire)) {
    return { ok: false, message: "Erreur technique." };
  }

  const configuration = lireConfigurationForm(formData);
  const contenu: ContenuRapportAntenne = {
    introduction: lireTexte(formData, "introduction"),
    actReunions: tableaux.actReunions,
    actSuivi: tableaux.actSuivi,
    actFormation: tableaux.actFormation,
    actDocumentation: tableaux.actDocumentation,
    actEvaluation: tableaux.actEvaluation,
    actAutres: tableaux.actAutres,
    programmesPrescolaire: tableaux.programmesPrescolaire,
    programmesPrimaire: tableaux.programmesPrimaire,
    programmesCafop: matriceCafop,
    programmesSecondaire: matriceSecondaire,
    analyse: {
      satisfactions: lireTexte(formData, "analyse-satisfactions"),
      insuffisances: lireTexte(formData, "analyse-insuffisances"),
      solutions: lireTexte(formData, "analyse-solutions"),
    },
    conclusion: lireTexte(formData, "conclusion"),
    signataire: lireTexte(formData, "signataire", MAX_TITRE_RAPPORT),
    sectionsMasquees: configuration.sectionsMasquees,
    zonesSupplementaires: configuration.zonesSupplementaires,
    sectionsLibres: configuration.sectionsLibres,
    entete: configuration.entete,
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
      titre: configuration.titre || null,
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
 * Enregistre la configuration COURANTE du formulaire comme MODÈLE PERSONNEL du type de
 * rapport d'antenne (« antenne-trimestriel » / « antenne-annuel ») — un modèle par compte
 * et par type (upsert). Mêmes rôles que l'écriture (`peutAvoirModeleRapport`, jamais
 * dupliqué) ; le modèle est personnel, aucune portée APFC à vérifier.
 */
export async function enregistrerModeleRapportAntenne(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const typeBrut = String(formData.get("type") ?? "");
  if (!estTypeRapportAntenne(typeBrut)) return { ok: false, message: "Paramètres invalides." };
  const structure = lireConfigurationForm(formData);

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
