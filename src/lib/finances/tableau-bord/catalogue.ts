/**
 * CATALOGUE des domaines/widgets du cockpit décisionnel (19) — module PUR (importable client).
 * Comme le 18, le cockpit AGRÈGE : aucune donnée recréée, aucune table (décision documentée —
 * vues enregistrées / personnalisation persistée = reports). Les scores de santé sont des
 * fonctions PURES appliquées aux tableaux de bord déjà produits par les sous-modules ; la
 * visibilité d'un domaine découle du RBAC (données chargées ⟺ droit de lecture — RM-1600).
 */

import type { TableauBordBudgetVue } from "../budgets/types";
import type { TableauBordStocksVue } from "../stocks/types";
import type { TableauBordImmoVue } from "../immobilisations/types";
import type { TableauBordAchatsVue } from "../achats/types";
import type { TableauBordDepensesVue } from "../depenses/types";
import type { TableauBordBanqueVue } from "../banque/types";
import type { TableauBordCaisseVue } from "../caisse/types";
import type { RecouvrementVue } from "../scolarite/types";

export type NiveauAlerte = "critique" | "attention" | "info";

export interface AlerteCockpit {
  domaine: string;
  niveau: NiveauAlerte;
  message: string;
  /** Onglet cible pour le drill-down. */
  onglet: string;
}

export interface DomaineSante {
  code: string;
  libelle: string;
  score: number; // 0..100
  onglet: string; // drill-down
  details: string;
}

export interface SerieMois {
  mois: string; // « 2026-07 »
  libelle: string; // « juil. 2026 »
  recettes: number;
  depenses: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// ── Scores de santé par domaine (fonctions PURES, dérivées des tableaux de bord) ──

export function scoreTresorerie(banque: TableauBordBanqueVue | null, caisse: TableauBordCaisseVue | null): number {
  const soldeGlobal = (banque?.soldeGlobal ?? 0) + (caisse?.montantEnCaisse ?? 0);
  if (soldeGlobal < 0) return 40;
  const depots = banque?.depotsEnAttente ?? 0;
  return clamp(100 - (depots > 0 ? 10 : 0));
}

export function scoreBudget(tb: TableauBordBudgetVue): number {
  return clamp(100 - tb.lignesDepassees * 20 - tb.lignesProchesEpuisement * 5);
}

export function scoreRecouvrement(vue: RecouvrementVue): number {
  return clamp(vue.taux);
}

export function scoreComptabilite(brouillons: number): number {
  return clamp(100 - brouillons * 5);
}

export function scoreStocks(tb: TableauBordStocksVue): number {
  return clamp(100 - tb.nbRuptures * 10 - tb.nbLotsPerimes * 5 - tb.nbSousSeuil * 2);
}

export function scorePatrimoine(tb: TableauBordImmoVue): number {
  return clamp(100 - tb.garantiesExpirant * 5 - tb.horsService * 5);
}

export function scoreAchats(tb: TableauBordAchatsVue): number {
  return clamp(100 - tb.bonsEnRetard * 10 - tb.facturesEchues * 5);
}

export function scoreDepenses(tb: TableauBordDepensesVue): number {
  return clamp(100 - tb.avancesEnCours * 5 - tb.recurrentesDues * 3);
}

/** Couleur/ton d'un score (UI). */
export function tonScore(score: number): "bon" | "moyen" | "faible" {
  return score >= 85 ? "bon" : score >= 60 ? "moyen" : "faible";
}

export interface CockpitVue {
  domaines: DomaineSante[];
  scoreGlobal: number;
  alertes: AlerteCockpit[];
}
