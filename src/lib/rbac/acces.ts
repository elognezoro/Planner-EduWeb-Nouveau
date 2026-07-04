import type { RoleId } from "./roles";

/**
 * Règles d'accès transverses (cahier §4.4 et §6.3).
 *  - Matrice d'accès aux grandes sections (vue d'ensemble, pour la page « Niveaux d'accès »).
 *  - Logique d'accès RESTREINT pendant l'attente d'approbation d'une demande de rôle.
 */

export type NiveauAcces = "complet" | "partiel" | "aucun";

export interface LigneMatrice {
  section: string;
  /** Niveau par rôle ; un rôle absent = "aucun". */
  niveaux: Partial<Record<RoleId, NiveauAcces>>;
}

/**
 * Matrice d'accès condensée (cahier §4.4). Légende : complet ● · partiel ◐ · aucun —.
 * La granularité fine (créer/modifier/supprimer/consulter) est précisée module par module.
 */
export const MATRICE_SECTIONS: LigneMatrice[] = [
  {
    section: "Pilotage",
    niveaux: {
      admin: "complet",
      etablissements_admin: "complet",
      drena: "complet",
      inspecteur: "complet",
      cafop_admin: "complet",
      apfc_admin: "complet",
      chef_etablissement: "complet",
      adjoint_chef_etablissement: "complet",
      chef_antenne: "complet",
      inspecteur_orientation: "partiel",
      conseiller_pedagogique: "partiel",
      enseignant: "partiel",
      educateur: "partiel",
      parent: "partiel",
      eleve: "partiel",
    },
  },
  {
    section: "Système (administration)",
    niveaux: {
      admin: "complet",
      etablissements_admin: "partiel",
      cafop_admin: "partiel",
      apfc_admin: "partiel",
      adjoint_chef_etablissement: "partiel",
    },
  },
  {
    section: "Vie scolaire (incl. emplois du temps)",
    niveaux: {
      admin: "complet",
      chef_etablissement: "complet",
      adjoint_chef_etablissement: "complet",
      drena: "partiel",
      inspecteur: "partiel",
      inspecteur_orientation: "partiel",
      enseignant: "partiel",
      educateur: "partiel",
      parent: "partiel",
      eleve: "partiel",
    },
  },
  {
    section: "Inspection & Supervision",
    niveaux: {
      admin: "complet",
      drena: "complet",
      inspecteur: "complet",
      conseiller_pedagogique: "partiel",
      chef_antenne: "partiel",
      chef_etablissement: "partiel",
      adjoint_chef_etablissement: "partiel",
    },
  },
  {
    section: "Rapports & Activités",
    niveaux: {
      admin: "complet",
      drena: "complet",
      inspecteur: "complet",
      chef_etablissement: "complet",
      etablissements_admin: "complet",
      cafop_admin: "partiel",
      apfc_admin: "partiel",
      enseignant: "partiel",
    },
  },
  {
    section: "Statistiques",
    niveaux: {
      admin: "complet",
      drena: "complet",
      inspecteur: "complet",
      chef_etablissement: "partiel",
      etablissements_admin: "partiel",
      enseignant: "partiel",
    },
  },
  {
    section: "CAFOP",
    niveaux: {
      admin: "complet",
      cafop_admin: "complet",
      drena: "partiel",
    },
  },
  {
    section: "APFC",
    niveaux: {
      admin: "complet",
      apfc_admin: "complet",
      chef_antenne: "complet",
      conseiller_pedagogique: "complet",
      drena: "partiel",
    },
  },
];

// ─────────────────────────────────────────────────────────────
//  Accès restreint pendant l'attente d'approbation (cahier §6.3)
// ─────────────────────────────────────────────────────────────

/**
 * Segments de page accessibles tant qu'une demande de rôle est `en_attente`.
 * Seules « Mon Identification » et « Mon Profil » sont autorisées — uniformément
 * pour tous les rôles demandés (décision explicite §6.3).
 */
export const SEGMENTS_AUTORISES_EN_ATTENTE = ["mon-identification", "mon-profil"] as const;

export type SegmentAutoriseEnAttente = (typeof SEGMENTS_AUTORISES_EN_ATTENTE)[number];

export function segmentAutoriseEnAttente(segment: string): boolean {
  return (SEGMENTS_AUTORISES_EN_ATTENTE as readonly string[]).includes(segment);
}
