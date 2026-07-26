import type { RoleId } from "@/lib/rbac/roles";

/**
 * REGISTRE des permissions atomiques du module Finance (docs/finance/97-RBAC, RM-2600/2601 ;
 * 04-Profils) — convention `module.ressource.action`, maintenu EN CODE avec la matrice
 * rôle → permissions (référentiel « maintenu avec le code source », 97 §Matrice), cohérent
 * avec le RBAC rang+périmètre existant qui EST notre implémentation RBAC+ABAC+multi-tenant :
 * le périmètre établissement (tenant, RM-2605) est vérifié par la garde unique
 * `exigerPermissionFinance` (src/lib/finances/commun/rbac.ts), jamais par les pages.
 *
 * Module PUR (importable par les composants clients — cases à cocher des délégations).
 *
 * Reports assumés (documentés) : MFA/OTP (chantier sécurité séparé) ; héritage hiérarchique
 * automatique (97 : héritage seulement EXPLICITE — cette matrice en code est l'explicite) ;
 * certification périodique des accès et simulation « Why/Why Not » (évolutions) ; rôles hors
 * Finance du 97 (responsable RH, pédagogique…) : viendront avec leurs modules.
 */

export const PERMISSIONS_FINANCE = [
  // Lectures
  { code: "finance.tableaux.lire", libelle: "Consulter les tableaux de bord financiers" },
  { code: "finance.scolarite.lire", libelle: "Consulter les comptes financiers des élèves" },
  { code: "finance.exports.exporter", libelle: "Exporter les états comptables (FEC, rapports)" },
  // Scolarité (06)
  { code: "finance.frais.gerer", libelle: "Gérer le barème des frais et les catégories" },
  { code: "finance.remises.gerer", libelle: "Accorder / retirer des remises et bourses internes" },
  { code: "finance.creances.generer", libelle: "Générer / recalculer les créances" },
  { code: "finance.exonerations.gerer", libelle: "Accorder / annuler des exonérations" },
  { code: "finance.bourses.gerer", libelle: "Accorder / annuler des bourses" },
  { code: "finance.plans.gerer", libelle: "Gérer les plans de paiement" },
  { code: "finance.penalites.gerer", libelle: "Paramétrer et appliquer les pénalités" },
  { code: "finance.avances.gerer", libelle: "Enregistrer et imputer les avances" },
  { code: "finance.remboursements.demander", libelle: "Demander un remboursement" },
  { code: "finance.remboursements.valider", libelle: "Valider / refuser un remboursement" },
  { code: "finance.remboursements.payer", libelle: "Payer un remboursement validé" },
  { code: "finance.blocages.gerer", libelle: "Configurer les règles de blocage pédagogique" },
  { code: "finance.scolarite.cloturer", libelle: "Clôturer le compte d'un élève" },
  { code: "finance.scolarite.relancer", libelle: "Relancer les familles (impayés)" },
  // Encaissements & trésorerie
  { code: "finance.paiements.encaisser", libelle: "Encaisser un paiement (reçu numéroté)" },
  { code: "finance.paiements.annuler", libelle: "Annuler un paiement (motif obligatoire)" },
  { code: "finance.operations.creer", libelle: "Saisir une recette / dépense au journal" },
  { code: "finance.operations.annuler", libelle: "Annuler une opération du journal" },
  // Facturation (07)
  { code: "finance.factures.creer", libelle: "Créer / modifier des factures (brouillons, proformas)" },
  { code: "finance.factures.valider", libelle: "Valider une facture" },
  { code: "finance.factures.emettre", libelle: "Émettre une facture (numérotation) et gérer son cycle" },
  { code: "finance.factures.annuler", libelle: "Annuler une facture (motif obligatoire)" },
  { code: "finance.factures.avoir", libelle: "Créer un avoir sur une facture émise" },
  { code: "finance.factures.debiter", libelle: "Créer une note de débit sur une facture émise" },
  // Caisses (09)
  { code: "finance.caisses.gerer", libelle: "Paramétrer les caisses (création, plafond, suspension)" },
  { code: "finance.caisses.session", libelle: "Ouvrir / clôturer SA session de caisse et saisir les mouvements courants" },
  { code: "finance.caisses.valider", libelle: "Valider les écarts de caisse, transferts et décaissements moyens" },
  { code: "finance.caisses.approuver", libelle: "Approuver les gros décaissements de caisse (seuil direction)" },
  // Économat
  { code: "finance.articles.gerer", libelle: "Gérer les articles de l'économat (prix)" },
  { code: "finance.stocks.mouvementer", libelle: "Enregistrer entrées / sorties / inventaires de stock" },
  // Banque (10)
  { code: "finance.banques.gerer", libelle: "Paramétrer les comptes bancaires (création, statut)" },
  { code: "finance.banques.mouvementer", libelle: "Saisir les opérations bancaires (dépôts, retraits, virements, frais)" },
  // Achats (12) + minimum fournisseur (le référentiel complet viendra au 13)
  { code: "finance.fournisseurs.gerer", libelle: "Gérer les fournisseurs (création, statut)" },
  { code: "finance.achats.demander", libelle: "Créer et soumettre des demandes d'achat" },
  { code: "finance.achats.valider", libelle: "Valider / refuser une demande d'achat (jusqu'au seuil direction)" },
  { code: "finance.achats.approuver", libelle: "Approuver les demandes d'achat au-delà du seuil direction" },
  { code: "finance.achats.commander", libelle: "Établir et émettre les bons de commande" },
  { code: "finance.achats.receptionner", libelle: "Enregistrer les réceptions de commandes" },
  { code: "finance.achats.facturer", libelle: "Enregistrer / valider les factures fournisseurs" },
  { code: "finance.achats.payer", libelle: "Régler les factures fournisseurs et enregistrer les retours" },
  // Comptabilité (11)
  { code: "finance.ecritures.saisir", libelle: "Saisir des écritures comptables (brouillons) et générer les automatiques" },
  { code: "finance.ecritures.valider", libelle: "Valider une écriture et contre-passer une écriture validée" },
  { code: "finance.ecritures.cloturer", libelle: "Clôturer / rouvrir une période comptable" },
  { code: "finance.rapprochement.pointer", libelle: "Rapprochement bancaire (pointage, relevés)" },
  { code: "finance.budgets.gerer", libelle: "Élaborer le budget prévisionnel" },
  { code: "finance.clotures.gerer", libelle: "Clôturer / rouvrir un exercice" },
  // Gouvernance des droits
  { code: "finance.delegations.gerer", libelle: "Accorder / révoquer des délégations de droits" },
] as const;

