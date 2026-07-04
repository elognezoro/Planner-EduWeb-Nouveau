import { ROLE_IDS, type RoleId } from "./roles";

/**
 * Mode Aperçu de rôle — filtrage par périmètre (cahier des charges §4.5, §4.6).
 *
 * Un administrateur peut visualiser l'interface telle qu'elle apparaît pour un autre rôle,
 * SANS changer de compte. La liste des rôles consultables N'EST PAS les 13 rôles : elle est
 * restreinte au périmètre de l'administrateur connecté. Lecture seule par défaut.
 */

/** Rôles autorisés à utiliser le mode Aperçu. */
export const ROLES_AVEC_APERCU: RoleId[] = [
  "admin",
  "etablissements_admin",
  "cafop_admin",
  "apfc_admin",
];

export function peutUtiliserApercu(roleId: RoleId): boolean {
  return ROLES_AVEC_APERCU.includes(roleId);
}

/**
 * Rôles consultables en aperçu par l'administrateur connecté (cahier §4.6).
 * La liste exacte pour les admins spécialisés sera affinée en Phase 5, une fois la
 * hiérarchie CAFOP/APFC stabilisée — d'où le périmètre volontairement prudent ici.
 */
export function rolesConsultablesEnApercu(roleId: RoleId): RoleId[] {
  switch (roleId) {
    case "admin":
      // Tous les rôles, sans restriction.
      return [...ROLE_IDS];
    case "etablissements_admin":
      return [
        "chef_etablissement",
        "adjoint_chef_etablissement",
        "inspecteur_orientation",
        "enseignant",
        "educateur",
        "parent",
        "eleve",
      ];
    case "cafop_admin":
      return ["chef_antenne", "conseiller_pedagogique"];
    case "apfc_admin":
      return ["chef_antenne", "conseiller_pedagogique"];
    default:
      return [];
  }
}
