/**
 * Types PARTAGÉS du sous-module Caisse (09) — module PUR (aucune dépendance serveur),
 * jamais de « export type » dans un fichier "use server" (cf. commit 29dcefa).
 */

export const TYPES_CAISSE = [
  { code: "physique", libelle: "Caisse physique" },
  { code: "mobile_money", libelle: "Caisse Mobile Money" },
  { code: "virtuelle", libelle: "Caisse virtuelle (paiements en ligne)" },
  { code: "bancaire", libelle: "Caisse bancaire" },
] as const;

export const LIBELLE_TYPE_CAISSE: Record<string, string> = Object.fromEntries(
  TYPES_CAISSE.map((t) => [t.code, t.libelle]),
);

export const TYPES_MOUVEMENT_CAISSE = [
  { code: "approvisionnement", libelle: "Approvisionnement", sens: 1 },
  { code: "decaissement", libelle: "Décaissement", sens: -1 },
  { code: "transfert_entree", libelle: "Transfert reçu", sens: 1 },
  { code: "transfert_sortie", libelle: "Transfert émis", sens: -1 },
  { code: "versement_banque", libelle: "Versement bancaire", sens: -1 },
  { code: "retrait_banque", libelle: "Retrait bancaire", sens: 1 },
  { code: "regularisation_plus", libelle: "Régularisation (+)", sens: 1 },
  { code: "regularisation_moins", libelle: "Régularisation (−)", sens: -1 },
] as const;

export type TypeMouvementCaisse = (typeof TYPES_MOUVEMENT_CAISSE)[number]["code"];

export const LIBELLE_MOUVEMENT_CAISSE: Record<string, string> = Object.fromEntries(
  TYPES_MOUVEMENT_CAISSE.map((t) => [t.code, t.libelle]),
);

export function sensMouvementCaisse(type: string): number {
  return TYPES_MOUVEMENT_CAISSE.find((t) => t.code === type)?.sens ?? 0;
}

/** Types de mouvement saisissables directement (les transferts ont leur action dédiée). */
export const TYPES_MOUVEMENT_SAISISSABLES: readonly TypeMouvementCaisse[] = [
  "approvisionnement", "decaissement", "versement_banque", "retrait_banque",
  "regularisation_plus", "regularisation_moins",
];

/**
 * SEUILS d'autorisation des décaissements (09) — valeurs PAR DÉFAUT du domaine :
 * ≤ validation : autorisation automatique (finance.caisses.session) ;
 * > validation : finance.caisses.valider (Gestionnaire) ;
 * > direction : finance.caisses.approuver (Direction).
 * « Entièrement paramétrables » : l'écran de paramétrage viendra avec la spec paramétrage.
 */
export const SEUILS_DECAISSEMENT = { validation: 50_000, direction: 500_000 } as const;

export interface MouvementCaisseVue {
  id: string;
  type: string;
  montant: number;
  beneficiaire: string | null;
  motif: string | null;
  pieceJustificative: string | null;
  creeLe: string;
  annule: boolean;
  version: number;
}

/** Ligne du journal de caisse (paiements espèces, opérations rattachées, mouvements internes). */
export interface LigneJournalCaisse {
  id: string;
  heure: string; // ISO
  libelle: string;
  categorie: string; // « Encaissement », « Dépense », « Recette diverse », libellé du mouvement…
  sens: 1 | -1;
  montant: number;
  annule: boolean;
}

export interface SessionCaisseVue {
  id: string;
  caisseId: string;
  caisseNom: string;
  caissierId: string;
  caissierNom: string;
  statut: string; // « ouverte » | « cloturee »
  fondsInitial: number;
  observations: string | null;
  ouverteLe: string;
  clotureeLe: string | null;
  /** Solde théorique : CALCULÉ en session ouverte, FIGÉ à la clôture (RM-503/505). */
  soldeTheorique: number;
  totalEncaissements: number;
  totalDecaissements: number;
  soldeReel: number | null;
  ecart: number | null;
  typeEcart: string | null;
  motifEcart: string | null;
  ecartValide: boolean;
  montantAVerser: number | null;
  version: number;
  mouvements: MouvementCaisseVue[];
  /** Journal chronologique complet (imprimable). */
  journal: LigneJournalCaisse[];
}

export interface CaisseVue {
  id: string;
  nom: string;
  code: string | null;
  type: string;
  responsableId: string | null;
  responsableNom: string | null;
  plafond: number | null;
  decouvertAutorise: boolean;
  statut: string; // « active » | « suspendue »
  /** DÉRIVÉ : une session est ouverte sur cette caisse (jamais stocké — 09). */
  ouverte: boolean;
  sessionOuverte: SessionCaisseVue | null;
  /** Solde réel de la DERNIÈRE session clôturée (proposition de fonds à l'ouverture). */
  dernierSoldeReel: number | null;
  alertes: string[]; // plafond dépassé, solde négatif…
  version: number;
}

export interface TableauBordCaisseVue {
  caissesOuvertes: number;
  caissesTotal: number;
  montantEnCaisse: number; // Σ soldes théoriques des sessions ouvertes
  versementsDuJour: number;
  ecartsEnAttente: number; // sessions clôturées avec écart non validé
}
