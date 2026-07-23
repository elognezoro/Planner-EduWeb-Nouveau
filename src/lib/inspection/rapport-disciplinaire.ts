/**
 * Rapport bilan de la Coordination Régionale Disciplinaire (CRD) — reproduction fidèle du
 * modèle officiel « Rapport bilan CRD » fourni par le client (page « Rapports Pédagogiques
 * Disciplinaires »).
 *
 * Module PUR (aucun import serveur — importable par les composants client) : structure
 * SPÉCIFIQUE au rapport CRD (colonnes officielles, lignes par défaut, sections, contenu
 * persisté RapportDisciplinaire.contenu). Les briques GÉNÉRIQUES (bornes, en-tête
 * configurable, configuration libre, tableaux, modèles personnels, helpers numériques)
 * vivent dans `rapport-commun.ts`, partagé avec les rapports d'antenne — et sont
 * RÉEXPORTÉES ici pour les consommateurs historiques du module CRD.
 */

import {
  MAX_TITRE_RAPPORT,
  appliquerStructureModeleDe,
  enteteVide,
  lignesDepuisLibelles,
  lireAnalyse,
  lireEntete,
  lireSectionsLibres,
  lireSectionsMasqueesParmi,
  lireStructureModeleDe,
  lireZonesSupplementairesParmi,
  normaliserTableau,
  texteBorne,
  type ContenusConfigurables,
  type StructureModeleDe,
  type ZoneSupplementaire,
} from "./rapport-commun";

// Briques génériques réexportées (compatibilité des imports existants du module CRD).
export * from "./rapport-commun";

/** Longueur maximale du paramètre « discipline » (?discipline=…, saisie libre autorisée). */
export const MAX_DISCIPLINE = 120;

// ── Colonnes officielles des tableaux (libellés du modèle Word du client) ──

/** Tableaux I-1 (PRIMAIRE/CAFOP) et I-2 (SECONDAIRE) — 8 colonnes. */
export const COLONNES_ACTIVITES = [
  "Nature de l'activité",
  "Prévue",
  "Réalisés",
  "Taux de réalisation",
  "Nombre d'enseignants/encadreurs total",
  "Nombre touchés",
  "Proportion touchés",
  "Observations",
] as const;

/** Tableau complémentaire du point I — 6 colonnes. */
export const COLONNES_ACTIVITES_COMPLEMENT = [
  "Nature de l'activité",
  "Objet",
  "Prévue",
  "Réalisés",
  "Taux de réalisation",
  "Observations",
] as const;

/** Tableau II « CAFOP » — 8 colonnes. */
export const COLONNES_PROGRAMMES_CAFOP = [
  "Niveaux",
  "Nombre de modules prévus pour l'année",
  "Nombre de modules prévus pour le trimestre",
  "Nombre de modules exécutés",
  "Taux d'exécution (%) du trimestre",
  "Taux total",
  "Taux d'exécution (%) de l'année",
  "Observations",
] as const;

/** Tableaux II « Secondaire (premier/second cycle) » — 7 colonnes. */
export const COLONNES_PROGRAMMES_SECONDAIRE = [
  "Niveau",
  "Discipline",
  "Nbre total de leçons de l'année",
  "Nbre de leçons du trimestre",
  "Nbre de leçons exécutées",
  "Taux d'exécution",
  "Taux total",
] as const;

// ── Lignes par défaut (natures d'activité et niveaux du modèle officiel) ──

export const ACTIVITES_PRIMAIRE_DEFAUT = [
  "Visites de classes / primaire/CAFOP",
  "Suivi et encadrement des professeurs pendant le stage des élèves-maîtres de 2ème année",
  "Contrôle des auxiliaires didactiques",
] as const;

export const ACTIVITES_SECONDAIRE_DEFAUT = [
  "Réunion du Chef APFC avec tous les encadreurs",
  "Réunion de l'APFC avec les CRD (RTC)",
  "Séance de travail au sein de la CRD",
  "Réunion à la DRENA",
  "Visites de classes",
  "Classes ouvertes",
  "Ateliers de formation en direction des professeurs",
  "Production numérique MEALM",
  "Fréquentation de l'APFC par les enseignants",
  "Supervision ou participation à des projets de la DPFC",
] as const;

export const ACTIVITES_COMPLEMENT_DEFAUT = [
  "Contrôle des auxiliaires didactiques",
  "Travaux sur le projet de révision des programmes éducatifs",
  "Analyse et validation des sujets d'examens blancs locaux",
  "Elaboration des jurys des examens nationaux",
  "Réception des emplois du temps",
] as const;