export type PermissionFinance = (typeof PERMISSIONS_FINANCE)[number]["code"];

export const CODES_PERMISSIONS_FINANCE: readonly PermissionFinance[] = PERMISSIONS_FINANCE.map(
  (p) => p.code,
);

export function estPermissionFinance(code: string): code is PermissionFinance {
  return (CODES_PERMISSIONS_FINANCE as readonly string[]).includes(code);
}

/** Permissions de LECTURE : autorisées en mode Aperçu de rôle (jamais les écritures). */
const PERMISSIONS_LECTURE: readonly PermissionFinance[] = [
  "finance.tableaux.lire",
  "finance.scolarite.lire",
  "finance.exports.exporter",
];

export function estPermissionLecture(code: PermissionFinance): boolean {
  return PERMISSIONS_LECTURE.includes(code);
}

const TOUTES: readonly PermissionFinance[] = CODES_PERMISSIONS_FINANCE;

/** Tout le financier SAUF la gouvernance des délégations (réservée à la direction/admin). */
const TOUTES_SAUF_DELEGATIONS: readonly PermissionFinance[] = CODES_PERMISSIONS_FINANCE.filter(
  (c) => c !== "finance.delegations.gerer",
);

const LECTURE_SEULE: readonly PermissionFinance[] = PERMISSIONS_LECTURE;

/**
 * MATRICE rôle → permissions (04-Profils P-003→P-008, P-016/P-017 + moindre privilège).
 * Comportement INCHANGÉ pour les rôles historiques : admin, chef/ACE, économe et admin
 * d'établissements conservent la totalité des droits qu'ils avaient avant la granularité.
 * Les rôles absents de cette matrice n'ont AUCUNE permission Finance (RM-2600).
 */
