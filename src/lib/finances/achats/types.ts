/**
 * Types PURS du sous-module ACHATS (12 — cycle Procure-to-Pay, WF-004) : constantes,
 * libellés et VUES sérialisables. Importable par les composants clients (aucun accès
 * serveur ici) — les exports de types restent HORS des fichiers "use server".
 */

/** 12 : « > 1 000 000 FCFA → Directeur Général » — au-delà de ce seuil, la décision exige
 *  finance.achats.approuver (direction). Le paramétrage par établissement viendra avec
 *  l'écran de paramétrage financier (« les seuils sont configurables », reporté). */
export const SEUIL_APPROBATION_DIRECTION_ACHAT = 1_000_000;

export const TYPES_ACHAT = [
  { code: "biens", libelle: "Biens (fournitures, mobilier, matériel…)" },
  { code: "services", libelle: "Services (maintenance, internet, formation…)" },
  { code: "travaux", libelle: "Travaux (construction, rénovation…)" },
] as const;

export const URGENCES_ACHAT = [
  { code: "normale", libelle: "Normale" },
  { code: "urgente", libelle: "Urgente" },
  { code: "critique", libelle: "Critique" },
] as const;

export const TYPES_FOURNISSEUR = [
  { code: "biens", libelle: "Fournisseur de biens" },
  { code: "services", libelle: "Prestataire de services" },
  { code: "travaux", libelle: "Prestataire de travaux" },
  { code: "institution", libelle: "Institution publique" },
  { code: "financier", libelle: "Partenaire financier" },
] as const;

export const LIBELLE_STATUT_FOURNISSEUR: Record<string, string> = {
  actif: "Actif",
  inactif: "Inactif",
  suspendu: "Suspendu",
};

export const LIBELLE_STATUT_DEMANDE: Record<string, string> = {
  brouillon: "Brouillon",
  soumise: "Soumise (en validation)",
  approuvee: "Approuvée",
  refusee: "Refusée",
  commandee: "Commandée",
  cloturee: "Clôturée",
};

export const LIBELLE_STATUT_BC: Record<string, string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  annulee: "Annulée",
};

export const LIBELLE_STATUT_FACTURE_FRS: Record<string, string> = {
  saisie: "Saisie",
  validee: "Validée",
  annulee: "Annulée",
};

export interface FournisseurVue {
  id: string;
  code: string;
  raisonSociale: string;
  nomCommercial: string | null;
  type: string;
  contactNom: string | null;
  contactFonction: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  numeroRccm: string | null;
  numeroFiscal: string | null;
  statut: string;
  notes: string | null;
  version: number;
}

export interface DevisVue {
  id: string;
  fournisseurId: string;
  fournisseurNom: string;
  montant: number;
  delaiJours: number | null;
  conditions: string | null;
  pieceReference: string | null;
  retenu: boolean;
  version: number;
}

export interface DemandeAchatVue {
  id: string;
  numero: string | null;
  typeAchat: string;
  objet: string;
  justification: string;
  service: string | null;
  centreCout: string | null;
  urgence: string;
  categorieBudget: string;
  categorieLibelle: string;
  montantEstime: number;
  pieceJustificative: string | null;
  statut: string;
  demandeurId: string | null;
  demandeurNom: string;
  decideParNom: string | null;
  dateDecision: string | null;
  motifRefus: string | null;
  /** Vrai si le montant estimé exige l'approbation DIRECTION (seuil du 12). */
  approbationDirectionRequise: boolean;
  date: string;
  version: number;
  devis: DevisVue[];
}

export interface LigneBcVue {
  id: string;
  articleId: string | null;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
  /** Cumul reçu (réceptions actives) — RM-902 : jamais au-delà de la quantité. */
  quantiteRecue: number;
  /** Cumul retourné au fournisseur (retours actifs). */
  quantiteRetournee: number;
}