export const NIVEAUX_CAFOP = ["Première année", "Deuxième année"] as const;
export const NIVEAUX_PREMIER_CYCLE = ["6ème", "5ème", "4ème", "3ème"] as const;
export const NIVEAUX_SECOND_CYCLE = ["2nde", "1ère", "Tle"] as const;

/** Position de la ligne « Visites de classes » dans les tableaux I-1 et I-2 (pré-remplissage). */
export const INDEX_VISITES_PRIMAIRE = 0;
export const INDEX_VISITES_SECONDAIRE = ACTIVITES_SECONDAIRE_DEFAUT.indexOf("Visites de classes");

/** Trame commune des 3 colonnes du point III (analyse des activités menées). */
export const ANALYSE_TRAME_DEFAUT =
  "Sur le plan pédagogique :\n\nSur le plan administratif :\n\nAu point de vue de la logistique :\n";

// ── Sections officielles du rapport (accordéons) — identifiants stables persistés dans le
//    contenu (sections retirées, zones supplémentaires par section) ──

export const SECTIONS_OFFICIELLES = [
  { id: "membres", titre: "Membres de la Coordination Régionale Disciplinaire" },
  { id: "introduction", titre: "INTRODUCTION" },
  { id: "bilan", titre: "I – BILAN DES ACTIVITES MENEES" },
  { id: "programmes", titre: "II – ETAT D'EXECUTION DES PROGRAMMES" },
  { id: "analyse", titre: "III – ANALYSE DES ACTIVITÉS MENÉES" },
  { id: "conclusion", titre: "CONCLUSION" },
] as const;

export type IdSectionOfficielle = (typeof SECTIONS_OFFICIELLES)[number]["id"];

export function estSectionOfficielle(v: string): v is IdSectionOfficielle {
  return SECTIONS_OFFICIELLES.some((s) => s.id === v);
}

/** Titre officiel d'une section (bandeau « Sections retirées », export Word). */
export function titreSectionOfficielle(id: IdSectionOfficielle): string {
  return SECTIONS_OFFICIELLES.find((s) => s.id === id)?.titre ?? id;
}

// ── Structure persistée (RapportDisciplinaire.contenu) ──

/** Tableaux du rapport : chaque tableau = lignes de cellules TEXTE (toujours éditables). */
export interface ContenuRapport extends ContenusConfigurables<IdSectionOfficielle> {
  /** Membres de la CRD — un nom par ligne. */
  membres: string;
  introduction: string;
  /** I-1. PRIMAIRE/CAFOP (colonnes COLONNES_ACTIVITES). */
  activitesPrimaire: string[][];
  /** I-2. SECONDAIRE (colonnes COLONNES_ACTIVITES). */
  activitesSecondaire: string[][];
  /** Tableau complémentaire du point I (colonnes COLONNES_ACTIVITES_COMPLEMENT). */
  activitesComplement: string[][];
  /** II — CAFOP (colonnes COLONNES_PROGRAMMES_CAFOP). */
  programmesCafop: string[][];
  /** II — Secondaire, premier cycle (colonnes COLONNES_PROGRAMMES_SECONDAIRE). */
  programmesPremierCycle: string[][];
  /** II — Secondaire, second cycle (colonnes COLONNES_PROGRAMMES_SECONDAIRE). */
  programmesSecondCycle: string[][];
  /** III — Analyse des activités menées (3 colonnes de texte). */
  analyse: { satisfactions: string; insuffisances: string; solutions: string };
  conclusion: string;
  /** Nom du Coordinateur Régional Disciplinaire (bloc signature). */
  coordinateur: string;
}

/** Clés des tableaux du contenu, avec leur nombre de colonnes (validation stricte). */
export const TABLEAUX_RAPPORT = {
  activitesPrimaire: COLONNES_ACTIVITES.length,
  activitesSecondaire: COLONNES_ACTIVITES.length,
  activitesComplement: COLONNES_ACTIVITES_COMPLEMENT.length,
  programmesCafop: COLONNES_PROGRAMMES_CAFOP.length,
  programmesPremierCycle: COLONNES_PROGRAMMES_SECONDAIRE.length,
  programmesSecondCycle: COLONNES_PROGRAMMES_SECONDAIRE.length,
} as const;

export type CleTableau = keyof typeof TABLEAUX_RAPPORT;

export const CLES_TABLEAUX = Object.keys(TABLEAUX_RAPPORT) as CleTableau[];

