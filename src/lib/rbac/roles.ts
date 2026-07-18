/**
 * Définition statique des rôles de la plateforme (cahier des charges §4.1 — 13 rôles
 * d'origine, étendus par l'ACE et l'Inspecteur d'Orientation).
 *
 * ⚠️ Les identifiants techniques (snake_case) sont contractuels : ils servent tels quels
 * en base de données et dans tout le code (CLAUDE.md §8). Ne pas les renommer.
 *
 * Cette couche est la SOURCE UNIQUE de vérité des rôles. Aucun module ne doit redéfinir
 * cette liste localement — toujours l'importer d'ici (CLAUDE.md §3 : RBAC centralisé).
 */

export const ROLE_IDS = [
  "admin",
  "senec",
  "sedec",
  "etablissements_admin",
  "cafop_admin",
  "apfc_admin",
  "drena",
  "inspecteur",
  "inspecteur_orientation",
  "conseiller_pedagogique",
  "chef_antenne",
  "chef_etablissement",
  "adjoint_chef_etablissement",
  "enseignant",
  "educateur",
  "parent",
  "eleve",
  "superviseur_international",
  "super_admin_cafop",
  "super_admin_etablissements",
  "super_admin_apfc",
  "representant_pays",
  "adc",
  "delc",
  "maitre_application",
  "econome",
  "directeur_etudes",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

/** Nature du périmètre attaché à un rôle (cahier §4.3). */
export type TypePortee =
  | "global" // admin, superviseur international : aucune restriction (tous pays)
  | "etablissement" // rattaché à un établissement
  | "cafop" // rattaché à un CAFOP
  | "apfc" // rattaché à une APFC
  | "antenne" // rattaché à une antenne pédagogique
  | "region" // rattaché à une région / zone
  | "pays" // rattaché à un pays (superviseur national, représentant-pays, SENEC)
  | "diocese" // rattaché à un diocèse (SEDEC — enseignement catholique diocésain)
  | "personnel"; // périmètre = un ensemble de personnes (parent, élève)

/** Regroupement par public cible (cahier §1.5) — sert au classement dans l'UI. */
export type GroupeRole = "pilotage" | "formation" | "etablissement" | "famille";

export interface DefinitionRole {
  id: RoleId;
  libelle: string;
  description: string;
  portee: TypePortee;
  groupe: GroupeRole;
  /** Niveau de privilège indicatif (plus élevé = plus de pouvoir). Sert au tri d'affichage. */
  rang: number;
}

export const ROLES: Record<RoleId, DefinitionRole> = {
  admin: {
    id: "admin",
    libelle: "Administrateur Système",
    description:
      "Accès complet : comptes, rôles, établissements, structures de formation et configuration globale.",
    portee: "global",
    groupe: "pilotage",
    rang: 100,
  },
  senec: {
    id: "senec",
    libelle: "SENEC — Enseignement Catholique National",
    description:
      "Secrétariat National de l'Enseignement Catholique : consultation en LECTURE SEULE de tous les établissements catholiques (réseau SEDEC) de son pays.",
    portee: "pays",
    groupe: "pilotage",
    rang: 84,
  },
  sedec: {
    id: "sedec",
    libelle: "SEDEC — Enseignement Catholique Diocésain",
    description:
      "Secrétariat Diocésain de l'Enseignement Catholique : consultation en LECTURE SEULE des établissements catholiques (réseau SEDEC) de son diocèse.",
    portee: "diocese",
    groupe: "pilotage",
    rang: 74,
  },
  etablissements_admin: {
    id: "etablissements_admin",
    libelle: "Admin Établissements",
    description: "Gestion administrative des établissements scolaires rattachés.",
    portee: "etablissement",
    groupe: "pilotage",
    rang: 80,
  },
  cafop_admin: {
    id: "cafop_admin",
    libelle: "Admin CAFOP",
    description:
      "Gestion du Centre d'Animation et de Formation Pédagogique : promotions, groupes-classes, cohortes.",
    portee: "cafop",
    groupe: "formation",
    rang: 75,
  },
  apfc_admin: {
    id: "apfc_admin",
    libelle: "Admin APFC",
    description: "Gestion de l'Antenne Pédagogique de Formation Continue.",
    portee: "apfc",
    groupe: "formation",
    rang: 75,
  },
  drena: {
    id: "drena",
    libelle: "DRENA / DRENAET",
    description:
      "Direction Régionale de l'Éducation Nationale : pilotage régional et supervision des structures de la région.",
    portee: "region",
    groupe: "pilotage",
    rang: 70,
  },
  inspecteur: {
    id: "inspecteur",
    libelle: "Inspecteur",
    description: "Inspection pédagogique, évaluation des enseignants, rapports d'inspection.",
    portee: "region",
    groupe: "pilotage",
    rang: 65,
  },
  conseiller_pedagogique: {
    id: "conseiller_pedagogique",
    libelle: "Conseiller Pédagogique",
    description: "Accompagnement pédagogique et suivi de la mise en œuvre des recommandations.",
    portee: "antenne",
    groupe: "formation",
    rang: 55,
  },
  chef_antenne: {
    id: "chef_antenne",
    libelle: "Chef d'antenne",
    description: "Responsable d'une antenne de formation pédagogique (rattachée APFC).",
    portee: "antenne",
    groupe: "formation",
    rang: 55,
  },
  chef_etablissement: {
    id: "chef_etablissement",
    libelle: "Chef d'établissement",
    description:
      "Direction d'un établissement : emplois du temps, enseignants, vie scolaire, rapport d'établissement.",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 60,
  },
  econome: {
    id: "econome",
    libelle: "Économe",
    description:
      "Gestion financière de l'établissement : frais et échéanciers, encaissements de scolarité avec reçus, dépenses et recettes, économat (stocks et ventes).",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 57,
  },
  directeur_etudes: {
    id: "directeur_etudes",
    libelle: "Directeur des Études",
    description:
      "Responsable pédagogique de l'établissement : emplois du temps, cahiers de texte, notes & bulletins et suivi des enseignants.",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 56,
  },
  adjoint_chef_etablissement: {
    id: "adjoint_chef_etablissement",
    libelle: "Adjoint au Chef d'Établissement (ACE)",
    description:
      "Seconde le chef d'établissement : configuration de l'établissement, consultation et visa des cahiers de textes, bulletins de notes, visites de classe pour évaluer l'exercice professionnel des enseignants.",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 58,
  },
  inspecteur_orientation: {
    id: "inspecteur_orientation",
    libelle: "Inspecteur d'Orientation",
    description:
      "Conseille, encadre et oriente les élèves dans leurs choix de projets professionnels : bulletins, livret scolaire et entretiens d'orientation.",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 50,
  },
  enseignant: {
    id: "enseignant",
    libelle: "Enseignant",
    description: "Saisie des notes, cahier de textes, absences ; consultation de l'emploi du temps.",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 40,
  },
  educateur: {
    id: "educateur",
    libelle: "Éducateur",
    description: "Gestion de la vie scolaire : suivi des absences, de la discipline.",
    portee: "etablissement",
    groupe: "etablissement",
    rang: 40,
  },
  parent: {
    id: "parent",
    libelle: "Parent d'élève",
    description: "Consultation des notes, absences et emploi du temps de ses enfants.",
    portee: "personnel",
    groupe: "famille",
    rang: 20,
  },
  eleve: {
    id: "eleve",
    libelle: "Élève",
    description:
      "Consultation de son emploi du temps, ses notes, son cahier de textes. Rôle par défaut à l'inscription.",
    portee: "personnel",
    groupe: "famille",
    rang: 10,
  },
  superviseur_international: {
    id: "superviseur_international",
    libelle: "Superviseur International",
    description:
      "Accès à tous les Établissements, CAFOP et APFC de tous les pays, pour leur administration et le coaching des représentants-pays.",
    portee: "global",
    groupe: "pilotage",
    rang: 90,
  },
  super_admin_cafop: {
    id: "super_admin_cafop",
    libelle: "Super Admin CAFOP",
    description:
      "Accès à tous les CAFOP d'un pays donné, avec le droit de les éditer et de les configurer.",
    portee: "pays",
    groupe: "pilotage",
    rang: 84,
  },
  super_admin_etablissements: {
    id: "super_admin_etablissements",
    libelle: "Super Admin Établissements",
    description:
      "Accès à tous les établissements d'un pays donné, avec le droit de les éditer et de les configurer.",
    portee: "pays",
    groupe: "pilotage",
    rang: 84,
  },
  super_admin_apfc: {
    id: "super_admin_apfc",
    libelle: "Super Admin APFC",
    description:
      "Accès à toutes les APFC d'un pays donné, avec le droit de les éditer et de les configurer.",
    portee: "pays",
    groupe: "pilotage",
    rang: 84,
  },
  representant_pays: {
    id: "representant_pays",
    libelle: "Représentant-Pays",
    description:
      "Accès à tous les Établissements, CAFOP et APFC de son pays, pour leur administration et le coaching de ses collaborateurs.",
    portee: "pays",
    groupe: "pilotage",
    rang: 82,
  },
  delc: {
    id: "delc",
    libelle: "Directeur Central (DELC)",
    description:
      "Directeur Central en charge des établissements scolaires : consultation en LECTURE SEULE de toutes les pages des CAFOP de son pays.",
    portee: "pays",
    groupe: "pilotage",
    rang: 83,
  },
  adc: {
    id: "adc",
    libelle: "Adjoint au Directeur de CAFOP (ADC)",
    description:
      "Seconde le directeur du CAFOP : consultation en LECTURE SEULE du cahier de texte, du registre d'appel et des notes & bulletins de son centre.",
    portee: "cafop",
    groupe: "formation",
    rang: 72,
  },
  maitre_application: {
    id: "maitre_application",
    libelle: "Maître d'application",
    description:
      "Encadre les élèves-maîtres en stage pratique : fiche de présence et régularité, dialogue avec l'administration du CAFOP et grille d'évaluation — uniquement pour les stagiaires qui lui sont attribués.",
    portee: "cafop",
    groupe: "formation",
    rang: 45,
  },
};

/** Liste ordonnée (par rang décroissant) des définitions de rôle. */
export const ROLES_ORDONNES: DefinitionRole[] = Object.values(ROLES).sort(
  (a, b) => b.rang - a.rang,
);

export function estRoleValide(valeur: string): valeur is RoleId {
  return (ROLE_IDS as readonly string[]).includes(valeur);
}

export function getRole(id: RoleId): DefinitionRole {
  return ROLES[id];
}

export function libelleRole(id: RoleId): string {
  return ROLES[id]?.libelle ?? id;
}

/** Le rôle technique par défaut attribué à toute nouvelle inscription (cahier §6.2). */
export const ROLE_PAR_DEFAUT: RoleId = "eleve";

/** Rôles « personnels » dont le périmètre n'est pas une entité administrative. */
export function estRolePersonnel(id: RoleId): boolean {
  return ROLES[id].portee === "personnel";
}

/**
 * Rôles de DIRECTION d'un établissement : le chef et son adjoint (ACE). L'ACE seconde
 * le chef — configuration de l'établissement, cahiers de textes (consultation et visa),
 * bulletins, visites de classe — avec le même périmètre (SON établissement).
 */
export function estDirectionEtablissement(id: RoleId): boolean {
  return id === "chef_etablissement" || id === "adjoint_chef_etablissement";
}
