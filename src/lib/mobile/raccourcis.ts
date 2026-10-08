import type { ItemNav, RoleId, SectionNav } from "@/lib/rbac";

/**
 * RACCOURCIS DE L'ACCUEIL MOBILE — les outils qu'un rôle ouvre le plus, en tête de son
 * tableau de bord sur téléphone (une carte principale, puis une grille ou une liste).
 *
 * Même principe que la barre d'onglets (lib/mobile/onglets.ts) : une liste de SOUHAITS par rôle,
 * croisée avec les items RÉELLEMENT accordés (`sections`, déjà filtrées par la matrice des droits,
 * surcharges de l'administrateur comprises). Un module retiré disparaît donc de l'accueil.
 *
 * Les liens directs vers la fiche de l'établissement (classes, enseignants, matières, paramètres,
 * génération de l'emploi du temps) ne sont proposés que si la page appelante les a AUTORISÉS
 * (`etabGere` : rôle de gestion ET même règle de périmètre que les pages visées) ET si le module
 * « Établissements », qui gouverne ces pages, est accordé. Le contrôle d'accès réel reste celui
 * de chaque page, côté serveur.
 */

export interface Raccourci {
  id: string;
  libelle: string;
  sousTitre: string;
  /** Nom d'une icône lucide-react. */
  icone: string;
  href: string;
  /** Pastille de compteur (ex. demandes à traiter). */
  badge?: number;
}

/** « equipe » : carte principale + grille (personnel) ; « famille » : bannière + liste (parents, élèves). */
export type Disposition = "equipe" | "famille";

export interface DonneesAccueilMobile {
  disposition: Disposition;
  principal: Raccourci | null;
  autres: Raccourci[];
}

interface ConfigAccueil {
  disposition: Disposition;
  /** Dans l'ordre d'affichage ; le premier retenu devient la carte principale. « a|b » = la première alternative accordée. */
  souhaits: string[];
}

/** Rôles qui gèrent LEUR établissement depuis sa fiche (pages /systeme/etablissements/[id]/…). */
export const ROLES_GESTION_ETABLISSEMENT: ReadonlySet<RoleId> = new Set<RoleId>([
  "chef_etablissement",
  "adjoint_chef_etablissement",
  "etablissements_admin",
]);

/** Liens directs vers la fiche de l'établissement (gouvernés par le module « etablissements »). */
const LIENS_FICHE = ["etab-emploi-du-temps", "etab-classes", "etab-enseignants", "etab-matieres", "etab-parametres"] as const;
/** Un lien direct et l'item qu'il remplace ne figurent jamais ensemble. */
const EQUIVALENTS: Record<string, string> = {
  "etab-emploi-du-temps": "emplois-du-temps",
  "etab-classes": "mes-classes",
  "etab-parametres": "etablissements",
};

