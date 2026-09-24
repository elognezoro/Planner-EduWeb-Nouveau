import type { ItemNav, RoleId, SectionNav } from "@/lib/rbac";

/**
 * ONGLETS DE LA BARRE DU BAS (téléphone).
 *
 * Principe : on ne fabrique JAMAIS les onglets à partir du catalogue de navigation, mais par
 * INTERSECTION entre une liste de souhaits par rôle et les items réellement accordés à
 * l'utilisateur (`sections`, déjà filtrées par la matrice des droits, surcharges comprises).
 * Un item retiré par l'administrateur disparaît donc automatiquement de la barre.
 *
 * Les souhaits reflètent l'usage réel au téléphone : ce qu'un enseignant ouvre en classe
 * (appel, cahier de texte), ce qu'un parent consulte (ses enfants, l'emploi du temps).
 * Les entrées non retenues restent accessibles par l'onglet « Plus ».
 */
const SOUHAITS: Partial<Record<RoleId, string[]>> = {
  enseignant: ["tableau-de-bord", "mes-classes", "registre-appel", "cahier-texte", "emplois-du-temps", "notes-bulletins"],
  educateur: ["tableau-de-bord", "registre-appel", "absences", "emplois-du-temps", "communication"],
  parent: ["tableau-de-bord", "mes-enfants", "emplois-du-temps", "livret-scolaire", "communication"],
  eleve: ["tableau-de-bord", "ma-classe", "emplois-du-temps", "cahier-texte", "livret-scolaire"],
  chef_etablissement: ["tableau-de-bord", "emplois-du-temps", "registre-appel", "notes-bulletins", "finances"],
  adjoint_chef_etablissement: ["tableau-de-bord", "emplois-du-temps", "registre-appel", "absences", "notes-bulletins"],
  // NB : les alias de rôle (directeur_etudes → chef_etablissement) sont résolus en amont par
  // roleEffectifRBAC ; cette table est donc indexée par rôle EFFECTIF.
  etablissements_admin: ["tableau-de-bord", "etablissements", "emplois-du-temps", "habilitations"],
  super_admin_etablissements: ["tableau-de-bord", "etablissements", "stat-etablissement", "rapport-etablissement"],
  admin: ["tableau-de-bord", "comptes", "approbations", "etablissements"],
  inspecteur: ["tableau-de-bord", "inspection", "rapports-inspection", "grille-evaluation"],
  conseiller_pedagogique: ["tableau-de-bord", "inspection", "rapports-inspection", "formations"],
  inspecteur_orientation: ["tableau-de-bord", "inspection", "rapports-inspection", "communication"],
  // Métiers des finances et de l'économat : le module Finances d'abord.
  econome: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  gestionnaire_financier: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  comptable: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  caissier: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  magasinier: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  auditeur: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  commissaire_comptes: ["tableau-de-bord", "finances", "academie-premium", "formations"],
  // Formation initiale des maîtres (CAFOP).
  cafop_admin: ["tableau-de-bord", "cafop", "plan-formation-cafop", "stages-maitre"],
  super_admin_cafop: ["tableau-de-bord", "cafop", "plan-formation-cafop", "stages-maitre"],
  adc: ["tableau-de-bord", "cafop", "plan-formation-cafop", "formations"],
  delc: ["tableau-de-bord", "cafop", "plan-formation-cafop", "formations"],
  maitre_application: ["tableau-de-bord", "stages-maitre", "formations", "notifications"],
  // Antennes et formation continue (APFC).
  apfc_admin: ["tableau-de-bord", "apfc-gestion", "apfc-formation-continue", "rapports-antennes"],
  super_admin_apfc: ["tableau-de-bord", "apfc-gestion", "apfc-formation-continue", "rapports-antennes"],
  chef_antenne: ["tableau-de-bord", "apfc-formation-continue", "rapports-antennes", "formations"],
  // Pilotage territorial et national : le parc d'établissements et les statistiques.
  drena: ["tableau-de-bord", "etablissements", "stat-etablissement", "rapport-etablissement"],
  representant_pays: ["tableau-de-bord", "etablissements", "stat-etablissement", "rapport-etablissement"],
  superviseur_international: ["tableau-de-bord", "etablissements", "stat-etablissement", "rapport-etablissement"],
  senec: ["tableau-de-bord", "etablissements", "stat-etablissement", "rapport-etablissement"],
  sedec: ["tableau-de-bord", "etablissements", "stat-etablissement", "rapport-etablissement"],
};

