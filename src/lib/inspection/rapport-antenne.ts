/**
 * Rapports narratifs d'ANTENNE (APFC) — reproduction fidèle des modèles officiels du client
 * « Rapport trimestriel » et « Rapport annuel » (page « Rapports d'antennes »).
 *
 * Module PUR (aucun import serveur — importable par les composants client) : structures
 * SPÉCIFIQUES aux deux rapports (sections, colonnes officielles, lignes par défaut, matrices
 * de programmes par discipline, périodes scolaires, correspondances d'agrégation depuis les
 * rapports CRD). Les briques GÉNÉRIQUES (bornes, en-tête, configuration libre, tableaux,
 * modèles personnels, helpers) viennent de `rapport-commun.ts` — jamais dupliquées.
 */

import {
  MAX_CELLULE_RAPPORT,
  MAX_LIGNES_TABLEAU,
  MAX_TITRE_RAPPORT,
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
  type AnalyseRapport,
  type ContenusConfigurables,
  type StructureModeleDe,
  type ZoneSupplementaire,
} from "./rapport-commun";

// ── Types de rapport et périodes scolaires ──

export type TypeRapportAntenne = "trimestriel" | "annuel";

export function estTypeRapportAntenne(v: string): v is TypeRapportAntenne {
  return v === "trimestriel" || v === "annuel";
}

export type CodeTrimestre = "T1" | "T2" | "T3";

/** Trimestres scolaires (fenêtres officielles : sept.–nov. / déc.–févr. / mars–mai). */
export const TRIMESTRES = [
  { code: "T1", libelle: "1er trimestre (sept. – nov.)", nomLong: "PREMIER" },
  { code: "T2", libelle: "2e trimestre (déc. – févr.)", nomLong: "DEUXIEME" },
  { code: "T3", libelle: "3e trimestre (mars – mai)", nomLong: "TROISIEME" },
] as const;

export function estCodeTrimestre(v: string): v is CodeTrimestre {
  return TRIMESTRES.some((t) => t.code === v);
}

/** Année scolaire « 2025-2026 » couvrant la date donnée (rentrée en septembre). */
export function anneeScolaireCourante(maintenant = new Date()): string {
  const annee = maintenant.getUTCFullYear();
  const debut = maintenant.getUTCMonth() >= 8 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
}

/** Années scolaires proposées au sélecteur (quelques années autour de la courante). */
export function anneesScolairesProposees(maintenant = new Date()): string[] {
  const courante = Number.parseInt(anneeScolaireCourante(maintenant).slice(0, 4), 10);
  return Array.from({ length: 6 }, (_, i) => {
    const debut = courante + 1 - i;
    return `${debut}-${debut + 1}`;
  });
}

/** « 2025-2026 » valide (deux années consécutives). */
export function estAnneeScolaireValide(v: string): boolean {
  const m = /^(\d{4})-(\d{4})$/.exec(v);
  return m !== null && Number.parseInt(m[2], 10) === Number.parseInt(m[1], 10) + 1;
}

/** Trimestre par défaut selon la date (T1 sept.–nov., T2 déc.–févr., T3 sinon). */
export function trimestreCourant(maintenant = new Date()): CodeTrimestre {
  const mois = maintenant.getUTCMonth();
  if (mois >= 8 && mois <= 10) return "T1";
  if (mois === 11 || mois <= 1) return "T2";
  return "T3";
}

/** Période persistée : « 2025-2026-T1 » (trimestriel) ou « 2025-2026 » (annuel). */
export function periodeDepuis(type: TypeRapportAntenne, annee: string, trimestre: CodeTrimestre): string {
  return type === "trimestriel" ? `${annee}-${trimestre}` : annee;
}

export interface PeriodeAntenne {
  annee: string;
  /** Null pour un rapport annuel. */
  trimestre: CodeTrimestre | null;
}

/** Validation fail-closed d'un paramètre `?periode=` selon le type — null si invalide. */
export function lirePeriode(type: TypeRapportAntenne, valeur: unknown): PeriodeAntenne | null {
  if (typeof valeur !== "string") return null;
  if (type === "annuel") {
    return estAnneeScolaireValide(valeur) ? { annee: valeur, trimestre: null } : null;
  }
  const m = /^(\d{4}-\d{4})-(T[123])$/.exec(valeur);
  if (!m || !estAnneeScolaireValide(m[1]) || !estCodeTrimestre(m[2])) return null;
  return { annee: m[1], trimestre: m[2] };
}