/** Libellé de tuile et sous-titre par identifiant d'item (repli : libellé et description du menu). */
const TEXTES: Record<string, { libelle: string; sousTitre: string; icone?: string }> = {
  "etab-emploi-du-temps": { libelle: "Emploi du temps", sousTitre: "Consulter et gérer les plannings", icone: "CalendarDays" },
  "etab-classes": { libelle: "Classes", sousTitre: "Voir les effectifs", icone: "UsersRound" },
  "etab-enseignants": { libelle: "Enseignants", sousTitre: "Gérer l'équipe", icone: "Presentation" },
  "etab-matieres": { libelle: "Matières", sousTitre: "Volumes horaires", icone: "BookOpen" },
  "etab-parametres": { libelle: "Paramètres", sousTitre: "Établissement et année", icone: "Settings" },
  "emplois-du-temps": { libelle: "Emploi du temps", sousTitre: "Consulter les plannings" },
  "mes-classes": { libelle: "Mes classes", sousTitre: "Élèves et effectifs" },
  "ma-classe": { libelle: "Ma classe", sousTitre: "Camarades et professeurs" },
  "mes-enfants": { libelle: "Mes enfants", sousTitre: "Suivre leur scolarité" },
  "registre-appel": { libelle: "Appel", sousTitre: "Présences du jour" },
  "cahier-texte": { libelle: "Cahier de texte", sousTitre: "Séances et devoirs" },
  "notes-bulletins": { libelle: "Notes", sousTitre: "Suivre les résultats" },
  "livret-scolaire": { libelle: "Résultats", sousTitre: "Suivre les notes" },
  communication: { libelle: "Messages", sousTitre: "Messagerie interne" },
  notifications: { libelle: "Notifications", sousTitre: "Restez informé" },
  absences: { libelle: "Absences", sousTitre: "Autorisations d'absence" },
  "rendez-vous": { libelle: "Rendez-vous", sousTitre: "Planifier les rencontres" },
  transport: { libelle: "Transport", sousTitre: "Suivre le car scolaire" },
  finances: { libelle: "Finances", sousTitre: "Frais et paiements" },
  "academie-premium": { libelle: "Académie Premium", sousTitre: "Ressources avancées" },
  inspection: { libelle: "Visites", sousTitre: "Planifier et conduire" },
  "rapports-inspection": { libelle: "Rapports", sousTitre: "Rapports d'inspection" },
  "grille-evaluation": { libelle: "Grille", sousTitre: "Critères d'évaluation" },
  "rapports-disciplinaires": { libelle: "Rapports disciplinaires", sousTitre: "Suivi pédagogique" },
  // « Écoles » : comme l'onglet du bas, et « Établissements » ne tient pas dans une tuile à 360 px.
  etablissements: { libelle: "Écoles", sousTitre: "Parc des établissements" },
  "etablissements-configures": { libelle: "Configurés", sousTitre: "Établissements prêts" },
  "etablissements-en-configuration": { libelle: "En configuration", sousTitre: "Suivi du paramétrage" },
  "stat-etablissement": { libelle: "Statistiques", sousTitre: "Indicateurs clés" },
  "stat-par-classe": { libelle: "Statistiques", sousTitre: "Résultats par classe" },
  "stat-regionales": { libelle: "Régions", sousTitre: "Statistiques régionales" },
  "stat-analytics": { libelle: "Analytique", sousTitre: "Tendances et évolutions" },
  "stat-suivi-recommandations": { libelle: "Recommandations", sousTitre: "Suivi des visites" },
  "rapport-etablissement": { libelle: "Bilans", sousTitre: "Rapports d'établissement" },
  "rapports-activite": { libelle: "Activité", sousTitre: "Rapports d'activité" },
  "rapports-antennes-pedagogiques": { libelle: "Antennes pédagogiques", sousTitre: "Rapports d'antennes" },
  "alertes-sms": { libelle: "Alertes SMS", sousTitre: "Informer les familles" },
  comptes: { libelle: "Comptes", sousTitre: "Utilisateurs" },
  approbations: { libelle: "Approbations", sousTitre: "Demandes de rôle" },
  habilitations: { libelle: "Habilitations", sousTitre: "Rôles et droits" },
  "journal-activite": { libelle: "Journal", sousTitre: "Activité de la plateforme" },
  connectes: { libelle: "Connectés", sousTitre: "Présence en ligne" },
  configuration: { libelle: "Configuration", sousTitre: "Réglages généraux" },
  cafop: { libelle: "CAFOP", sousTitre: "Gestion des centres" },
  "plan-formation-cafop": { libelle: "Plan de formation", sousTitre: "Modules et calendrier" },
  "stages-maitre": { libelle: "Stagiaires", sousTitre: "Suivi des stages" },
  "suivi-apprenants": { libelle: "Apprenants", sousTitre: "Suivi des parcours" },
  "apfc-gestion": { libelle: "APFC", sousTitre: "Gestion des antennes" },
  "apfc-formation-continue": { libelle: "Formation continue", sousTitre: "Sessions et participants" },
  "rapports-antennes": { libelle: "Rapports d'antennes", sousTitre: "Suivi des antennes" },
  "supervision-apfc": { libelle: "Supervision", sousTitre: "Visites des antennes" },
  formations: { libelle: "Formations", sousTitre: "Se former en ligne" },
  guides: { libelle: "Guides", sousTitre: "Aide pas à pas" },
  parcours: { libelle: "Parcours", sousTitre: "Parcours de formation" },
  "mon-profil": { libelle: "Mon profil", sousTitre: "Coordonnées et sécurité" },
};

/** Sous-titres propres à un rôle (ce que l'outil représente POUR LUI). */
const SOUS_TITRES_ROLE: Partial<Record<RoleId, Record<string, string>>> = {
  enseignant: { "emplois-du-temps": "Vos cours de la semaine", "notes-bulletins": "Saisir les notes" },
  eleve: { "emplois-du-temps": "Vos cours de la semaine", "cahier-texte": "Devoirs à faire", communication: "Échanger avec l'école" },
  parent: { communication: "Échanger avec l'école", "rendez-vous": "Rencontrer l'école" },
};

// Familles de rôles qui partagent une configuration (typées : une faute de frappe est refusée).
const ROLES_PILOTAGE: RoleId[] = ["super_admin_etablissements", "representant_pays", "superviseur_international", "senec", "sedec"];
const ROLES_FINANCES: RoleId[] = ["econome", "gestionnaire_financier", "comptable", "caissier", "magasinier", "auditeur", "commissaire_comptes"];
const ROLES_CAFOP: RoleId[] = ["cafop_admin", "super_admin_cafop", "adc", "delc"];
const ROLES_APFC: RoleId[] = ["apfc_admin", "super_admin_apfc"];

