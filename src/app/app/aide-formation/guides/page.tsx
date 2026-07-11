import type { Metadata } from "next";
import type { ComponentType } from "react";
import {
  Rocket,
  UserCircle,
  School,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Guides d'utilisateurs — Aide et Formation" };

interface Guide {
  icone: ComponentType<{ size?: number; className?: string }>;
  titre: string;
  intro: string;
  etapes: string[];
}

const GUIDES: Guide[] = [
  {
    icone: Rocket,
    titre: "Prise en main",
    intro: "Créer son compte, confirmer son adresse et obtenir son rôle.",
    etapes: [
      "S'inscrire avec e-mail, mot de passe et rôle souhaité (l'établissement/structure est déclaré).",
      "Confirmer l'adresse via le lien reçu par e-mail : le compte devient actif immédiatement.",
      "En attendant l'approbation du rôle, l'accès est limité à « Mon Identification » et « Mon Profil ».",
      "À l'approbation par l'administrateur, le rôle et son périmètre sont activés et l'accès s'ouvre.",
    ],
  },
  {
    icone: UserCircle,
    titre: "Mon compte",
    intro: "Gérer ses informations personnelles et sa sécurité.",
    etapes: [
      "« Mon Identification » : récapitulatif du compte et statut de la demande de rôle.",
      "« Mon Profil » : coordonnées, pays, langue et préférences d'affichage.",
      "Modifier son mot de passe depuis le bloc dédié du profil.",
    ],
  },
  {
    icone: School,
    titre: "Configurer un établissement",
    intro: "Poser les fondations avant de générer les emplois du temps.",
    etapes: [
      "Renseigner la fiche : pays, ministère, armoiries, en-tête officiel du bulletin.",
      "Définir la structure : niveaux, classes, salles (capacité et type), disciplines.",
      "Saisir les effectifs par niveau, puis générer les classes et les comptes élèves.",
      "Déclarer les compétences des enseignants (monovalents / bivalents).",
    ],
  },
  {
    icone: CalendarClock,
    titre: "Emplois du temps",
    intro: "Générer un planning conforme aux contraintes, puis l'ajuster.",
    etapes: [
      "Vérifier la grille horaire nationale (modifiable) et les régimes de vacation.",
      "Paramétrer les contraintes : double vacation, plages EPS, repos enseignant, heures creuses.",
      "Lancer la génération : en cas de sur-contrainte, les blocages sont affichés explicitement.",
      "Ajuster par glisser-déposer ; les conflits sont refusés en temps réel. Imprimer / envoyer par e-mail.",
    ],
  },
  {
    icone: ClipboardList,
    titre: "Vie scolaire",
    intro: "Registre d'appel, cahier de texte et notes & bulletins.",
    etapes: [
      "Registre d'appel : marquer présences/absences/retards, justifier, alerter les parents.",
      "Cahier de texte : consigner les séances (titre, sous-titres, objectifs, travail à faire).",
      "Notes & bulletins : saisir par classe, discipline et période, puis générer les bulletins.",
    ],
  },
  {
    icone: GraduationCap,
    titre: "CAFOP & APFC",
    intro: "Formation des élèves-maîtres et sessions de formation continue.",
    etapes: [
      "Gérer les promotions et les groupes-classes ; importer les listes (CSV Moodle).",
      "Saisir les notes des élèves-maîtres par module et par semestre.",
      "Renseigner conduite, professeurs principaux et générer les bulletins officiels.",
    ],
  },
  {
    icone: ShieldCheck,
    titre: "Rôles & habilitations",
    intro: "Comprendre qui voit et gère quoi (rôle + périmètre).",
    etapes: [
      "Chaque compte possède un rôle ET un périmètre : deux mêmes rôles de périmètres différents ne voient pas les mêmes données.",
      "« Habilitations » : attribuer un rôle et son rattachement (établissement, CAFOP, APFC, pays).",
      "Le mode « Aperçu de rôle » permet de visualiser l'interface d'un autre rôle, en lecture seule.",
    ],
  },
];

export default async function GuidesPage() {
  await requireUtilisateur();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Guides d'utilisateurs et formation à l'utilisation"
        description="Des guides pratiques pour prendre en main EduWeb Planner, module par module."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => {
          const Icone = g.icone;
          return (
            <Card key={g.titre} className="flex flex-col">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <Icone size={18} />
                </span>
                <h2 className="font-display text-base font-bold text-forest-900">{g.titre}</h2>
              </div>
              <p className="mb-3 text-sm text-ink-700/70">{g.intro}</p>
              <ol className="mt-auto space-y-2">
                {g.etapes.map((e, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-ink-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream-200 text-[0.7rem] font-bold text-forest-800">
                      {i + 1}
                    </span>
                    <span>{e}</span>
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>

      <Card className="flex flex-col items-start gap-2 border-gold-200 bg-gold-50/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy size={22} className="shrink-0 text-gold-600" />
          <div>
            <p className="text-sm font-semibold text-forest-900">Besoin d&apos;un accompagnement ?</p>
            <p className="text-sm text-ink-700/70">
              Consultez la page <span className="font-semibold">Formations</span> pour les sessions de prise en main,
              ou contactez votre administrateur.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