/** Période par défaut (année scolaire courante, trimestre courant pour le trimestriel). */
export function periodeParDefaut(type: TypeRapportAntenne, maintenant = new Date()): string {
  const annee = anneeScolaireCourante(maintenant);
  return type === "trimestriel" ? `${annee}-${trimestreCourant(maintenant)}` : annee;
}

/** Fenêtre UTC [début, fin) d'une période (T1 sept.–nov., T2 déc.–févr., T3 mars–mai, année sept.–août). */
export function fenetrePeriode(periode: PeriodeAntenne): { debut: Date; fin: Date } {
  const anneeDebut = Number.parseInt(periode.annee.slice(0, 4), 10);
  switch (periode.trimestre) {
    case "T1":
      return { debut: new Date(Date.UTC(anneeDebut, 8, 1)), fin: new Date(Date.UTC(anneeDebut, 11, 1)) };
    case "T2":
      return { debut: new Date(Date.UTC(anneeDebut, 11, 1)), fin: new Date(Date.UTC(anneeDebut + 1, 2, 1)) };
    case "T3":
      return { debut: new Date(Date.UTC(anneeDebut + 1, 2, 1)), fin: new Date(Date.UTC(anneeDebut + 1, 5, 1)) };
    default:
      return { debut: new Date(Date.UTC(anneeDebut, 8, 1)), fin: new Date(Date.UTC(anneeDebut + 1, 8, 1)) };
  }
}

/** Titre TYPE du bloc violet selon le type et la période (modèles officiels). */
export function titreTypeAntenne(type: TypeRapportAntenne, periode: PeriodeAntenne): string {
  if (type === "annuel") return `RAPPORT D'ACTIVITES ANNUEL ANTENNE ${periode.annee}`;
  const nomLong = TRIMESTRES.find((t) => t.code === periode.trimestre)?.nomLong ?? "PREMIER";
  return `RAPPORT DES ACTIVITES DU ${nomLong} TRIMESTRE ${periode.annee.replace("-", " - ")}`;
}

// ── Sections officielles (accordéons) ──

export const SECTIONS_ANTENNE = [
  { id: "introduction", titre: "INTRODUCTION" },
  { id: "activites", titre: "I – ACTIVITÉS PÉDAGOGIQUES RÉALISÉES" },
  { id: "programmes", titre: "II – ÉTAT D'EXÉCUTION DES PROGRAMMES" },
  { id: "analyse", titre: "III – ANALYSE DES RÉSULTATS DES ACTIVITÉS" },
  { id: "conclusion", titre: "CONCLUSION" },
] as const;

export type IdSectionAntenne = (typeof SECTIONS_ANTENNE)[number]["id"];

export function estSectionAntenne(v: string): v is IdSectionAntenne {
  return SECTIONS_ANTENNE.some((s) => s.id === v);
}

/** Titre officiel d'une section — la section I diffère entre trimestriel et annuel. */
export function titreSectionAntenne(id: IdSectionAntenne, type: TypeRapportAntenne): string {
  if (id === "activites" && type === "annuel") return "I – ACTIVITÉS DES COORDINATIONS RÉGIONALES";
  return SECTIONS_ANTENNE.find((s) => s.id === id)?.titre ?? id;
}

// ── Colonnes officielles des tableaux d'activités ──

/** Sous-tableaux I-1 à I-5 — 8 colonnes (touchés/attendus scindés, modèle officiel). */
export const COLONNES_ACTIVITES_ANTENNE = [
  "Nature de l'activité",
  "Prévue",
  "Réalisée",
  "Indicateurs vérifiables",
  "Touchés",
  "Attendus",
  "Pourcentage touchés",
  "Observations",
] as const;

/** Sous-tableau I-6 (AUTRES ACTIVITÉS MENÉES) — 7 colonnes (pas de « Prévue »). */
export const COLONNES_AUTRES_ACTIVITES_ANTENNE = [
  "Nature de l'activité",
  "Réalisé",
  "Indicateurs vérifiables",
  "Touchés",
  "Attendus",
  "Pourcentage",
  "Observations",
] as const;

