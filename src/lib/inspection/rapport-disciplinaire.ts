/**
 * Rapport bilan de la Coordination Régionale Disciplinaire (CRD) — reproduction fidèle du
 * modèle officiel « Rapport bilan CRD » fourni par le client (page « Rapports Pédagogiques
 * Disciplinaires »).
 *
 * Module PUR (aucun import serveur — importable par les composants client) : types de la
 * structure `contenu` persistée en base (RapportDisciplinaire.contenu), colonnes officielles
 * des tableaux, lignes par défaut, bornes de validation et helpers de normalisation. SEULE
 * source de vérité de la structure, partagée par la page, le formulaire client, l'action
 * d'enregistrement et l'export Word.
 */

// ── Bornes de validation (appliquées côté serveur, jamais confiées au client) ──

/** Longueur maximale des textes narratifs (membres, introduction, analyse, conclusion). */
export const MAX_TEXTE_RAPPORT = 8000;
/** Longueur maximale d'une cellule de tableau. */
export const MAX_CELLULE_RAPPORT = 400;
/** Nombre maximal de lignes par tableau. */
export const MAX_LIGNES_TABLEAU = 40;
/** Longueur maximale du titre saisi (bloc violet) et du nom du coordinateur. */
export const MAX_TITRE_RAPPORT = 300;
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

// ── Structure persistée (RapportDisciplinaire.contenu) ──

export interface AnalyseRapport {
  /** POINTS DE SATISFACTION. */
  satisfactions: string;
  /** INSUFFISANCES RELEVEES. */
  insuffisances: string;
  /** SOLUTIONS PROPOSEES. */
  solutions: string;
}

