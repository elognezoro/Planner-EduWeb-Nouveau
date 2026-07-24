/**
 * Rapports narratifs d'ANTENNE (APFC) — page « Rapports d'antennes », rapports TRIMESTRIEL
 * et ANNUEL calqués sur les rapports réels de l'APFC de Yamoussoukro fournis par le client.
 *
 * CONTENU v2 : le rapport est un PLAN — une liste ordonnée de SECTIONS saisies par
 * l'utilisateur (titre + niveau 1/2/3, narratif, tableaux AUTO-générés ou manuels,
 * diagrammes en ligne). Les blocs AUTO du catalogue sont calculés côté serveur pour la
 * FENÊTRE DE PÉRIODE choisie (champ « Du … au … ») puis restent éditables.
 *
 * Module PUR (aucun import serveur — importable par les composants client). Briques
 * génériques dans `rapport-commun.ts` — jamais dupliquées.
 */

import {
  MAX_CELLULE_RAPPORT,
  MAX_LIGNES_TABLEAU,
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  MAX_TITRE_ZONE,
  enteteVide,
  lireEntete,
  nouvelId,
  texteBorne,
  type EnteteRapport,
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
  { code: "T2", libelle: "2e trimestre (déc. – févr.)", nomLong: "DEUXIÈME" },
  { code: "T3", libelle: "3e trimestre (mars – mai)", nomLong: "TROISIÈME" },
] as const;

export function estCodeTrimestre(v: string): v is CodeTrimestre {
  return TRIMESTRES.some((t) => t.code === v);
}

export function nomLongTrimestre(code: CodeTrimestre): string {
  return TRIMESTRES.find((t) => t.code === code)?.nomLong ?? "PREMIER";
}

