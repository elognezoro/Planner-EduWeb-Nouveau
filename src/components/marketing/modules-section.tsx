"use client";

import { motion, type Variants } from "motion/react";
import {
  CalendarDays,
  GraduationCap,
  Stamp,
  BarChart3,
  Users,
  CreditCard,
  School,
  Bell,
  LayoutGrid,
  Sparkles,
  ShieldCheck,
  Database,
  Layers,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";

type Module = {
  icone: LucideIcon;
  titre: string;
  texte: string;
  phare?: boolean;
  /** Capacités mises en avant sur la carte phare (issues du texte, jamais inventées). */
  tags?: string[];
};

const modules: Module[] = [
  {
    icone: CalendarDays,
    titre: "Emplois du temps",
    texte:
      "Génération automatique par solveur de contraintes, ajustement par glisser-déposer, contrôle des conflits en temps réel.",
    phare: true,
    tags: ["Solveur de contraintes", "Glisser-déposer", "Conflits en temps réel"],
  },
  {
    icone: School,
    titre: "Vie scolaire",
    texte:
      "Registre d'appel, cahier de texte, notes & bulletins, livret scolaire, rendez-vous et communication interne.",
  },
  {
    icone: Stamp,
    titre: "Inspection & supervision",
    texte:
      "Planification des visites, grilles d'évaluation, rapports d'inspection et suivi des recommandations.",
  },
  {
    icone: BarChart3,
    titre: "Statistiques & pilotage",
    texte:
      "Tableaux de bord par classe, établissement et région, indicateurs de performance et analytics visuels.",
  },
  {
    icone: GraduationCap,
    titre: "CAFOP & APFC",
    texte:
      "Gestion des structures de formation des maîtres et de formation continue, import de cohortes au format Moodle.",
  },
  {
    icone: Users,
    titre: "Comptes & habilitations",
    texte:
      "Inscription, confirmation par e-mail, demande de rôle approuvée par l'administration, gestion fine des périmètres.",
  },
  {
    icone: CreditCard,
    titre: "Facturation",
    texte:
      "Abonnements des établissements via Stripe, webhooks de synchronisation, gestion des échecs de paiement et reçus.",
  },
  {
    icone: Bell,
    titre: "Notifications & alertes",
    texte:
      "Centre de notifications unifié in-app, e-mails transactionnels et alertes SMS pour atteindre les familles.",
  },
];

/** Socle partagé par tous les modules — reprend « sécurité, données, expérience » du sous-titre. */
const socle = [
  { icone: ShieldCheck, texte: "Sécurité vérifiée côté serveur" },
  { icone: Database, texte: "Données cloisonnées par périmètre" },
  { icone: Layers, texte: "Expérience unifiée par rôle" },
];

const enteteParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};
const grilleParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const apparition: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.21, 0.5, 0.27, 1] },
  },
};

const revelation = {
  initial: "hidden" as const,
  whileInView: "visible" as const,
  viewport: { once: true, margin: "-80px" },
};

