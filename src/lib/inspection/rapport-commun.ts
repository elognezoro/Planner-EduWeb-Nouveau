/**
 * Briques COMMUNES des rapports narratifs d'inspection (rapport bilan CRD, rapports
 * trimestriel et annuel d'antenne) : bornes de validation, en-tête officiel configurable,
 * configuration libre (zones de saisie, sections libres, sections retirées), tableaux
 * éditables, modèles personnels, helpers numériques et d'échappement.
 *
 * Module PUR (aucun import serveur — importable par les composants client). Les structures
 * SPÉCIFIQUES à chaque rapport (colonnes officielles, lignes par défaut, sections) vivent
 * dans `rapport-disciplinaire.ts` (CRD) et `rapport-antenne.ts` (trimestriel/annuel), qui
 * réutilisent ces briques — jamais dupliquées.
 */

import { specialitesElementaires } from "./specialites";

// ── Bornes de validation (appliquées côté serveur, jamais confiées au client) ──

/** Longueur maximale des textes narratifs (membres, introduction, analyse, conclusion). */
export const MAX_TEXTE_RAPPORT = 8000;
/** Longueur maximale d'une cellule de tableau. */
export const MAX_CELLULE_RAPPORT = 400;
/** Nombre maximal de lignes par tableau. */
export const MAX_LIGNES_TABLEAU = 40;
/** Longueur maximale du titre saisi (bloc violet) et des noms de signataires. */
export const MAX_TITRE_RAPPORT = 300;
/** Longueur maximale du titre d'une zone de saisie ou d'une section libre. */
export const MAX_TITRE_ZONE = 200;
/** Nombre maximal de sections libres (nouveaux titres) ajoutées à un rapport. */
export const MAX_SECTIONS_LIBRES = 20;
/** Nombre maximal de zones de saisie supplémentaires par section. */
export const MAX_ZONES_PAR_SECTION = 10;

/** Texte borné, lu de façon tolérante depuis une valeur inconnue. */
export function texteBorne(v: unknown, max = MAX_TEXTE_RAPPORT): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// ── Analyse en 3 volets (POINTS DE SATISFACTION | INSUFFISANCES | SOLUTIONS) ──

export interface AnalyseRapport {
  /** POINTS DE SATISFACTION. */
  satisfactions: string;
  /** INSUFFISANCES RELEVEES. */
  insuffisances: string;
  /** SOLUTIONS PROPOSEES. */
  solutions: string;
}

/** Lecture tolérante d'un bloc d'analyse (champ absent → vide). */
export function lireAnalyse(valeur: unknown): AnalyseRapport {
  const a = valeur && typeof valeur === "object" && !Array.isArray(valeur) ? (valeur as Record<string, unknown>) : {};
  return {
    satisfactions: texteBorne(a.satisfactions),
    insuffisances: texteBorne(a.insuffisances),
    solutions: texteBorne(a.solutions),
  };
}

// ── En-tête officiel configurable (2 colonnes du modèle Word) ──

/**
 * En-tête OFFICIEL d'un rapport, configurable selon le pays et l'antenne : les 6 mentions du
 * bloc à deux colonnes. Un champ VIDE retombe sur la valeur PAR DÉFAUT calculée côté serveur
 * (cf. `enteteBaseApfc`, portee-apfc-rapports) — les armoiries restent celles du pays.
 */
export interface EnteteRapport {
  ministere: string;
  directionRegionale: string;
  antenne: string;
  coordination: string;
  republique: string;
  devise: string;
}

/** En-tête entièrement vide (les défauts réels dépendent du serveur). */
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

// ── Configuration libre : zones de saisie et sections libres ──

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

/** Identifiant court d'une zone/section libre — généré côté client, assaini côté serveur. */
export function nouvelId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Id accepté tel quel s'il est sain (chaîne courte alphanumérique), sinon re-généré. */
function idSur(v: unknown): string {
  return typeof v === "string" && /^[A-Za-z0-9-]{1,40}$/.test(v) ? v : nouvelId();
}