/** Libellé du trimestre SUIVANT (section « PERSPECTIVES POUR LE … » du rapport réel). */
export function libelleTrimestreSuivant(code: CodeTrimestre): string {
  if (code === "T1") return "DEUXIÈME TRIMESTRE";
  if (code === "T2") return "TROISIÈME TRIMESTRE";
  return "PREMIER TRIMESTRE DE L'ANNÉE SCOLAIRE SUIVANTE";
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

/** Période persistée (CLÉ du rapport) : « 2025-2026-T1 » (trimestriel) ou « 2025-2026 » (annuel). */
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

// ── Fenêtre des DONNÉES (champ « Du … au … », modifiable — détermine tous les blocs auto) ──

/** Fenêtre UTC [début, fin exclusive) par défaut d'une période scolaire. */
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

/** Fenêtre effective des données : dates ISO inclusives + bornes UTC de requête. */
export interface FenetreDonnees {
  debut: Date;
  finExclusive: Date;
  /** « YYYY-MM-DD » inclusifs (champs de saisie, stockage `contenu.periode`, rappel document). */
  debutIso: string;
  finIso: string;
}

const enIso = (d: Date): string => d.toISOString().slice(0, 10);
const JOUR_MS = 24 * 60 * 60 * 1000;

/** « YYYY-MM-DD » plausible (année 2000-2100, date réelle). */
export function estDateIsoValide(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  const annee = d.getUTCFullYear();
  return !Number.isNaN(d.getTime()) && enIso(d) === v && annee >= 2000 && annee <= 2100;
}

/**
 * Fenêtre EFFECTIVE des données : `?debut=&fin=` (ISO, inclusifs) s'ils sont valides et
 * ordonnés (début ≤ fin), sinon REPLI sur la fenêtre par défaut de la période (fail-closed).
 */
export function lireFenetre(periode: PeriodeAntenne, debutParam?: unknown, finParam?: unknown): FenetreDonnees {
  if (estDateIsoValide(debutParam) && estDateIsoValide(finParam) && debutParam <= finParam) {
    const debut = new Date(`${debutParam}T00:00:00.000Z`);
    const finExclusive = new Date(new Date(`${finParam}T00:00:00.000Z`).getTime() + JOUR_MS);
    return { debut, finExclusive, debutIso: debutParam, finIso: finParam };
  }
  const { debut, fin } = fenetrePeriode(periode);
  return { debut, finExclusive: fin, debutIso: enIso(debut), finIso: enIso(new Date(fin.getTime() - JOUR_MS)) };
}

/** Date ISO « YYYY-MM-DD » au format français long (rappel de période, titres). */
export function dateIsoEnFrancais(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Titre TYPE du bloc violet (modèles réels de Yamoussoukro). */
export function titreTypeAntenne(type: TypeRapportAntenne, periode: PeriodeAntenne): string {
  if (type === "annuel") return `RAPPORT ANNUEL D'ACTIVITÉS ${periode.annee}`;
  return `BILAN DES ACTIVITÉS PÉDAGOGIQUES MENÉES AU ${nomLongTrimestre(periode.trimestre ?? "T1")} TRIMESTRE ${periode.annee}`;
}

// ── Ordres d'enseignement ──

export const ORDRES = [
  { cle: "secondaire", libelle: "AU SECONDAIRE", court: "Secondaire" },
  { cle: "primaire", libelle: "AU PRÉSCOLAIRE ET AU PRIMAIRE", court: "Primaire" },
  { cle: "cafop", libelle: "AU CAFOP", court: "CAFOP" },
] as const;

export type Ordre = (typeof ORDRES)[number]["cle"];

// ── Catalogue des BLOCS AUTO (tableaux générés pour la fenêtre) et des DIAGRAMMES ──

export const BLOCS_AUTO = [
  { cle: "activites-secondaire", libelle: "Activités menées — Secondaire", source: "Visites, grilles et sessions de la période (établissements couverts du secondaire)" },
  { cle: "activites-primaire", libelle: "Activités menées — Primaire", source: "Visites et grilles de la période (établissements couverts du préscolaire-primaire)" },
  { cle: "activites-cafop", libelle: "Activités menées — CAFOP", source: "Visites et grilles de la période (structures couvertes de type CAFOP)" },
  { cle: "recap-activites", libelle: "Récapitulatif des activités menées par ordre d'enseignement", source: "Somme des activités de la période par ordre" },
  { cle: "recap-touches", libelle: "Récapitulatif des enseignants touchés par ordre d'enseignement", source: "Enseignants distincts visités sur la période, par ordre" },
  { cle: "tableau-crd-encadreurs", libelle: "Répartition des Encadreurs Pédagogiques par CRD", source: "Personnel de l'antenne et conseillers rattachés (disciplines × fonctions)" },
  { cle: "axe-2-secondaire", libelle: "AXE 2 pré-chiffré — Secondaire", source: "Visites et grilles de la période (secondaire)" },
  { cle: "axe-2-primaire", libelle: "AXE 2 pré-chiffré — Préscolaire/Primaire", source: "Visites et grilles de la période (préscolaire-primaire)" },
  { cle: "axe-2-cafop", libelle: "AXE 2 pré-chiffré — CAFOP", source: "Visites et grilles de la période (CAFOP)" },
  { cle: "axe-3-secondaire", libelle: "AXE 3 pré-chiffré — Secondaire", source: "Sessions de formation continue de l'antenne sur la période" },
  { cle: "axe-3-primaire", libelle: "AXE 3 pré-chiffré — Préscolaire/Primaire", source: "Sessions de formation continue de l'antenne sur la période" },
  { cle: "axe-3-cafop", libelle: "AXE 3 pré-chiffré — CAFOP", source: "Sessions de formation continue de l'antenne sur la période" },
  { cle: "axes-vide", libelle: "Tableau d'axe vierge (6 colonnes)", source: "Saisie libre" },
  { cle: "agregation-crd", libelle: "Agrégation des rapports CRD enregistrés", source: "Sommes des tableaux des rapports de coordination disciplinaire" },
  { cle: "agregation-trimestriels", libelle: "Agrégation des rapports trimestriels enregistrés", source: "Sommes des récapitulatifs des rapports trimestriels de l'année" },
] as const;

export type CleBlocAuto = (typeof BLOCS_AUTO)[number]["cle"];

export function estCleBlocAuto(v: string): v is CleBlocAuto {
  return BLOCS_AUTO.some((b) => b.cle === v);
}

export function libelleBlocAuto(cle: CleBlocAuto): string {
  return BLOCS_AUTO.find((b) => b.cle === cle)?.libelle ?? cle;
}

export function sourceBlocAuto(cle: CleBlocAuto): string {
  return BLOCS_AUTO.find((b) => b.cle === cle)?.source ?? "";
}

export const GRAPHIQUES_AUTO = [
  { cle: "graphique-touches-secondaire", libelle: "Diagramme — Activités et touchés (Secondaire)" },
  { cle: "graphique-touches-primaire", libelle: "Diagramme — Activités et touchés (Primaire)" },
  { cle: "graphique-touches-cafop", libelle: "Diagramme — Activités et touchés (CAFOP)" },
  { cle: "graphique-recap", libelle: "Diagramme récapitulatif — Activités vs Touchés par ordre" },
] as const;

export type CleGraphique = (typeof GRAPHIQUES_AUTO)[number]["cle"];

export function estCleGraphique(v: string): v is CleGraphique {
  return GRAPHIQUES_AUTO.some((g) => g.cle === v);
}

export function libelleGraphique(cle: CleGraphique): string {
  return GRAPHIQUES_AUTO.find((g) => g.cle === cle)?.libelle ?? cle;
}

/** Bloc « activités » dont se nourrit un diagramme par ordre (null = diagramme récapitulatif). */
export function sourceTableauDuGraphique(cle: CleGraphique): CleBlocAuto | null {
  if (cle === "graphique-touches-secondaire") return "activites-secondaire";
  if (cle === "graphique-touches-primaire") return "activites-primaire";
  if (cle === "graphique-touches-cafop") return "activites-cafop";
  return null;
}

// ── Colonnes officielles (rapports réels) et référentiels de lignes ──

export const COLONNES_ACTIVITES_ORDRE = ["Activités menées", "Nombre d'activités", "Enseignants touchés"] as const;
export const COLONNES_RECAP = ["Secondaire", "Primaire", "CAFOP", "Total"] as const;
export const COLONNES_AXES = [
  "ACTIONS PROGRAMMÉES",
  "ACTIVITÉS MENÉES",
  "NBRE",
  "INDICATEURS DE PERFORMANCE",
  "DIFFICULTÉS RENCONTRÉES",
  "PROPOSITIONS DE SOLUTIONS",
] as const;
export const COLONNES_PROGRAMME = [
  "Discipline / Niveau",
  "Nombre total de leçons prévues",
  "Nombre de leçons exécutées",
  "Taux d'exécution (%)",
] as const;
export const COLONNES_AGREGATION_CRD = ["Nature de l'activité", "Prévue", "Réalisée", "Touchés", "Attendus"] as const;

/** Lignes types des tableaux « Activités menées » par ordre (rapport trimestriel réel). */
export const ACTIVITES_ORDRE_LIGNES = [
  "Visites de classe",
  "Classes ouvertes",
  "Ateliers de formation des enseignants",
  "Contrôle des auxiliaires pédagogiques",
] as const;

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
export const DISCIPLINES_CAFOP_DEFAUT = ["EDHC", "CAV", "FRANÇAIS", "HISTOIRE-GÉO"] as const;
export const NIVEAUX_PRESCOLAIRE = ["Petite section", "Moyenne section", "Grande section"] as const;
export const NIVEAUX_PRIMAIRE = ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"] as const;

/** Les 7 axes du bilan annuel (rapport réel de Yamoussoukro). */
export const AXES_ANNUELS = [
  "AXE 1 : GOUVERNANCE ET PROMOTION DE L'APFC",
  "AXE 2 : SUIVI ET ENCADREMENT PÉDAGOGIQUES DES ENSEIGNANTS",
  "AXE 3 : RENFORCEMENT DES CAPACITÉS",
  "AXE 4 : PRODUCTION ET DOCUMENTATION",
  "AXE 5 : SUIVI DES DIFFÉRENTS PROJETS",
  "AXE 6 : ÉVALUATION",
  "AXE 7 : AUTRES ACTIVITÉS",
] as const;

/** Missions types de l'APFC (section I du rapport trimestriel réel) — narratif modifiable. */
export const MISSIONS_APFC_DEFAUT = [
  "- diffuser les textes officiels et les documents pédagogiques auprès des établissements et des enseignants ;",
  "- veiller à l'application des instructions officielles et des programmes éducatifs ;",
  "- suivre l'état d'exécution des programmes dans les établissements ;",
  "- suivre la mise en œuvre des innovations pédagogiques ;",
  "- identifier les besoins de formation des enseignants ;",
  "- assurer la formation continue, le suivi et l'encadrement pédagogiques des enseignants ;",
  "- participer à l'organisation et au déroulement des examens et concours scolaires.",
].join("\n");

// ── Structure v2 persistée (RapportAntenne.contenu) ──

export const VERSION_CONTENU_ANTENNE = 2;
export const MAX_SECTIONS_PLAN = 80;
export const MAX_TABLEAUX_PAR_SECTION = 10;
export const MAX_COLONNES_TABLEAU = 12;
export const MAX_GRAPHIQUES_PAR_SECTION = 6;

export type NiveauTitre = 1 | 2 | 3;

export function estNiveauTitre(v: unknown): v is NiveauTitre {
  return v === 1 || v === 2 || v === 3;
}

/** Tableau d'une section : AUTO (source du catalogue, inséré avec ses chiffres) ou MANUEL. */
export interface TableauSection {
  id: string;
  /** Clé du bloc AUTO du catalogue — null pour un tableau manuel. */
  source: CleBlocAuto | null;
  titre: string;
  colonnes: string[];
  lignes: string[][];
}

/** Section du PLAN saisi : titre hiérarchisé + narratif + tableaux + diagrammes. */
export interface SectionPlan {
  id: string;
  niveau: NiveauTitre;
  titre: string;
  texte: string;
  /** Vrai pour « PLAN DE PRÉSENTATION » : contenu GÉNÉRÉ (titres de niveau 1), non éditable. */
  planAuto: boolean;
  tableaux: TableauSection[];
  graphiques: CleGraphique[];
}

/** Fenêtre de période RETENUE par le rapport (« YYYY-MM-DD » inclusifs, rappelée au document). */
export interface PeriodeDonnees {
  debut: string;
  fin: string;
}

export interface ContenuRapportAntenne {
  version: 2;
  /** Fenêtre des données ayant servi aux blocs auto. */
  periode: PeriodeDonnees;
  sections: SectionPlan[];
  entete: EnteteRapport;
  /** Nom du Chef d'Antenne (bloc signature). */
  signataire: string;
}

// ── Constructeurs ──

export function sectionVide(niveau: NiveauTitre = 1): SectionPlan {
  return { id: nouvelId(), niveau, titre: "", texte: "", planAuto: false, tableaux: [], graphiques: [] };
}

export function tableauManuelVide(): TableauSection {
  return {
    id: nouvelId(),
    source: null,
    titre: "",
    colonnes: ["Colonne 1", "Colonne 2", "Colonne 3"],
    lignes: [["", "", ""]],
  };
}

// ── Lecteurs TOLÉRANTS (fail-closed, jamais d'exception) ──

const cellule = (v: unknown): string => (typeof v === "string" ? v.slice(0, MAX_CELLULE_RAPPORT) : "");

function idSur(v: unknown): string {
  return typeof v === "string" && /^[A-Za-z0-9-]{1,40}$/.test(v) ? v : nouvelId();
}

/** Tableau de section — colonnes/lignes bornées, source validée (sinon manuel). */
export function lireTableauSection(v: unknown): TableauSection {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const colonnes = (Array.isArray(o.colonnes) ? o.colonnes : []).slice(0, MAX_COLONNES_TABLEAU).map(cellule);
  const nb = Math.max(colonnes.length, 1);
  const lignes = (Array.isArray(o.lignes) ? o.lignes : []).slice(0, MAX_LIGNES_TABLEAU).map((l) => {
    const cellules = Array.isArray(l) ? l : [];
    return Array.from({ length: nb }, (_, i) => cellule(cellules[i]));
  });
  return {
    id: idSur(o.id),
    source: typeof o.source === "string" && estCleBlocAuto(o.source) ? o.source : null,
    titre: texteBorne(o.titre, MAX_TITRE_ZONE),
    colonnes: colonnes.length ? colonnes : ["Colonne 1"],
    lignes,
  };
}

/** Sections du plan — niveaux/titres/textes/tableaux/graphiques bornés et validés. */
export function lireSectionsPlan(v: unknown): SectionPlan[] {
  if (!Array.isArray(v)) return [];
  const sections: SectionPlan[] = [];
  for (const s of v.slice(0, MAX_SECTIONS_PLAN)) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const o = s as Record<string, unknown>;
    sections.push({
      id: idSur(o.id),
      niveau: estNiveauTitre(o.niveau) ? o.niveau : 1,
      titre: texteBorne(o.titre, MAX_TITRE_ZONE),
      texte: texteBorne(o.texte, MAX_TEXTE_RAPPORT),
      planAuto: o.planAuto === true,
      tableaux: (Array.isArray(o.tableaux) ? o.tableaux : []).slice(0, MAX_TABLEAUX_PAR_SECTION).map(lireTableauSection),
      graphiques: (Array.isArray(o.graphiques) ? o.graphiques : [])
        .filter((g): g is CleGraphique => typeof g === "string" && estCleGraphique(g))
        .slice(0, MAX_GRAPHIQUES_PAR_SECTION),
    });
  }
  return sections;
}

/** Fenêtre stockée dans le contenu (repli neutre si absente/mal formée). */
export function lirePeriodeDonnees(v: unknown): PeriodeDonnees {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    debut: estDateIsoValide(o.debut) ? o.debut : "",
    fin: estDateIsoValide(o.fin) ? o.fin : "",
  };
}

