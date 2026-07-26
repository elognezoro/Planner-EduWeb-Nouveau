/**
 * Types PURS du sous-module FOURNISSEURS (13 — référentiel unique) : états, libellés et
 * VUES sérialisables. Tous les indicateurs (score global RM-1004, expirations RM-1003,
 * états de contrats, encours) sont DÉRIVÉS en lecture — jamais stockés.
 */

/** États du 13 (+ « inactif » hérité du 12, conservé pour compatibilité). */
export const ETATS_FOURNISSEUR = [
  { code: "prospect", libelle: "Prospect (à qualifier)", commandable: false },
  { code: "actif", libelle: "Actif", commandable: true },
  { code: "surveillance", libelle: "Sous surveillance", commandable: true },
  { code: "suspendu", libelle: "Suspendu", commandable: false },
  { code: "archive", libelle: "Archivé", commandable: false },
  { code: "inactif", libelle: "Inactif", commandable: false },
] as const;

export const LIBELLE_ETAT_FOURNISSEUR: Record<string, string> = Object.fromEntries(
  ETATS_FOURNISSEUR.map((e) => [e.code, e.libelle]),
);

/** RM-901/1002/1005 : seuls ACTIF et SOUS SURVEILLANCE reçoivent de nouvelles commandes. */
export const ETATS_COMMANDABLES: readonly string[] = ["actif", "surveillance"];

/** Transitions d'état autorisées (BPMN 13) — l'approbation prospect → actif a SA propre action. */
export const TRANSITIONS_FOURNISSEUR: Record<string, readonly string[]> = {
  actif: ["surveillance", "suspendu", "archive"],
  surveillance: ["actif", "suspendu", "archive"],
  suspendu: ["actif", "archive"],
  inactif: ["actif", "archive"],
  prospect: ["archive"],
  archive: ["prospect"], // réactivation = repasse la QUALIFICATION (nouvel examen)
};

export const TYPES_DOCUMENT_FOURNISSEUR = [
  { code: "rccm", libelle: "RCCM" },
  { code: "attestation_fiscale", libelle: "Attestation fiscale" },
  { code: "attestation_cnps", libelle: "Attestation CNPS" },
  { code: "attestation_regularite", libelle: "Attestation de régularité" },
  { code: "agrement", libelle: "Agrément" },
  { code: "assurance", libelle: "Assurance" },
  { code: "piece_identite", libelle: "Pièce d'identité" },
  { code: "contrat", libelle: "Contrat" },
  { code: "catalogue", libelle: "Catalogue" },
  { code: "tarifs", libelle: "Tarifs" },
  { code: "autre", libelle: "Autre document" },
] as const;

export const TYPES_LITIGE_FOURNISSEUR = [
  { code: "retard_livraison", libelle: "Retard de livraison" },
  { code: "non_conformite", libelle: "Non-conformité" },
  { code: "erreur_facturation", libelle: "Erreur de facturation" },
  { code: "rupture_contrat", libelle: "Rupture de contrat" },
  { code: "qualite_insuffisante", libelle: "Qualité insuffisante" },
  { code: "autre", libelle: "Autre litige" },
] as const;

export const GRAVITES_LITIGE = [
  { code: "mineure", libelle: "Mineure" },
  { code: "moyenne", libelle: "Moyenne" },
  { code: "majeure", libelle: "Majeure" },
  { code: "critique", libelle: "Critique" },
] as const;

export const RENOUVELLEMENTS_CONTRAT = [
  { code: "aucun", libelle: "Sans renouvellement" },
  { code: "tacite", libelle: "Tacite reconduction" },
  { code: "express", libelle: "Renouvellement express" },
] as const;

/** Alertes dérivées (RM-1003 / contrats) — seuils du domaine, paramétrage à venir. */
export const SEUIL_ALERTE_DOCUMENT_JOURS = 30;
export const SEUIL_ALERTE_CONTRAT_JOURS = 60;

/** Critères d'évaluation (13) — notés de 1 à 5, poids ÉGAUX en V1 (pondération à venir). */
export const CRITERES_EVALUATION = [
  { cle: "scoreQualite", libelle: "Qualité (conformité, taux de défaut)" },
  { cle: "scoreDelais", libelle: "Délais (ponctualité, engagements)" },
  { cle: "scorePrix", libelle: "Prix (compétitivité, stabilité)" },
  { cle: "scoreService", libelle: "Service (réactivité, support)" },
  { cle: "scoreConformite", libelle: "Conformité (documents, réglementation)" },
] as const;

