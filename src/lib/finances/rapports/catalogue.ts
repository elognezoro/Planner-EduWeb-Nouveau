/**
 * CATALOGUE des rapports (18) — module PUR (importable client). Le moteur de restitution ne
 * recrée AUCUNE donnée : chaque rapport est DÉRIVÉ des chargeurs des sous-modules (source
 * unique de vérité). Le catalogue est maintenu EN CODE (comme le registre de permissions) ;
 * aucune table n'est nécessaire — décision documentée (RM-1501 historisation = journal
 * d'audit à l'export ; planification/générateur personnalisé/persistance = reports).
 *
 * RM-1500/1502 : chaque définition porte la PERMISSION requise ; la page filtre le catalogue
 * selon le rôle et le serveur revérifie à la génération et à l'export.
 */

import type { PermissionFinance } from "../commun/permissions";

export const CATEGORIES_RAPPORT = [
  { code: "financiers", libelle: "Rapports financiers" },
  { code: "comptables", libelle: "Rapports comptables" },
  { code: "budgetaires", libelle: "Rapports budgétaires" },
  { code: "tresorerie", libelle: "Rapports de trésorerie" },
  { code: "facturation", libelle: "Rapports de facturation" },
  { code: "fournisseurs", libelle: "Rapports fournisseurs" },
  { code: "stocks", libelle: "Rapports de stocks" },
  { code: "patrimoniaux", libelle: "Rapports patrimoniaux" },
  { code: "pedagogiques", libelle: "Rapports pédagogiques (finance)" },
] as const;

export const LIBELLE_CATEGORIE_RAPPORT: Record<string, string> = Object.fromEntries(
  CATEGORIES_RAPPORT.map((c) => [c.code, c.libelle]),
);

/** Type de format d'une colonne (mise en forme UI + CSV). */
export type FormatColonne = "texte" | "nombre" | "fcfa" | "date" | "pourcent";

export interface ColonneRapport {
  cle: string;
  libelle: string;
  format?: FormatColonne;
}

export interface RapportDefinition {
  code: string;
  nom: string;
  categorie: string;
  description: string;
  /** Permission de LECTURE requise pour voir/générer le rapport (RM-1500). */
  permission: PermissionFinance;
  orientation: "portrait" | "paysage";
}

/** Rapport GÉNÉRÉ (données dérivées, prêtes à restituer). */
export interface RapportGenere {
  code: string;
  titre: string;
  sousTitre: string;
  orientation: "portrait" | "paysage";
  colonnes: ColonneRapport[];
  lignes: Record<string, string | number | null>[];
  /** Ligne de totaux (facultative) — mêmes clés que les colonnes. */
  totaux: Record<string, string | number | null> | null;
  genereLe: string;
}

/** Catalogue unifié (RM-1505 : les modèles personnalisés versionnés viendront plus tard). */
export const CATALOGUE_RAPPORTS: RapportDefinition[] = [
  // ── Financiers ──
  { code: "synthese-financiere", nom: "Synthèse financière (recettes / dépenses / solde)", categorie: "financiers", description: "Totaux encaissés, dépensés et solde de l'exercice, par nature.", permission: "finance.tableaux.lire", orientation: "portrait" },
  { code: "recettes-nature", nom: "Recettes par nature", categorie: "financiers", description: "Produits par catégorie OHADA (scolarité, économat, opérations).", permission: "finance.tableaux.lire", orientation: "portrait" },
  { code: "depenses-nature", nom: "Dépenses par nature", categorie: "financiers", description: "Charges par catégorie OHADA (opérations, dépenses, achats).", permission: "finance.tableaux.lire", orientation: "portrait" },
  // ── Comptables ──
  { code: "balance-generale", nom: "Balance générale (registre formel)", categorie: "comptables", description: "Soldes débiteurs/créditeurs des comptes mouvementés (écritures validées).", permission: "finance.tableaux.lire", orientation: "paysage" },
  { code: "journaux", nom: "Journal des écritures", categorie: "comptables", description: "Écritures comptables récentes par journal et pièce.", permission: "finance.tableaux.lire", orientation: "paysage" },
  { code: "balance-agee", nom: "Balance âgée des créances", categorie: "comptables", description: "Restes dus des élèves par tranche d'ancienneté.", permission: "finance.tableaux.lire", orientation: "portrait" },
  // ── Budgétaires ──
  { code: "budget-execution", nom: "Exécution budgétaire (dépenses)", categorie: "budgetaires", description: "Voté / engagé / consommé / disponible par catégorie.", permission: "finance.tableaux.lire", orientation: "paysage" },
  { code: "budget-recettes", nom: "Budget des recettes (prévu vs réalisé)", categorie: "budgetaires", description: "Recettes votées et réalisées par catégorie.", permission: "finance.tableaux.lire", orientation: "portrait" },
  // ── Trésorerie ──
  { code: "tresorerie-caisses", nom: "Situation des caisses", categorie: "tresorerie", description: "Soldes et sessions des caisses physiques.", permission: "finance.tableaux.lire", orientation: "portrait" },
  { code: "tresorerie-banques", nom: "Situation des comptes bancaires", categorie: "tresorerie", description: "Soldes calculés et pointage des comptes bancaires.", permission: "finance.tableaux.lire", orientation: "portrait" },
  // ── Facturation ──
  { code: "facturation", nom: "Factures et créances", categorie: "facturation", description: "Factures émises, payées, impayées et restes dus.", permission: "finance.tableaux.lire", orientation: "paysage" },
  // ── Fournisseurs ──
  { code: "achats-fournisseur", nom: "Achats par fournisseur", categorie: "fournisseurs", description: "Commandes, facturé, payé, encours et litiges par fournisseur.", permission: "finance.tableaux.lire", orientation: "paysage" },
  // ── Stocks ──
  { code: "stocks-valorisation", nom: "Valorisation des stocks", categorie: "stocks", description: "Stock, disponible, CUMP et valeur par article ; alertes.", permission: "finance.tableaux.lire", orientation: "paysage" },
  // ── Patrimoniaux ──
  { code: "immobilisations", nom: "État du patrimoine et amortissements", categorie: "patrimoniaux", description: "Valeur brute, amortissements cumulés et VNC par actif.", permission: "finance.tableaux.lire", orientation: "paysage" },
  // ── Pédagogiques (finance) ──
  { code: "recettes-scolarite", nom: "Recettes de scolarité (recouvrement)", categorie: "pedagogiques", description: "Attendu, encaissé et reste à recouvrer de la scolarité.", permission: "finance.scolarite.lire", orientation: "portrait" },
];

export const FORMATS_EXPORT = [
  { code: "csv", libelle: "CSV (Excel)" },
  { code: "json", libelle: "JSON" },
] as const;