/**
 * Contenu v2 — `null` si le JSON n'est PAS au format v2 (rapport de l'ANCIEN format fixe :
 * l'appelant conserve l'en-tête/titre puis repart du PLAN PAR DÉFAUT, sans jamais planter).
 */
export function lireContenuAntenneV2(json: unknown): ContenuRapportAntenne | null {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  if (o.version !== VERSION_CONTENU_ANTENNE) return null;
  return {
    version: 2,
    periode: lirePeriodeDonnees(o.periode),
    sections: lireSectionsPlan(o.sections),
    entete: lireEntete(o.entete),
    signataire: texteBorne(o.signataire, MAX_TITRE_RAPPORT),
  };
}

/** En-tête relu depuis un contenu de format INCONNU (rétro-compatibilité ancien format). */
export function enteteDepuisContenuInconnu(json: unknown): EnteteRapport {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return lireEntete(o.entete);
}

// ── Modèle personnel (typeRapport « antenne-trimestriel » / « antenne-annuel ») ──

/**
 * Modèle personnel v2 = le PLAN SANS LES CHIFFRES : sections (niveaux, titres, textes types,
 * tableaux — les tableaux AUTO y sont stockés SANS lignes et re-générés à l'application),
 * en-tête personnalisé et titre type. `ModeleRapport.typeRapport` inchangé.
 */