export interface ContactFrsVue {
  id: string;
  nom: string;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  principal: boolean;
  version: number;
}

export interface CompteBancaireFrsVue {
  id: string;
  banque: string;
  agence: string | null;
  numeroCompte: string | null;
  iban: string | null;
  swift: string | null;
  mobileMoney: string | null;
  principal: boolean;
  version: number;
}

export interface DocumentFrsVue {
  id: string;
  type: string;
  reference: string | null;
  dateEmission: string | null;
  dateExpiration: string | null;
  numeroVersion: number;
  /** DÉRIVÉS (RM-1003). */
  expire: boolean;
  expireBientot: boolean;
  version: number;
}

export interface ContratFrsVue {
  id: string;
  reference: string;
  objet: string;
  dateDebut: string;
  dateFin: string | null;
  montant: number | null;
  conditionsPaiement: string | null;
  penalites: string | null;
  renouvellement: string;
  documentReference: string | null;
  /** DÉRIVÉ : « en_cours » | « echeance_proche » | « expire » | « a_venir ». */
  etat: string;
  version: number;
}

export interface EvaluationFrsVue {
  id: string;
  periode: string;
  scoreQualite: number;
  scoreDelais: number;
  scorePrix: number;
  scoreService: number;
  scoreConformite: number;
  /** DÉRIVÉ (RM-1004) : moyenne des 5 critères, arrondie au dixième. */
  scoreGlobal: number;
  commentaire: string | null;
  evalueParNom: string | null;
  date: string;
  version: number;
}

export interface LitigeFrsVue {
  id: string;
  type: string;
  description: string;
  gravite: string;
  responsable: string | null;
  statut: string;
  solution: string | null;
  dateCloture: string | null;
  ouvertParNom: string | null;
  cloParNom: string | null;
  date: string;
  version: number;
}

/** Historique achats/paiements du fournisseur (12 ↔ 13) — agrégats DÉRIVÉS. */
export interface HistoriqueAchatsFrsVue {
  nbBonsCommande: number;
  totalCommande: number;
  totalFactureValidee: number;
  totalPaye: number;
  /** Encours = factures validées − paiements (comparé au plafond de crédit). */
  encours: number;
  nbRetours: number;
}

export interface FicheFournisseurVue {
  id: string;
  code: string;
  raisonSociale: string;
  nomCommercial: string | null;
  type: string;
  statut: string;
  contactNom: string | null;
  contactFonction: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  region: string | null;
  siteWeb: string | null;
  formeJuridique: string | null;
  numeroRccm: string | null;
  numeroFiscal: string | null;
  numeroCnps: string | null;
  numeroTva: string | null;
  secteurActivite: string | null;
  categoriesProduits: string | null;
  niveauStrategique: string;
  niveauRisque: string;
  delaiPaiementJours: number | null;
  remisePourcent: number | null;
  minimumCommande: number | null;
  plafondCredit: number | null;
  notes: string | null;
  creeParId: string | null;
  approuveParNom: string | null;
  dateApprobation: string | null;
  version: number;
  /** DÉRIVÉS. */
  scoreGlobal: number | null; // moyenne des évaluations actives (RM-1004)
  plafondDepasse: boolean;
  contacts: ContactFrsVue[];
  comptesBancaires: CompteBancaireFrsVue[];
  documents: DocumentFrsVue[];
  contrats: ContratFrsVue[];
  evaluations: EvaluationFrsVue[];
  litiges: LitigeFrsVue[];
  historique: HistoriqueAchatsFrsVue;
}

export interface TableauBordFournisseursVue {
  actifs: number;
  prospects: number;
  sousSurveillance: number;
  suspendus: number;
  strategiques: number;
  contratsAEcheance: number;
  documentsExpirant: number;
  litigesOuverts: number;
  scoreMoyen: number | null;
  top: { raisonSociale: string; total: number }[];
}

/** Vue AGRÉGÉE du référentiel (chargée par la page, passée à l'onglet Achats). */
export interface DonneesFournisseursVue {
  fiches: FicheFournisseurVue[];
  tableauBord: TableauBordFournisseursVue;
}
