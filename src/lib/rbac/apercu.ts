import { ROLE_IDS, ROLES, type RoleId } from "./roles";

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
/** Rôles autorisés à INCARNER un utilisateur (« Voir comme », mode assistance). */
export const ROLES_ASSISTANCE: RoleId[] = [
  "admin",
  "super_admin_etablissements",
  "super_admin_cafop",
  "super_admin_apfc",
];

/** Comptes qu'on ne peut JAMAIS incarner, quel que soit l'opérateur (élévation de privilèges). */
const CIBLES_PROTEGEES = new Set<RoleId>(["admin", "superviseur_international"]);

/** Structure administrée par chaque Super Admin — borne la famille de cibles incarnables. */
const FAMILLE_SUPER_ADMIN: Partial<Record<RoleId, "etablissement" | "cafop" | "apfc">> = {
  super_admin_etablissements: "etablissement",
  super_admin_cafop: "cafop",
  super_admin_apfc: "apfc",
};

/**
 * L'opérateur peut-il incarner cette cible (mode assistance) ? REFUS PAR DÉFAUT.
 *
 * Règles, dans l'ordre :
 * 1. jamais en aperçu (pas d'incarnation en chaîne), jamais soi-même ;
 * 2. cible protégée (admin, superviseur international) : refusée pour tous ;
 * 3. `admin` : toute autre cible ;
 * 4. Super Admin : cible de SON pays, de rang STRICTEMENT inférieur, et rattachée à la FAMILLE
 *    de structure qu'il administre. Cette dernière condition ferme l'ESCALADE TRANSITIVE — sans
 *    elle, un Super Admin CAFOP incarnerait un économe pour écrire dans la comptabilité d'un
 *    établissement, hors de son ressort.
 *
 * Fonction PURE (aucun accès base) : rejouable côté UI comme à chaque requête.
 */
export function peutIncarnerUtilisateur(
  operateur: {
    id: string;
    roleReel: RoleId;
    /**
     * ⚠️ Passer `enApercu` (aperçu de rôle OU assistance), JAMAIS `apercuActif` : ce dernier vaut
     * `false` en assistance et autoriserait l'enchaînement d'incarnations.
     */
    enApercu: boolean;
    portee: { pays: string | null };
  },
  cible: {
    id: string;
    role: RoleId;
    pays: string | null;
    etablissementId: string | null;
    cafopId: string | null;
    apfcId: string | null;
  },
): boolean {
  if (operateur.enApercu) return false;
  if (operateur.id === cible.id) return false;
  if (!ROLES_ASSISTANCE.includes(operateur.roleReel)) return false;
  if (CIBLES_PROTEGEES.has(cible.role)) return false;
  if (operateur.roleReel === "admin") return true;

  // ── Super Admin : cloisonnement pays + hiérarchie + famille de structure ──
  const pays = operateur.portee.pays?.trim().toLowerCase();
  if (!pays || cible.pays?.trim().toLowerCase() !== pays) return false;
  if (ROLES[cible.role].rang >= ROLES[operateur.roleReel].rang) return false;
  const famille = FAMILLE_SUPER_ADMIN[operateur.roleReel];
  if (famille === "etablissement") return cible.etablissementId !== null;
  if (famille === "cafop") return cible.cafopId !== null;
  if (famille === "apfc") return cible.apfcId !== null;
  return false;
}

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
        // Famille FINANCE (04-Profils) — rôles à portée établissement.
        "econome",
        "gestionnaire_financier",
        "comptable",
        "caissier",
        "magasinier",
        "auditeur",
        "commissaire_comptes",
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