/** Souhaits par défaut, pour tout rôle non listé : l'essentiel commun à tous. */
const SOUHAITS_DEFAUT = ["tableau-de-bord", "formations", "parcours", "guides"];

/**
 * Libellés COURTS pour la barre du bas : « Tableau de bord » ne tient pas sous une icône de
 * 72 px de large et serait coupé (« Tableau d… »). Le menu complet, lui, garde les libellés
 * officiels — c'est la barre, et elle seule, qui abrège.
 */
const LIBELLES_COURTS: Record<string, string> = {
  "tableau-de-bord": "Accueil",
  "registre-appel": "Appel",
  "cahier-texte": "Cahier",
  "emplois-du-temps": "Horaires",
  "notes-bulletins": "Notes",
  "livret-scolaire": "Livret",
  communication: "Messages",
  notifications: "Alertes",
  absences: "Absences",
  "mes-enfants": "Enfants",
  "ma-classe": "Ma classe",
  "mes-classes": "Classes",
  etablissements: "Écoles",
  comptes: "Comptes",
  approbations: "Demandes",
  inspection: "Visites",
  "rapports-inspection": "Rapports",
  "grille-evaluation": "Grille",
  formations: "Formations",
  guides: "Guides",
  finances: "Finances",
  cafop: "CAFOP",
  "plan-formation-cafop": "Plan",
  "stages-maitre": "Stagiaires",
  "apfc-gestion": "APFC",
  "apfc-formation-continue": "Continue",
  "rapports-antennes": "Antennes",
  "supervision-apfc": "Supervision",
  "stat-etablissement": "Statistiques",
  "rapport-etablissement": "Rapport",
  "rapports-activite": "Activité",
  "suivi-apprenants": "Suivi",
  parcours: "Parcours",
  connectes: "Connectés",
  "niveaux-acces": "Accès",
  habilitations: "Droits",
  "journal-activite": "Journal",
  configuration: "Réglages",
  inscriptions: "Inscriptions",
  affectations: "Affectations",
  "liens-parents": "Parents",
  "rendez-vous": "Rendez-vous",
  transport: "Transport",
  "academie-premium": "Premium",
  "alertes-sms": "SMS",
  facturation: "Facturation",
};

/** Libellé affiché sous l'icône d'un onglet (abrégé si besoin). */
export function libelleOnglet(item: ItemNav): string {
  return LIBELLES_COURTS[item.id] ?? item.libelle;
}

/** Nombre d'onglets AVANT le bouton « Plus » (5 cases au total : au-delà, la barre se tasse). */
export const NB_ONGLETS = 4;

export function ongletsPour(role: RoleId, sections: SectionNav[], nb: number = NB_ONGLETS): ItemNav[] {
  const disponibles = new Map<string, ItemNav>();
  for (const section of sections) {
    for (const item of section.items) {
      // Un module « Bientôt » n'est pas navigable : il n'a rien à faire dans la barre.
      if (item.statut === "a_venir") continue;
      if (!disponibles.has(item.id)) disponibles.set(item.id, item);
    }
  }

  const retenus: ItemNav[] = [];
  const prendre = (id: string) => {
    const item = disponibles.get(id);
    if (item && !retenus.some((r) => r.id === item.id)) retenus.push(item);
  };

  for (const id of SOUHAITS[role] ?? SOUHAITS_DEFAUT) {
    if (retenus.length >= nb) break;
    prendre(id);
  }
  // Complément : les premiers items accordés, dans l'ordre du menu, si les souhaits ne suffisent pas.
  for (const item of disponibles.values()) {
    if (retenus.length >= nb) break;
    if (!retenus.some((r) => r.id === item.id)) retenus.push(item);
  }
  return retenus.slice(0, nb);
}