// NB : certains souhaits ne sont accordés que par une surcharge des Niveaux d'accès (ex. la
// messagerie pour le pilotage) : ils restent listés pour apparaître dès qu'elle est posée.
const PILOTAGE: ConfigAccueil = {
  disposition: "equipe",
  souhaits: [
    "etablissements", "stat-etablissement", "rapport-etablissement", "stat-regionales", "etablissements-configures",
    "etablissements-en-configuration", "cafop", "apfc-gestion", "habilitations", "connectes", "alertes-sms", "communication",
  ],
};
const FINANCES: ConfigAccueil = { disposition: "equipe", souhaits: ["finances", "academie-premium", "formations", "communication", "notifications", "guides"] };
const CAFOP: ConfigAccueil = {
  disposition: "equipe",
  souhaits: ["cafop", "plan-formation-cafop", "stages-maitre", "suivi-apprenants", "rapports-activite", "habilitations", "connectes", "formations", "guides"],
};
const APFC: ConfigAccueil = {
  disposition: "equipe",
  souhaits: ["apfc-gestion", "apfc-formation-continue", "rapports-antennes", "supervision-apfc", "rapports-activite", "formations", "guides"],
};

/** Souhaits par rôle EFFECTIF (les alias, ex. directeur_etudes → chef_etablissement, sont résolus en amont). */
const CONFIG: Partial<Record<RoleId, ConfigAccueil>> = {
  ...Object.fromEntries(ROLES_PILOTAGE.map((r) => [r, PILOTAGE])),
  ...Object.fromEntries(ROLES_FINANCES.map((r) => [r, FINANCES])),
  ...Object.fromEntries(ROLES_CAFOP.map((r) => [r, CAFOP])),
  ...Object.fromEntries(ROLES_APFC.map((r) => [r, APFC])),
  chef_etablissement: {
    disposition: "equipe",
    souhaits: ["etab-emploi-du-temps|emplois-du-temps", "etab-classes|mes-classes", "etab-enseignants", "etab-matieres", "etab-parametres", "registre-appel", "notes-bulletins"],
  },
  adjoint_chef_etablissement: {
    disposition: "equipe",
    souhaits: [
      "etab-emploi-du-temps|emplois-du-temps", "registre-appel", "absences", "notes-bulletins", "etab-classes|mes-classes",
      "etab-enseignants", "cahier-texte", "communication", "etab-matieres", "etab-parametres",
    ],
  },
  etablissements_admin: {
    disposition: "equipe",
    souhaits: ["etab-emploi-du-temps|emplois-du-temps", "etab-classes", "etab-enseignants", "etab-matieres", "etab-parametres", "comptes|habilitations", "communication"],
  },
  enseignant: {
    disposition: "equipe",
    souhaits: ["emplois-du-temps", "mes-classes", "registre-appel", "cahier-texte", "notes-bulletins", "communication", "absences"],
  },
  educateur: {
    disposition: "equipe",
    souhaits: ["registre-appel", "absences", "emplois-du-temps", "communication", "notifications", "cahier-texte", "rendez-vous"],
  },
  parent: {
    disposition: "famille",
    souhaits: ["emplois-du-temps", "livret-scolaire|notes-bulletins", "communication", "mes-enfants", "transport", "rendez-vous"],
  },
  eleve: {
    disposition: "famille",
    souhaits: ["emplois-du-temps", "cahier-texte", "livret-scolaire|notes-bulletins", "ma-classe", "communication"],
  },
  admin: {
    disposition: "equipe",
    souhaits: ["approbations", "comptes", "etablissements", "habilitations", "journal-activite", "connectes", "configuration"],
  },
  inspecteur: {
    disposition: "equipe",
    souhaits: ["inspection", "rapports-inspection", "grille-evaluation", "rapports-disciplinaires", "stat-suivi-recommandations", "communication", "formations"],
  },
  conseiller_pedagogique: {
    disposition: "equipe",
    souhaits: ["inspection", "rapports-inspection", "supervision-apfc", "apfc-formation-continue", "rapports-antennes", "stat-suivi-recommandations", "formations"],
  },
  inspecteur_orientation: {
    disposition: "equipe",
    souhaits: ["inspection", "stat-par-classe", "notes-bulletins", "livret-scolaire", "absences", "rendez-vous", "communication"],
  },
  drena: {
    disposition: "equipe",
    souhaits: ["stat-etablissement", "rapport-etablissement", "inspection", "rapports-inspection", "stat-regionales", "emplois-du-temps", "absences", "stat-analytics"],
  },
  maitre_application: {
    disposition: "equipe",
    souhaits: ["stages-maitre", "formations", "notifications", "communication", "guides", "parcours"],
  },
  chef_antenne: {
    disposition: "equipe",
    souhaits: ["apfc-formation-continue", "rapports-antennes", "supervision-apfc", "formations", "guides", "notifications"],
  },
};

