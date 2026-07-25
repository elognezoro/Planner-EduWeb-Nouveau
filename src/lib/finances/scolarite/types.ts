/**
 * Types PARTAGÉS du sous-module Scolarité (06) — module PUR (aucune dépendance serveur) :
 * importé à la fois par le domaine serveur (generation/solde), les actions et les composants
 * clients (jamais de « export type » dans un fichier "use server", cf. commit 29dcefa).
 */

/** Statuts STOCKÉS d'une créance ; « en_retard » est calculé à l'affichage. */
export type StatutCreance = "generee" | "partiellement_payee" | "soldee" | "suspendue" | "annulee";
export type StatutCreanceAffiche = StatutCreance | "en_retard";

export const LIBELLE_STATUT_CREANCE: Record<StatutCreanceAffiche, string> = {
  generee: "Générée",
  partiellement_payee: "Partiellement payée",
  soldee: "Soldée",
  en_retard: "En retard",
  suspendue: "Suspendue",
  annulee: "Annulée",
};

export interface CreanceVue {
  id: string;
  fraisId: string;
  libelle: string;
  montant: number;
  devise: string;
  dateEcheance: string | null;
  statut: StatutCreance;
  /** Statut d'affichage : « en_retard » si échéance dépassée et créance non soldée. */
  statutAffiche: StatutCreanceAffiche;
  /** Part des paiements du frais allouée à CETTE créance (ordre des échéances). */
  paye: number;
  version: number;
}

export interface ExonerationVue {
  id: string; eleveId: string; eleveNom: string; fraisId: string | null; type: string;
  taux: number | null; montant: number | null; decision: string; debut: string; fin: string | null; version: number;
}
export interface BourseVue {
  id: string; eleveId: string; eleveNom: string; type: string; organisme: string | null;
  taux: number | null; montantFixe: number | null; fraisCibles: string[] | null; periode: string; version: number;
}
export interface PlanPaiementVue {
  id: string; eleveId: string; eleveNom: string; creanceId: string | null; libelle: string | null;
  echeances: { date: string; montant: number }[]; statut: string; version: number;
}
export interface PenaliteVue {
  id: string; creanceId: string; creanceLibelle: string; montant: number; statut: string; version: number;
}
export interface AvanceVue {
  id: string; eleveId: string; eleveNom: string; montant: number; solde: number; mode: string;
  reference: string | null; version: number;
}
export interface RemboursementVue {
  id: string; eleveId: string; eleveNom: string; paiementId: string | null; montant: number;
  motif: string; statut: string; dateValidation: string | null; version: number;
}
export interface CategorieFraisVue {
  id: string; nom: string; code: string | null; ordreImputation: number; actif: boolean; version: number;
}
export interface ReglePenaliteVue {
  id: string; declencheur: string; type: string; valeur: number; delaiJours: number; actif: boolean; version: number;
}
export interface RegleBlocageVue {
  id: string; type: string; seuilImpaye: number | null; actif: boolean; version: number;
}

/** Détail du solde — formule du 06 : facturé − paiements − remises − exonérations − bourses + pénalités. */
export interface DetailSolde {
  facture: number;
  paye: number; // paiements valides − remboursements payés
  remises: number;
  exonerations: number;
  bourses: number;
  penalites: number;
  solde: number;
}

/** Compte financier COMPLET d'un élève (06) — sérialisable (dates ISO). */
export interface CompteEleveVue {
  eleveId: string;
  eleveNom: string;
  classe: string | null;
  exercice: string;
  creances: CreanceVue[];
  paiements: { id: string; numeroRecu: number; libelle: string; montant: number; mode: string; date: string; annule: boolean }[];
  remises: { id: string; type: string; libelle: string; montant: number | null; pourcentage: number | null }[];
  exonerations: ExonerationVue[];
  bourses: BourseVue[];
  plans: PlanPaiementVue[];
  penalites: PenaliteVue[];
  avances: AvanceVue[];
  remboursements: RemboursementVue[];
  detail: DetailSolde;
  /** Crédit d'avances non encore imputé. */
  avancesDisponibles: number;
}

/** Tableau de bord recouvrement (06) — agrégé côté serveur. */
export interface RecouvrementVue {
  attendu: number; // Σ créances actives de l'exercice
  encaisse: number; // Σ paiements valides des élèves (net des remboursements payés)
  reste: number; // Σ soldes positifs par élève
  taux: number; // 0..100
  enRetardNombre: number;
  enRetardMontant: number;
  totalRemises: number;
  totalExonerations: number;
  totalBourses: number;
  totalPenalites: number;
}

/** Aperçu des élèves actuellement bloquables par une règle de blocage (consultation V1). */
export interface ApercuBlocageVue {
  regleId: string;
  type: string;
  seuilImpaye: number | null;
  actif: boolean;
  nombreBloquables: number;
  exemples: { eleveNom: string; reste: number }[]; // plafonné côté serveur
}

export const LIBELLE_TYPE_BLOCAGE: Record<string, string> = {
  bulletin: "Impression du bulletin",
  composition: "Participation aux compositions",
  reinscription: "Réinscription",
  transport: "Transport scolaire",
  cantine: "Cantine",
};

export const LIBELLE_DECLENCHEUR: Record<string, string> = {
  retard: "Retard de paiement",
  echeance: "Échéance dépassée",
  rejet: "Rejet bancaire",
};

export const LIBELLE_TYPE_PENALITE: Record<string, string> = {
  fixe: "Montant fixe",
  pourcentage: "Pourcentage",
  interet_journalier: "Intérêt journalier",
};

export const LIBELLE_TYPE_BOURSE: Record<string, string> = {
  nationale: "Bourse nationale",
  privee: "Bourse privée",
  interne: "Bourse interne",
  prise_en_charge: "Prise en charge",
};

export const MODES_CALCUL_FRAIS = [
  { code: "fixe", libelle: "Montant fixe (tranches libres)" },
  { code: "mensuel", libelle: "Mensuel (9 échéances égales)" },
  { code: "trimestriel", libelle: "Trimestriel (3 échéances)" },
  { code: "semestriel", libelle: "Semestriel (2 échéances)" },
] as const;

export const STATUTS_ELEVE_FRAIS = [
  { code: "", libelle: "Tous les statuts" },
  { code: "interne", libelle: "Interne" },
  { code: "externe", libelle: "Externe" },
  { code: "demi_pensionnaire", libelle: "Demi-pensionnaire" },
] as const;

export const CYCLES_FRAIS = [
  { code: "", libelle: "Tous les cycles" },
  { code: "prescolaire", libelle: "Préscolaire" },
  { code: "primaire", libelle: "Primaire" },
  { code: "college", libelle: "Collège" },
  { code: "lycee", libelle: "Lycée" },
] as const;