const MATRICE: Partial<Record<RoleId, readonly PermissionFinance[]>> = {
  admin: TOUTES,
  chef_etablissement: TOUTES, // « directeur_etudes » hérite via roleEffectifRBAC (alias central)
  adjoint_chef_etablissement: TOUTES,
  etablissements_admin: TOUTES,
  // L'Économe garde TOUS ses droits historiques ; la gouvernance des DÉLÉGATIONS (nouvelle)
  // revient à la direction (04 : « le Directeur délègue »).
  econome: TOUTES_SAUF_DELEGATIONS,
  // P-004 — Gestionnaire Financier : tout le financier SAUF l'économat (prix/stocks :
  // magasinier/économe) et la gouvernance des délégations (direction).
  gestionnaire_financier: [
    "finance.tableaux.lire", "finance.scolarite.lire", "finance.exports.exporter",
    "finance.frais.gerer", "finance.remises.gerer", "finance.creances.generer",
    "finance.exonerations.gerer", "finance.bourses.gerer", "finance.plans.gerer",
    "finance.penalites.gerer", "finance.avances.gerer",
    "finance.remboursements.demander", "finance.remboursements.valider", "finance.remboursements.payer",
    "finance.blocages.gerer", "finance.scolarite.cloturer", "finance.scolarite.relancer",
    "finance.paiements.encaisser", "finance.paiements.annuler",
    "finance.operations.creer", "finance.operations.annuler",
    "finance.rapprochement.pointer", "finance.budgets.gerer", "finance.clotures.gerer",
    // Facturation (07) : le Gestionnaire Financier gère tout le cycle documentaire.
    "finance.factures.creer", "finance.factures.valider", "finance.factures.emettre",
    "finance.factures.annuler", "finance.factures.avoir", "finance.factures.debiter",
    // Caisses (09) : supervise les caisses et valide les écarts (04 : validation Gestionnaire) —
    // le seuil DIRECTION (finance.caisses.approuver) reste à la direction.
    "finance.caisses.gerer", "finance.caisses.session", "finance.caisses.valider",
    // Banque (10) : le Gestionnaire gère les comptes et opère (04 : suit la trésorerie) ;
    // le comptable, lui, RAPPROCHE (finance.rapprochement.pointer, inchangé).
    "finance.banques.gerer", "finance.banques.mouvementer",
    // Comptabilité (11) : le Gestionnaire saisit, valide et LANCE LES CLÔTURES (04).
    "finance.ecritures.saisir", "finance.ecritures.valider", "finance.ecritures.cloturer",
    // Achats (12) : le Gestionnaire gère les fournisseurs et tout le cycle P2P (04 P-004),
    // SAUF l'approbation au-delà du seuil direction (12 : « > 1 000 000 → Directeur »).
    "finance.fournisseurs.gerer", "finance.achats.demander", "finance.achats.valider",
    "finance.achats.commander", "finance.achats.receptionner", "finance.achats.facturer",
    "finance.achats.payer",
  ],
  // P-005 — Comptable : lecture, rapprochements, écritures d'ajustement autorisées, exports.
  // 11 : saisit et VALIDE ses écritures, corrige par CONTRE-PASSATION (jamais de suppression
  // d'une validée — RM-701/702) ; les clôtures de période restent au Gestionnaire (04).
  comptable: [
    "finance.tableaux.lire", "finance.scolarite.lire", "finance.exports.exporter",
    "finance.operations.creer", "finance.rapprochement.pointer",
    "finance.ecritures.saisir", "finance.ecritures.valider",
  ],
  // P-006 — Caissier : encaisse, édite les reçus, avances, remboursements AUTORISÉS (validés) ;
  // 09 : ouvre et clôture SA session de caisse (les écarts sont validés par un second acteur).
  caissier: [
    "finance.scolarite.lire",
    "finance.paiements.encaisser", "finance.avances.gerer", "finance.remboursements.payer",
    "finance.caisses.session",
  ],
  // P-008 — Magasinier : entrées/sorties/inventaires ; jamais les prix (articles.gerer exclu).
  // 12-Achats : il RÉCEPTIONNE les commandes (l'entrée en stock découle de la réception).
  magasinier: ["finance.stocks.mouvementer", "finance.achats.receptionner"],
  // P-016 / P-017 — Auditeur & Commissaire aux Comptes : LECTURE SEULE + exports.
  auditeur: LECTURE_SEULE,
  commissaire_comptes: LECTURE_SEULE,
};

