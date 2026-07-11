import type { Metadata } from "next";
import type { ComponentType } from "react";
import { Video, Presentation, MonitorPlay, Users, Clock, CalendarCheck } from "lucide-react";
import { requireUtilisateur } from "@/lib/auth/session";
import { PageHeader, Card, Badge } from "@/components/app/ui";

export const metadata: Metadata = { title: "Formations — Aide et Formation" };

interface Formation {
  icone: ComponentType<{ size?: number; className?: string }>;
  titre: string;
  description: string;
  format: string;
  public: string;
  duree: string;
  statut: "programmee" | "a_la_demande" | "a_venir";
}

const FORMATIONS: Formation[] = [
  {
    icone: Video,
    titre: "Découverte d'EduWeb Planner",
    description: "Tour d'horizon de la plateforme : navigation, rôles, tableau de bord et bonnes pratiques.",
    format: "Webinaire",
    public: "Tous les utilisateurs",
    duree: "1 h",
    statut: "programmee",
  },
  {
    icone: Presentation,
    titre: "Configurer un établissement",
    description: "Fiche officielle, structure (niveaux, classes, salles), disciplines et effectifs.",
    format: "Atelier",
    public: "Chef d'établissement · Admin Établissements",
    duree: "1 h 30",
    statut: "programmee",
  },
  {
    icone: Presentation,
    titre: "Générer les emplois du temps",
    description: "Grille nationale, contraintes (vacation, EPS, repos), génération, diagnostic des blocages et ajustement.",
    format: "Atelier",
    public: "Chef · Adjoint au chef",
    duree: "2 h",
    statut: "a_la_demande",
  },
  {
    icone: MonitorPlay,
    titre: "Vie scolaire au quotidien",
    description: "Registre d'appel, cahier de texte, notes & bulletins, alertes aux parents.",
    format: "Atelier",
    public: "Éducateur · Enseignant",
    duree: "1 h 30",
    statut: "a_la_demande",
  },
  {
    icone: Presentation,
    titre: "Gestion CAFOP & APFC",
    description: "Promotions, import des listes, notes des élèves-maîtres et bulletins officiels.",
    format: "Atelier",
    public: "Admin CAFOP · Admin APFC",
    duree: "1 h 30",
    statut: "a_venir",
  },
  {
    icone: MonitorPlay,
    titre: "Administration & habilitations",
    description: "Rôles et périmètres, habilitations, approbations, journal d'activité.",
    format: "Session",
    public: "Administrateurs",
    duree: "1 h",
    statut: "a_la_demande",
  },
];

const STATUT: Record<Formation["statut"], { libelle: string; ton: "succes" | "attente" | "neutre" }> = {
  programmee: { libelle: "Sur inscription", ton: "succes" },
  a_la_demande: { libelle: "À la demande", ton: "neutre" },
  a_venir: { libelle: "Bientôt", ton: "attente" },
};

export default async function FormationsPage() {
  await requireUtilisateur();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Formations"
        description="Sessions de formation à l'utilisation d'EduWeb Planner — en ligne ou en atelier, selon votre rôle."
      />

      <Card className="border-forest-200 bg-forest-50/40">
        <p className="text-sm text-ink-700/80">
          Les formations sont proposées sous forme de <span className="font-semibold">webinaires</span> et
          d&apos;<span className="font-semibold">ateliers pratiques</span>. Certaines sont programmées sur inscription,
          d&apos;autres organisées <span className="font-semibold">à la demande</span> pour votre établissement ou
          votre structure. Rapprochez-vous de votre administrateur pour planifier une session.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {FORMATIONS.map((f) => {
          const Icone = f.icone;
          const s = STATUT[f.statut];
          return (
            <Card key={f.titre} className="flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                    <Icone size={18} />
                  </span>
                  <h2 className="font-display text-base font-bold text-forest-900">{f.titre}</h2>
                </div>
                <Badge ton={s.ton}>{s.libelle}</Badge>
              </div>
              <p className="mb-3 text-sm text-ink-700/70">{f.description}</p>
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-cream-100 pt-3 text-xs text-ink-700/70">
                <span className="inline-flex items-center gap-1.5"><MonitorPlay size={13} className="text-forest-600" /> {f.format}</span>
                <span className="inline-flex items-center gap-1.5"><Users size={13} className="text-forest-600" /> {f.public}</span>
                <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-forest-600" /> {f.duree}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="flex items-center gap-3 border-gold-200 bg-gold-50/40">
        <CalendarCheck size={22} className="shrink-0 text-gold-600" />
        <p className="text-sm text-ink-700/80">
          <span className="font-semibold text-forest-900">Planifier une session&nbsp;:</span> le calendrier des
          formations programmées et l&apos;inscription en ligne seront bientôt disponibles ici. En attendant,
          contactez votre administrateur pour organiser une formation à la demande.
        </p>
      </Card>
    </div>
  );
}