/** Tableaux du rapport : chaque tableau = lignes de cellules TEXTE (toujours éditables). */
export interface ContenuRapport {
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
  analyse: AnalyseRapport;
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

// ── Helpers de construction et de normalisation ──

/** Ligne vide d'un tableau à `nbColonnes` colonnes. */
export function ligneVide(nbColonnes: number): string[] {
  return Array.from({ length: nbColonnes }, () => "");
}

/** Lignes par défaut d'un tableau : la nature/le niveau en première colonne, le reste vide. */
export function lignesDepuisLibelles(libelles: readonly string[], nbColonnes: number): string[][] {
  return libelles.map((libelle) => {
    const ligne = ligneVide(nbColonnes);
    ligne[0] = libelle;
    return ligne;
  });
}

/** Contenu vide (structure complète, tableaux avec leurs lignes par défaut). */
export function contenuParDefaut(): ContenuRapport {
  const premierCycle = lignesDepuisLibelles(NIVEAUX_PREMIER_CYCLE, COLONNES_PROGRAMMES_SECONDAIRE.length);
  const secondCycle = lignesDepuisLibelles(NIVEAUX_SECOND_CYCLE, COLONNES_PROGRAMMES_SECONDAIRE.length);
  return {
    membres: "",
    introduction: "",
    activitesPrimaire: lignesDepuisLibelles(ACTIVITES_PRIMAIRE_DEFAUT, COLONNES_ACTIVITES.length),
    activitesSecondaire: lignesDepuisLibelles(ACTIVITES_SECONDAIRE_DEFAUT, COLONNES_ACTIVITES.length),
    activitesComplement: lignesDepuisLibelles(ACTIVITES_COMPLEMENT_DEFAUT, COLONNES_ACTIVITES_COMPLEMENT.length),
    programmesCafop: lignesDepuisLibelles(NIVEAUX_CAFOP, COLONNES_PROGRAMMES_CAFOP.length),
    programmesPremierCycle: premierCycle,
    programmesSecondCycle: secondCycle,
    analyse: {
      satisfactions: ANALYSE_TRAME_DEFAUT,
      insuffisances: ANALYSE_TRAME_DEFAUT,
      solutions: ANALYSE_TRAME_DEFAUT,
    },
    conclusion: "",
    coordinateur: "",
  };
}

/** Texte narratif borné (lecture tolérante d'une valeur inconnue). */
function texteBorne(v: unknown, max = MAX_TEXTE_RAPPORT): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * Normalise un tableau de provenance inconnue (JSON en base) : lignes bornées à
 * MAX_LIGNES_TABLEAU, cellules recalées sur `nbColonnes` et bornées à MAX_CELLULE_RAPPORT.
 */
export function normaliserTableau(valeur: unknown, nbColonnes: number): string[][] {
  if (!Array.isArray(valeur)) return [];
  return valeur.slice(0, MAX_LIGNES_TABLEAU).map((ligne) => {
    const cellules = Array.isArray(ligne) ? ligne : [];
    return Array.from({ length: nbColonnes }, (_, i) => {
      const c: unknown = cellules[i];
      return typeof c === "string" ? c.slice(0, MAX_CELLULE_RAPPORT) : "";
    });
  });
}

/**
 * Validation STRICTE d'un tableau soumis par le formulaire (structure attendue exactement :
 * lignes ≤ 40, chaque ligne = `nbColonnes` cellules texte ≤ 400 caractères).
 */
export function estTableauValide(v: unknown, nbColonnes: number): v is string[][] {
  return (
    Array.isArray(v) &&
    v.length <= MAX_LIGNES_TABLEAU &&
    v.every(
      (ligne) =>
        Array.isArray(ligne) &&
        ligne.length === nbColonnes &&
        ligne.every((c) => typeof c === "string" && c.length <= MAX_CELLULE_RAPPORT),
    )
  );
}

/**
 * Relit un `contenu` JSON (base de données) en structure sûre — tolérant aux données
 * partielles : champ absent → valeur vide, tableau mal formé → normalisé.
 */
export function lireContenuRapport(json: unknown): ContenuRapport {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const a =
    o.analyse && typeof o.analyse === "object" && !Array.isArray(o.analyse)
      ? (o.analyse as Record<string, unknown>)
      : {};
  return {
    membres: texteBorne(o.membres),
    introduction: texteBorne(o.introduction),
    activitesPrimaire: normaliserTableau(o.activitesPrimaire, TABLEAUX_RAPPORT.activitesPrimaire),
    activitesSecondaire: normaliserTableau(o.activitesSecondaire, TABLEAUX_RAPPORT.activitesSecondaire),
    activitesComplement: normaliserTableau(o.activitesComplement, TABLEAUX_RAPPORT.activitesComplement),
    programmesCafop: normaliserTableau(o.programmesCafop, TABLEAUX_RAPPORT.programmesCafop),
    programmesPremierCycle: normaliserTableau(o.programmesPremierCycle, TABLEAUX_RAPPORT.programmesPremierCycle),
    programmesSecondCycle: normaliserTableau(o.programmesSecondCycle, TABLEAUX_RAPPORT.programmesSecondCycle),
    analyse: {
      satisfactions: texteBorne(a.satisfactions),
      insuffisances: texteBorne(a.insuffisances),
      solutions: texteBorne(a.solutions),
    },
    conclusion: texteBorne(o.conclusion),
    coordinateur: texteBorne(o.coordinateur, MAX_TITRE_RAPPORT),
  };
}

// ── Helpers numériques (pré-remplissage des taux + diagrammes en ligne) ──

/** Nombre lu dans une cellule (« 12 », « 75 % », « 3,5 »…) — null si non numérique. */
export function nombreDeCellule(s: string): number | null {
  const n = Number.parseFloat(s.replace(/\s/g, "").replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Pourcentage arrondi « 75 % » — chaîne vide si le dénominateur est nul (reste éditable). */
export function pourcentage(numerateur: number, denominateur: number): string {
  if (!Number.isFinite(numerateur) || !Number.isFinite(denominateur) || denominateur <= 0) return "";
  return `${Math.round((numerateur / denominateur) * 100)} %`;
}

/** Échappement HTML minimal (export Word : contenu utilisateur inséré dans du HTML). */
export function echapperHtmlRapport(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
