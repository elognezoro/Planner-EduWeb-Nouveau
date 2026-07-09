import type { Prisma } from "@prisma/client";
import { ROLES, type RoleId, type TypePortee } from "./roles";

/**
 * Logique de PÉRIMÈTRE (scope) — cahier des charges §4.3.
 *
 * Deux utilisateurs de même rôle mais de périmètres différents ne voient JAMAIS les
 * mêmes données. Cette couche produit des filtres Prisma (`where`) à appliquer côté
 * serveur AVANT tout renvoi au client. Elle est centralisée ici et ne doit pas être
 * réécrite module par module (CLAUDE.md §3, §9).
 */

/** Représentation minimale du périmètre d'un utilisateur, dérivée de sa session. */
export interface PorteeUtilisateur {
  utilisateurId: string;
  roleId: RoleId;
  etablissementId: string | null;
  cafopId: string | null;
  apfcId: string | null;
  regionId: string | null;
  /** Pays de rattachement (rôles à périmètre « pays » : superviseur national, représentant-pays). */
  pays: string | null;
}

/**
 * Rôles à périmètre « pays » ayant accès aux structures de formation (CAFOP/APFC) de leur pays.
 * Le superviseur national est volontairement EXCLU : son périmètre se limite aux établissements
 * (décision produit). Seul le représentant-pays administre aussi les CAFOP et APFC de son pays.
 */
function accedeStructuresFormationDuPays(roleId: RoleId): boolean {
  return roleId === "representant_pays";
}

/** Filtre qui ne correspond à AUCUNE ligne (périmètre incompatible avec l'entité demandée). */
const AUCUN_RESULTAT = { id: { in: [] as string[] } } as const;
/** Même sentinelle, typée pour Utilisateur (refus par défaut, jamais « tout »). */
const AUCUN_UTILISATEUR: Prisma.UtilisateurWhereInput = { id: { in: [] as string[] } };

export function estGlobal(roleId: RoleId): boolean {
  return ROLES[roleId].portee === "global";
}

export function typePortee(roleId: RoleId): TypePortee {
  return ROLES[roleId].portee;
}

/**
 * Filtre des ÉTABLISSEMENTS visibles selon le périmètre.
 * - admin (global) : tous.
 * - région (drena, inspecteur) : ceux de la région.
 * - établissement (chef_etablissement, enseignant, educateur, etablissements_admin) : le sien.
 * - autres périmètres (cafop, apfc, antenne, personnel) : aucun établissement par défaut.
 */
export function filtreEtablissements(p: PorteeUtilisateur): Prisma.EtablissementWhereInput {
  switch (typePortee(p.roleId)) {
    case "global":
      return {};
    case "pays":
      return p.pays ? { pays: p.pays } : AUCUN_RESULTAT;
    case "region":
      return p.regionId ? { regionId: p.regionId } : AUCUN_RESULTAT;
    case "etablissement":
      return p.etablissementId ? { id: p.etablissementId } : AUCUN_RESULTAT;
    default:
      return AUCUN_RESULTAT;
  }
}

/**
 * Filtre des UTILISATEURS (comptes) visibles selon le périmètre — REFUSÉ PAR DÉFAUT.
 * - admin (global) : tous.
 * - établissement (chef_etablissement, etablissements_admin, enseignant, educateur…) : ceux
 *   rattachés à SON établissement uniquement.
 * - région (drena, inspecteur) : les comptes des établissements de sa région.
 * - cafop / apfc : les comptes rattachés à sa structure.
 * - tout autre cas (périmètre manquant, rôle personnel) : AUCUN compte.
 *
 * ⚠️ Ne JAMAIS retomber sur `{}` (= tout voir) : un périmètre inconnu doit tout masquer.
 */
export function filtreUtilisateurs(p: PorteeUtilisateur): Prisma.UtilisateurWhereInput {
  switch (typePortee(p.roleId)) {
    case "global":
      return {};
    case "pays":
      // Comptes du pays (coaching des représentants / collaborateurs).
      return p.pays ? { pays: p.pays } : AUCUN_UTILISATEUR;
    case "etablissement":
      return p.etablissementId ? { etablissementId: p.etablissementId } : AUCUN_UTILISATEUR;
    case "cafop":
      return p.cafopId ? { cafopId: p.cafopId } : AUCUN_UTILISATEUR;
    case "apfc":
      return p.apfcId ? { apfcId: p.apfcId } : AUCUN_UTILISATEUR;
    case "region":
      return p.regionId ? { etablissement: { regionId: p.regionId } } : AUCUN_UTILISATEUR;
    default:
      return AUCUN_UTILISATEUR;
  }
}

/**
 * Un utilisateur cible est-il dans le périmètre de l'appelant ? (pour autoriser une action
 * ou l'ouverture d'une fiche). REFUSÉ PAR DÉFAUT. Le cas régional nécessite la région de
 * l'établissement de la cible (à fournir), sinon on refuse.
 */
export function utilisateurDansPortee(
  p: PorteeUtilisateur,
  cible: { etablissementId: string | null; cafopId: string | null; apfcId: string | null; regionId?: string | null; pays?: string | null },
): boolean {
  switch (typePortee(p.roleId)) {
    case "global":
      return true;
    case "pays":
      return Boolean(p.pays) && cible.pays != null && cible.pays === p.pays;
    case "etablissement":
      return Boolean(p.etablissementId) && cible.etablissementId === p.etablissementId;
    case "cafop":
      return Boolean(p.cafopId) && cible.cafopId === p.cafopId;
    case "apfc":
      return Boolean(p.apfcId) && cible.apfcId === p.apfcId;
    case "region":
      return Boolean(p.regionId) && cible.regionId != null && cible.regionId === p.regionId;
    default:
      return false;
  }
}

