import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Users, GraduationCap, Home, BookOpen, Award, FileCheck2, Compass } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { PageHeader, Card, Badge } from "@/components/app/ui";
import { NAVIGATION, navigationPourRole, TOUS } from "@/lib/rbac/navigation";
import { ROLES, ROLES_ORDONNES, libelleRole, type RoleId, type TypePortee, type GroupeRole } from "@/lib/rbac/roles";
import { BoutonImprimerGuide } from "./bouton-imprimer";
import { MaquetteBarre, MaquetteMenu, FluxLMS, MaquetteAttestation } from "./guide-visuels";

export const metadata: Metadata = { title: "Guide complet — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";

const PORTEE_LABEL: Record<TypePortee, string> = {
  global: "Tous les pays — aucune restriction",
  pays: "Un pays",
  diocese: "Un diocèse (enseignement catholique)",
  region: "Une région (DRENA / DRENAET)",
  etablissement: "Un ou plusieurs établissements",
  cafop: "Un CAFOP",
  apfc: "Une APFC",
  antenne: "Une antenne pédagogique",
  personnel: "Ses propres données (ou ses enfants)",
};

const GROUPES: { id: GroupeRole; titre: string; icone: typeof ShieldCheck }[] = [
  { id: "pilotage", titre: "Pilotage & administration", icone: ShieldCheck },
  { id: "formation", titre: "Formation des maîtres (CAFOP / APFC)", icone: GraduationCap },
  { id: "etablissement", titre: "Établissement scolaire", icone: Home },
  { id: "famille", titre: "Famille (élève & parent)", icone: Users },
];

/** Usage détaillé, rôle par rôle (curated). */
const USAGE_ROLE: Record<RoleId, string> = {
  admin: "Contrôle total : crée et gère les comptes, approuve les demandes de rôle, configure les établissements, CAFOP et APFC, pilote le LMS et consulte toutes les statistiques. Peut activer l'Aperçu de rôle pour voir l'interface d'un autre rôle en lecture seule.",
  senec: "Secrétariat National de l'Enseignement Catholique : consultation en lecture seule de tous les établissements catholiques (réseau SEDEC) de son pays — annuaire, rapports et statistiques.",
  sedec: "Secrétariat Diocésain de l'Enseignement Catholique : consultation en lecture seule des établissements catholiques (réseau SEDEC) de son diocèse — annuaire, rapports et statistiques.",
  superviseur_international: "Accès à tous les établissements, CAFOP et APFC de tous les pays, pour leur administration et le coaching des représentants-pays.",
  super_admin_cafop: "Accès en écriture à tous les CAFOP de son pays : édition et configuration des centres, promotions et cohortes.",
  super_admin_etablissements: "Accès en écriture à tous les établissements de son pays : édition, configuration et alertes SMS.",
  super_admin_apfc: "Accès en écriture à toutes les APFC de son pays : sessions de formation continue et configuration.",
  representant_pays: "Administre les établissements, CAFOP et APFC de son pays et coache ses collaborateurs.",
  delc: "Directeur Central : consultation en lecture seule de toutes les pages des CAFOP de son pays.",
  etablissements_admin: "Administre les établissements rattachés : habilitations locales, configuration, facturation, rapports et statistiques.",
  drena: "Pilotage régional : supervise les structures de sa région, consulte emplois du temps, rapports et statistiques régionales, suit les recommandations d'inspection.",
  inspecteur: "Conduit l'inspection pédagogique : visites de classe, grille d'évaluation, rapports d'inspection et statistiques de performance des enseignants.",
  inspecteur_orientation: "Accompagne l'orientation des élèves : consulte bulletins et livret scolaire, mène des entretiens et gère des rendez-vous d'orientation.",
  conseiller_pedagogique: "Accompagne la mise en œuvre pédagogique de son antenne et suit le traitement des recommandations d'inspection.",
  chef_antenne: "Responsable d'une antenne de formation (APFC) : rapports d'antennes et d'activité de formation continue.",
  adc: "Adjoint au directeur de CAFOP : consultation en lecture seule du cahier de texte, du registre d'appel et des notes & bulletins de son centre ; co-décide avec le directeur sur les stages pratiques (attribution des stagiaires, autorisations de modification de notes).",
  maitre_application: "Encadre les élèves-maîtres en stage pratique : fiche de présence et régularité, dialogue avec l'administration du CAFOP et grille d'évaluation — uniquement pour les stagiaires qui lui sont attribués.",
  cafop_admin: "Gère son CAFOP : promotions d'élèves-maîtres, groupes-classes, cohortes, import CSV et plan de formation initiale.",
  apfc_admin: "Gère son APFC : sessions de formation continue, import CSV et rapports d'antennes pédagogiques.",
  econome: "Gère les finances de son établissement : barème des frais et échéanciers, encaissements de scolarité avec reçus numérotés, remises et bourses, dépenses et recettes (imputation OHADA simplifiée), économat (stocks et ventes).",
  directeur_etudes: "Responsable pédagogique de son établissement : supervise les emplois du temps, les cahiers de texte, les notes & bulletins et le suivi de l'exercice professionnel des enseignants.",
  chef_etablissement: "Dirige son établissement : configuration, affectations enseignants-classes, inscriptions, emplois du temps (solveur), vie scolaire, notes & bulletins, rapports, statistiques et facturation.",
  adjoint_chef_etablissement: "Seconde le chef d'établissement : configuration, visa des cahiers de textes et des bulletins, visites de classe (inspection interne) pour évaluer les enseignants.",
  enseignant: "Saisit le registre d'appel, le cahier de texte et les notes de ses classes ; consulte son emploi du temps et les statistiques de ses classes.",
  educateur: "Gère la vie scolaire : suivi des absences et de la discipline, inscriptions, liens parent-élève et alertes SMS.",
  parent: "Suit la scolarité de ses enfants : emplois du temps, notes, cahier de texte, livret scolaire, communication et rendez-vous.",
  eleve: "Consulte sa scolarité : emploi du temps, notes, cahier de texte et livret. Rôle attribué par défaut à l'inscription, jusqu'à l'approbation d'un autre rôle.",
};

function modulesDeRole(roleId: RoleId): string[] {
  return navigationPourRole(roleId).flatMap((s) => s.items.map((i) => i.libelle));
}

/** Accompagnement pas-à-pas : les tâches principales de chaque rôle, dans l'ordre. */
const PAS_A_PAS: Record<RoleId, string[]> = {
  admin: [
    "Traitez les demandes de rôle en attente : Système › Approbations.",
    "Créez et habilitez les comptes : Système › Comptes et Habilitations.",
    "Configurez établissements, CAFOP et APFC : menu Système.",
    "Alimentez le centre de formation : Aide et Formation › Gérer le contenu.",
    "Suivez l'activité : Statistiques et Journal d'activité.",
  ],
  senec: [
    "Consultez l'annuaire des établissements catholiques (réseau SEDEC) de votre pays.",
    "Suivez les rapports et statistiques nationaux de l'enseignement catholique.",
    "Interface en lecture seule : consultation uniquement.",
  ],
  sedec: [
    "Consultez les établissements catholiques (réseau SEDEC) de votre diocèse.",
    "Suivez les rapports et statistiques de votre diocèse.",
    "Interface en lecture seule : consultation uniquement.",
  ],
  superviseur_international: [
    "Choisissez le pays à administrer (barre supérieure).",
    "Administrez établissements, CAFOP et APFC de tous les pays.",
    "Coachez les représentants-pays.",
  ],
  super_admin_cafop: [
    "Sélectionnez votre pays dans la barre supérieure.",
    "Ouvrez Système › CAFOP et éditez / configurez chaque centre.",
  ],
  super_admin_etablissements: [
    "Sélectionnez votre pays.",
    "Ouvrez Système › Établissements et éditez / configurez chaque établissement.",
  ],
  super_admin_apfc: [
    "Sélectionnez votre pays.",
    "Ouvrez Système › APFC et éditez / configurez chaque antenne.",
  ],
  representant_pays: [
    "Administrez les établissements, CAFOP et APFC de votre pays.",
    "Coachez vos collaborateurs.",
  ],
  delc: [
    "Ouvrez Système › CAFOP : consultez (lecture seule) toutes les pages des CAFOP de votre pays.",
  ],
  etablissements_admin: [
    "Ouvrez Système › Établissements pour vos établissements.",
    "Attribuez les rôles locaux : Système › Habilitations.",
    "Consultez rapports et statistiques d'établissement.",
    "Gérez les abonnements : Système › Facturation.",
  ],
  drena: [
    "Consultez les établissements de votre région.",
    "Suivez emplois du temps et rapports d'établissement.",
    "Analysez les statistiques régionales.",
    "Suivez le traitement des recommandations d'inspection.",
  ],
  inspecteur: [
    "Planifiez et menez vos visites : Inspection › Visites.",
    "Évaluez avec la grille d'évaluation.",
    "Rédigez vos rapports d'inspection.",
    "Suivez la performance des enseignants : Statistiques.",
  ],
  inspecteur_orientation: [
    "Consultez bulletins et livret scolaire des élèves.",
    "Programmez des entretiens : Vie scolaire › Rendez-vous.",
    "Analysez les statistiques par classe.",
  ],
  conseiller_pedagogique: [
    "Consultez les rapports d'antennes.",
    "Accompagnez la mise en œuvre pédagogique.",
    "Suivez les recommandations : Statistiques › Suivi des recommandations.",
  ],
  chef_antenne: [
    "Consultez les rapports d'antennes pédagogiques.",
    "Suivez l'activité de formation continue.",
  ],
  adc: [
    "Consultez (lecture seule) le cahier de texte, le registre d'appel et les notes & bulletins de votre CAFOP.",
    "Stages pratiques : attribuez les stagiaires aux maîtres d'application et instruisez les demandes de modification de notes.",
  ],
  maitre_application: [
    "Ouvrez « Mes stagiaires » pour retrouver les élèves-maîtres qui vous sont attribués.",
    "Saisissez la fiche de présence de chaque séance de stage (régularité calculée automatiquement).",
    "Dialoguez avec l'administration du CAFOP dans le fil de suivi de chaque stagiaire.",
    "Renseignez votre grille d'évaluation ; toute modification ultérieure requiert l'autorisation du Directeur ou de l'ADC.",
  ],
  econome: [
    "Ouvrez Vie scolaire › Finances.",
    "Définissez le barème des frais (montants, échéanciers en tranches) par niveau.",
    "Encaissez les paiements de scolarité : un reçu numéroté imprimable est produit à chaque encaissement.",
    "Saisissez les dépenses et recettes diverses avec leur imputation comptable ; suivez les soldes par mode (espèces, Mobile Money, banque).",
    "Tenez l'économat : articles, entrées de stock, ventes et alertes de seuil.",
  ],
  directeur_etudes: [
    "Suivez les emplois du temps : Vie scolaire › Emplois du temps.",
    "Consultez les cahiers de texte des enseignants et leur avancement.",
    "Supervisez les notes & bulletins de l'établissement.",
    "Suivez l'exercice professionnel des enseignants : visites de classe et statistiques.",
  ],
  cafop_admin: [
    "Ouvrez Système › CAFOP.",
    "Créez les promotions et groupes-classes.",
    "Importez les élèves-maîtres : import CSV / Convertisseur.",
    "Renseignez le plan de formation.",
  ],
  apfc_admin: [
    "Ouvrez Système › APFC.",
    "Programmez les sessions de formation continue.",
    "Importez les participants (CSV).",
    "Consultez les rapports d'antennes pédagogiques.",
  ],
  chef_etablissement: [
    "Configurez l'établissement : Système › Configuration générale.",
    "Reliez enseignants et classes : Vie scolaire › Affectations.",
    "Inscrivez les élèves : Vie scolaire › Inscriptions.",
    "Générez les emplois du temps (solveur).",
    "Suivez notes & bulletins, rapports et statistiques.",
  ],
  adjoint_chef_etablissement: [
    "Secondez la configuration de l'établissement.",
    "Visez les cahiers de textes et les bulletins.",
    "Menez des visites de classe : Inspection › Visites.",
  ],
  enseignant: [
    "Consultez votre emploi du temps : Vie scolaire › Emplois du temps.",
    "Faites l'appel : Vie scolaire › Registre d'appel.",
    "Renseignez le cahier de texte de vos séances.",
    "Saisissez les notes : Vie scolaire › Notes & bulletins.",
  ],
  educateur: [
    "Suivez les absences et la discipline.",
    "Gérez inscriptions et liens parent-élève.",
    "Informez les parents : Vie scolaire › Alertes & SMS.",
  ],
  parent: [
    "Ouvrez le suivi de vos enfants : Vie scolaire › Mes enfants.",
    "Consultez notes, emploi du temps et cahier de texte.",
    "Échangez : Communication et Rendez-vous.",
  ],
  eleve: [
    "Consultez votre emploi du temps.",
    "Suivez notes et livret : Ma classe.",
    "Formez-vous : Aide et Formation › Guides d'utilisateurs.",
  ],
};

// ── Contenu rédigé (blocs) ──────────────────────────────────

type Bloc = { titre?: string; texte?: string[]; points?: string[] };
type Sujet = { titre: string; blocs: Bloc[] };

const PREMIERS_PAS: Bloc[] = [
  {
    titre: "Créer son compte et obtenir un rôle",
    texte: [
      "L'inscription se fait avec un e-mail, un mot de passe et le rôle souhaité (avec l'établissement ou la structure déclarée). Un e-mail de confirmation est envoyé : au clic sur le lien, le compte devient actif immédiatement.",
      "Le compte et le rôle sont découplés. Tant que la demande de rôle n'est pas approuvée par l'administrateur, l'accès est limité à « Mon Identification » et « Mon Profil », avec un bandeau de statut. Une fois la demande approuvée, le rôle et son périmètre sont attribués et l'accès complet est débloqué.",
    ],
  },
  {
    titre: "La barre supérieure",
    points: [
      "Recherche globale, sélecteur de pays, année scolaire et langue.",
      "Aperçu de rôle (réservé aux administrateurs) : visualiser l'interface d'un autre rôle, en lecture seule.",
      "Cloche de notifications : décisions de rôle, événements de vie scolaire et alertes.",
    ],
  },
  {
    titre: "Mon compte",
    points: [
      "Mon Identification : récapitulatif du compte et statut de la demande de rôle.",
      "Mon Profil : informations personnelles, coordonnées et préférences.",
    ],
  },
];

const RBAC_BLOCS: Bloc[] = [
  {
    texte: [
      "Un utilisateur n'a pas seulement un rôle : il a un rôle ET un périmètre (scope). Deux utilisateurs de même rôle mais de périmètres différents ne voient jamais les mêmes données — le filtrage se fait toujours côté serveur.",
      "L'interface est unique : ses sections et pages sont filtrées dynamiquement selon le rôle. Un menu affiché ne suffit jamais : chaque page revérifie l'autorisation.",
    ],
  },
  {
    titre: "Mode Aperçu de rôle",
    points: [
      "Permet à un administrateur de visualiser l'interface d'un autre rôle sans changer de compte.",
      "Filtré par périmètre : un admin spécialisé ne voit en aperçu que les rôles pertinents pour son périmètre.",
      "Lecture seule : en aperçu, toutes les actions d'écriture sont désactivées (un bandeau permanent le rappelle).",
    ],
  },
];

const LMS_SUJETS: Sujet[] = [
  {
    titre: "Vue d'ensemble",
    blocs: [
      {
        texte: [
          "« Aide et Formation » est le centre de formation intégré (LMS) d'EduWeb Planner. Il comporte deux espaces : l'espace apprenant (ouvert à tous les rôles) et la console d'administration du contenu (réservée à l'administrateur système).",
        ],
        points: [
          "Espace apprenant : Guides d'utilisateurs (catalogue de cours), Formations (sessions programmées), Parcours (suites de cours avec badge), Corrections (pour les tuteurs).",
          "Administration : Gestion du contenu (catégories, cours, leçons, quiz, devoirs), Parcours & badges, Suivi des apprenants, import de contenus CSV.",
        ],
      },
    ],
  },
  {
    titre: "Suivre un cours (apprenant)",
    blocs: [
      {
        titre: "Types de leçons",
        points: [
          "Texte (mise en forme Markdown, avec lecture audio du texte), Vidéo (YouTube/Vimeo intégrée), Fichier (PDF/document à télécharger), Lien (ressource externe).",
          "Quiz : évaluation notée automatiquement.",
          "Devoir : dépôt d'un texte et/ou d'un fichier, corrigé par un tuteur.",
        ],
      },
      {
        titre: "Progression",
        points: [
          "Les leçons de contenu (texte, vidéo, fichier, lien) se valident avec le bouton « Marquer terminé ».",
          "Une leçon Quiz se valide uniquement en atteignant le seuil de réussite.",
          "Une leçon Devoir se valide dès le dépôt d'un contenu (la note du tuteur vient ensuite).",
          "La barre de progression du cours reflète le pourcentage de leçons terminées.",
        ],
      },
    ],
  },
  {
    titre: "Quiz & exerciseurs",
    blocs: [
      {
        titre: "Côté apprenant",
        points: [
          "Le quiz est corrigé automatiquement ; le score et la réussite s'affichent à la soumission.",
          "Selon le réglage du quiz, les bonnes réponses et explications sont révélées (jamais / après tentative / après réussite / toujours).",
        ],
      },
      {
        titre: "Côté administration — constructeur de quiz",
        points: [
          "Types de questions : choix unique, choix multiple, vrai/faux, association (relier deux colonnes), texte à trous, remise en ordre.",
          "Chaque question porte un barème (points) et une explication facultative.",
          "Réglages du quiz : seuil de réussite (%), mode formatif ou sommatif, politique de révélation des solutions, consigne.",
          "Sécurité : les bonnes réponses ne sont jamais envoyées au navigateur avant soumission ; la correction est faite côté serveur.",
        ],
      },
    ],
  },
  {
    titre: "Devoirs & tuteurs",
    blocs: [
      {
        points: [
          "Un devoir accepte un dépôt en texte libre et/ou un fichier (jusqu'à 8 Mo), avec consigne, barème (note sur…) et date limite indicative.",
          "Tuteurs : l'administrateur désigne, par cours, des comptes existants comme tuteurs correcteurs (par e-mail). Un tuteur ne voit que les dépôts des cours dont il est tuteur ; l'administrateur voit et corrige tous les dépôts via la page « Corrections ».",
          "Correction : note + appréciation. Une observation peut être suggérée par l'IA (si une clé est configurée, sinon un repli local) — toujours modifiable par le correcteur avant validation.",
        ],
      },
    ],
  },
  {
    titre: "Formations (sessions)",
    blocs: [
      {
        points: [
          "Les sessions sont des rendez-vous programmés (webinaire, atelier, présentiel) avec inscription en ligne, indépendants des cours.",
          "Chaque session précise un format, une date & heure de début et une date & heure de fin (facultative), un animateur, un nombre de places et éventuellement un lien visio ou un lieu.",
          "L'apprenant s'inscrit d'un clic ; le lien de connexion n'apparaît qu'aux inscrits.",
        ],
      },
    ],
  },
  {
    titre: "Parcours & badges",
    blocs: [
      {
        points: [
          "Un parcours regroupe et ordonne plusieurs cours. L'apprenant s'y inscrit et progresse cours après cours.",
          "Un badge (nom, icône, couleur) peut être rattaché à un parcours. Il est décerné automatiquement lorsque l'apprenant termine tous les cours du parcours.",
          "L'apprenant retrouve ses badges dans « Parcours ». Un badge ne se rattache qu'à un parcours (jamais à un cours seul).",
        ],
      },
    ],
  },
  {
    titre: "Conditions de validation",
    blocs: [
      {
        titre: "Trois niveaux",
        points: [
          "Leçon : contenu = « Marquer terminé » ; quiz = score ≥ seuil de réussite ; devoir = dépôt d'un contenu.",
          "Cours : validé lorsque le pourcentage de leçons terminées atteint le seuil de complétion du cours (réglable, 100 % par défaut) ET que tous les quiz « sommatifs » ont été réussis.",
          "Parcours : validé lorsque tous ses cours sont terminés (déclenche le badge éventuel).",
        ],
      },
      {
        titre: "À régler côté administration",
        points: [
          "Seuil de réussite de chaque quiz (défaut 70 %).",
          "Mode d'un quiz : « sommatif » le rend obligatoire pour valider le cours (quel que soit le seuil de complétion) ; « formatif » sert d'entraînement.",
          "Seuil de complétion du cours : abaissez-le (ex. 80 %) pour accepter une validation partielle, tout en gardant les quiz sommatifs obligatoires.",
        ],
      },
    ],
  },
  {
    titre: "Certificats d'achèvement (attestations)",
    blocs: [
      {
        points: [
          "Dès qu'un cours est validé (seuil atteint et quiz sommatifs réussis), l'apprenant obtient le bouton « Obtenir mon attestation ».",
          "L'attestation « de réussite » présente le nom de l'apprenant, le cours, la date de fin, une référence unique, et — s'il y a des quiz sommatifs — le score moyen obtenu avec une mention automatique (Passable à Excellent).",
          "L'administrateur peut personnaliser, par cours, un signataire, sa fonction et une mention portée sur le document.",
          "L'attestation s'imprime ou s'enregistre en PDF depuis le navigateur. Elle se situe au niveau du cours ; la reconnaissance d'un parcours passe, elle, par un badge.",
        ],
      },
    ],
  },
];

// ── Rendu ───────────────────────────────────────────────────

function BlocVue({ b }: { b: Bloc }) {
  return (
    <div className="space-y-2">
      {b.titre && <h4 className="font-display text-sm font-bold text-forest-900">{b.titre}</h4>}
      {b.texte?.map((t, i) => <p key={i} className="text-sm leading-relaxed text-ink-800">{t}</p>)}
      {b.points && (
        <ul className="space-y-1.5">
          {b.points.map((p, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-800">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const lienSommaire = "block rounded-lg px-3 py-1.5 text-sm text-forest-800 hover:bg-forest-50";

export default async function GuidePlateformePage() {
  const u = await requireUtilisateur();
  const monRole = u.roleActif as RoleId;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`${BASE}/guides`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
          <ArrowLeft size={15} /> Retour aux guides
        </Link>
        <BoutonImprimerGuide />
      </div>

      <PageHeader
        titre="Guide complet d'EduWeb Planner"
        description="Prise en main de la plateforme et usage détaillé de chaque rôle, avec un chapitre approfondi sur le centre de formation (LMS)."
      />

      {ROLES[monRole] && (
        <Card className="border-forest-200 bg-forest-50/40">
          <p className="text-sm text-ink-800">
            Vous consultez ce guide en tant que <strong className="text-forest-900">{libelleRole(monRole)}</strong>. Votre section personnalisée est mise en avant plus bas.
          </p>
        </Card>
      )}

      {/* Sommaire */}
      <Card className="print:hidden">
        <h2 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">Sommaire</h2>
        <div className="grid gap-1 sm:grid-cols-2">
          <a href="#intro" className={lienSommaire}>1 · EduWeb Planner en bref</a>
          <a href="#premiers-pas" className={lienSommaire}>2 · Premiers pas</a>
          <a href="#roles" className={lienSommaire}>3 · Rôles & périmètres</a>
          <a href="#roles-detail" className={lienSommaire}>4 · Les rôles en détail</a>
          <a href="#modules" className={lienSommaire}>5 · Les modules de la plateforme</a>
          <a href="#lms" className={lienSommaire}>6 · ★ Aide et Formation (LMS) en profondeur</a>
        </div>
      </Card>

      {/* 1 — Intro */}
      <section id="intro" className="space-y-3 scroll-mt-24">
        <h2 className="font-display text-xl font-black text-forest-900">1 · EduWeb Planner en bref</h2>
        <Card className="space-y-3">
          <p className="text-sm leading-relaxed text-ink-800">
            EduWeb Planner est une plateforme de gestion et de planification scolaire pour le système éducatif ivoirien (et au-delà). Son principe directeur : une interface unique qui s&apos;adapte dynamiquement au rôle et au périmètre de chaque utilisateur.
          </p>
          <p className="text-sm leading-relaxed text-ink-800">
            Elle couvre l&apos;administration des établissements, la vie scolaire (registre d&apos;appel, cahier de texte, notes & bulletins), la génération automatique des emplois du temps par solveur de contraintes, la formation des maîtres (CAFOP / APFC), l&apos;inspection, les rapports et statistiques, et un centre de formation en ligne (LMS) détaillé au chapitre 6.
          </p>
        </Card>
      </section>

      {/* 2 — Premiers pas */}
      <section id="premiers-pas" className="space-y-3 scroll-mt-24">
        <h2 className="font-display text-xl font-black text-forest-900">2 · Premiers pas</h2>
        <Card className="space-y-5">{PREMIERS_PAS.map((b, i) => <BlocVue key={i} b={b} />)}</Card>
        <div className="space-y-2">
          <h3 className="font-display text-base font-bold text-forest-900">La barre supérieure, repère par repère</h3>
          <Card><MaquetteBarre /></Card>
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-base font-bold text-forest-900">Le menu latéral, adapté à votre rôle</h3>
          <Card><MaquetteMenu /></Card>
        </div>
      </section>

      {/* 3 — RBAC */}
      <section id="roles" className="space-y-3 scroll-mt-24">
        <h2 className="font-display text-xl font-black text-forest-900">3 · Rôles & périmètres — le cœur du système</h2>
        <Card className="space-y-5">{RBAC_BLOCS.map((b, i) => <BlocVue key={i} b={b} />)}</Card>
      </section>

      {/* 4 — Rôles en détail */}
      <section id="roles-detail" className="space-y-4 scroll-mt-24">
        <h2 className="font-display text-xl font-black text-forest-900">4 · Les rôles en détail</h2>
        <p className="text-sm text-ink-700/70">La plateforme compte {ROLES_ORDONNES.length} rôles, regroupés par vocation. Pour chacun : son périmètre, son usage et les modules auxquels il accède.</p>
        {GROUPES.map((g) => {
          const roles = ROLES_ORDONNES.filter((r) => r.groupe === g.id);
          if (roles.length === 0) return null;
          const IconeG = g.icone;
          return (
            <div key={g.id} className="space-y-3">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">
                <IconeG size={15} className="text-forest-600" /> {g.titre}
              </h3>
              <div className="space-y-3">
                {roles.map((r) => {
                  const estMien = r.id === monRole;
                  const modules = modulesDeRole(r.id);
                  return (
                    <Card key={r.id} className={`space-y-2 ${estMien ? "border-forest-300 ring-1 ring-forest-200" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-display text-base font-bold text-forest-900">{r.libelle}</h4>
                        {estMien && <Badge ton="succes">Votre rôle</Badge>}
                        <Badge ton="neutre">{PORTEE_LABEL[r.portee]}</Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-ink-800">{USAGE_ROLE[r.id]}</p>
                      <p className="text-xs text-ink-700/60">
                        <span className="font-semibold text-ink-700/75">Accès : </span>
                        {modules.length > 0 ? modules.join(" · ") : "Mon Identification · Mon Profil (jusqu'à l'attribution du rôle)"}
                      </p>
                      <div className="pt-1">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-forest-700">Pas à pas</p>
                        <ol className="space-y-1">
                          {PAS_A_PAS[r.id].map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-ink-800">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest-100 text-[11px] font-bold text-forest-700">{i + 1}</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* 5 — Modules */}
      <section id="modules" className="space-y-4 scroll-mt-24">
        <h2 className="font-display text-xl font-black text-forest-900">5 · Les modules de la plateforme</h2>
        <p className="text-sm text-ink-700/70">Chaque module indique à quoi il sert et quels rôles y ont accès.</p>
        {NAVIGATION.map((section) => (
          <div key={section.id} className="space-y-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">{section.libelle}</h3>
            <Card className="divide-y divide-cream-100 p-0">
              {section.items.map((item) => {
                const roles = item.roles === TOUS ? "Tous les rôles" : item.roles.map((rid) => libelleRole(rid)).join(", ");
                return (
                  <div key={item.id} className="px-4 py-3">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-forest-900">
                      {item.libelle}
                      {item.statut === "a_venir" && <Badge ton="attente">À venir</Badge>}
                    </p>
                    {item.description && <p className="mt-0.5 text-sm text-ink-700/70">{item.description}</p>}
                    <p className="mt-1 text-xs text-ink-700/55"><span className="font-semibold">Accès :</span> {roles}</p>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
      </section>

      {/* 6 — LMS */}
      <section id="lms" className="space-y-4 scroll-mt-24">
        <div className="flex items-center gap-2">
          <Compass size={20} className="text-gold-500" />
          <h2 className="font-display text-xl font-black text-forest-900">6 · Aide et Formation (LMS) en profondeur</h2>
        </div>
        <Card className="flex flex-wrap gap-4 border-gold-200 bg-gold-50/40 text-xs font-semibold text-forest-800">
          <span className="inline-flex items-center gap-1.5"><BookOpen size={14} className="text-forest-600" /> Cours & leçons</span>
          <span className="inline-flex items-center gap-1.5"><FileCheck2 size={14} className="text-forest-600" /> Quiz & devoirs</span>
          <span className="inline-flex items-center gap-1.5"><Compass size={14} className="text-forest-600" /> Parcours</span>
          <span className="inline-flex items-center gap-1.5"><Award size={14} className="text-forest-600" /> Badges & certificats</span>
        </Card>
        <div className="space-y-2">
          <h3 className="font-display text-base font-bold text-forest-900">Le parcours de l&apos;apprenant, en un coup d&apos;œil</h3>
          <Card><FluxLMS /></Card>
        </div>
        {LMS_SUJETS.map((s, i) => (
          <div key={i} className="space-y-2">
            <h3 className="font-display text-base font-bold text-forest-900">{s.titre}</h3>
            <Card className="space-y-4">{s.blocs.map((b, j) => <BlocVue key={j} b={b} />)}</Card>
          </div>
        ))}
        <div className="space-y-2">
          <h3 className="font-display text-base font-bold text-forest-900">À quoi ressemble l&apos;attestation</h3>
          <Card><MaquetteAttestation /></Card>
        </div>
      </section>

      <p className="pt-2 text-center text-xs text-ink-700/50">
        EduWeb Planner · Guide d&apos;utilisation — utilisez « Imprimer / PDF » pour conserver ce guide.
      </p>
    </div>
  );
}