/** II-1 (préscolaire / primaire) — 5 colonnes. */
export const COLONNES_PROGRAMMES_CYCLE = [
  "Niveaux",
  "Nombre total de leçons prévues",
  "Nombre de leçons exécutées",
  "Taux d'exécution (%)",
  "Observations",
] as const;

/** Sous-colonnes des matrices par discipline (II-2 CAFOP / II-3 secondaire). */
export const SOUS_COLONNES_CAFOP = ["Nbre total modules", "Nbre leçons modules", "Taux"] as const;
export const SOUS_COLONNES_SECONDAIRE = ["Nbre total leçons", "Nbre leçons exécutées", "Taux"] as const;

// ── Sous-tableaux d'activités (I-1 … I-6) et lignes par défaut par type de rapport ──

export const TABLEAUX_ACTIVITES_ANTENNE = [
  { cle: "actReunions", titre: "I-1. RÉUNIONS / SÉANCE DE TRAVAIL" },
  { cle: "actSuivi", titre: "I-2. SUIVI ET ENCADREMENT PÉDAGOGIQUES" },
  { cle: "actFormation", titre: "I-3. FORMATION PÉDAGOGIQUE CONTINUE" },
  { cle: "actDocumentation", titre: "I-4. DOCUMENTATION ET PRODUCTION" },
  { cle: "actEvaluation", titre: "I-5. ÉVALUATION" },
  { cle: "actAutres", titre: "I-6. AUTRES ACTIVITÉS MENÉES" },
] as const;

export type CleActivitesAntenne = (typeof TABLEAUX_ACTIVITES_ANTENNE)[number]["cle"];

/** Natures d'activité par défaut de chaque sous-tableau, selon le type de rapport. */
export const ACTIVITES_ANTENNE_DEFAUT: Record<TypeRapportAntenne, Record<CleActivitesAntenne, readonly string[]>> = {
  trimestriel: {
    actReunions: ["Réunions", "Séances de travail"],
    actSuivi: ["Visites de classes", "Classe ouverte", "Ateliers de formation"],
    actFormation: ["Ateliers de formation DRENA", "Mission nationale", "Suivi des enseignants contractuels en sciences"],
    actDocumentation: ["Projet « Mon école à la maison »"],
    actEvaluation: ["Examens blancs régionaux/Remédiations", "Commission de choix de sujets", "Mission d'inspection"],
    actAutres: ["Formation VPJ DECO"],
  },
  annuel: {
    actReunions: [
      "Réunion de l'APFC",
      "Séance de travail CRD",
      "Rentrée pédagogique APFC",
      "Réunion de rentrée",
      "Réunion de travail des CND",
      "Participation à la réunion de la CND avec l'IGENA",
      "Réunion/Séance de travail avec la DPFC",
      "Réunion/Séance de travail à la DRENA",
      "Commission Pédagogique Nationale",
      "Commission de choix de sujets",
      "Formation des encadreurs pédagogiques en APFC",
      "Examen BAC UEMOA",
      "Formation des acteurs des examens nationaux (VPJ, …)",
    ],
    actSuivi: [
      "Séance de travail avec les UP/CE",
      "Fréquentation de l'APFC par les enseignants",
      "Visites de classes /primaire/CAFOP",
      "Visites de classes /secondaire",
      "Atelier de formation /secondaire",
      "Contrôle des auxiliaires didactiques/entretien",
      "Missions nationales hors DRENA",
      "Missions internationales",
    ],
    actFormation: [
      "Formation sur l'élaboration des sujets d'examens blancs avec les enseignants",
      "Formation commandée par la DRENA",
      "Formation commandée par un établissement scolaire",
    ],
    actDocumentation: [
      "Réception des listes (enseignants, Responsable Labo, animateurs CE/UP)",
      "Réception des listes des responsables de structures de la DRENA",
      "Mise à disposition des programmes, progressions et textes officiels de rentrée",
      "Production de supports pédagogiques",
    ],
    actEvaluation: [
      "Analyse des emplois du temps",
      "Production de sujets examens blancs régionaux BEPC/BAC",
      "Correction des sujets des établissements scolaires",
      "Supervision des examens blancs",
      "Élaboration des sujets d'examens à la DECO",
      "Examens pédagogiques",
    ],
    actAutres: [
      "Formation des enseignants à la mise en œuvre de la réforme curriculaire",
      "Visites de classe d'expérimentation primaire",
      "Visites de classe d'expérimentation secondaire",
      "Suivi des projets DPFC",
      "Supervision de la dictée PGL",
      "Organisation du concours Plume d'Or",
      "Production de capsules vidéos",
      "Participation aux « cafés littéraires »",
      "Formation des enseignants contractuels",
      "Conseils de formation",
      "Regroupements pédagogiques",
      "Participation aux activités pédagogiques du Primaire",
    ],
  },
};