/**
 * Rôle à périmètre « pays » : l'entité (établissement/CAFOP/APFC) de ce pays est-elle autorisée ?
 * Renvoie true pour les rôles GLOBAUX (admin, superviseur international) qui voient tout, et
 * applique l'égalité de pays pour les rôles à périmètre « pays ». Pour les autres rôles, renvoie
 * false (ce contrôle ne les concerne pas — ils passent par leurs propres vérifications).
 * `structuresFormation` = true pour un CAFOP/APFC (le superviseur national en est alors exclu).
 */
export function paysStructureAutorise(
  p: PorteeUtilisateur,
  paysStructure: string | null | undefined,
  structuresFormation = false,
): boolean {
  if (typePortee(p.roleId) === "global") return true;
  if (typePortee(p.roleId) !== "pays") return false;
  if (structuresFormation && !accedeStructuresFormationDuPays(p.roleId)) return false;
  return Boolean(p.pays) && paysStructure != null && paysStructure === p.pays;
}

// ── Autorisations d'accès à une fiche de STRUCTURE (pages de détail par identifiant) ──
// Centralisées ici (refus par défaut) : global → tout ; rattaché → sa structure ; pays → son pays.

/** Peut administrer la fiche d'un établissement donné (dont on connaît l'id et le pays). */
export function peutAdministrerEtablissement(
  p: PorteeUtilisateur,
  etablissementId: string,
  paysEtablissement: string | null | undefined,
): boolean {
  switch (typePortee(p.roleId)) {
    case "global":
      return true;
    case "pays":
      return Boolean(p.pays) && paysEtablissement != null && paysEtablissement === p.pays;
    case "etablissement":
      return p.etablissementId === etablissementId;
    default:
      return false;
  }
}

/** Peut administrer la fiche d'un CAFOP donné (le superviseur national en est exclu). */
export function peutAdministrerCafop(
  p: PorteeUtilisateur,
  cafopId: string,
  paysCafop: string | null | undefined,
): boolean {
  switch (typePortee(p.roleId)) {
    case "global":
      return true;
    case "pays":
      return accedeStructuresFormationDuPays(p.roleId) && Boolean(p.pays) && paysCafop != null && paysCafop === p.pays;
    case "cafop":
      return p.cafopId === cafopId;
    default:
      return false;
  }
}

/** Peut administrer la fiche d'une APFC donnée (le superviseur national en est exclu). */
export function peutAdministrerApfc(
  p: PorteeUtilisateur,
  apfcId: string,
  paysApfc: string | null | undefined,
): boolean {
  switch (typePortee(p.roleId)) {
    case "global":
      return true;
    case "pays":
      return accedeStructuresFormationDuPays(p.roleId) && Boolean(p.pays) && paysApfc != null && paysApfc === p.pays;
    case "apfc":
      return p.apfcId === apfcId;
    default:
      return false;
  }
}

/** Filtre des CAFOP visibles selon le périmètre. */
export function filtreCafops(p: PorteeUtilisateur): Prisma.CafopWhereInput {
  switch (typePortee(p.roleId)) {
    case "global":
      return {};
    case "pays":
      // Représentant-pays seulement (le superviseur national ne couvre pas les CAFOP).
      return accedeStructuresFormationDuPays(p.roleId) && p.pays ? { pays: p.pays } : AUCUN_RESULTAT;
    case "region":
      return p.regionId ? { regionId: p.regionId } : AUCUN_RESULTAT;
    case "cafop":
      return p.cafopId ? { id: p.cafopId } : AUCUN_RESULTAT;
    default:
      return AUCUN_RESULTAT;
  }
}

/** Filtre des APFC visibles selon le périmètre (les APFC portent leur pays via leur région). */
export function filtreApfcs(p: PorteeUtilisateur): Prisma.ApfcWhereInput {
  switch (typePortee(p.roleId)) {
    case "global":
      return {};
    case "pays":
      // Représentant-pays seulement ; l'APFC hérite du pays de sa région.
      return accedeStructuresFormationDuPays(p.roleId) && p.pays ? { region: { pays: p.pays } } : AUCUN_RESULTAT;
    case "region":
      return p.regionId ? { regionId: p.regionId } : AUCUN_RESULTAT;
    case "apfc":
      return p.apfcId ? { id: p.apfcId } : AUCUN_RESULTAT;
    default:
      return AUCUN_RESULTAT;
  }
}

/** Filtre des RÉGIONS visibles selon le périmètre. */
export function filtreRegions(p: PorteeUtilisateur): Prisma.RegionWhereInput {
  if (estGlobal(p.roleId)) return {};
  if (p.regionId) return { id: p.regionId };
  // Un rôle rattaché à un établissement/structure ne voit que la région de celui-ci :
  // ce raffinement (jointure) sera ajouté en Phase 2 quand les rattachements seront densifiés.
  return AUCUN_RESULTAT;
}

/**
 * Vérifie qu'un identifiant d'établissement donné est DANS le périmètre.
 * Utilisé pour autoriser/refuser une action ciblée (et non une simple liste).
 * Le contrôle régional réel (établissement appartenant à la région) nécessite une
 * vérification en base ; ici on traite les cas déterminables sans requête.
 */
export function etablissementDansPortee(
  p: PorteeUtilisateur,
  etablissementId: string,
): boolean | "verifier_en_base" {
  switch (typePortee(p.roleId)) {
    case "global":
      return true;
    case "etablissement":
      return p.etablissementId === etablissementId;
    case "region":
      return "verifier_en_base"; // dépend de la région de l'établissement
    case "pays":
      return "verifier_en_base"; // dépend du pays de l'établissement
    default:
      return false;
  }
}