/** Zones d'une section (tableau JSON) — champ mal formé ignoré, bornes appliquées. */
export function lireZones(valeur: unknown): ZoneSupplementaire[] {
  if (!Array.isArray(valeur)) return [];
  const zones: ZoneSupplementaire[] = [];
  for (const z of valeur.slice(0, MAX_ZONES_PAR_SECTION)) {
    if (!z || typeof z !== "object" || Array.isArray(z)) continue;
    const o = z as Record<string, unknown>;
    zones.push({ id: idSur(o.id), titre: texteBorne(o.titre, MAX_TITRE_ZONE), texte: texteBorne(o.texte) });
  }
  return zones;
}

/** Sections officielles retirées — seuls les identifiants VALIDES pour le rapport sont retenus. */
export function lireSectionsMasqueesParmi<T extends string>(
  valeur: unknown,
  estValide: (v: string) => v is T,
): T[] {
  if (!Array.isArray(valeur)) return [];
  return [...new Set(valeur.filter((s): s is T => typeof s === "string" && estValide(s)))];
}

/** Zones supplémentaires par section officielle — clés inconnues ignorées. */
export function lireZonesSupplementairesParmi<T extends string>(
  valeur: unknown,
  estValide: (v: string) => v is T,
): Partial<Record<T, ZoneSupplementaire[]>> {
  const resultat: Partial<Record<T, ZoneSupplementaire[]>> = {};
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return resultat;
  for (const [cle, zones] of Object.entries(valeur as Record<string, unknown>)) {
    if (!estValide(cle)) continue;
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

// ── Tableaux éditables (lignes de cellules texte) ──

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
 * Champs de CONFIGURATION portés par le contenu de tout rapport configurable (CRD, antenne) :
 * sections officielles retirées, zones supplémentaires par section, sections libres, en-tête.
 */
export interface ContenusConfigurables<T extends string> {
  sectionsMasquees: T[];
  zonesSupplementaires: Partial<Record<T, ZoneSupplementaire[]>>;
  sectionsLibres: SectionLibre[];
  entete: EnteteRapport;
}

// ── Modèles PERSONNELS de rapport (ModeleRapport.structure) — la CONFIGURATION seulement ──

/**
 * Structure d'un MODÈLE personnel : configuration réutilisable (en-tête personnalisé,
 * sections masquées, sections libres et zones types, titre type) — JAMAIS les données
 * d'instance. Générique sur l'ensemble `T` des identifiants de sections officielles du
 * rapport concerné (CRD / antenne).
 */
export interface StructureModeleDe<T extends string> {
  titre: string;
  entete: EnteteRapport;
  sectionsMasquees: T[];
  zonesSupplementaires: Partial<Record<T, ZoneSupplementaire[]>>;
  sectionsLibres: SectionLibre[];
}

/** Lecture tolérante et bornée d'une `structure` de modèle (fail-closed, jamais d'exception). */
export function lireStructureModeleDe<T extends string>(
  json: unknown,
  estValide: (v: string) => v is T,
): StructureModeleDe<T> {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return {
    titre: texteBorne(o.titre, MAX_TITRE_RAPPORT),
    entete: lireEntete(o.entete),
    sectionsMasquees: lireSectionsMasqueesParmi(o.sectionsMasquees, estValide),
    zonesSupplementaires: lireZonesSupplementairesParmi(o.zonesSupplementaires, estValide),
    sectionsLibres: lireSectionsLibres(o.sectionsLibres),
  };
}

/**
 * Applique la STRUCTURE d'un modèle personnel à un contenu : la configuration du modèle
 * remplace celle du contenu (sections masquées, sections libres et zones types) et les
 * mentions d'en-tête NON VIDES du modèle priment ; tout le reste (données d'instance)
 * est INCHANGÉ.
 */
export function appliquerStructureModeleDe<
  T extends string,
  C extends {
    sectionsMasquees: T[];
    zonesSupplementaires: Partial<Record<T, ZoneSupplementaire[]>>;
    sectionsLibres: SectionLibre[];
    entete: EnteteRapport;
  },
>(contenu: C, modele: StructureModeleDe<T>): C {
  return {
    ...contenu,
    sectionsMasquees: modele.sectionsMasquees,
    zonesSupplementaires: modele.zonesSupplementaires,
    sectionsLibres: modele.sectionsLibres,
    entete: completerEntete(modele.entete, contenu.entete),
  };
}

// ── Helpers numériques (pré-remplissage des taux, agrégations + diagrammes en ligne) ──

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

/** Normalisation pour comparaisons insensibles à la casse et aux accents. */
export function normaliserComparaison(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
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
