/**
 * Types PARTAGÉS du sous-module Comptabilité (11) — module PUR (aucune dépendance serveur),
 * jamais de « export type » dans un fichier "use server" (cf. commit 29dcefa).
 */

export const NATURES_COMPTE = [
  { code: "capitaux", libelle: "Capitaux" },
  { code: "immobilisations", libelle: "Immobilisations" },
  { code: "stocks", libelle: "Stocks" },
  { code: "tiers", libelle: "Tiers" },
  { code: "tresorerie", libelle: "Trésorerie" },
  { code: "charge", libelle: "Charges" },
  { code: "produit", libelle: "Produits" },
  { code: "mixte", libelle: "Mixte / autre" },
] as const;

export const LIBELLE_NATURE_COMPTE: Record<string, string> = Object.fromEntries(
  NATURES_COMPTE.map((n) => [n.code, n.libelle]),
);

export const TYPES_JOURNAL = [
  { code: "ventes", libelle: "Journal des ventes" },
  { code: "achats", libelle: "Journal des achats" },
  { code: "caisse", libelle: "Journal de caisse" },
  { code: "banque", libelle: "Journal de banque" },
  { code: "od", libelle: "Journal des opérations diverses" },
  { code: "salaires", libelle: "Journal des salaires" },
  { code: "immobilisations", libelle: "Journal des immobilisations" },
] as const;

export const LIBELLE_TYPE_JOURNAL: Record<string, string> = Object.fromEntries(
  TYPES_JOURNAL.map((t) => [t.code, t.libelle]),
);

/** Centres analytiques SUGGÉRÉS (11) — saisie libre possible ; clés de répartition : à venir. */
export const CENTRES_ANALYTIQUES_SUGGERES = [
  "Administration", "Internat", "Cantine", "Transport", "Bibliothèque",
  "Laboratoire", "Informatique", "Formation continue",
] as const;

export interface CompteComptableVue {
  id: string;
  numero: string;
  intitule: string;
  classe: number;
  nature: string;
  parentNumero: string | null;
  statut: string;
  version: number;
}

export interface JournalComptableVue {
  id: string;
  code: string;
  libelle: string;
  type: string;
  actif: boolean;
  version: number;
}

export interface LigneEcritureVue {
  id: string;
  compteId: string;
  compteNumero: string;
  compteIntitule: string;
  debit: number;
  credit: number;
  libelle: string | null;
  centreAnalytique: string | null;
  lettrage: string | null;
}

export interface EcritureVue {
  id: string;
  numero: string | null;
  journalId: string;
  journalCode: string;
  exercice: string;
  date: string;
  libelle: string;
  pieceJustificative: string;
  origine: string; // « manuelle » | « automatique »
  sourceType: string | null;
  statut: string; // « brouillon » | « validee »
  contreEcritureDeId: string | null;
  totalDebit: number;
  totalCredit: number;
  equilibree: boolean;
  annulee: boolean;
  version: number;
  lignes: LigneEcritureVue[];
}

/** Ligne de balance FORMELLE (écritures validées uniquement). */
export interface BalanceFormelleLigne {
  compteNumero: string;
  compteIntitule: string;
  classe: number;
  totalDebit: number;
  totalCredit: number;
  solde: number; // débit − crédit
}

/** Balance ÂGÉE des créances élèves (11) : restes dus par ancienneté d'échéance. */
export interface BalanceAgeeVue {
  tranches: { libelle: string; montant: number; nombre: number }[];
  total: number;
}

export interface CloturePeriodeVue {
  id: string;
  periode: string; // « AAAA-MM »
  clotureLe: string;
  version: number;
}

export interface TableauBordComptaVue {
  totalEcritures: number;
  brouillons: number;
  automatiques: number;
  manuelles: number;
  dernierePeriodeCloturee: string | null;
}

/** Vue AGRÉGÉE du registre formel (chargée par la page, passée à l'onglet Comptabilité). */
export interface RegistreComptableVue {
  comptes: CompteComptableVue[];
  journaux: JournalComptableVue[];
  ecritures: EcritureVue[];
  balanceFormelle: BalanceFormelleLigne[];
  balanceAgee: BalanceAgeeVue;
  cloturesPeriode: CloturePeriodeVue[];
  tableauBord: TableauBordComptaVue;
}

/** Ligne saisie dans le formulaire d'écriture manuelle (JSON du champ caché). */
export interface LigneEcritureSaisie {
  compteId: string;
  debit: number;
  credit: number;
  libelle?: string;
  centreAnalytique?: string;
}