export interface StructureModeleAntenne {
  titre: string;
  entete: EnteteRapport;
  sections: SectionPlan[];
}

export function lireStructureModeleAntenne(json: unknown): StructureModeleAntenne {
  const o = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  return {
    titre: texteBorne(o.titre, MAX_TITRE_RAPPORT),
    entete: lireEntete(o.entete),
    sections: lireSectionsPlan(o.sections),
  };
}

/** PLAN « sans les chiffres » : les lignes des tableaux AUTO sont vidées (config seulement). */
export function depouillerPourModele(sections: SectionPlan[]): SectionPlan[] {
  return sections.map((s) => ({
    ...s,
    tableaux: s.tableaux.map((t) => (t.source ? { ...t, lignes: [] } : t)),
  }));
}

/** Valeur `ModeleRapport.typeRapport` du modèle personnel de chaque type de rapport. */
export function typeModeleAntenne(type: TypeRapportAntenne): string {
  return type === "trimestriel" ? "antenne-trimestriel" : "antenne-annuel";
}

// ── Spécification des blocs AUTO (titre + colonnes de repli — les lignes viennent du serveur) ──

export const SPEC_BLOCS: Record<CleBlocAuto, { titre: string; colonnes: readonly string[] }> = {
  "activites-secondaire": { titre: "Secondaire", colonnes: COLONNES_ACTIVITES_ORDRE },
  "activites-primaire": { titre: "Primaire", colonnes: COLONNES_ACTIVITES_ORDRE },
  "activites-cafop": { titre: "CAFOP", colonnes: COLONNES_ACTIVITES_ORDRE },
  "recap-activites": { titre: "Tableau récapitulatif des activités menées par ordre d'enseignement", colonnes: COLONNES_RECAP },
  "recap-touches": { titre: "Tableau récapitulatif du nombre d'enseignants touchés par ordre d'enseignement", colonnes: COLONNES_RECAP },
  "tableau-crd-encadreurs": { titre: "Répartition des Encadreurs Pédagogiques par CRD", colonnes: ["CRD", "Effectif"] },
  "axe-2-secondaire": { titre: "AXE 2 — Suivi et encadrement pédagogiques (Secondaire)", colonnes: COLONNES_AXES },
  "axe-2-primaire": { titre: "AXE 2 — Suivi et encadrement pédagogiques (Préscolaire/Primaire)", colonnes: COLONNES_AXES },
  "axe-2-cafop": { titre: "AXE 2 — Suivi et encadrement pédagogiques (CAFOP)", colonnes: COLONNES_AXES },
  "axe-3-secondaire": { titre: "AXE 3 — Renforcement des capacités (Secondaire)", colonnes: COLONNES_AXES },
  "axe-3-primaire": { titre: "AXE 3 — Renforcement des capacités (Préscolaire/Primaire)", colonnes: COLONNES_AXES },
  "axe-3-cafop": { titre: "AXE 3 — Renforcement des capacités (CAFOP)", colonnes: COLONNES_AXES },
  "axes-vide": { titre: "Tableau d'axe", colonnes: COLONNES_AXES },
  "agregation-crd": { titre: "Agrégation des rapports CRD enregistrés", colonnes: COLONNES_AGREGATION_CRD },
  "agregation-trimestriels": { titre: "Agrégation des rapports trimestriels enregistrés", colonnes: ["Indicateur", ...COLONNES_RECAP] },
};