export interface ReceptionVue {
  id: string;
  date: string;
  receptionnaireNom: string;
  observations: string | null;
  version: number;
  lignes: { designation: string; quantiteRecue: number; quantiteRefusee: number; observation: string | null }[];
}

export interface BonCommandeVue {
  id: string;
  numero: string | null;
  statut: string;
  demandeId: string;
  demandeNumero: string | null;
  demandeObjet: string;
  categorieBudget: string;
  fournisseurId: string;
  fournisseurNom: string;
  conditionsPaiement: string | null;
  lieuLivraison: string | null;
  dateLivraisonPrevue: string | null;
  dateEmission: string | null;
  emisParNom: string | null;
  motifAnnulation: string | null;
  totalCommande: number;
  totalFacture: number; // factures actives (saisies + validées)
  totalFactureValidee: number;
  totalPaye: number;
  /** DÉRIVÉ : « aucune » | « partielle » | « totale » (cumuls de réception par ligne). */
  etatReception: string;
  /** DÉRIVÉ : livraison prévue dépassée sans réception totale. */
  enRetard: boolean;
  date: string;
  version: number;
  lignes: LigneBcVue[];
  receptions: ReceptionVue[];
}

export interface FactureFournisseurVue {
  id: string;
  bonCommandeId: string;
  bonCommandeNumero: string | null;
  fournisseurNom: string;
  numeroFournisseur: string;
  date: string;
  montant: number;
  taxes: number;
  dateEcheance: string | null;
  pieceJustificative: string;
  statut: string;
  valideeParNom: string | null;
  motifAnnulation: string | null;
  /** DÉRIVÉS (RM-903) : cumul des paiements actifs et reste à payer. */
  totalPaye: number;
  reste: number;
  enRetard: boolean;
  /** Écart facture vs total du BC (3-way match complet au 13/14 — affiché, non bloquant). */
  ecartCommande: number;
  version: number;
  paiements: { id: string; montant: number; mode: string; reference: string | null; date: string; payeParNom: string | null; version: number }[];
}

export interface RetourVue {
  id: string;
  numero: string;
  bonCommandeNumero: string | null;
  designation: string;
  quantite: number;
  motif: string;
  retourneParNom: string | null;
  date: string;
}

export interface EngagementCategorieVue {
  categorie: string;
  libelle: string;
  /** Budget prévu (BudgetPrevision, sens dépense) — nul si aucun budget défini. */
  prevu: number | null;
  /** Consommé ACHATS : factures fournisseurs VALIDÉES de l'exercice. */
  consomme: number;
  /** Engagé (RM-905) : bons émis non annulés, net des factures validées (plancher zéro). */
  engage: number;
  /** Disponible si un budget est défini : prévu − consommé − engagé. */
  disponible: number | null;
}

export interface TableauBordAchatsVue {
  demandesEnValidation: number;
  bonsEnCours: number; // émis, réception incomplète
  bonsEnRetard: number;
  facturesAValider: number;
  facturesEchues: number;
  montantAchatsExercice: number; // factures validées
  totalEngage: number;
}

/** Vue AGRÉGÉE de l'onglet Achats (chargée par la page, passée à la vue). */
export interface DonneesAchatsVue {
  fournisseurs: FournisseurVue[];
  demandes: DemandeAchatVue[];
  bonsCommande: BonCommandeVue[];
  factures: FactureFournisseurVue[];
  retours: RetourVue[];
  engagements: EngagementCategorieVue[];
  tableauBord: TableauBordAchatsVue;
}

/** Ligne saisie dans le formulaire de bon de commande (JSON du champ caché). */
export interface LigneBcSaisie {
  articleId?: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
}

/** Ligne saisie dans le formulaire de réception (JSON du champ caché). */
export interface LigneReceptionSaisie {
  ligneBonCommandeId: string;
  quantiteRecue: number;
  quantiteRefusee?: number;
  observation?: string;
}