// ── Niveaux et disciplines par défaut des programmes (II) ──

export const NIVEAUX_PRESCOLAIRE = ["Petite section", "Moyenne section", "Grande section"] as const;
export const NIVEAUX_PRIMAIRE = ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"] as const;
export const NIVEAUX_CAFOP_ANTENNE = ["1ère ANNÉE", "2è ANNÉE"] as const;
export const NIVEAUX_SECONDAIRE_ANTENNE = [
  "6ème",
  "5ème",
  "4ème",
  "3ème",
  "2nde A",
  "2nde C",
  "1ère A",
  "1ère C",
  "1ère D",
  "Tle A",
  "Tle C",
  "Tle D",
] as const;

export const DISCIPLINES_CAFOP_DEFAUT = ["EDHC", "CAV", "FRANÇAIS", "HISTOIRE-GÉO"] as const;
export const DISCIPLINES_SECONDAIRE_DEFAUT = [
  "ANGLAIS",
  "ESPAGNOL",
  "FRANÇAIS",
  "HISTOIRE-GÉO",
  "MATHS",
  "PHILOSOPHIE",
  "PHYSIQUE-CHIMIE",
  "SVT",
] as const;

/** Nombre maximal de colonnes-disciplines d'une matrice (ajoutables/supprimables). */
export const MAX_DISCIPLINES_MATRICE = 20;
/** Nombre de sous-colonnes par discipline (identique aux deux matrices). */
export const NB_SOUS_COLONNES_MATRICE = 3;

/** Trame des 3 colonnes du point III (modèle antenne : « Au plan … »). */
export const ANALYSE_TRAME_ANTENNE = "Au plan pédagogique :\n\nAu plan administratif :\n\nAu plan logistique :\n";

// ── Matrices de programmes (disciplines en COLONNES ajoutables, niveaux en lignes) ──

/**
 * Matrice « disciplines × niveaux » (II-2 CAFOP, II-3 secondaire général) : chaque ligne
 * porte son niveau et, PAR discipline (même index que `disciplines`), les 3 sous-colonnes
 * en texte éditable.
 */
export interface MatriceProgrammes {
  disciplines: string[];
  lignes: { niveau: string; valeurs: string[][] }[];
}

/** Matrice par défaut : disciplines et niveaux du modèle, cellules vides. */
export function matriceParDefaut(disciplines: readonly string[], niveaux: readonly string[]): MatriceProgrammes {
  return {
    disciplines: [...disciplines],
    lignes: niveaux.map((niveau) => ({
      niveau,
      valeurs: disciplines.map(() => Array.from({ length: NB_SOUS_COLONNES_MATRICE }, () => "")),
    })),
  };
}

/** Cellule bornée. */
const cellule = (v: unknown): string => (typeof v === "string" ? v.slice(0, MAX_CELLULE_RAPPORT) : "");

/** Lecture TOLÉRANTE d'une matrice (JSON en base) — recalée sur ses disciplines, jamais d'exception. */
export function lireMatrice(valeur: unknown): MatriceProgrammes {
  const o = valeur && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
  const disciplines = (Array.isArray(o.disciplines) ? o.disciplines : [])
    .slice(0, MAX_DISCIPLINES_MATRICE)
    .map((d) => cellule(d));
  const lignes = (Array.isArray(o.lignes) ? o.lignes : []).slice(0, MAX_LIGNES_TABLEAU).map((l) => {
    const ligne = l && typeof l === "object" && !Array.isArray(l) ? (l as Record<string, unknown>) : {};
    const valeurs = Array.isArray(ligne.valeurs) ? ligne.valeurs : [];
    return {
      niveau: cellule(ligne.niveau),
      valeurs: disciplines.map((_, d) => {
        const sous: unknown = valeurs[d];
        const tableau = Array.isArray(sous) ? sous : [];
        return Array.from({ length: NB_SOUS_COLONNES_MATRICE }, (_, i) => cellule(tableau[i]));
      }),
    };
  });
  return { disciplines, lignes };
}