export function ModulesSection() {
  return (
    <section
      id="modules"
      className="relative scroll-mt-24 overflow-hidden bg-forest-950 py-24 text-cream-50 sm:py-32"
    >
      {/* Décor : grille + halos, cohérents avec le hero */}
      <div className="absolute inset-0 bg-grid-forest opacity-40" aria-hidden />
      <div
        className="absolute -top-24 right-[-6rem] h-[34rem] w-[34rem] rounded-full bg-gold-500/10 blur-[130px]"
        aria-hidden
      />
      <div
        className="absolute bottom-[-10rem] left-[-8rem] h-[30rem] w-[30rem] rounded-full bg-forest-400/15 blur-[130px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-forest-950 to-transparent"
        aria-hidden
      />

      <Container className="relative">
        {/* En-tête de section */}
        <motion.div
          variants={enteteParent}
          {...revelation}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.span
            variants={apparition}
            className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-forest-900/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur"
          >
            <LayoutGrid size={14} />
            Périmètre fonctionnel
          </motion.span>

          <motion.h2
            variants={apparition}
            className="mt-5 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            Huit domaines, une plateforme{" "}
            <span className="text-gold-gradient">cohérente</span>
          </motion.h2>

          <motion.p
            variants={apparition}
            className="mt-4 text-lg leading-relaxed text-cream-200/85"
          >
            Du pilotage national à la salle de classe, chaque module partage le même socle
            de sécurité, de données et d&apos;expérience.
          </motion.p>
        </motion.div>

        {/* Grille bento asymétrique — la carte phare occupe deux colonnes */}
        <motion.div
          variants={grilleParent}
          {...revelation}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {modules.map((m, i) => {
            const numero = String(i + 1).padStart(2, "0");

            if (m.phare) {
              return (
                <motion.article
                  key={m.titre}
                  variants={apparition}
                  className="group relative overflow-hidden rounded-2xl border border-gold-400/40 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-900 p-7 shadow-[var(--shadow-gold)] transition-all duration-300 hover:-translate-y-1.5 lg:col-span-2"
                >
                  {/* Lueur d'accent au survol */}
                  <div
                    className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 opacity-70 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/50 to-transparent" aria-hidden />

                  <span
                    className="absolute right-6 top-5 font-display text-5xl font-bold leading-none text-gold-300/15"
                    aria-hidden
                  >
                    {numero}
                  </span>

                  <div className="relative flex h-full flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
                    <div className="lg:w-[42%]">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-500/15 px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-gold-200">
                        <Sparkles size={12} />
                        Module phare
                      </span>
                      <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/20 text-gold-200 shadow-inner ring-1 ring-gold-400/30 transition-transform duration-300 group-hover:scale-105">
                        <m.icone size={26} />
                      </div>
                      <h3 className="mt-5 font-display text-2xl font-bold text-cream-50">
                        {m.titre}
                      </h3>
                    </div>

                    <div className="lg:flex-1">
                      <p className="text-[0.95rem] leading-relaxed text-cream-100/80">
                        {m.texte}
                      </p>
                      {m.tags && (
                        <ul className="mt-5 flex flex-wrap gap-2">
                          {m.tags.map((tag) => (
                            <li
                              key={tag}
                              className="rounded-full border border-cream-50/15 bg-forest-950/40 px-3 py-1 text-xs font-medium text-cream-100/80"
                            >
                              {tag}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            }

            return (
              <motion.article
                key={m.titre}
                variants={apparition}
                className="group relative h-full overflow-hidden rounded-2xl border border-cream-50/10 bg-forest-900/40 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-gold-400/40 hover:bg-forest-900/70"
              >
                {/* Lueur d'accent au survol */}
                <div
                  className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-400/15 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />

                <span
                  className="absolute right-5 top-4 font-display text-4xl font-bold leading-none text-cream-50/[0.07] transition-colors duration-300 group-hover:text-gold-300/25"
                  aria-hidden
                >
                  {numero}
                </span>

                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300 ring-1 ring-gold-400/15 transition-all duration-300 group-hover:bg-gold-500/20 group-hover:text-gold-200">
                    <m.icone size={22} />
                  </div>
                  <h3 className="mt-5 flex items-center gap-1.5 font-display text-lg font-bold text-cream-50">
                    {m.titre}
                    <ArrowUpRight
                      size={16}
                      className="translate-y-0.5 text-gold-300/0 transition-all duration-300 group-hover:-translate-y-0 group-hover:text-gold-300"
                      aria-hidden
                    />
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-cream-200/70">
                    {m.texte}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </motion.div>

        {/* Socle commun à tous les modules */}
        <motion.div
          variants={apparition}
          {...revelation}
          className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-cream-50/10 bg-forest-900/30 px-6 py-5 text-center backdrop-blur-sm sm:flex-row sm:justify-center sm:gap-10 sm:text-left"
        >
          {socle.map((s) => (
            <div key={s.texte} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/15 text-gold-300 ring-1 ring-gold-400/20">
                <s.icone size={16} />
              </span>
              <span className="text-sm font-medium text-cream-200/80">{s.texte}</span>
            </div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