/** Tableau AUTO « à blanc » (les lignes chiffrées sont posées par le serveur). */
export function tableauAutoStub(cle: CleBlocAuto): TableauSection {
  return {
    id: nouvelId(),
    source: cle,
    titre: SPEC_BLOCS[cle].titre,
    colonnes: [...SPEC_BLOCS[cle].colonnes],
    lignes: [],
  };
}

// ── PLANS PAR DÉFAUT (fidèles aux deux rapports réels de Yamoussoukro) ──

function section(
  niveau: NiveauTitre,
  titre: string,
  options?: Partial<Pick<SectionPlan, "texte" | "planAuto" | "tableaux" | "graphiques">>,
): SectionPlan {
  return {
    id: nouvelId(),
    niveau,
    titre,
    texte: options?.texte ?? "",
    planAuto: options?.planAuto ?? false,
    tableaux: options?.tableaux ?? [],
    graphiques: options?.graphiques ?? [],
  };
}

/** Tableau MANUEL pré-structuré (programmes) : une ligne par discipline/niveau. */
function tableauProgramme(titre: string, lignes: readonly string[]): TableauSection {
  return {
    id: nouvelId(),
    source: null,
    titre,
    colonnes: [...COLONNES_PROGRAMME],
    lignes: lignes.map((l) => [l, "", "", ""]),
  };
}

