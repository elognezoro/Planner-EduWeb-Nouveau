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

import { specialitesElementaires } from "./specialites";

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
/** Longueur maximale du titre d'une zone de saisie ou d'une section libre. */
export const MAX_TITRE_ZONE = 200;
/** Nombre maximal de sections libres (nouveaux titres) ajoutées au rapport. */
export const MAX_SECTIONS_LIBRES = 20;
/** Nombre maximal de zones de saisie supplémentaires par section. */
export const MAX_ZONES_PAR_SECTION = 10;

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

export interface AnalyseRapport {
  /** POINTS DE SATISFACTION. */
  satisfactions: string;
  /** INSUFFISANCES RELEVEES. */
  insuffisances: string;
  /** SOLUTIONS PROPOSEES. */
  solutions: string;
}

/** Zone de saisie ajoutée librement par l'utilisateur (petit titre + texte). */
export interface ZoneSupplementaire {
  id: string;
  titre: string;
  texte: string;
}

/** Section LIBRE (nouveau titre) ajoutée après les sections officielles. */
export interface SectionLibre {
  id: string;
  titre: string;
  zones: ZoneSupplementaire[];
}

/**
 * En-tête OFFICIEL du rapport, configurable selon le pays et l'antenne (consigne client) :
 * les 6 mentions du bloc à deux colonnes. Un champ VIDE retombe sur la valeur PAR DÉFAUT
 * calculée côté serveur d'après le pays et l'antenne (cf. `enteteParDefaut`, rapport-serveur)
 * — les armoiries restent celles du pays et ne se configurent pas ici.
 */
export interface EnteteRapport {
  ministere: string;
  directionRegionale: string;
  antenne: string;
  coordination: string;
  republique: string;
  devise: string;
}

/** En-tête entièrement vide (contenu par défaut pur — les défauts réels dépendent du serveur). */
export function enteteVide(): EnteteRapport {
  return { ministere: "", directionRegionale: "", antenne: "", coordination: "", republique: "", devise: "" };
}

/** Lecture tolérante du bloc `entete` (rapports antérieurs sans ce champ → vide, jamais d'exception). */
export function lireEntete(valeur: unknown): EnteteRapport {
  const o = valeur && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
  return {
    ministere: texteBorne(o.ministere, MAX_TITRE_ZONE),
    directionRegionale: texteBorne(o.directionRegionale, MAX_TITRE_ZONE),
    antenne: texteBorne(o.antenne, MAX_TITRE_ZONE),
    coordination: texteBorne(o.coordination, MAX_TITRE_ZONE),
    republique: texteBorne(o.republique, MAX_TITRE_ZONE),
    devise: texteBorne(o.devise, MAX_TITRE_ZONE),
  };
}

/** En-tête EFFECTIF : chaque mention vide retombe sur la valeur par défaut calculée. */
export function completerEntete(entete: EnteteRapport, defauts: EnteteRapport): EnteteRapport {
  return {
    ministere: entete.ministere.trim() || defauts.ministere,
    directionRegionale: entete.directionRegionale.trim() || defauts.directionRegionale,
    antenne: entete.antenne.trim() || defauts.antenne,
    coordination: entete.coordination.trim() || defauts.coordination,
    republique: entete.republique.trim() || defauts.republique,
    devise: entete.devise.trim() || defauts.devise,
  };
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
  /** Configuration libre : sections OFFICIELLES retirées de l'écran et du Word (données conservées). */
  sectionsMasquees: IdSectionOfficielle[];
  /** Configuration libre : zones de saisie ajoutées dans chaque section officielle. */
  zonesSupplementaires: Partial<Record<IdSectionOfficielle, ZoneSupplementaire[]>>;
  /** Configuration libre : sections à titre libre, rendues après les sections officielles. */
  sectionsLibres: SectionLibre[];
  /** En-tête officiel configurable (pays + antenne) — champs vides = défauts calculés serveur. */
  entete: EnteteRapport;
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
    sectionsMasquees: [],
    zonesSupplementaires: {},
    sectionsLibres: [],
    entete: enteteVide(),
  };
}

// ── Configuration libre : identifiants et lecteurs tolérants (fail-closed, jamais d'exception) ──

/** Identifiant court d'une zone/section libre — généré côté client, assaini côté serveur. */
export function nouvelId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Id accepté tel quel s'il est sain (chaîne courte alphanumérique), sinon re-généré. */
function idSur(v: unknown): string {
  return typeof v === "string" && /^[A-Za-z0-9-]{1,40}$/.test(v) ? v : nouvelId();
}

/** Zones d'une section (tableau JSON) — champ mal formé ignoré, bornes appliquées. */
function lireZones(valeur: unknown): ZoneSupplementaire[] {
  if (!Array.isArray(valeur)) return [];
  const zones: ZoneSupplementaire[] = [];
  for (const z of valeur.slice(0, MAX_ZONES_PAR_SECTION)) {
    if (!z || typeof z !== "object" || Array.isArray(z)) continue;
    const o = z as Record<string, unknown>;
    zones.push({ id: idSur(o.id), titre: texteBorne(o.titre, MAX_TITRE_ZONE), texte: texteBorne(o.texte) });
  }
  return zones;
}

