/**
 * Types PARTAGÉS du sous-module Banque (10) — module PUR (aucune dépendance serveur),
 * jamais de « export type » dans un fichier "use server" (cf. commit 29dcefa).
 */

export const TYPES_COMPTE_BANCAIRE = [
  { code: "courant", libelle: "Compte courant" },
  { code: "epargne", libelle: "Compte d'épargne" },
  { code: "mobile_money", libelle: "Compte Mobile Money Business" },
  { code: "virtuel", libelle: "Compte virtuel (passerelles)" },
] as const;

export const LIBELLE_TYPE_COMPTE: Record<string, string> = Object.fromEntries(
  TYPES_COMPTE_BANCAIRE.map((t) => [t.code, t.libelle]),
);

export const LIBELLE_STATUT_COMPTE: Record<string, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  ferme: "Fermé",
};

export const TYPES_MOUVEMENT_BANCAIRE = [
  { code: "depot", libelle: "Dépôt", sens: 1 },
  { code: "retrait", libelle: "Retrait", sens: -1 },
  { code: "virement_entrant", libelle: "Virement reçu", sens: 1 },
  { code: "virement_sortant", libelle: "Virement émis", sens: -1 },
  { code: "virement_interne_entree", libelle: "Virement interne reçu", sens: 1 },
  { code: "virement_interne_sortie", libelle: "Virement interne émis", sens: -1 },
  { code: "prelevement", libelle: "Prélèvement", sens: -1 },
  { code: "frais_bancaires", libelle: "Frais bancaires", sens: -1 },
  { code: "interets", libelle: "Intérêts créditeurs", sens: 1 },
] as const;

export type TypeMouvementBancaire = (typeof TYPES_MOUVEMENT_BANCAIRE)[number]["code"];

export const LIBELLE_MOUVEMENT_BANCAIRE: Record<string, string> = Object.fromEntries(
  TYPES_MOUVEMENT_BANCAIRE.map((t) => [t.code, t.libelle]),
);

export function sensMouvementBancaire(type: string): number {
  return TYPES_MOUVEMENT_BANCAIRE.find((t) => t.code === type)?.sens ?? 0;
}

/** Types saisissables directement (les virements internes et dépôts de caisse ont leur action). */
export const TYPES_MOUVEMENT_BANCAIRE_SAISISSABLES: readonly TypeMouvementBancaire[] = [
  "depot", "retrait", "virement_entrant", "virement_sortant", "prelevement",
  "frais_bancaires", "interets",
];

/**
 * SEUIL de validation hiérarchique des SORTIES bancaires (10 : « validation hiérarchique ») —
 * au-delà, la permission finance.banques.gerer est exigée. Paramétrage : écran à venir ;
 * l'authentification forte (MFA) est un report documenté (chantier sécurité).
 */
export const SEUIL_VALIDATION_BANCAIRE = 500_000;

export const LIBELLE_STATUT_CHEQUE: Record<string, string> = {
  en_circulation: "En circulation",
  encaisse: "Encaissé",
  rejete: "Rejeté",
  annule: "Annulé",
};

export interface MouvementBancaireVue {
  id: string;
  compteId: string;
  compteNom: string;
  type: string;
  montant: number;
  libelle: string;
  reference: string | null;
  pieceJustificative: string;
  beneficiaire: string | null;
  mouvementCaisseId: string | null;
  chequeId: string | null;
  dateOperation: string;
  pointe: boolean;
  annule: boolean;
  version: number;
}

export interface ChequeVue {
  id: string;
  sens: string; // « emis » | « recu »
  numero: string;
  banque: string | null;
  montant: number;
  dateEmission: string;
  emetteur: string | null;
  beneficiaire: string | null;
  paiementId: string | null;
  compteNom: string | null;
  statut: string;
  motifStatut: string | null;
  version: number;
}

/** Versement de caisse (09) en attente de CONFIRMATION bancaire (RM-600). */
export interface VersementEnAttenteVue {
  mouvementCaisseId: string;
  caisseNom: string;
  caissierNom: string;
  montant: number;
  date: string;
  motif: string | null;
}

export interface CompteBancaireVue {
  id: string;
  nom: string;
  code: string | null;
  type: string;
  banque: string;
  agence: string | null;
  numeroCompte: string | null;
  iban: string | null;
  swift: string | null;
  responsableId: string | null;
  responsableNom: string | null;
  soldeInitial: number;
  seuilAlerte: number | null;
  statut: string;
  devise: string;
  /** Solde THÉORIQUE calculé : soldeInitial + mouvements actifs (jamais stocké). */
  solde: number;
  /** Rapprochement : soldeInitial + mouvements POINTÉS actifs. */
  soldePointe: number;
  nonPointes: number; // opérations en attente de rapprochement
  dernierReleve: { mois: string; solde: number } | null;
  /** Écart de rapprochement : solde du dernier relevé − solde pointé (nul sans relevé). */
  ecartReleve: number | null;
  alertes: string[];
  version: number;
}

export interface TableauBordBanqueVue {
  soldeGlobal: number;
  comptesActifs: number;
  depotsEnAttente: number; // Σ versements de caisse non confirmés
  virementsDuJour: number;
  fraisAnnee: number;
  chequesEnCirculation: number;
}
