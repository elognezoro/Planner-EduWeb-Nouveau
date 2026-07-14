import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import {
  ROLES_ORDONNES,
  type DefinitionRole,
  type GroupeRole,
  type TypePortee,
} from "@/lib/rbac";
import {
  Layers,
  ShieldCheck,
  Eye,
  Landmark,
  GraduationCap,
  School,
  Users,
  Building2,
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  BarChart3,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

/* ─── Les trois piliers du principe directeur ─────────────────────────── */
const piliers = [
  {
    icone: Layers,
    titre: "Une interface unique",
    texte:
      "Pas une application par profil, mais une seule plateforme dont chaque page, menu et donnée s'adapte au rôle connecté.",
  },
  {
    icone: ShieldCheck,
    titre: "Sécurité par périmètre",
    texte:
      "Chaque rôle porte un périmètre — établissement, région, structure. Deux utilisateurs d'un même rôle ne voient jamais les mêmes données.",
  },
  {
    icone: Eye,
    titre: "Mode Aperçu de rôle",
    texte:
      "Les administrateurs visualisent l'interface telle qu'elle apparaît pour un autre rôle, en lecture seule, pour tester et diagnostiquer.",
  },
] as const;

/* ─── Aperçu illustratif (la même interface, lue par un rôle) ──────────── */
const apercuRoles = ["Chef d'établissement", "Enseignant", "Parent"] as const;

const apercuMenu: { libelle: string; icone: LucideIcon }[] = [
  { libelle: "Tableau de bord", icone: LayoutDashboard },
  { libelle: "Vie scolaire", icone: BookOpen },
  { libelle: "Emplois du temps", icone: CalendarDays },
  { libelle: "Statistiques", icone: BarChart3 },
];

/* ─── Cartographie des rôles : regroupement par public cible ───────────── */
interface GroupeConf {
  libelle: string;
  sous: string;
  icone: LucideIcon;
  tile: string;
  puce: string;
}

const groupes: Record<GroupeRole, GroupeConf> = {
  pilotage: {
    libelle: "Pilotage",
    sous: "Direction & supervision",
    icone: Landmark,
    tile: "bg-forest-800 text-gold-300",
    puce: "border-forest-200 bg-forest-50 text-forest-800",
  },
  formation: {
    libelle: "Formation",
    sous: "Structures de formation",
    icone: GraduationCap,
    tile: "bg-gradient-to-br from-gold-300 to-gold-500 text-forest-950",
    puce: "border-gold-200 bg-gold-50 text-gold-800",
  },
  etablissement: {
    libelle: "Établissement",
    sous: "Au sein de l'établissement",
    icone: School,
    tile: "bg-forest-700 text-cream-50",
    puce: "border-forest-200 bg-cream-100 text-forest-800",
  },
  famille: {
    libelle: "Famille",
    sous: "Élèves & parents",
    icone: Users,
    tile: "bg-ink-800 text-cream-50",
    puce: "border-cream-300 bg-cream-50 text-ink-700",
  },
};

const ordreGroupes: GroupeRole[] = ["pilotage", "formation", "etablissement", "famille"];

/** Libellé lisible du périmètre, affiché sur chaque puce de rôle. */
const portees: Record<TypePortee, string> = {
  global: "International",
  pays: "Pays",
  diocese: "Diocèse",
  region: "Région",
  etablissement: "Établissement",
  cafop: "CAFOP",
  apfc: "APFC",
  antenne: "Antenne",
  personnel: "Personnel",
};

/** Rôles regroupés par public (déjà triés par rang décroissant dans ROLES_ORDONNES). */
const rolesParGroupe: Record<GroupeRole, DefinitionRole[]> = {
  pilotage: ROLES_ORDONNES.filter((r) => r.groupe === "pilotage"),
  formation: ROLES_ORDONNES.filter((r) => r.groupe === "formation"),
  etablissement: ROLES_ORDONNES.filter((r) => r.groupe === "etablissement"),
  famille: ROLES_ORDONNES.filter((r) => r.groupe === "famille"),
};

const totalRoles = ROLES_ORDONNES.length;

export function PlatformSection() {
  return (
    <section id="plateforme" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      {/* Halos décoratifs discrets sur fond clair */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-24 right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-gold-200/25 blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-[26rem] w-[26rem] rounded-full bg-forest-200/40 blur-[130px]" />
      </div>

      <Container className="relative">
        {/* En-tête éditorial aligné à gauche */}
        <div className="max-w-2xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-gold-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
              <ShieldCheck size={14} />
              Le principe directeur
            </span>
          </Reveal>
          <Reveal delayIndex={1}>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-balance text-forest-900 sm:text-4xl">
              Une seule interface, <span className="text-gold-gradient">pilotée par le rôle</span>
            </h2>
          </Reveal>
          <Reveal delayIndex={2}>
            <p className="mt-4 text-lg leading-relaxed text-ink-700/80">
              EduWeb Planner repose sur un contrôle d&apos;accès basé sur les rôles (RBAC) à
              périmètre. C&apos;est le cœur du système : chaque module s&apos;appuie sur cette
              couche unique et centralisée.
            </p>
          </Reveal>
        </div>

        {/* Bloc asymétrique : démonstration à gauche, piliers à droite */}
        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Panneau sombre — la même interface lue par un rôle */}
          <Reveal>
            <div className="relative h-full">
              <div className="relative h-full overflow-hidden rounded-3xl border border-forest-800/60 bg-gradient-to-br from-forest-900 to-forest-950 p-6 shadow-[0_30px_80px_-40px_rgba(7,31,23,0.9)] sm:p-8">
                <div className="absolute inset-0 bg-grid-forest opacity-40" aria-hidden />
                <div
                  className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/15 blur-3xl"
                  aria-hidden
                />

                <div className="relative">
                  {/* Chrome de fenêtre */}
                  <div className="flex items-center gap-2 border-b border-cream-50/10 pb-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-gold-300/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-forest-300/80" />
                    <span className="ml-2 text-xs font-medium text-cream-200/60">
                      EduWeb Planner · une interface
                    </span>
                  </div>

                  {/* Rôle actif */}
                  <p className="mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold-200/80">
                    Rôle actif
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {apercuRoles.map((r, i) => (
                      <span
                        key={r}
                        className={
                          i === 0
                            ? "rounded-full bg-gold-300/90 px-3 py-1 text-xs font-semibold text-forest-950"
                            : "rounded-full border border-cream-50/15 px-3 py-1 text-xs font-medium text-cream-200/60"
                        }
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  {/* Périmètre */}
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-cream-50/10 bg-forest-950/50 px-3 py-2 text-xs text-cream-200/70">
                    <Building2 size={14} className="shrink-0 text-forest-300" />
                    <span>
                      Périmètre —{" "}
                      <span className="font-semibold text-cream-100">Lycée Moderne, Abidjan</span>
                    </span>
                  </div>

                  {/* Menu adapté au rôle */}
                  <p className="mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-cream-200/45">
                    Menu adapté au rôle
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {apercuMenu.map((m, i) => (
                      <div
                        key={m.libelle}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.72rem] font-medium ${
                          i === 0 ? "bg-gold-500/15 text-gold-200" : "text-cream-200/55"
                        }`}
                      >
                        <m.icone size={14} className="shrink-0" />
                        <span className="truncate">{m.libelle}</span>
                        {i === 0 && (
                          <ChevronRight size={13} className="ml-auto shrink-0 text-gold-300" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Puce flottante — vérification serveur */}
              <div className="animate-float absolute -right-2 bottom-6 hidden items-center gap-2 rounded-2xl border border-cream-50/15 bg-forest-900/85 px-3 py-2 shadow-2xl backdrop-blur-xl sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-forest-500/25 text-forest-200">
                  <ShieldCheck size={16} />
                </span>
                <div className="leading-tight">
                  <p className="text-[0.7rem] font-semibold text-cream-50">Vérifié côté serveur</p>
                  <p className="text-[0.6rem] text-cream-200/60">jamais masqué côté client</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Les trois piliers, empilés */}
          <div className="grid gap-4">
            {piliers.map((p, i) => (
              <Reveal key={p.titre} delayIndex={i} as="article">
                <div className="group relative h-full overflow-hidden rounded-2xl border border-cream-200 bg-gradient-to-br from-white to-cream-50 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-1 -top-5 select-none font-display text-7xl font-bold text-forest-900/[0.04]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="relative flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-800 text-gold-300 transition-colors group-hover:bg-forest-700">
                      <p.icone size={20} />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-forest-900">{p.titre}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-700/80">{p.texte}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Cartographie des rôles — bandes par public cible */}
        <Reveal delayIndex={1}>
          <div className="mt-8 rounded-3xl border border-cream-200 bg-gradient-to-b from-cream-50 to-white p-6 shadow-soft sm:p-9">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
                  Cartographie des accès
                </p>
                <h3 className="mt-2 font-display text-2xl font-bold text-forest-900">
                  {totalRoles} rôles, chacun son périmètre
                </h3>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-ink-700/70">
                Regroupés par public — du pilotage national à la famille. La couleur et le
                périmètre indiqués gouvernent ce que chacun peut voir et faire.
              </p>
            </div>

            <div className="mt-7 divide-y divide-cream-200">
              {ordreGroupes.map((g, gi) => {
                const conf = groupes[g];
                const roles = rolesParGroupe[g];
                if (roles.length === 0) return null;
                return (
                  <Reveal key={g} delayIndex={gi} as="div">
                    <div className="grid gap-4 py-5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-start">
                      {/* En-tête du groupe */}
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${conf.tile}`}
                        >
                          <conf.icone size={19} />
                        </span>
                        <div>
                          <p className="font-display text-base font-bold text-forest-900">
                            {conf.libelle}
                          </p>
                          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-ink-700/55">
                            {roles.length} rôle{roles.length > 1 ? "s" : ""} · {conf.sous}
                          </p>
                        </div>
                      </div>

                      {/* Puces de rôles */}
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <span
                            key={role.id}
                            title={role.description}
                            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-transform duration-200 hover:-translate-y-0.5 ${conf.puce}`}
                          >
                            {role.libelle}
                            <span className="text-[0.62rem] uppercase tracking-wide opacity-60">
                              {portees[role.portee]}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