/** Sections officielles retirées — seuls les identifiants officiels connus sont retenus. */
export function lireSectionsMasquees(valeur: unknown): IdSectionOfficielle[] {
  if (!Array.isArray(valeur)) return [];
  return [...new Set(valeur.filter((s): s is IdSectionOfficielle => typeof s === "string" && estSectionOfficielle(s)))];
}

/** Zones supplémentaires par section officielle — clés inconnues ignorées. */
export function lireZonesSupplementaires(valeur: unknown): Partial<Record<IdSectionOfficielle, ZoneSupplementaire[]>> {
  const resultat: Partial<Record<IdSectionOfficielle, ZoneSupplementaire[]>> = {};
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return resultat;
  for (const [cle, zones] of Object.entries(valeur as Record<string, unknown>)) {
    if (!estSectionOfficielle(cle)) continue;
    const lues = lireZones(zones);
    if (lues.length > 0) resultat[cle] = lues;
  }
  return resultat;
}

/** Sections libres (titre éditable + zones) — entrées mal formées ignorées, bornes appliquées. */
export function lireSectionsLibres(valeur: unknown): SectionLibre[] {
  if (!Array.isArray(valeur)) return [];
  const sections: SectionLibre[] = [];
  for (const s of valeur.slice(0, MAX_SECTIONS_LIBRES)) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const o = s as Record<string, unknown>;
    sections.push({ id: idSur(o.id), titre: texteBorne(o.titre, MAX_TITRE_ZONE), zones: lireZones(o.zones) });
  }
  return sections;
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
    // Configuration libre — RÉTRO-COMPATIBLE : les rapports enregistrés avant cette évolution
    // n'ont pas ces champs (lecture tolérante → valeurs vides, jamais d'exception).
    sectionsMasquees: lireSectionsMasquees(o.sectionsMasquees),
    zonesSupplementaires: lireZonesSupplementaires(o.zonesSupplementaires),
    sectionsLibres: lireSectionsLibres(o.sectionsLibres),
    entete: lireEntete(o.entete),
  };
}

// ── Modèle PERSONNEL de rapport (ModeleRapport.structure) — la CONFIGURATION seulement ──

/**
 * Structure d'un MODÈLE personnel de rapport : la configuration réutilisable (en-tête
 * personnalisé, sections masquées, sections libres et zones avec leurs titres/textes types,
 * titre type du bloc violet) — JAMAIS les données d'instance (tableaux chiffrés, membres,
 * introduction, analyse, conclusion).
 */
export interface StructureModele {
  /** Titre type du bloc violet (facultatif — vide = titre saisi au cas par cas). */
  titre: string;
  /** Mentions d'en-tête personnalisées (une mention vide n'écrase rien à l'application). */
  entete: EnteteRapport;
  sectionsMasquees: IdSectionOfficielle[];
  zonesSupplementaires: Partial<Record<IdSectionOfficielle, ZoneSupplementaire[]>>;
  sectionsLibres: SectionLibre[];
}

/** Lecture tolérante et bornée d'une `structure` de modèle (fail-closed, jamais d'exception). */
export function lireStructureModele(json: unknown): StructureModele {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return {
    titre: texteBorne(o.titre, MAX_TITRE_RAPPORT),
    entete: lireEntete(o.entete),
    sectionsMasquees: lireSectionsMasquees(o.sectionsMasquees),
    zonesSupplementaires: lireZonesSupplementaires(o.zonesSupplementaires),
    sectionsLibres: lireSectionsLibres(o.sectionsLibres),
  };
}

/**
 * Applique la STRUCTURE d'un modèle personnel à un contenu : la configuration du modèle
 * remplace celle du contenu (sections masquées, sections libres et zones types) et les
 * mentions d'en-tête NON VIDES du modèle priment ; tout le reste — tableaux chiffrés,
 * membres, introduction, analyse, conclusion, coordinateur — est INCHANGÉ.
 */
export function appliquerStructureModele(contenu: ContenuRapport, modele: StructureModele): ContenuRapport {
  return {
    ...contenu,
    sectionsMasquees: modele.sectionsMasquees,
    zonesSupplementaires: modele.zonesSupplementaires,
    sectionsLibres: modele.sectionsLibres,
    entete: completerEntete(modele.entete, contenu.entete),
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

/**
 * Disciplines ÉLÉMENTAIRES d'une valeur possiblement composite (« Anglais / EPS »,
 * « Français ; EDHC », « Histoire, Géographie ») : éclatement sur « ; » et « , » PUIS sur
 * « / » en RÉUTILISANT `specialitesElementaires` (specialites.ts — même convention que le
 * bloc Compétences) ; valeurs aiguisées, vides ignorées, dédoublonnées. Les sélecteurs de
 * discipline ne proposent JAMAIS de couples (consigne client).
 */
export function disciplinesElementaires(nom: string): string[] {
  return [...new Set(nom.split(/[;,]/).flatMap((partie) => specialitesElementaires(partie)))];
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