/** Plan par défaut du rapport TRIMESTRIEL. */
function planTrimestriel(periode: PeriodeAntenne): SectionPlan[] {
  const trimestre = periode.trimestre ?? "T1";
  const nomLong = nomLongTrimestre(trimestre);
  return [
    section(1, "PLAN DE PRÉSENTATION", { planAuto: true }),
    section(1, "INTRODUCTION"),
    section(1, "I- RAPPEL DE QUELQUES PRINCIPALES MISSIONS DE L'APFC", { texte: MISSIONS_APFC_DEFAUT }),
    section(1, `II- ÉTAT DE RÉALISATION DES ACTIVITÉS DE L'APFC AU ${nomLong} TRIMESTRE`, {
      tableaux: [
        tableauAutoStub("activites-secondaire"),
        tableauAutoStub("activites-primaire"),
        tableauAutoStub("activites-cafop"),
        tableauAutoStub("recap-activites"),
        tableauAutoStub("recap-touches"),
      ],
      graphiques: [
        "graphique-touches-secondaire",
        "graphique-touches-primaire",
        "graphique-touches-cafop",
        "graphique-recap",
      ],
    }),
    section(1, "III- DIFFICULTÉS ET/OU CONTRAINTES"),
    section(1, `IV- PERSPECTIVES POUR LE ${libelleTrimestreSuivant(trimestre)}`),
    section(1, "CONCLUSION"),
  ];
}

