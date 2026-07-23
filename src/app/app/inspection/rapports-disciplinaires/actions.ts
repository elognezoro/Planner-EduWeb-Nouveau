"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import {
  CLES_TABLEAUX,
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  MAX_TITRE_ZONE,
  TABLEAUX_RAPPORT,
  estTableauValide,
  lireSectionsLibres,
  lireSectionsMasquees,
  lireZonesSupplementaires,
  type ContenuRapport,
  type EnteteRapport,
  type StructureModele,
} from "@/lib/inspection/rapport-disciplinaire";
import {
  TYPE_RAPPORT_CRD,
  nettoyerDiscipline,
  peutAvoirModeleRapport,
  peutModifierRapportDisciplinaire,
} from "./rapport-serveur";
import type { EtatForm } from "../visites/actions";

const CHEMIN_PAGE = "/app/inspection/rapports-disciplinaires";

/** Texte narratif borné côté serveur (jamais confié au client). */
function lireTexte(formData: FormData, champ: string, max = MAX_TEXTE_RAPPORT): string {
  return String(formData.get(champ) ?? "").trim().slice(0, max);
}

/** Champ JSON de configuration libre — mal formé = ignoré (fail-closed, jamais d'exception). */
function lireJson(formData: FormData, champ: string): unknown {
  try {
    return JSON.parse(String(formData.get(champ) ?? "null"));
  } catch {
    return null;
  }
}

/**
 * CONFIGURATION du formulaire (mêmes champs que l'enregistrement du rapport) : titre type,
 * en-tête (6 mentions bornées à 200), sections retirées, zones supplémentaires, sections
 * libres — partagée entre l'enregistrement du rapport et celui du MODÈLE personnel.
 */
function lireConfigurationForm(formData: FormData): StructureModele {
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
    sectionsMasquees: lireSectionsMasquees(lireJson(formData, "sectionsMasquees")),
    zonesSupplementaires: lireZonesSupplementaires(lireJson(formData, "zonesSupplementaires")),
    sectionsLibres: lireSectionsLibres(lireJson(formData, "sectionsLibres")),
  };
}

/**
 * Enregistre (crée ou met à jour) le RAPPORT BILAN CRD d'une antenne pour une discipline.
 * Validation serveur STRICTE : chaque tableau soumis (JSON) doit respecter exactement la
 * structure attendue (≤ 40 lignes, nombre de colonnes du modèle officiel, cellules ≤ 400
 * caractères) ; textes narratifs bornés à 8000 caractères. Garde d'écriture UNIQUE
 * `peutModifierRapportDisciplinaire` (admin, superviseur international, Admin APFC / Chef
 * d'antenne de CETTE antenne) — les autres rôles de la page restent en lecture seule.
 */
export async function enregistrerRapportDisciplinaire(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const apfcId = String(formData.get("apfcId") ?? "").trim();
  const discipline = nettoyerDiscipline(formData.get("discipline"));
  if (!apfcId || !discipline) return { ok: false, message: "Paramètres invalides." };

  // ── Structure attendue, validée strictement (tableaux JSON + textes bornés) ──
  const tableaux = {} as Record<(typeof CLES_TABLEAUX)[number], string[][]>;
  for (const cle of CLES_TABLEAUX) {
    let valeur: unknown;
    try {
      valeur = JSON.parse(String(formData.get(cle) ?? "[]"));
    } catch {
      return { ok: false, message: "Erreur technique." };
    }
    if (!estTableauValide(valeur, TABLEAUX_RAPPORT[cle])) return { ok: false, message: "Erreur technique." };
    tableaux[cle] = valeur;
  }

  // Configuration (titre, en-tête, sections retirées/libres, zones) — lecteurs TOLÉRANTS et
  // bornés (titres ≤ 200, textes ≤ 8000, ≤ 20 sections libres, ≤ 10 zones par section, ids
  // assainis/re-générés si suspects) — partagée avec l'enregistrement du modèle personnel.
  const configuration = lireConfigurationForm(formData);
  const titre = configuration.titre;
  const contenu: ContenuRapport = {
    membres: lireTexte(formData, "membres"),
    introduction: lireTexte(formData, "introduction"),
    activitesPrimaire: tableaux.activitesPrimaire,
    activitesSecondaire: tableaux.activitesSecondaire,
    activitesComplement: tableaux.activitesComplement,
    programmesCafop: tableaux.programmesCafop,
    programmesPremierCycle: tableaux.programmesPremierCycle,
    programmesSecondCycle: tableaux.programmesSecondCycle,
    analyse: {
      satisfactions: lireTexte(formData, "analyse-satisfactions"),
      insuffisances: lireTexte(formData, "analyse-insuffisances"),
      solutions: lireTexte(formData, "analyse-solutions"),
    },
    conclusion: lireTexte(formData, "conclusion"),
    coordinateur: lireTexte(formData, "coordinateur", MAX_TITRE_RAPPORT),
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
    if (!apfc || !peutModifierRapportDisciplinaire(u, { id: apfc.id, pays: apfc.region?.pays ?? null })) {
      return { ok: false, message: "Action non autorisée." };
    }
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };

    // Un rapport par (antenne, discipline) — recherche sans casse pour ne pas créer de doublon
    // (« Mathématiques » / « mathématiques »), puis création ou mise à jour.
    const donnees = {
      titre: titre || null,
      contenu: contenu as unknown as Prisma.InputJsonValue,
      rempliParId: u.id,
    };
    const existant = await prisma.rapportDisciplinaire.findFirst({
      where: { apfcId, discipline: { equals: discipline, mode: "insensitive" } },
      select: { id: true },
    });
    if (existant) await prisma.rapportDisciplinaire.update({ where: { id: existant.id }, data: donnees });
    else await prisma.rapportDisciplinaire.create({ data: { apfcId, discipline, ...donnees } });

    revalidatePath(CHEMIN_PAGE);
  } catch (e) {
    console.error("[rapports-disciplinaires] enregistrement :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Rapport enregistré." };
}

/**
 * Enregistre la configuration COURANTE du formulaire comme MODÈLE PERSONNEL de rapport CRD
 * de l'utilisateur (un modèle par compte et par type de rapport — upsert) : titre type,
 * en-tête personnalisé, sections retirées, sections libres et zones types — JAMAIS les
 * tableaux chiffrés ni les textes d'instance. Garde : mêmes rôles que l'écriture du rapport
 * (`peutAvoirModeleRapport`, même ensemble de rôles — le modèle est personnel, aucune portée
 * APFC à vérifier). Le modèle s'applique ensuite automatiquement aux NOUVEAUX rapports.
 */
export async function enregistrerModeleRapport(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const structure = lireConfigurationForm(formData);

  try {
    if (!peutAvoirModeleRapport(u)) return { ok: false, message: "Action non autorisée." };
    const rEssai = refusEssaiPour(u);
    if (rEssai) return { ok: false, message: rEssai };

    await prisma.modeleRapport.upsert({
      where: { proprietaireId_typeRapport: { proprietaireId: u.id, typeRapport: TYPE_RAPPORT_CRD } },
      create: {
        proprietaireId: u.id,
        typeRapport: TYPE_RAPPORT_CRD,
        structure: structure as unknown as Prisma.InputJsonValue,
      },
      update: { structure: structure as unknown as Prisma.InputJsonValue },
    });

    revalidatePath(CHEMIN_PAGE);
  } catch (e) {
    console.error("[rapports-disciplinaires] modèle personnel :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Modèle personnel enregistré — il s'appliquera à vos nouveaux rapports." };
}
