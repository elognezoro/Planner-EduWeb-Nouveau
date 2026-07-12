/**
 * Règles d'HABILITATION : qui peut attribuer un rôle à un utilisateur, et lesquels.
 * Centralisé ici (CLAUDE.md §3) et invoqué par l'action serveur ET l'UI (dropdown).
 *
 * Deux garde-fous, en plus du contrôle de PÉRIMÈTRE (utilisateurDansPortee, scope.ts) :
 *  1. seul un rôle « habilitateur » peut attribuer des rôles ;
 *  2. il ne peut attribuer qu'un rôle STRICTEMENT INFÉRIEUR à son propre rang
 *     — l'admin système (portée globale) fait exception et peut tout attribuer.
 */
import { ROLES, ROLE_IDS, type RoleId } from "./roles";

/**
 * Rôles autorisés à attribuer des rôles à d'autres utilisateurs.
 * L'admin système est global ; les autres sont bornés à leur périmètre (établissement,
 * CAFOP, APFC, ou PAYS pour les niveaux « Super Admin » / Représentant-Pays).
 */
export const ROLES_HABILITATEURS: readonly RoleId[] = [
  "admin",
  "etablissements_admin",
  "cafop_admin",
  "apfc_admin",
  "super_admin_cafop",
  "super_admin_etablissements",
  "super_admin_apfc",
  "representant_pays",
];

export function estHabilitateur(role: RoleId): boolean {
  return ROLES_HABILITATEURS.includes(role);
}

/**
 * Règle de HIÉRARCHIE pure : `roleCible` est-il de rang STRICTEMENT inférieur à `roleAdmin` ?
 * L'admin système (portée globale) fait exception et domine tout. À utiliser dans TOUTE action
 * qui attribue un rôle (page Habilitations ET module Comptes) pour interdire l'attribution d'un
 * rôle égal ou supérieur — indépendamment de la porte « qui peut habiliter » propre à chaque écran.
 */
export function estRoleInferieur(roleAdmin: RoleId, roleCible: RoleId): boolean {
  if (roleAdmin === "admin") return true;
  return ROLES[roleCible].rang < ROLES[roleAdmin].rang;
}

/**
 * Un habilitateur peut-il attribuer `roleCible` ? Il faut être habilitateur (page Habilitations)
 * ET que le rôle attribué soit strictement inférieur au sien.
 */
export function peutAttribuerRole(roleAdmin: RoleId, roleCible: RoleId): boolean {
  return estHabilitateur(roleAdmin) && estRoleInferieur(roleAdmin, roleCible);
}

/** Liste des rôles qu'un habilitateur donné peut attribuer (pour peupler le menu déroulant). */
export function rolesAttribuables(roleAdmin: RoleId): RoleId[] {
  return ROLE_IDS.filter((r) => peutAttribuerRole(roleAdmin, r));
}

/**
 * Un habilitateur peut-il MODIFIER le rôle d'un utilisateur dont le rôle actuel est `roleActuel` ?
 * (Empêche un habilitateur non-système de toucher un compte de rang égal ou supérieur.)
 */
export function peutModifierRoleActuel(roleAdmin: RoleId, roleActuel: RoleId): boolean {
  return estHabilitateur(roleAdmin) && estRoleInferieur(roleAdmin, roleActuel);
}
