import type { RoleId } from "./roles";

/**
 * Carte de navigation de l'application — réalise le principe directeur du projet :
 * UNE interface unique, dont les sections et pages sont filtrées dynamiquement par le rôle
 * de l'utilisateur connecté (cahier §1.4). Chaque entrée déclare les rôles qui y ont accès
 * et son statut de réalisation (`disponible` ou `a_venir`).
 *
 * ⚠️ La présence d'un item dans le menu n'est PAS la sécurité : le contrôle d'accès réel
 * est refait côté serveur sur chaque page (CLAUDE.md §3, §9). Cette carte pilote l'affichage
 * et sert d'index unique des modules à construire au fil des phases.
 */

/** Sentinelle : item accessible à tous les rôles. */
export const TOUS = "tous" as const;

/** Nom d'une icône lucide-react (résolue dans le composant Sidebar). */
export type IconeNav = string;

export type RolesAutorises = RoleId[] | typeof TOUS;

export interface ItemNav {
  id: string;
  libelle: string;
  /** Segment de route sous /app (ex : "mon-profil" → /app/mon-profil). */
  segment: string;
  icone: IconeNav;
  roles: RolesAutorises;
  statut: "disponible" | "a_venir";
  /** Phase du plan de développement qui livre cet item (cahier §8). */
  phase: number;
  description?: string;
}

export interface SectionNav {
  id: string;
  libelle: string;
  icone: IconeNav;
  items: ItemNav[];
}

