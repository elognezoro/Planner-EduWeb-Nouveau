/**
 * Types PURS du sous-module IMMOBILISATIONS (15) : catégories (et leurs comptes OHADA de
 * classe 2/28), états du cycle de vie, plan d'amortissement DÉRIVÉ, VUES sérialisables.
 * La VNC n'est jamais stockée : elle est calculée depuis coût, durée et date de mise en
 * service (fonctions pures ci-dessous), réutilisables côté serveur ET client.
 */

/** Catégorie d'immobilisation → comptes OHADA (2x immobilisation, 28x amortissements),
 *  amortissable, durée par défaut (mois). Terrains non amortissables. */
export const CATEGORIES_IMMO = [
  { code: "incorporelle", libelle: "Immobilisation incorporelle (licence, brevet)", compteImmo: "21", compteAmort: "281", amortissable: true, dureeMoisDefaut: 36 },
  { code: "terrain", libelle: "Terrain", compteImmo: "22", compteAmort: null, amortissable: false, dureeMoisDefaut: 0 },
  { code: "batiment", libelle: "Bâtiment, installation, agencement", compteImmo: "23", compteAmort: "283", amortissable: true, dureeMoisDefaut: 240 },
  { code: "materiel_informatique", libelle: "Matériel informatique", compteImmo: "24", compteAmort: "284", amortissable: true, dureeMoisDefaut: 36 },
  { code: "mobilier", libelle: "Mobilier de bureau", compteImmo: "24", compteAmort: "284", amortissable: true, dureeMoisDefaut: 120 },
  { code: "vehicule", libelle: "Véhicule", compteImmo: "24", compteAmort: "284", amortissable: true, dureeMoisDefaut: 60 },
  { code: "materiel_pedagogique", libelle: "Matériel pédagogique", compteImmo: "24", compteAmort: "284", amortissable: true, dureeMoisDefaut: 60 },
  { code: "equipement_sportif", libelle: "Équipement sportif", compteImmo: "24", compteAmort: "284", amortissable: true, dureeMoisDefaut: 60 },
  { code: "autre", libelle: "Autre immobilisation", compteImmo: "24", compteAmort: "284", amortissable: true, dureeMoisDefaut: 60 },
] as const;

export const LIBELLE_CATEGORIE_IMMO: Record<string, string> = Object.fromEntries(
  CATEGORIES_IMMO.map((c) => [c.code, c.libelle]),
);

export function categorieImmo(code: string) {
  return CATEGORIES_IMMO.find((c) => c.code === code) ?? CATEGORIES_IMMO[CATEGORIES_IMMO.length - 1];
}

export const MODES_ACQUISITION = [
  { code: "achat", libelle: "Achat" },
  { code: "don", libelle: "Don" },
  { code: "subvention", libelle: "Subvention" },
  { code: "transfert", libelle: "Transfert" },
  { code: "production", libelle: "Production interne" },
  { code: "leasing", libelle: "Crédit-bail (leasing)" },
] as const;

/** États du cycle de vie (BPMN 15). */
export const ETATS_IMMO = [
  { code: "acquisition", libelle: "En acquisition" },
  { code: "installation", libelle: "En installation" },
  { code: "service", libelle: "En service" },
  { code: "maintenance", libelle: "En maintenance" },
  { code: "hors_service", libelle: "Hors service" },
  { code: "cession", libelle: "En cession" },
  { code: "reforme", libelle: "Réformée" },
  { code: "detruite", libelle: "Détruite" },
  { code: "perdue", libelle: "Perdue / volée" },
  { code: "archive", libelle: "Archivée" },
] as const;

export const LIBELLE_ETAT_IMMO: Record<string, string> = Object.fromEntries(
  ETATS_IMMO.map((e) => [e.code, e.libelle]),
);

/** États « en service » du bien (amortissable et déplaçable, non sortis). */
export const ETATS_ACTIFS_IMMO: readonly string[] = ["service", "maintenance", "hors_service"];
/** États finaux de SORTIE (RM-1203). */
export const ETATS_SORTIE_IMMO: readonly string[] = ["cession", "reforme", "detruite", "perdue"];

/** Transitions manuelles d'état (hors mise en service et sortie, qui ont leurs actions). */
export const TRANSITIONS_IMMO: Record<string, readonly string[]> = {
  service: ["maintenance", "hors_service"],
  maintenance: ["service", "hors_service"],
  hors_service: ["service", "maintenance"],
};

/** Types de sortie (RM-1203) — « vente » porte un produit de cession. */
export const TYPES_SORTIE_IMMO = [
  { code: "vente", libelle: "Vente (cession)", etat: "cession" },
  { code: "reforme", libelle: "Réforme", etat: "reforme" },
  { code: "destruction", libelle: "Destruction", etat: "detruite" },
  { code: "perte", libelle: "Perte", etat: "perdue" },
  { code: "vol", libelle: "Vol", etat: "perdue" },
  { code: "don", libelle: "Don sortant", etat: "cession" },
] as const;

export const TYPES_MAINTENANCE = [
  { code: "preventive", libelle: "Préventive (planifiée)" },
  { code: "corrective", libelle: "Corrective (incident)" },
] as const;

/** Alerte garantie/maintenance/amortissement (jours) — paramétrage à venir. */
export const SEUIL_ALERTE_GARANTIE_JOURS = 60;

// ─────────────────────────────────────────────────────────────
//  Amortissement LINÉAIRE — fonctions PURES (plan dérivé, VNC calculée)
// ─────────────────────────────────────────────────────────────

