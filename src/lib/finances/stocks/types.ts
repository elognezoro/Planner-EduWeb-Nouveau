/**
 * Types PURS du sous-module STOCKS (14) : constantes, libellés et VUES sérialisables.
 * Disponible, valorisations, écarts d'inventaire et alertes sont DÉRIVÉS — jamais stockés
 * (seule exception documentée : le CUMP, agrégat de valorisation tenu en transaction).
 */

export const TYPES_MAGASIN = [
  { code: "central", libelle: "Magasin central" },
  { code: "pedagogique", libelle: "Magasin pédagogique" },
  { code: "informatique", libelle: "Magasin informatique" },
  { code: "laboratoire", libelle: "Magasin laboratoire" },
  { code: "cantine", libelle: "Magasin cantine" },
  { code: "maintenance", libelle: "Magasin maintenance" },
  { code: "pharmacie", libelle: "Pharmacie / Infirmerie" },
  { code: "depot", libelle: "Dépôt temporaire" },
] as const;

export const TYPES_ARTICLE = [
  { code: "consommable", libelle: "Consommable" },
  { code: "stockable", libelle: "Stockable (équipement)" },
  { code: "immobilisable", libelle: "Immobilisable (→ module 15 à venir)" },
] as const;

/** Sorties motivées du 14 (les ventes du comptoir restent le flux historique). */
export const TYPES_SORTIE_STOCK = [
  { code: "consommation", libelle: "Consommation interne" },
  { code: "distribution", libelle: "Distribution (classes, services)" },
  { code: "rebut", libelle: "Mise au rebut" },
] as const;

export const MOTIFS_RESERVATION = [
  { code: "laboratoire", libelle: "Laboratoire" },
  { code: "examen", libelle: "Examen" },
  { code: "evenement", libelle: "Événement" },
  { code: "maintenance", libelle: "Maintenance" },
  { code: "salle_informatique", libelle: "Salle informatique" },
  { code: "autre", libelle: "Autre" },
] as const;

export const TYPES_INVENTAIRE = [
  { code: "general", libelle: "Inventaire général" },
  { code: "tournant", libelle: "Inventaire tournant" },
  { code: "exceptionnel", libelle: "Inventaire exceptionnel" },
] as const;

export const STATUTS_SERIE = [
  { code: "disponible", libelle: "Disponible" },
  { code: "reserve", libelle: "Réservé" },
  { code: "en_transit", libelle: "En transit" },
  { code: "endommage", libelle: "Endommagé" },
  { code: "obsolete", libelle: "Obsolète" },
  { code: "sorti", libelle: "Sorti du stock" },
] as const;

/** RM-1103 : au-delà de cette VALEUR (qté × CUMP/prix d'achat), la sortie exige
 *  finance.stocks.valider (seuil du domaine — paramétrage à venir). */
export const SEUIL_VALIDATION_SORTIE_STOCK = 100_000;

/** Alertes de péremption (14) : paliers en jours — paramétrage à venir. */
export const PALIERS_PEREMPTION_JOURS = [90, 60, 30, 7] as const;

export interface MagasinVue {
  id: string;
  nom: string;
  type: string;
  parentId: string | null;
  cheminComplet: string; // « Magasin central › Zone A › Rayon 3 »
  profondeur: number;
  statut: string;
  principal: boolean;
  nbArticles: number;
  quantiteTotale: number;
  version: number;
}

export interface StockParMagasinVue {
  magasinId: string;
  magasinNom: string;
  quantite: number;
}

export interface LotVue {
  id: string;
  articleId: string;
  articleNom: string;
  numeroLot: string;
  dateFabrication: string | null;
  datePeremption: string | null;
  fournisseurRef: string | null;
  coutAcquisition: number | null;
  quantite: number;
  /** DÉRIVÉS : périmé / jours restants (nul = sans péremption). */
  perime: boolean;
  joursRestants: number | null;
  version: number;
}

export interface SerieVue {
  id: string;
  articleId: string;
  articleNom: string;
  numeroSerie: string;
  statut: string;
  observation: string | null;
  version: number;
}

export interface ReservationVue {
  id: string;
  articleId: string;
  articleNom: string;
  quantite: number;
  motif: string;
  beneficiaire: string | null;
  dateDebut: string;
  dateFin: string | null;
  statut: string;
  demandeParNom: string | null;
  version: number;
}

export interface LigneInventaireVue {
  id: string;
  articleId: string;
  articleNom: string;
  stockTheorique: number;
  stockPhysique: number | null;
  /** DÉRIVÉ : physique − théorique (nul tant que non compté). */
  ecart: number | null;
  observation: string | null;
}

export interface InventaireVue {
  id: string;
  reference: string;
  type: string;
  magasinId: string | null;
  magasinNom: string | null;
  statut: string;
  notes: string | null;
  compteParNom: string | null;
  compteParId: string | null;
  valideParNom: string | null;
  dateValidation: string | null;
  date: string;
  version: number;
  lignes: LigneInventaireVue[];
  /** DÉRIVÉS. */
  nbComptees: number;
  nbEcarts: number;
}

/** Situation de stock d'un article (14) — tout dérivé sauf le CUMP. */
export interface SituationArticleVue {
  articleId: string;
  nom: string;
  unite: string;
  typeArticle: string;
  stock: number;
  reserve: number;
  disponible: number; // stock − réservations actives (RM-1100)
  stockMin: number; // seuilAlerte historique
  stockMax: number | null;
  cump: number | null;
  valeur: number; // stock × (cump ?? prixAchat ?? 0)
  /** DÉRIVÉS : alertes. */
  rupture: boolean;
  sousSeuil: boolean;
  surstock: boolean;
  parMagasin: StockParMagasinVue[];
}

export interface TableauBordStocksVue {
  valeurTotale: number;
  nbRuptures: number;
  nbSousSeuil: number;
  nbSurstock: number;
  nbLotsPerimes: number;
  nbLotsProches: number; // sous le premier palier (90 j)
  quantiteReservee: number;
  inventairesEnCours: number;
}

/** Vue AGRÉGÉE du 14 (chargée par la page, passée à l'onglet Économat). */
export interface DonneesStocksVue {
  magasins: MagasinVue[];
  situations: SituationArticleVue[];
  lots: LotVue[];
  series: SerieVue[];
  reservations: ReservationVue[];
  inventaires: InventaireVue[];
  tableauBord: TableauBordStocksVue;
}