const ENSEMBLE_VIDE: ReadonlySet<PermissionFinance> = new Set();
const ENSEMBLES = new Map<RoleId, ReadonlySet<PermissionFinance>>(
  (Object.entries(MATRICE) as [RoleId, readonly PermissionFinance[]][]).map(([role, perms]) => [
    role,
    new Set(perms),
  ]),
);

/** Permissions Finance d'un rôle (ensemble vide si le rôle est hors module — RM-2600). */
export function permissionsDuRole(role: RoleId): ReadonlySet<PermissionFinance> {
  return ENSEMBLES.get(role) ?? ENSEMBLE_VIDE;
}

/** Rôles ayant accès à la page Finances (navigation + requireRole de la page). */
export const ROLES_FINANCE: readonly RoleId[] = Object.keys(MATRICE) as RoleId[];

/**
 * SÉPARATION DES RESPONSABILITÉS (97 + 04 « Double validation ») : opérations à DEUX acteurs
 * distincts — le contrôle serveur impose acteur de l'étape 2 ≠ acteur de l'étape 1.
 * Actif dès maintenant : remboursements. Les entrées suivantes documentent les cycles des
 * modules à venir (07+ : dépenses, fournisseurs, budgets) et seront branchées avec eux.
 */
export const OPERATIONS_DOUBLE_ACTEUR = [
  { entite: "DemandeRemboursement", etape1: "finance.remboursements.demander", etape2: "finance.remboursements.valider", actif: true },
  { entite: "SessionCaisse (écart)", etape1: "finance.caisses.session", etape2: "finance.caisses.valider", actif: true },
  // 12-Achats : le validateur (ou l'approbateur direction) est TOUJOURS distinct du demandeur.
  { entite: "DemandeAchat", etape1: "finance.achats.demander", etape2: "finance.achats.valider", actif: true },
  { entite: "Depense (17)", etape1: "finance.depenses.creer", etape2: "finance.depenses.valider", actif: false },
  { entite: "Budget (16)", etape1: "finance.budgets.gerer", etape2: "finance.budgets.approuver", actif: false },
] as const;

export const MESSAGE_SEPARATION_RESPONSABILITES =
  "Séparation des responsabilités : le validateur doit être différent du demandeur.";

/** Droits GROSSIERS pour l'UI (affichage des formulaires par onglet) — le serveur reste seul juge. */
export interface DroitsFinancesUi {
  scolarite: boolean;
  facturation: boolean;
  paiements: boolean;
  caisses: boolean;
  banques: boolean;
  tresorerie: boolean;
  economat: boolean;
  achats: boolean;
  comptabilite: boolean;
  rapprochement: boolean;
  budget: boolean;
  delegations: boolean;
}

/** Vue sérialisable d'une délégation (liste « Droits & délégations » de la page Finances). */
export interface DelegationVue {
  id: string;
  beneficiaireId: string;
  beneficiaireNom: string;
  accordeParNom: string;
  permissions: string[];
  motif: string;
  debut: string; // ISO
  fin: string; // ISO
  statut: "active" | "a_venir" | "expiree" | "revoquee";
  version: number;
}

/** Membre du personnel de l'établissement éligible à une délégation. */
export interface PersonnelVue {
  id: string;
  nom: string;
  role: string;
}

export function droitsUiPourRole(role: RoleId): DroitsFinancesUi {
  const p = permissionsDuRole(role);
  return {
    scolarite:
      p.has("finance.frais.gerer") || p.has("finance.creances.generer") ||
      p.has("finance.exonerations.gerer") || p.has("finance.avances.gerer") ||
      p.has("finance.remboursements.payer"),
    facturation: p.has("finance.factures.creer"),
    paiements: p.has("finance.paiements.encaisser"),
    caisses: p.has("finance.caisses.session") || p.has("finance.caisses.gerer"),
    banques: p.has("finance.banques.gerer") || p.has("finance.banques.mouvementer"),
    tresorerie: p.has("finance.operations.creer"),
    economat: p.has("finance.articles.gerer") || p.has("finance.stocks.mouvementer"),
    achats:
      p.has("finance.achats.demander") || p.has("finance.achats.receptionner") ||
      p.has("finance.achats.valider"),
    comptabilite: p.has("finance.clotures.gerer") || p.has("finance.ecritures.saisir"),
    rapprochement: p.has("finance.rapprochement.pointer"),
    budget: p.has("finance.budgets.gerer"),
    delegations: p.has("finance.delegations.gerer"),
  };
}