/** Validation STRICTE d'une matrice soumise par le formulaire (structure exacte, bornes). */
export function estMatriceValide(v: unknown): v is MatriceProgrammes {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.disciplines) || o.disciplines.length > MAX_DISCIPLINES_MATRICE) return false;
  if (!o.disciplines.every((d) => typeof d === "string" && d.length <= MAX_CELLULE_RAPPORT)) return false;
  const nbDisciplines = o.disciplines.length;
  if (!Array.isArray(o.lignes) || o.lignes.length > MAX_LIGNES_TABLEAU) return false;
  return o.lignes.every((l) => {
    if (!l || typeof l !== "object" || Array.isArray(l)) return false;
    const ligne = l as Record<string, unknown>;
    if (typeof ligne.niveau !== "string" || ligne.niveau.length > MAX_CELLULE_RAPPORT) return false;
    return (
      Array.isArray(ligne.valeurs) &&
      ligne.valeurs.length === nbDisciplines &&
      ligne.valeurs.every(
        (sous) =>
          Array.isArray(sous) &&
          sous.length === NB_SOUS_COLONNES_MATRICE &&
          sous.every((c) => typeof c === "string" && c.length <= MAX_CELLULE_RAPPORT),
      )
    );
  });
}

// ── Structure persistée (RapportAntenne.contenu) ──

/** Tableaux SIMPLES du contenu (clé → nombre de colonnes, validation stricte). */
export const TABLEAUX_RAPPORT_ANTENNE = {
  actReunions: COLONNES_ACTIVITES_ANTENNE.length,
  actSuivi: COLONNES_ACTIVITES_ANTENNE.length,
  actFormation: COLONNES_ACTIVITES_ANTENNE.length,
  actDocumentation: COLONNES_ACTIVITES_ANTENNE.length,
  actEvaluation: COLONNES_ACTIVITES_ANTENNE.length,
  actAutres: COLONNES_AUTRES_ACTIVITES_ANTENNE.length,
  programmesPrescolaire: COLONNES_PROGRAMMES_CYCLE.length,
  programmesPrimaire: COLONNES_PROGRAMMES_CYCLE.length,
} as const;

export type CleTableauAntenne = keyof typeof TABLEAUX_RAPPORT_ANTENNE;

export const CLES_TABLEAUX_ANTENNE = Object.keys(TABLEAUX_RAPPORT_ANTENNE) as CleTableauAntenne[];

export interface ContenuRapportAntenne extends ContenusConfigurables<IdSectionAntenne> {
  introduction: string;
  /** I-1 … I-5 (colonnes COLONNES_ACTIVITES_ANTENNE). */
  actReunions: string[][];
  actSuivi: string[][];
  actFormation: string[][];
  actDocumentation: string[][];
  actEvaluation: string[][];
  /** I-6 (colonnes COLONNES_AUTRES_ACTIVITES_ANTENNE). */
  actAutres: string[][];
  /** II-1 (colonnes COLONNES_PROGRAMMES_CYCLE). */
  programmesPrescolaire: string[][];
  programmesPrimaire: string[][];
  /** II-2 / II-3 — matrices disciplines × niveaux. */
  programmesCafop: MatriceProgrammes;
  programmesSecondaire: MatriceProgrammes;
  /** III — Analyse des résultats des activités (3 colonnes de texte). */
  analyse: AnalyseRapport;
  conclusion: string;
  /** Nom du Chef de l'Antenne (bloc signature). */
  signataire: string;
}

