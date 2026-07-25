/**
 * Types PARTAGÉS du sous-module Encaissements (08) — module PUR (aucune dépendance serveur),
 * jamais de « export type » dans un fichier "use server" (cf. commit 29dcefa).
 */

/** Tableau de bord des encaissements (08 — KPI) : agrégé côté serveur. */
export interface StatistiquesEncaissementsVue {
  /** Recettes de scolarité du JOUR (paiements valides). */
  jour: number;
  nombreJour: number;
  /** Recettes du MOIS en cours. */
  mois: number;
  /** Recettes de l'ANNÉE CIVILE en cours. */
  annee: number;
  /** Répartition par moyen de paiement (année en cours) avec part en %. */
  parMode: { mode: string; total: number; pourcentage: number }[];
  /** Top caissiers (année en cours). */
  parCaissier: { nom: string; total: number }[];
  /** Crédit d'avances non encore imputé (tous élèves). */
  avancesDisponibles: number;
  /** Remboursements PAYÉS (année en cours). */
  remboursementsPayes: number;
}

/** Facture ouverte d'un élève, telle que présentée au règlement ventilé. */
export interface FactureARegler {
  id: string;
  numero: string | null;
  objet: string;
  netDu: number;
  paye: number;
  reste: number;
  dateEcheance: string | null;
}
