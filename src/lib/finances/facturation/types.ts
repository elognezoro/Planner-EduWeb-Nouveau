/**
 * Types PARTAGÉS du sous-module Facturation (07) — module PUR (aucune dépendance serveur),
 * importé par le domaine serveur, les actions et les composants clients (jamais de
 * « export type » dans un fichier "use server", cf. commit 29dcefa).
 */

/** Statuts STOCKÉS d'une facture ; « en_retard » est calculé à l'affichage (07). */
export type StatutFacture =
  | "brouillon"
  | "en_attente_validation"
  | "validee"
  | "emise"
  | "partiellement_payee"
  | "soldee"
  | "suspendue"
  | "annulee"
  | "archivee";

export type StatutFactureAffiche = StatutFacture | "en_retard";

export const LIBELLE_STATUT_FACTURE: Record<StatutFactureAffiche, string> = {
  brouillon: "Brouillon",
  en_attente_validation: "En attente de validation",
  validee: "Validée",
  emise: "Émise",
  partiellement_payee: "Partiellement payée",
  soldee: "Soldée",
  en_retard: "En retard",
  suspendue: "Suspendue",
  annulee: "Annulée",
  archivee: "Archivée",
};

/** Statuts sur lesquels le PAYÉ et le retard se suivent (facture émise vivante). */
export const STATUTS_FACTURE_SUIVIS: readonly StatutFacture[] = [
  "emise", "partiellement_payee", "soldee",
];

export interface LigneFactureVue {
  id: string;
  creanceId: string | null;
  libelle: string;
  description: string | null;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  taxe: number;
  montant: number;
}

export interface AvoirVue {
  id: string;
  numero: string;
  type: string;
  montant: number;
  motif: string;
  creeLe: string;
  version: number;
}

export interface NoteDebitVue {
  id: string;
  numero: string;
  libelle: string;
  montant: number;
  motif: string | null;
  creeLe: string;
  version: number;
}

export interface FactureVue {
  id: string;
  type: string; // « facture » | « proforma »
  numero: string | null;
  exercice: string;
  eleveId: string;
  eleveNom: string;
  classe: string | null;
  matricule: string | null;
  objet: string;
  observations: string | null;
  totalBrut: number;
  totalRemises: number;
  totalTaxes: number;
  montantTotal: number; // TTC
  totalAvoirs: number;
  totalNotesDebit: number;
  /** Net dû = TTC + notes de débit − avoirs (bornes : jamais négatif). */
  netDu: number;
  /** Payé via l'allocation des paiements aux créances liées (06) — 0 pour une facture
   *  manuelle sans créances tant que 08-Encaissements n'apporte pas l'imputation directe. */
  paye: number;
  statut: StatutFacture;
  statutAffiche: StatutFactureAffiche;
  joursRetard: number;
  motifAnnulation: string | null;
  dateEmission: string | null;
  dateEcheance: string | null;
  creeLe: string;
  version: number;
  lignes: LigneFactureVue[];
  avoirs: AvoirVue[];
  notesDebit: NoteDebitVue[];
}

/** Tableau de bord du sous-module (07 — indicateurs). */
export interface StatistiquesFacturationVue {
  nombre: number; // factures actives (hors proformas et annulées)
  montantFacture: number; // Σ net dû des factures émises+
  montantEncaisse: number; // Σ payé alloué
  resteAEncaisser: number;
  tauxPaiement: number; // 0..100
  enRetardNombre: number;
  enRetardMontant: number;
  montantsAnnules: number; // Σ TTC des factures annulées
  totalAvoirs: number;
  brouillons: number;
}

/** Ligne saisie dans le formulaire de facture manuelle (JSON du champ caché). */
export interface LigneFactureSaisie {
  libelle: string;
  description?: string;
  quantite: number;
  prixUnitaire: number;
  remise?: number;
  taxe?: number;
}

/** Créance facturable (ouverte, non liée à une facture active) — pour « Facturer les créances ». */
export interface CreanceFacturableVue {
  id: string;
  libelle: string;
  montant: number;
  dateEcheance: string | null;
}