/** Contenu par défaut d'un rapport d'antenne du `type` donné (lignes officielles du modèle). */
export function contenuAntenneParDefaut(type: TypeRapportAntenne): ContenuRapportAntenne {
  const natures = ACTIVITES_ANTENNE_DEFAUT[type];
  return {
    introduction: "",
    actReunions: lignesDepuisLibelles(natures.actReunions, TABLEAUX_RAPPORT_ANTENNE.actReunions),
    actSuivi: lignesDepuisLibelles(natures.actSuivi, TABLEAUX_RAPPORT_ANTENNE.actSuivi),
    actFormation: lignesDepuisLibelles(natures.actFormation, TABLEAUX_RAPPORT_ANTENNE.actFormation),
    actDocumentation: lignesDepuisLibelles(natures.actDocumentation, TABLEAUX_RAPPORT_ANTENNE.actDocumentation),
    actEvaluation: lignesDepuisLibelles(natures.actEvaluation, TABLEAUX_RAPPORT_ANTENNE.actEvaluation),
    actAutres: lignesDepuisLibelles(natures.actAutres, TABLEAUX_RAPPORT_ANTENNE.actAutres),
    programmesPrescolaire: lignesDepuisLibelles(NIVEAUX_PRESCOLAIRE, TABLEAUX_RAPPORT_ANTENNE.programmesPrescolaire),
    programmesPrimaire: lignesDepuisLibelles(NIVEAUX_PRIMAIRE, TABLEAUX_RAPPORT_ANTENNE.programmesPrimaire),
    programmesCafop: matriceParDefaut(DISCIPLINES_CAFOP_DEFAUT, NIVEAUX_CAFOP_ANTENNE),
    programmesSecondaire: matriceParDefaut(DISCIPLINES_SECONDAIRE_DEFAUT, NIVEAUX_SECONDAIRE_ANTENNE),
    analyse: {
      satisfactions: ANALYSE_TRAME_ANTENNE,
      insuffisances: ANALYSE_TRAME_ANTENNE,
      solutions: ANALYSE_TRAME_ANTENNE,
    },
    conclusion: "",
    signataire: "",
    sectionsMasquees: [],
    zonesSupplementaires: {},
    sectionsLibres: [],
    entete: enteteVide(),
  };
}

/** Relit un `contenu` JSON (base) en structure sûre — tolérant, jamais d'exception. */
export function lireContenuRapportAntenne(json: unknown): ContenuRapportAntenne {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return {
    introduction: texteBorne(o.introduction),
    actReunions: normaliserTableau(o.actReunions, TABLEAUX_RAPPORT_ANTENNE.actReunions),
    actSuivi: normaliserTableau(o.actSuivi, TABLEAUX_RAPPORT_ANTENNE.actSuivi),
    actFormation: normaliserTableau(o.actFormation, TABLEAUX_RAPPORT_ANTENNE.actFormation),
    actDocumentation: normaliserTableau(o.actDocumentation, TABLEAUX_RAPPORT_ANTENNE.actDocumentation),
    actEvaluation: normaliserTableau(o.actEvaluation, TABLEAUX_RAPPORT_ANTENNE.actEvaluation),
    actAutres: normaliserTableau(o.actAutres, TABLEAUX_RAPPORT_ANTENNE.actAutres),
    programmesPrescolaire: normaliserTableau(o.programmesPrescolaire, TABLEAUX_RAPPORT_ANTENNE.programmesPrescolaire),
    programmesPrimaire: normaliserTableau(o.programmesPrimaire, TABLEAUX_RAPPORT_ANTENNE.programmesPrimaire),
    programmesCafop: lireMatrice(o.programmesCafop),
    programmesSecondaire: lireMatrice(o.programmesSecondaire),
    analyse: lireAnalyse(o.analyse),
    conclusion: texteBorne(o.conclusion),
    signataire: texteBorne(o.signataire, MAX_TITRE_RAPPORT),
    sectionsMasquees: lireSectionsMasqueesParmi(o.sectionsMasquees, estSectionAntenne),
    zonesSupplementaires: lireZonesSupplementairesParmi(o.zonesSupplementaires, estSectionAntenne),
    sectionsLibres: lireSectionsLibres(o.sectionsLibres),
    entete: lireEntete(o.entete),
  };
}

// ── Modèle personnel (typeRapport « antenne-trimestriel » / « antenne-annuel ») ──