/** Contenu vide (structure complète, tableaux avec leurs lignes par défaut). */
export function contenuParDefaut(): ContenuRapport {
  return {
    membres: "",
    introduction: "",
    activitesPrimaire: lignesDepuisLibelles(ACTIVITES_PRIMAIRE_DEFAUT, COLONNES_ACTIVITES.length),
    activitesSecondaire: lignesDepuisLibelles(ACTIVITES_SECONDAIRE_DEFAUT, COLONNES_ACTIVITES.length),
    activitesComplement: lignesDepuisLibelles(ACTIVITES_COMPLEMENT_DEFAUT, COLONNES_ACTIVITES_COMPLEMENT.length),
    programmesCafop: lignesDepuisLibelles(NIVEAUX_CAFOP, COLONNES_PROGRAMMES_CAFOP.length),
    programmesPremierCycle: lignesDepuisLibelles(NIVEAUX_PREMIER_CYCLE, COLONNES_PROGRAMMES_SECONDAIRE.length),
    programmesSecondCycle: lignesDepuisLibelles(NIVEAUX_SECOND_CYCLE, COLONNES_PROGRAMMES_SECONDAIRE.length),
    analyse: {
      satisfactions: ANALYSE_TRAME_DEFAUT,
      insuffisances: ANALYSE_TRAME_DEFAUT,
      solutions: ANALYSE_TRAME_DEFAUT,
    },
    conclusion: "",
    coordinateur: "",
    sectionsMasquees: [],
    zonesSupplementaires: {},
    sectionsLibres: [],
    entete: enteteVide(),
  };
}

// ── Lecteurs CRD (briques génériques spécialisées sur les sections officielles du CRD) ──

/** Sections officielles CRD retirées (identifiants connus uniquement). */
export function lireSectionsMasquees(valeur: unknown): IdSectionOfficielle[] {
  return lireSectionsMasqueesParmi(valeur, estSectionOfficielle);
}

/** Zones supplémentaires par section officielle CRD. */
export function lireZonesSupplementaires(valeur: unknown): Partial<Record<IdSectionOfficielle, ZoneSupplementaire[]>> {
  return lireZonesSupplementairesParmi(valeur, estSectionOfficielle);
}

/**
 * Relit un `contenu` JSON (base de données) en structure sûre — tolérant aux données
 * partielles : champ absent → valeur vide, tableau mal formé → normalisé. RÉTRO-COMPATIBLE :
 * les rapports enregistrés avant la configuration libre / l'en-tête n'ont pas ces champs.
 */
export function lireContenuRapport(json: unknown): ContenuRapport {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return {
    membres: texteBorne(o.membres),
    introduction: texteBorne(o.introduction),
    activitesPrimaire: normaliserTableau(o.activitesPrimaire, TABLEAUX_RAPPORT.activitesPrimaire),
    activitesSecondaire: normaliserTableau(o.activitesSecondaire, TABLEAUX_RAPPORT.activitesSecondaire),
    activitesComplement: normaliserTableau(o.activitesComplement, TABLEAUX_RAPPORT.activitesComplement),
    programmesCafop: normaliserTableau(o.programmesCafop, TABLEAUX_RAPPORT.programmesCafop),
    programmesPremierCycle: normaliserTableau(o.programmesPremierCycle, TABLEAUX_RAPPORT.programmesPremierCycle),
    programmesSecondCycle: normaliserTableau(o.programmesSecondCycle, TABLEAUX_RAPPORT.programmesSecondCycle),
    analyse: lireAnalyse(o.analyse),
    conclusion: texteBorne(o.conclusion),
    coordinateur: texteBorne(o.coordinateur, MAX_TITRE_RAPPORT),
    sectionsMasquees: lireSectionsMasquees(o.sectionsMasquees),
    zonesSupplementaires: lireZonesSupplementaires(o.zonesSupplementaires),
    sectionsLibres: lireSectionsLibres(o.sectionsLibres),
    entete: lireEntete(o.entete),
  };
}

// ── Modèle personnel CRD (spécialisation des briques génériques) ──

export type StructureModele = StructureModeleDe<IdSectionOfficielle>;

/** Lecture tolérante d'une `structure` de modèle CRD (fail-closed). */
export function lireStructureModele(json: unknown): StructureModele {
  return lireStructureModeleDe(json, estSectionOfficielle);
}

/** Applique la structure d'un modèle CRD à un contenu (données d'instance inchangées). */
export function appliquerStructureModele(contenu: ContenuRapport, modele: StructureModele): ContenuRapport {
  return appliquerStructureModeleDe(contenu, modele);
}