export const NAVIGATION: SectionNav[] = [
  {
    id: "pilotage",
    libelle: "Pilotage",
    icone: "LayoutDashboard",
    items: [
      {
        id: "tableau-de-bord",
        libelle: "Tableau de bord",
        segment: "",
        icone: "LayoutDashboard",
        roles: TOUS,
        statut: "disponible",
        phase: 1,
        description: "Vue d'accueil adaptée à votre rôle et à votre périmètre.",
      },
    ],
  },
  {
    id: "mon-compte",
    libelle: "Mon compte",
    icone: "UserCircle",
    items: [
      {
        id: "mon-identification",
        libelle: "Mon Identification",
        segment: "mon-identification",
        icone: "IdCard",
        roles: TOUS,
        statut: "disponible",
        phase: 1,
        description: "Récapitulatif de votre compte et du statut de votre demande de rôle.",
      },
      {
        id: "mon-profil",
        libelle: "Mon Profil",
        segment: "mon-profil",
        icone: "UserCircle",
        roles: TOUS,
        statut: "disponible",
        phase: 1,
        description: "Informations personnelles, coordonnées et préférences.",
      },
    ],
  },
  {
    id: "systeme",
    libelle: "Système",
    icone: "ShieldCheck",
    items: [
      {
        id: "niveaux-acces",
        libelle: "Niveaux d'accès",
        segment: "systeme/niveaux-acces",
        icone: "ShieldCheck",
        roles: ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"],
        statut: "disponible",
        phase: 1,
        description: "Définition des 13 rôles et de leurs périmètres.",
      },
      {
        id: "habilitations",
        libelle: "Gestion des habilitations",
        segment: "systeme/habilitations",
        icone: "KeyRound",
        roles: ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"],
        statut: "disponible",
        phase: 1,
        description: "Attribution et révocation des rôles et périmètres des utilisateurs.",
      },
      {
        id: "comptes",
        libelle: "Comptes utilisateurs",
        segment: "systeme/comptes",
        icone: "Users",
        roles: ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"],
        statut: "disponible",
        phase: 1,
        description: "Création, modification et suivi des comptes.",
      },
      {
        id: "approbations",
        libelle: "Approbations",
        segment: "systeme/approbations",
        icone: "ClipboardCheck",
        roles: ["admin"],
        statut: "disponible",
        phase: 1,
        description: "Traitement des demandes de rôle (inscriptions et changements).",
      },
      {
        id: "etablissements",
        libelle: "Établissements",
        segment: "systeme/etablissements",
        icone: "School",
        roles: ["admin", "etablissements_admin"],
        statut: "disponible",
        phase: 2,
      },
      {
        id: "cafop",
        libelle: "CAFOP",
        segment: "systeme/cafop",
        icone: "GraduationCap",
        roles: ["admin", "cafop_admin"],
        statut: "disponible",
        phase: 5,
        description: "Promotions d'élèves-maîtres et import CSV.",
      },
      {
        id: "statistiques-cafop",
        libelle: "Statistiques CAFOP",
        segment: "systeme/statistiques-cafop",
        icone: "BarChart3",
        roles: ["admin", "cafop_admin", "drena"],
        statut: "a_venir",
        phase: 5,
      },
      {
        id: "rapports-cafop",
        libelle: "Rapports CAFOP",
        segment: "systeme/rapports-cafop",
        icone: "FileText",
        roles: ["admin", "cafop_admin"],
        statut: "a_venir",
        phase: 5,
      },
      {
        id: "apfc",
        libelle: "APFC",
        segment: "systeme/apfc",
        icone: "Network",
        roles: ["admin", "apfc_admin"],
        statut: "disponible",
        phase: 5,
        description: "Sessions de formation continue et import CSV.",
      },
      {
        id: "convertisseur-csv",
        libelle: "Convertisseur CSV",
        segment: "systeme/convertisseur-csv",
        icone: "FileSpreadsheet",
        roles: ["admin", "cafop_admin", "apfc_admin"],
        statut: "a_venir",
        phase: 5,
      },
      {
        id: "journal-activite",
        libelle: "Journal d'activité",
        segment: "systeme/journal-activite",
        icone: "ScrollText",
        roles: ["admin"],
        statut: "disponible",
        phase: 7,
        description: "Traçabilité des actions sensibles (audit).",
      },
      {
        id: "facturation",
        libelle: "Facturation",
        segment: "systeme/facturation",
        icone: "CreditCard",
        roles: ["admin", "etablissements_admin", "chef_etablissement"],
        statut: "a_venir",
        phase: 7,
      },
      {
        id: "design-theme",
        libelle: "Design & thème",
        segment: "systeme/design-theme",
        icone: "Palette",
        roles: ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"],
        statut: "disponible",
        phase: 2,
      },
      {
        id: "installation",
        libelle: "Installation",
        segment: "systeme/installation",
        icone: "Download",
        roles: ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"],
        statut: "a_venir",
        phase: 7,
      },
      {
        id: "configuration",
        libelle: "Configuration générale",
        segment: "systeme/configuration",
        icone: "Settings",
        roles: ["admin"],
        statut: "disponible",
        phase: 2,
      },
      {
        id: "apercu-role",
        libelle: "Aperçu de rôle",
        segment: "systeme/apercu",
        icone: "Eye",
        roles: ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"],
        statut: "disponible",
        phase: 1,
        description: "Visualiser l'interface telle qu'elle apparaît pour un autre rôle.",
      },
    ],
  },
  {
    id: "vie-scolaire",
    libelle: "Vie scolaire",
    icone: "CalendarDays",
    items: [
      {
        id: "mes-classes",
        libelle: "Mes classes",
        segment: "mes-classes",
        icone: "Presentation",
        roles: ["enseignant"],
        statut: "disponible",
        phase: 3,
        description: "Vos classes affectées et l'accès direct à leurs outils.",
      },
      {
        id: "ma-classe",
        libelle: "Ma classe",
        segment: "ma-classe",
        icone: "Backpack",
        roles: ["eleve"],
        statut: "disponible",
        phase: 3,
        description: "Votre scolarité : séances, notes et assiduité.",
      },
      {
        id: "mes-enfants",
        libelle: "Mes enfants",
        segment: "mes-enfants",
        icone: "UsersRound",
        roles: ["parent"],
        statut: "disponible",
        phase: 3,
        description: "Le suivi scolaire de vos enfants.",
      },
      {
        id: "emplois-du-temps",
        libelle: "Emplois du temps",
        segment: "vie-scolaire/emplois-du-temps",
        icone: "CalendarDays",
        roles: [
          "admin",
          "chef_etablissement",
          "enseignant",
          "educateur",
          "parent",
          "eleve",
          "drena",
          "inspecteur",
        ],
        statut: "a_venir",
        phase: 4,
        description: "Génération automatique par solveur de contraintes — module phare.",
      },
      {
        id: "affectations",
        libelle: "Affectations",
        segment: "vie-scolaire/affectations",
        icone: "UserCheck",
        roles: ["admin", "chef_etablissement"],
        statut: "disponible",
        phase: 3,
        description: "Relier les enseignants à leurs classes et disciplines.",
      },
      {
        id: "inscriptions",
        libelle: "Inscriptions",
        segment: "vie-scolaire/inscriptions",
        icone: "GraduationCap",
        roles: ["admin", "chef_etablissement", "educateur"],
        statut: "disponible",
        phase: 3,
        description: "Inscrire les élèves dans leurs classes.",
      },
      {
        id: "liens-parents",
        libelle: "Liens parent-élève",
        segment: "vie-scolaire/liens-parents",
        icone: "Users",
        roles: ["admin", "chef_etablissement", "educateur"],
        statut: "disponible",
        phase: 3,
        description: "Relier les comptes parents aux comptes élèves.",
      },
      {
        id: "registre-appel",
        libelle: "Registre d'appel",
        segment: "vie-scolaire/registre-appel",
        icone: "ClipboardList",
        roles: ["admin", "chef_etablissement", "enseignant", "educateur"],
        statut: "disponible",
        phase: 3,
      },
      {
        id: "cahier-texte",
        libelle: "Cahier de texte",
        segment: "vie-scolaire/cahier-texte",
        icone: "NotebookPen",
        roles: ["admin", "chef_etablissement", "enseignant", "parent", "eleve"],
        statut: "disponible",
        phase: 3,
        description: "Contenu des séances et travail à faire, classe par classe.",
      },
      {
        id: "notes-bulletins",
        libelle: "Notes & bulletins",
        segment: "vie-scolaire/notes-bulletins",
        icone: "BookOpen",
        roles: ["admin", "chef_etablissement", "educateur", "enseignant"],
        statut: "disponible",
        phase: 3,
      },
      {
        id: "livret-scolaire",
        libelle: "Livret scolaire",
        segment: "vie-scolaire/livret-scolaire",
        icone: "BookMarked",
        roles: ["admin", "chef_etablissement", "enseignant", "parent", "eleve"],
        statut: "a_venir",
        phase: 3,
      },
      {
        id: "communication",
        libelle: "Communication",
        segment: "vie-scolaire/communication",
        icone: "MessageSquare",
        roles: [
          "admin",
          "chef_etablissement",
          "enseignant",
          "educateur",
          "parent",
          "eleve",
        ],
        statut: "disponible",
        phase: 7,
        description: "Messagerie interne entre membres de la plateforme.",
      },
      {
        id: "rendez-vous",
        libelle: "Rendez-vous",
        segment: "vie-scolaire/rendez-vous",
        icone: "CalendarClock",
        roles: ["admin", "chef_etablissement", "enseignant", "educateur", "parent"],
        statut: "a_venir",
        phase: 7,
      },
      {
        id: "academie-premium",
        libelle: "Académie Premium",
        segment: "vie-scolaire/academie-premium",
        icone: "Sparkles",
        roles: TOUS,
        statut: "a_venir",
        phase: 7,
      },
      {
        id: "alertes-sms",
        libelle: "Alertes & SMS",
        segment: "vie-scolaire/alertes-sms",
        icone: "Megaphone",
        roles: ["admin", "chef_etablissement", "educateur"],
        statut: "a_venir",
        phase: 7,
      },
      {
        id: "notifications",
        libelle: "Notifications",
        segment: "vie-scolaire/notifications",
        icone: "Bell",
        roles: TOUS,
        statut: "disponible",
        phase: 3,
        description: "Vos notifications : décisions de rôle, vie scolaire, alertes.",
      },
    ],
  },
  {
    id: "inspection",
    libelle: "Inspection & Supervision",
    icone: "Stamp",
    items: [
      {
        id: "inspection",
        libelle: "Inspection",
        segment: "inspection/visites",
        icone: "Stamp",
        roles: ["admin", "inspecteur", "drena"],
        statut: "disponible",
        phase: 6,
        description: "Visites, comptes-rendus et suivi des recommandations.",
      },
      {
        id: "grille-evaluation",
        libelle: "Grille d'évaluation",
        segment: "inspection/grille-evaluation",
        icone: "ListChecks",
        roles: ["admin", "inspecteur"],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "rapports-antennes",
        libelle: "Rapports d'antennes",
        segment: "inspection/rapports-antennes",
        icone: "FileText",
        roles: ["admin", "drena", "chef_antenne", "conseiller_pedagogique", "apfc_admin"],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "rapports-inspection",
        libelle: "Rapports d'inspection",
        segment: "inspection/rapports-inspection",
        icone: "FileCheck",
        roles: ["admin", "inspecteur", "drena"],
        statut: "a_venir",
        phase: 6,
      },
    ],
  },
  {
    id: "rapports",
    libelle: "Rapports & Activités",
    icone: "FileBarChart",
    items: [
      {
        id: "rapport-etablissement",
        libelle: "Rapport d'établissement",
        segment: "rapports/etablissement",
        icone: "FileBarChart",
        roles: ["admin", "chef_etablissement", "etablissements_admin", "drena"],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "rapports-activite",
        libelle: "Rapports d'activité",
        segment: "rapports/activite",
        icone: "FileText",
        roles: [
          "admin",
          "drena",
          "inspecteur",
          "chef_etablissement",
          "cafop_admin",
          "apfc_admin",
        ],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "rapports-antennes-pedagogiques",
        libelle: "Rapports d'Antennes Pédagogiques",
        segment: "rapports/antennes-pedagogiques",
        icone: "FileText",
        roles: ["admin", "drena", "chef_antenne", "apfc_admin"],
        statut: "a_venir",
        phase: 6,
      },
    ],
  },
  {
    id: "statistiques",
    libelle: "Statistiques",
    icone: "BarChart3",
    items: [
      {
        id: "stat-par-classe",
        libelle: "Par classe",
        segment: "statistiques/par-classe",
        icone: "BarChart3",
        roles: ["admin", "chef_etablissement", "enseignant"],
        statut: "disponible",
        phase: 6,
        description: "Moyennes, assiduité et répartition des notes d'une classe.",
      },
      {
        id: "stat-etablissement",
        libelle: "Établissement",
        segment: "statistiques/etablissement",
        icone: "BarChart3",
        roles: ["admin", "chef_etablissement", "etablissements_admin", "drena"],
        statut: "disponible",
        phase: 6,
        description: "Indicateurs clés : effectifs, cycles, assiduité, moyennes.",
      },
      {
        id: "stat-regionales",
        libelle: "Régionales",
        segment: "statistiques/regionales",
        icone: "BarChart3",
        roles: ["admin", "drena"],
        statut: "disponible",
        phase: 6,
        description: "Répartition territoriale des effectifs par région.",
      },
      {
        id: "stat-analytics",
        libelle: "Analytics",
        segment: "statistiques/analytics",
        icone: "TrendingUp",
        roles: ["admin", "drena", "chef_etablissement"],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "stat-performance-enseignants",
        libelle: "Performance des enseignants",
        segment: "statistiques/performance-enseignants",
        icone: "Gauge",
        roles: ["admin", "inspecteur", "drena", "chef_etablissement"],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "stat-efficacite",
        libelle: "Efficacité pédagogique",
        segment: "statistiques/efficacite-pedagogique",
        icone: "Target",
        roles: ["admin", "inspecteur", "drena"],
        statut: "a_venir",
        phase: 6,
      },
      {
        id: "stat-suivi-recommandations",
        libelle: "Suivi des recommandations",
        segment: "statistiques/suivi-recommandations",
        icone: "ClipboardCheck",
        roles: ["admin", "inspecteur", "drena", "conseiller_pedagogique"],
        statut: "a_venir",
        phase: 6,
      },
    ],
  },
];

/** Un item est-il autorisé pour ce rôle ? */
export function itemAutorise(item: ItemNav, roleId: RoleId): boolean {
  return item.roles === TOUS || item.roles.includes(roleId);
}

/** Navigation filtrée pour un rôle : ne conserve que les sections ayant au moins un item visible. */
export function navigationPourRole(roleId: RoleId): SectionNav[] {
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => itemAutorise(item, roleId)),
  })).filter((section) => section.items.length > 0);
}

/** Tous les items, à plat (utile pour résoudre une route ou produire un index). */
export function tousLesItems(): ItemNav[] {
  return NAVIGATION.flatMap((s) => s.items);
}
