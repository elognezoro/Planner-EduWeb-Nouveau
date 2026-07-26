/**
 * Types PURS du sous-module BUDGETS (16) : types de budgets, workflow, révisions, VUES.
 * Les 4 agrégats (VOTÉ / ENGAGÉ / CONSOMMÉ / DISPONIBLE) et les taux sont DÉRIVÉS — jamais
 * stockés (cohérence stricte avec l'engagement déjà posé au 12).
 */

export const TYPES_BUDGET = [
  { code: "fonctionnement", libelle: "Budget de fonctionnement" },
  { code: "investissement", libelle: "Budget d'investissement" },
  { code: "projet", libelle: "Budget de projet" },
  { code: "exceptionnel", libelle: "Budget exceptionnel" },
] as const;

export const LIBELLE_TYPE_BUDGET: Record<string, string> = Object.fromEntries(
  TYPES_BUDGET.map((t) => [t.code, t.libelle]),
);

/** États du workflow (BPMN 16). */
export const ETATS_BUDGET = [
  { code: "brouillon", libelle: "Brouillon" },
  { code: "soumis", libelle: "Soumis au vote" },
  { code: "approuve", libelle: "Approuvé" },
  { code: "execution", libelle: "En exécution" },
  { code: "cloture", libelle: "Clôturé" },
  { code: "archive", libelle: "Archivé" },
] as const;

export const LIBELLE_ETAT_BUDGET: Record<string, string> = Object.fromEntries(
  ETATS_BUDGET.map((e) => [e.code, e.libelle]),
);

export const TYPES_REVISION = [
  { code: "augmentation", libelle: "Augmentation de crédits" },
  { code: "diminution", libelle: "Diminution de crédits" },
  { code: "virement", libelle: "Virement entre lignes" },
  { code: "ouverture", libelle: "Ouverture de crédits supplémentaires" },
  { code: "annulation", libelle: "Annulation de crédits" },
] as const;

export const SOURCES_ENGAGEMENT = [
  { code: "contrat", libelle: "Contrat" },
  { code: "marche", libelle: "Marché" },
  { code: "convention", libelle: "Convention" },
  { code: "autre", libelle: "Autre" },
] as const;

/** Seuil d'alerte « budget proche de l'épuisement » (taux de consommation+engagement). */
export const SEUIL_ALERTE_EPUISEMENT = 0.9;

export interface CentreCoutVue {
  id: string;
  code: string;
  libelle: string;
  type: string; // « cout » | « profit »
  actif: boolean;
  version: number;
}

/** Une ligne d'exécution budgétaire (dépense) — tout est DÉRIVÉ sauf le voté. */
export interface LigneExecutionVue {
  categorie: string;
  libelle: string;
  centreCoutId: string | null;
  centreCoutLibelle: string | null;
  ligneId: string | null;
  budgetId: string | null;
  statut: string;
  vote: number; // montantRevise ?? montantPrevu
  montantInitial: number;
  engageBC: number; // bons de commande émis (12)
  engageManuel: number; // engagements manuels (contrats/marchés)
  consomme: number; // factures validées + dépenses directes
  disponible: number; // vote − engagé − consommé
  tauxExecution: number; // (engagé + consommé) / voté
  depasse: boolean;
  procheEpuisement: boolean;
}

export interface LigneRecetteVue {
  categorie: string;
  libelle: string;
  vote: number;
  realise: number;
  taux: number;
}

export interface RevisionVue {
  id: string;
  type: string;
  categorie: string | null;
  montant: number;
  montantAvant: number | null;
  montantApres: number | null;
  motif: string;
  parNom: string | null;
  date: string;
}

export interface EngagementManuelVue {
  id: string;
  exercice: string;
  categorie: string;
  categorieLibelle: string;
  centreCoutLibelle: string | null;
  montant: number;
  libelle: string;
  source: string;
  reference: string | null;
  statut: string;
  parNom: string | null;
  version: number;
}

export interface BudgetEnveloppeVue {
  id: string;
  exercice: string;
  type: string;
  libelle: string;
  statut: string;
  preparParNom: string | null;
  voteParNom: string | null;
  dateVote: string | null;
  notes: string | null;
  creeParId: string | null;
  version: number;
  nbLignes: number;
  totalVote: number;
}

export interface TableauBordBudgetVue {
  totalVote: number;
  totalEngage: number;
  totalConsomme: number;
  totalDisponible: number;
  tauxExecution: number;
  lignesDepassees: number;
  lignesProchesEpuisement: number;
  totalVoteRecettes: number;
  totalRealiseRecettes: number;
}

/** Vue AGRÉGÉE du 16 (chargée par la page, passée à l'onglet Budget). */
export interface DonneesBudgetVue {
  exercice: string;
  execution: LigneExecutionVue[];
  recettes: LigneRecetteVue[];
  enveloppes: BudgetEnveloppeVue[];
  centres: CentreCoutVue[];
  engagementsManuels: EngagementManuelVue[];
  revisions: RevisionVue[];
  tableauBord: TableauBordBudgetVue;
}

/** Ligne saisie dans le formulaire de lignes budgétaires (JSON du champ caché) — legacy. */
export interface LigneBudgetSaisie {
  categorie: string;
  sens: string;
  montantPrevu: number;
}
