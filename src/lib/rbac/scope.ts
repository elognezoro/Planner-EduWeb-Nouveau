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
  /** Pays de rattachement (rôles à périmètre « pays » : superviseur national, représentant-pays, SENEC). */
  pays: string | null;
  /** Diocèse de rattachement (rôle SEDEC — enseignement catholique diocésain). */
  diocese: string | null;
}

/**
 * Établissements « catholiques » = confessionnels du réseau SEDEC. Base des périmètres SENEC (pays)
 * et SEDEC (diocèse). Réutilisable comme fragment de filtre Prisma sur Etablissement.
 */
const FILTRE_CATHOLIQUE = { statut: "confessionnel" as const, reseauConfessionnel: "SEDEC" };

/**
 * Rôles à périmètre « pays » et nature des structures qu'ils administrent DANS LEUR PAYS :
 * Super Admin CAFOP → les CAFOP ; Super Admin Établissements → les établissements ;
 * Super Admin APFC → les APFC ; Représentant-pays → les trois.
 * (Le superviseur international est GLOBAL — tous pays, toutes structures — traité à part.)
 */
const ROLES_PAYS_ETABLISSEMENTS = new Set<RoleId>(["super_admin_etablissements", "representant_pays"]);
// « delc » (Directeur Central) voit les CAFOP de son pays — mais en LECTURE SEULE : les écritures
// restent gardées par peutGererCafop / cafopAutorise (admin + cafop_admin uniquement).
const ROLES_PAYS_CAFOP = new Set<RoleId>(["super_admin_cafop", "representant_pays", "delc"]);
const ROLES_PAYS_APFC = new Set<RoleId>(["super_admin_apfc", "representant_pays"]);

/**
 * Rôles CAFOP en LECTURE SEULE : ils accèdent aux pages (voir) mais ne peuvent JAMAIS écrire.
 * L'interdiction d'écriture est garantie côté serveur par peutGererCafop / cafopAutorise (qui
 * n'autorisent qu'admin + cafop_admin) ; ce marqueur sert à MASQUER les contrôles d'édition.
 */
const ROLES_CAFOP_LECTURE_SEULE = new Set<RoleId>(["adc", "delc", "representant_pays", "superviseur_international"]);
export function estLectureSeuleCafop(roleId: RoleId): boolean {
  return ROLES_CAFOP_LECTURE_SEULE.has(roleId);
}

/**
 * Rôles PUREMENT en LECTURE SEULE sur toute la plateforme (supervision, aucune écriture) :
 * ADC / DELC (CAFOP) et SENEC / SEDEC (enseignement catholique). Sert au bandeau permanent et au
 * masquage des contrôles d'édition. Côté serveur, l'absence de droit d'écriture est garantie par
 * les gardes de chaque module (ils ne sont ni admin, ni gestionnaire de la structure).
 */
const ROLES_LECTURE_SEULE = new Set<RoleId>(["adc", "delc", "senec", "sedec"]);
export function estLectureSeule(roleId: RoleId): boolean {
  return ROLES_LECTURE_SEULE.has(roleId);
}

/** Rôle « Super Admin » national correspondant à chaque type de structure. */
export type RoleSuperAdmin = "super_admin_etablissements" | "super_admin_cafop" | "super_admin_apfc";

/**
 * Écriture « nationale » d'un Super Admin (cahier §4.3) : autorise la MODIFICATION d'une
 * structure (établissement / CAFOP / APFC) dont le pays correspond à celui du Super Admin.
 * Strictement cloisonné au pays — jamais une structure d'un autre pays. Le mode aperçu
 * (lecture seule) ne passe jamais ce test ; le Représentant-pays n'est pas un Super Admin,
 * donc il reste en consultation.
 */
export function ecritureNationaleAutorisee(
  u: { roleReel: RoleId; apercuActif: boolean; portee: { pays: string | null } },
  roleSuperAdmin: RoleSuperAdmin,
  paysStructure: string | null | undefined,
): boolean {
  if (u.apercuActif) return false;
  return u.roleReel === roleSuperAdmin && Boolean(u.portee.pays) && paysStructure != null && paysStructure === u.portee.pays;
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
      // SENEC : tous les établissements CATHOLIQUES (réseau SEDEC) de son pays.
      if (p.roleId === "senec") return p.pays ? { pays: p.pays, ...FILTRE_CATHOLIQUE } : AUCUN_RESULTAT;
      return ROLES_PAYS_ETABLISSEMENTS.has(p.roleId) && p.pays ? { pays: p.pays } : AUCUN_RESULTAT;
    case "diocese":
      // SEDEC : établissements catholiques de son diocèse (dans son pays).
      return p.pays && p.diocese ? { pays: p.pays, diocese: p.diocese, ...FILTRE_CATHOLIQUE } : AUCUN_RESULTAT;
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
      // SENEC : comptes rattachés aux établissements catholiques (réseau SEDEC) du pays.
      if (p.roleId === "senec")
        return p.pays ? { etablissement: { pays: p.pays, ...FILTRE_CATHOLIQUE } } : AUCUN_UTILISATEUR;
      // Comptes du pays (coaching des représentants / collaborateurs).
      return p.pays ? { pays: p.pays } : AUCUN_UTILISATEUR;
    case "diocese":
      // SEDEC : comptes rattachés aux établissements catholiques de son diocèse.
      return p.pays && p.diocese
        ? { etablissement: { pays: p.pays, diocese: p.diocese, ...FILTRE_CATHOLIQUE } }
        : AUCUN_UTILISATEUR;
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
  cible: { etablissementId: string | null; cafopId: string | null; apfcId: string | null; regionId?: string | null; pays?: string | null; diocese?: string | null },
): boolean {
  switch (typePortee(p.roleId)) {
    case "global":
      return true;
    case "pays":
      return Boolean(p.pays) && cible.pays != null && cible.pays === p.pays;
    case "diocese":
      return Boolean(p.diocese) && cible.diocese != null && cible.diocese === p.diocese;
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
      return ROLES_PAYS_ETABLISSEMENTS.has(p.roleId) && Boolean(p.pays) && paysEtablissement != null && paysEtablissement === p.pays;
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
      return ROLES_PAYS_CAFOP.has(p.roleId) && Boolean(p.pays) && paysCafop != null && paysCafop === p.pays;
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
      return ROLES_PAYS_APFC.has(p.roleId) && Boolean(p.pays) && paysApfc != null && paysApfc === p.pays;
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
      // Super Admin CAFOP et représentant-pays uniquement.
      return ROLES_PAYS_CAFOP.has(p.roleId) && p.pays ? { pays: p.pays } : AUCUN_RESULTAT;
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
      // Super Admin APFC et représentant-pays uniquement ; l'APFC hérite du pays de sa région.
      return ROLES_PAYS_APFC.has(p.roleId) && p.pays ? { region: { pays: p.pays } } : AUCUN_RESULTAT;
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