const DEFAUT: ConfigAccueil = { disposition: "equipe", souhaits: ["formations", "guides", "parcours", "notifications", "mon-profil"] };

/** Items jamais proposés en raccourci : l'accueil lui-même, les écrans techniques de la plateforme, le parrainage. */
const EXCLUS = new Set(["tableau-de-bord", "apercu-role", "design-theme", "installation", "mon-identification", "mon-parrainage", "corrections"]);

/** Outils communs à tous : ne complètent l'accueil qu'APRÈS les modules métier du rôle, dans cet ordre. */
const GENERIQUES = ["formations", "guides", "notifications", "parcours", "academie-premium", "mon-profil"];

/** Nombre d'outils sous la carte principale (grille) ou dans la liste (famille). */
const MAX_GRILLE = 6;
const MAX_LISTE = 5;

export function accueilMobilePour(
  role: RoleId,
  sections: SectionNav[],
  contexte: { etabGere: string | null; badges?: Record<string, number>; terme?: (s: string) => string },
): DonneesAccueilMobile {
  const config = CONFIG[role] ?? DEFAUT;
  const T = contexte.terme ?? ((s: string) => s);

  const creer = (id: string, item: Pick<ItemNav, "libelle" | "description" | "icone"> | null, href: string): Raccourci => {
    const texte = TEXTES[id];
    return {
      id,
      libelle: T(texte?.libelle ?? item?.libelle ?? id),
      sousTitre: T(SOUS_TITRES_ROLE[role]?.[id] ?? texte?.sousTitre ?? item?.description ?? ""),
      icone: texte?.icone ?? item?.icone ?? "Circle",
      href,
      badge: contexte.badges?.[id] || undefined,
    };
  };

  const disponibles = new Map<string, Raccourci>();
  for (const section of sections) {
    for (const item of section.items) {
      if (item.statut === "a_venir" || EXCLUS.has(item.id) || disponibles.has(item.id)) continue;
      disponibles.set(item.id, creer(item.id, item, `/app/${item.segment}`));
    }
  }
  // Liens directs : seulement si le module « Établissements » (qui gouverne ces pages) est accordé.
  const liensFiche = Boolean(contexte.etabGere) && disponibles.has("etablissements");
  if (liensFiche) {
    const base = `/app/systeme/etablissements/${contexte.etabGere}`;
    const hrefs: Record<(typeof LIENS_FICHE)[number], string> = {
      "etab-emploi-du-temps": `${base}/emploi-du-temps`,
      "etab-classes": `${base}/structure`,
      "etab-enseignants": `${base}/enseignants`,
      "etab-matieres": `${base}#volumes`,
      "etab-parametres": base,
    };
    for (const id of LIENS_FICHE) disponibles.set(id, creer(id, null, hrefs[id]));
  }

  const max = config.disposition === "famille" ? MAX_LISTE : 1 + MAX_GRILLE;
  const retenus: Raccourci[] = [];
  const pris = new Set<string>();
  const prendre = (id: string) => {
    const r = disponibles.get(id);
    if (!r || pris.has(id) || retenus.length >= max) return false;
    retenus.push(r);
    pris.add(id);
    if (EQUIVALENTS[id]) pris.add(EQUIVALENTS[id]);
    return true;
  };
  for (const souhait of config.souhaits) souhait.split("|").some(prendre);
  // Complément : d'abord les modules MÉTIER accordés, dans l'ordre du menu, puis les outils
  // communs. Les liens directs ne complètent jamais (ils ne figurent que s'ils sont souhaités).
  const estLienFiche = (id: string) => (LIENS_FICHE as readonly string[]).includes(id);
  for (const id of disponibles.keys()) {
    if (retenus.length >= max) break;
    if (!estLienFiche(id) && !GENERIQUES.includes(id)) prendre(id);
  }
  for (const id of GENERIQUES) {
    if (retenus.length >= max) break;
    prendre(id);
  }

  if (config.disposition === "famille") return { disposition: "famille", principal: null, autres: retenus };
  const [principal = null, ...autres] = retenus;
  // Grille à 2 colonnes : on retire la dernière tuile si elle resterait seule sur sa rangée.
  if (autres.length > 1 && autres.length % 2 === 1) autres.pop();
  return { disposition: "equipe", principal, autres };
}