export type StructureModeleAntenne = StructureModeleDe<IdSectionAntenne>;

export function lireStructureModeleAntenne(json: unknown): StructureModeleAntenne {
  return lireStructureModeleDe(json, estSectionAntenne);
}

/** Valeur `ModeleRapport.typeRapport` du modèle personnel de chaque type de rapport. */
export function typeModeleAntenne(type: TypeRapportAntenne): string {
  return type === "trimestriel" ? "antenne-trimestriel" : "antenne-annuel";
}

// ── Agrégation depuis les rapports CRD (correspondances par nature d'activité) ──

/** Colonnes numériques agrégées d'une ligne d'activités (indices selon le tableau). */
export interface IndicesActivites {
  prevue: number | null;
  realisee: number;
  touches: number | null;
  attendus: number | null;
  pourcentage: number | null;
}

/** Indices des tableaux I-1 … I-5 (8 colonnes). */
export const INDICES_ACTIVITES_ANTENNE: IndicesActivites = {
  prevue: 1,
  realisee: 2,
  touches: 4,
  attendus: 5,
  pourcentage: 6,
};

/** Indices du tableau I-6 (7 colonnes, pas de « Prévue »). */
export const INDICES_AUTRES_ACTIVITES_ANTENNE: IndicesActivites = {
  prevue: null,
  realisee: 1,
  touches: 3,
  attendus: 4,
  pourcentage: 5,
};

export function indicesTableauActivites(cle: CleActivitesAntenne): IndicesActivites {
  return cle === "actAutres" ? INDICES_AUTRES_ACTIVITES_ANTENNE : INDICES_ACTIVITES_ANTENNE;
}

/**
 * Correspondance d'AGRÉGATION : une ligne (tableau + nature) du rapport d'antenne reçoit la
 * somme des colonnes numériques des lignes des rapports CRD dont la nature (colonne 1)
 * correspond à l'une des `sources` (comparaison sans casse/accents, parse tolérant).
 */
export interface CorrespondanceCrd {
  table: CleActivitesAntenne;
  nature: string;
  sources: readonly string[];
}

export const CORRESPONDANCES_CRD: Record<TypeRapportAntenne, readonly CorrespondanceCrd[]> = {
  trimestriel: [
    {
      table: "actReunions",
      nature: "Réunions",
      sources: ["Réunion du Chef APFC avec tous les encadreurs", "Réunion de l'APFC avec les CRD (RTC)", "Réunion à la DRENA"],
    },
    { table: "actReunions", nature: "Séances de travail", sources: ["Séance de travail au sein de la CRD"] },
    { table: "actSuivi", nature: "Visites de classes", sources: ["Visites de classes", "Visites de classes / primaire/CAFOP"] },
    { table: "actSuivi", nature: "Classe ouverte", sources: ["Classes ouvertes"] },
    { table: "actSuivi", nature: "Ateliers de formation", sources: ["Ateliers de formation en direction des professeurs"] },
  ],
  annuel: [
    {
      table: "actReunions",
      nature: "Réunion de l'APFC",
      sources: ["Réunion du Chef APFC avec tous les encadreurs", "Réunion de l'APFC avec les CRD (RTC)"],
    },
    { table: "actReunions", nature: "Séance de travail CRD", sources: ["Séance de travail au sein de la CRD"] },
    { table: "actReunions", nature: "Réunion/Séance de travail à la DRENA", sources: ["Réunion à la DRENA"] },
    { table: "actSuivi", nature: "Visites de classes /primaire/CAFOP", sources: ["Visites de classes / primaire/CAFOP"] },
    { table: "actSuivi", nature: "Visites de classes /secondaire", sources: ["Visites de classes"] },
    { table: "actSuivi", nature: "Atelier de formation /secondaire", sources: ["Ateliers de formation en direction des professeurs"] },
    { table: "actSuivi", nature: "Fréquentation de l'APFC par les enseignants", sources: ["Fréquentation de l'APFC par les enseignants"] },
    { table: "actSuivi", nature: "Contrôle des auxiliaires didactiques/entretien", sources: ["Contrôle des auxiliaires didactiques"] },
  ],
};

// Réexport pratique des types communs consommés avec ce module.
export type { AnalyseRapport, ZoneSupplementaire };
