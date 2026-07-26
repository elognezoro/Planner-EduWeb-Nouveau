/**
 * Types PURS du sous-module DÉPENSES (17) : types de dépenses, états, seuils, VUES. Les
 * statuts d'avancement et le solde des avances sont dérivés/figés à la transition ; le budget
 * consommé/engagé reste calculé par le 16 (executionParCategorie).
 */

/** 17 : « > 1 000 000 FCFA → Directeur Général » — au-delà, la validation exige
 *  finance.depenses.approuver (seuil du domaine, paramétrage configurable à venir). */
export const SEUIL_APPROBATION_DIRECTION_DEPENSE = 1_000_000;

export const TYPES_DEPENSE = [
  { code: "fonctionnement", libelle: "Fonctionnement" },
  { code: "investissement", libelle: "Investissement" },
  { code: "pedagogique", libelle: "Pédagogique" },
  { code: "administrative", libelle: "Administrative" },
  { code: "mission", libelle: "Mission / note de frais" },
  { code: "exceptionnelle", libelle: "Exceptionnelle" },
] as const;

export const LIBELLE_TYPE_DEPENSE: Record<string, string> = Object.fromEntries(
  TYPES_DEPENSE.map((t) => [t.code, t.libelle]),
);

export const LIBELLE_STATUT_DEPENSE: Record<string, string> = {
  brouillon: "Brouillon",
  soumise: "Soumise",
  approuvee: "Approuvée (engagée)",
  refusee: "Refusée",
  payee: "Payée",
  cloturee: "Clôturée",
  archivee: "Archivée",
};

export const URGENCES_DEPENSE = [
  { code: "normale", libelle: "Normale" },
  { code: "urgente", libelle: "Urgente" },
  { code: "critique", libelle: "Critique" },
] as const;

export const MOTIFS_AVANCE = [
  { code: "mission", libelle: "Mission" },
  { code: "achat_urgent", libelle: "Achat urgent" },
  { code: "activite", libelle: "Activité exceptionnelle" },
] as const;

export const PERIODICITES = [
  { code: "mensuelle", libelle: "Mensuelle", mois: 1 },
  { code: "trimestrielle", libelle: "Trimestrielle", mois: 3 },
  { code: "annuelle", libelle: "Annuelle", mois: 12 },
] as const;

export const MODES_DEPENSE = ["especes", "virement", "cheque", "mobile_money", "carte"] as const;

export interface DepenseVue {
  id: string;
  numero: string | null;
  type: string;
  objet: string;
  description: string | null;
  categorie: string;
  categorieLibelle: string;
  centreCoutLibelle: string | null;
  service: string | null;
  projet: string | null;
  beneficiaire: string | null;
  montantEstime: number;
  montantValide: number | null;
  urgence: string;
  pieceJustificative: string | null;
  statut: string;
  demandeurId: string | null;
  demandeurNom: string;
  decideParNom: string | null;
  dateDecision: string | null;
  motifRefus: string | null;
  mode: string | null;
  reference: string | null;
  datePaiement: string | null;
  payeParNom: string | null;
  /** Vrai si le montant exige l'approbation DIRECTION (seuil du 17). */
  approbationDirectionRequise: boolean;
  date: string;
  version: number;
}

export interface AvanceVue {
  id: string;
  numero: string | null;
  beneficiaireNom: string;
  motif: string;
  objet: string;
  categorie: string;
  categorieLibelle: string;
  montant: number;
  mode: string;
  statut: string;
  montantJustifie: number | null;
  soldeType: string | null;
  /** Reste à régulariser (dérivé) : avance − justifié (nul si régularisée). */
  solde: number | null;
  decaisseParNom: string | null;
  dateRegularisation: string | null;
  date: string;
  version: number;
}

export interface DepenseRecurrenteVue {
  id: string;
  libelle: string;
  categorie: string;
  categorieLibelle: string;
  montant: number;
  periodicite: string;
  prochaineEcheance: string;
  beneficiaire: string | null;
  actif: boolean;
  derniereGeneration: string | null;
  /** Dérivé : échéance dépassée (à générer). */
  echeanceDue: boolean;
  version: number;
}

export interface TableauBordDepensesVue {
  enAttente: number; // soumises
  approuveesNonPayees: number;
  montantMois: number; // dépenses payées ce mois
  montantExercice: number; // dépenses payées de l'exercice
  avancesEnCours: number; // décaissées non régularisées
  recurrentesDues: number;
}

/** Vue AGRÉGÉE du 17 (chargée par la page, passée à l'onglet). */
export interface DonneesDepensesVue {
  exercice: string;
  depenses: DepenseVue[];
  avances: AvanceVue[];
  recurrentes: DepenseRecurrenteVue[];
  tableauBord: TableauBordDepensesVue;
}