/** Plan par défaut du rapport ANNUEL (les 3 ordres × bilan par axes + programmes + analyse). */
function planAnnuel(finIso: string): SectionPlan[] {
  const sections: SectionPlan[] = [
    section(1, "INTRODUCTION", { tableaux: [tableauAutoStub("tableau-crd-encadreurs")] }),
  ];
  for (const ordre of ORDRES) {
    sections.push(section(1, ordre.libelle));
    sections.push(section(2, "I/ BILAN DES ACTIVITÉS"));
    for (const [i, axe] of AXES_ANNUELS.entries()) {
      let tableau: TableauSection;
      if (i === 1) tableau = tableauAutoStub(`axe-2-${ordre.cle}`);
      else if (i === 2) tableau = tableauAutoStub(`axe-3-${ordre.cle}`);
      else {
        tableau = tableauAutoStub("axes-vide");
        tableau.lignes = [["", "", "", "", "", ""]];
      }
      sections.push(section(3, axe, { tableaux: [tableau] }));
    }
    sections.push(
      section(2, `II/ ÉTAT D'EXÉCUTION DES PROGRAMMES ${ordre.libelle} À LA DATE DU ${dateIsoEnFrancais(finIso).toUpperCase()}`),
    );
    if (ordre.cle === "secondaire") {
      sections.push(
        section(3, "II.1. PREMIER CYCLE", { tableaux: [tableauProgramme("Premier cycle", DISCIPLINES_SECONDAIRE_DEFAUT)] }),
        section(3, "II.2. SECOND CYCLE", { tableaux: [tableauProgramme("Second cycle", DISCIPLINES_SECONDAIRE_DEFAUT)] }),
      );
    } else if (ordre.cle === "primaire") {
      sections.push(
        section(3, "II.1. PRÉSCOLAIRE", { tableaux: [tableauProgramme("Préscolaire", NIVEAUX_PRESCOLAIRE)] }),
        section(3, "II.2. PRIMAIRE", { tableaux: [tableauProgramme("Primaire", NIVEAUX_PRIMAIRE)] }),
      );
    } else {
      sections.push(
        section(3, "II.1. PREMIÈRE ANNÉE", { tableaux: [tableauProgramme("Première année", DISCIPLINES_CAFOP_DEFAUT)] }),
        section(3, "II.2. DEUXIÈME ANNÉE", { tableaux: [tableauProgramme("Deuxième année", DISCIPLINES_CAFOP_DEFAUT)] }),
      );
    }
    sections.push(section(2, "III/ ANALYSE DES RÉSULTATS DES ACTIVITÉS"));
  }
  sections.push(section(1, "CONCLUSION"));
  return sections;
}