export interface ParamsAmortissement {
  valeurBrute: number;
  valeurResiduelle: number;
  dureeMois: number;
  dateMiseEnService: string | null; // ISO ; null = pas encore amortissable (RM-1201)
  amortissable: boolean;
}

export interface LignePlanAmortissement {
  annee: number;
  dotation: number;
  cumul: number;
  vnc: number;
}

/** Dotation mensuelle théorique (linéaire), le dernier mois absorbant l'arrondi. */
function dotationsMensuelles(base: number, dureeMois: number): number[] {
  if (dureeMois <= 0 || base <= 0) return [];
  const perMonth = Math.floor(base / dureeMois);
  const mois = new Array<number>(dureeMois).fill(perMonth);
  mois[dureeMois - 1] = base - perMonth * (dureeMois - 1); // reste sur le dernier mois
  return mois;
}

/** Plan d'amortissement ANNUEL dérivé (prorata temporis mensuel). */
export function planAmortissement(p: ParamsAmortissement): LignePlanAmortissement[] {
  if (!p.amortissable || !p.dateMiseEnService) return [];
  const base = Math.max(0, p.valeurBrute - p.valeurResiduelle);
  const mensuelles = dotationsMensuelles(base, p.dureeMois);
  if (mensuelles.length === 0) return [];
  const debut = new Date(p.dateMiseEnService);
  const anneeDebut = debut.getUTCFullYear();
  const moisDebut = debut.getUTCMonth();
  const parAnnee = new Map<number, number>();
  for (let i = 0; i < mensuelles.length; i += 1) {
    const annee = anneeDebut + Math.floor((moisDebut + i) / 12);
    parAnnee.set(annee, (parAnnee.get(annee) ?? 0) + mensuelles[i]);
  }
  let cumul = 0;
  return [...parAnnee.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([annee, dotation]) => {
      cumul += dotation;
      return { annee, dotation, cumul, vnc: p.valeurBrute - cumul };
    });
}

/** Amortissement cumulé THÉORIQUE à une date donnée (mois entiers écoulés). */
export function amortissementCumuleTheorique(p: ParamsAmortissement, asOf: Date = new Date()): number {
  if (!p.amortissable || !p.dateMiseEnService) return 0;
  const base = Math.max(0, p.valeurBrute - p.valeurResiduelle);
  const mensuelles = dotationsMensuelles(base, p.dureeMois);
  if (mensuelles.length === 0) return 0;
  const debut = new Date(p.dateMiseEnService);
  let ecoulis = (asOf.getUTCFullYear() - debut.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - debut.getUTCMonth());
  ecoulis = Math.max(0, Math.min(ecoulis, mensuelles.length));
  return mensuelles.slice(0, ecoulis).reduce((s, m) => s + m, 0);
}

/** VNC théorique = valeur brute − amortissement cumulé théorique. */
export function vncTheorique(p: ParamsAmortissement, asOf: Date = new Date()): number {
  return p.valeurBrute - amortissementCumuleTheorique(p, asOf);
}

// ─────────────────────────────────────────────────────────────
//  Vues sérialisables
// ─────────────────────────────────────────────────────────────

export interface DotationVue {
  id: string;
  periode: string;
  montant: number;
  cumulApres: number;
  vncApres: number;
  date: string;
  version: number;
}

export interface MaintenanceVue {
  id: string;
  type: string;
  description: string;
  prestataire: string | null;
  datePrevue: string | null;
  dateRealisee: string | null;
  coutPrevu: number | null;
  coutReel: number | null;
  statut: string;
  version: number;
}

export interface EvenementVue {
  id: string;
  type: string;
  description: string;
  montant: number | null;
  parNom: string | null;
  date: string;
}

export interface ImmobilisationVue {
  id: string;
  code: string;
  designation: string;
  description: string | null;
  categorie: string;
  sousCategorie: string | null;
  numeroSerie: string | null;
  dateAcquisition: string;
  dateMiseEnService: string | null;
  fournisseurNom: string | null;
  factureReference: string | null;
  coutAcquisition: number;
  valeurBrute: number;
  valeurResiduelle: number;
  dureeMois: number;
  modeAmortissement: string;
  amortissable: boolean;
  modeAcquisition: string;
  compteImmo: string;
  compteAmort: string | null;
  garantieFournisseur: string | null;
  garantieEcheance: string | null;
  localisation: string | null;
  responsableNom: string | null;
  statut: string;
  typeSortie: string | null;
  motifSortie: string | null;
  dateSortie: string | null;
  valeurCession: number | null;
  origineArticleId: string | null;
  creeParId: string | null;
  version: number;
  /** DÉRIVÉS. */
  amortiComptabilise: number; // Σ dotations comptabilisées
  vncComptable: number; // valeurBrute − amortiComptabilise
  amortiTheorique: number; // à aujourd'hui
  vncTheorique: number;
  dotationDue: boolean; // une dotation d'exercice reste à comptabiliser
  garantieExpire: boolean;
  plan: LignePlanAmortissement[];
  dotations: DotationVue[];
  maintenances: MaintenanceVue[];
  evenements: EvenementVue[];
}

export interface TableauBordImmoVue {
  nbActifs: number;
  valeurBrute: number;
  amortissementsCumules: number;
  valeurNette: number;
  enMaintenance: number;
  horsService: number;
  garantiesExpirant: number;
  dotationsDues: number;
  parCategorie: { categorie: string; libelle: string; nombre: number; valeurBrute: number; vnc: number }[];
}

/** Vue AGRÉGÉE du 15 (chargée par la page, passée à l'onglet). */
export interface DonneesImmobilisationsVue {
  immobilisations: ImmobilisationVue[];
  tableauBord: TableauBordImmoVue;
}