/** PLAN PAR DÉFAUT d'un rapport d'antenne (fidèle aux deux rapports réels). */
export function planParDefaut(type: TypeRapportAntenne, periode: PeriodeAntenne, finIso: string): SectionPlan[] {
  return type === "trimestriel" ? planTrimestriel(periode) : planAnnuel(finIso);
}

/** Contenu v2 « à blanc » (plan par défaut, blocs auto sans chiffres). */
export function contenuAntenneParDefaut(
  type: TypeRapportAntenne,
  periode: PeriodeAntenne,
  fenetre: { debutIso: string; finIso: string },
): ContenuRapportAntenne {
  return {
    version: 2,
    periode: { debut: fenetre.debutIso, fin: fenetre.finIso },
    sections: planParDefaut(type, periode, fenetre.finIso),
    entete: enteteVide(),
    signataire: "",
  };
}

// ── Correspondances d'agrégation depuis les rapports CRD (bloc `agregation-crd`) ──

/** Une ligne du tableau d'agrégation ← sommes des lignes CRD dont la nature correspond. */
export interface CorrespondanceCrd {
  nature: string;
  sources: readonly string[];
}

export const CORRESPONDANCES_CRD: readonly CorrespondanceCrd[] = [
  {
    nature: "Réunions / séances de travail",
    sources: [
      "Réunion du Chef APFC avec tous les encadreurs",
      "Réunion de l'APFC avec les CRD (RTC)",
      "Séance de travail au sein de la CRD",
      "Réunion à la DRENA",
    ],
  },
  { nature: "Visites de classes", sources: ["Visites de classes", "Visites de classes / primaire/CAFOP"] },
  { nature: "Classes ouvertes", sources: ["Classes ouvertes"] },
  { nature: "Ateliers de formation", sources: ["Ateliers de formation en direction des professeurs"] },
  { nature: "Contrôle des auxiliaires didactiques", sources: ["Contrôle des auxiliaires didactiques"] },
];

// ── Aides de rendu (plan de présentation, tableaux nourrissant les diagrammes) ──

/** Titres de NIVEAU 1 du plan (hors « PLAN DE PRÉSENTATION » lui-même) — recalculés en direct. */
export function titresNiveau1(sections: SectionPlan[]): string[] {
  return sections.filter((s) => s.niveau === 1 && !s.planAuto && s.titre.trim()).map((s) => s.titre.trim());
}

/** Tableau alimentant un diagramme : cherché dans la SECTION, puis dans tout le plan. */
export function trouverTableauParSource(
  sections: SectionPlan[],
  source: CleBlocAuto,
  sectionId?: string,
): TableauSection | null {
  const locale = sectionId
    ? sections.find((s) => s.id === sectionId)?.tableaux.find((t) => t.source === source)
    : undefined;
  if (locale) return locale;
  for (const s of sections) {
    const t = s.tableaux.find((x) => x.source === source);
    if (t) return t;
  }
  return null;
}
