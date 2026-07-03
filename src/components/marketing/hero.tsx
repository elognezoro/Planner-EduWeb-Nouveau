"use client";

import { motion, type Variants } from "motion/react";
import {
  ArrowRight,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  BarChart3,
  Stamp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TraficLive } from "@/components/marketing/trafic-live";

const conteneur: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const enfant: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.21, 0.5, 0.27, 1] } },
};

const stats = [
  { valeur: "13", libelle: "rôles, une seule interface" },
  { valeur: "8", libelle: "domaines fonctionnels" },
  { valeur: "100%", libelle: "vérification côté serveur" },
];

// Modules de la mini-barre latérale (aperçu de l'application).
const modulesApercu = [
  { libelle: "Tableau de bord", icone: LayoutDashboard },
  { libelle: "Vie scolaire", icone: BookOpen },
  { libelle: "Emplois du temps", icone: CalendarDays },
  { libelle: "Statistiques", icone: BarChart3 },
  { libelle: "Inspection", icone: Stamp },
];

const tuiles = [
  { valeur: "1 248", libelle: "élèves suivis" },
  { valeur: "24", libelle: "classes actives" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-forest-950 via-forest-900 to-forest-950 text-cream-50">
      <div className="absolute inset-0 bg-grid-forest opacity-40" aria-hidden />
      <div
        className="absolute -top-32 right-0 h-[36rem] w-[36rem] rounded-full bg-gold-500/15 blur-[120px]"
        aria-hidden
      />
      <div
        className="absolute -bottom-40 -left-24 h-[32rem] w-[32rem] rounded-full bg-forest-400/20 blur-[120px]"
        aria-hidden
      />

      <Container className="relative grid items-center gap-14 pb-24 pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-44">
        <motion.div variants={conteneur} initial="hidden" animate="visible">
          <motion.span
            variants={enfant}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-gold-400/30 bg-forest-900/60 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-gold-200 backdrop-blur sm:text-xs sm:tracking-[0.2em]"
          >
            <Sparkles size={14} />
            Plateforme internationale · Management d&apos;établissements scolaires
          </motion.span>

          <motion.h1
            variants={enfant}
            className="mt-7 font-display text-4xl font-bold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Toute la gestion scolaire,{" "}
            <span className="text-gold-gradient">dans une seule plateforme</span>, de la
            classe à la nation.
          </motion.h1>

          <motion.p
            variants={enfant}
            className="mt-6 max-w-xl text-lg leading-relaxed text-cream-200/90"
          >
            Vie scolaire, notes et bulletins, inspection, statistiques, gestion des
            structures de formation, facturation — et la génération automatique des emplois
            du temps. Le tout dans une interface unique qui s&apos;adapte à chaque rôle.
          </motion.p>

          <motion.div variants={enfant} className="mt-9 flex flex-wrap items-center gap-4">
            <Button href="/inscription" variant="gold" size="lg">
              Créer un compte
              <ArrowRight size={18} />
            </Button>
            <Button
              href="#modules"
              variant="outline"
              size="lg"
              className="border-cream-50/20 bg-white/5 text-cream-50 hover:border-cream-50/40 hover:bg-white/10"
            >
              Explorer les modules
            </Button>
          </motion.div>

          <motion.dl
            variants={enfant}
            className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-cream-50/10 pt-8"
          >
            {stats.map((s) => (
              <div key={s.libelle}>
                <dt className="font-display text-3xl font-bold text-gold-300">{s.valeur}</dt>
                <dd className="mt-1 text-xs leading-snug text-cream-200/70">{s.libelle}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* Visuel : trafic temps réel + aperçu de l'application */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.21, 0.5, 0.27, 1] }}
          className="relative mx-auto w-full max-w-md"
        >
          {/* Compteur de visites + diagramme des connexions/visites en direct */}
          <TraficLive />

          <div className="rounded-3xl border border-cream-50/15 bg-forest-900/50 p-4 shadow-2xl backdrop-blur-xl">
            {/* Barre de fenêtre */}
            <div className="flex items-center gap-2 border-b border-cream-50/10 pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-forest-300/80" />
              <span className="ml-2 text-xs font-medium text-cream-200/60">
                EduWeb Planner · Tableau de bord
              </span>
            </div>

            <div className="mt-3 grid grid-cols-[7.5rem_1fr] gap-3">
              {/* Mini barre latérale : plusieurs modules */}
              <div className="space-y-1">
                {modulesApercu.map((m, i) => (
                  <motion.div
                    key={m.libelle}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + i * 0.07 }}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.68rem] font-medium ${
                      i === 0
                        ? "bg-gold-500/20 text-gold-200"
                        : "text-cream-200/55"
                    }`}
                  >
                    <m.icone size={13} className="shrink-0" />
                    <span className="truncate">{m.libelle}</span>
                  </motion.div>
                ))}
              </div>

              {/* Contenu : KPI + un aperçu d'emploi du temps parmi les modules */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {tuiles.map((t, i) => (
                    <motion.div
                      key={t.libelle}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.9 + i * 0.1 }}
                      className="rounded-xl border border-cream-50/10 bg-forest-950/40 p-2.5"
                    >
                      <p className="font-display text-lg font-bold text-cream-50">{t.valeur}</p>
                      <p className="text-[0.6rem] text-cream-200/55">{t.libelle}</p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 1.1 }}
                  className="rounded-xl border border-cream-50/10 bg-forest-950/40 p-2.5"
                >
                  <p className="mb-1.5 flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-gold-200/80">
                    <CalendarDays size={11} /> Emploi du temps · 4ᵉ A
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["Maths", "SVT", "EPS", "Fr.", "Angl.", "Hist."].map((mat, i) => (
                      <span
                        key={i}
                        className={`rounded-md py-1 text-center text-[0.6rem] font-semibold ${
                          i % 3 === 0
                            ? "bg-gold-300/85 text-forest-950"
                            : i % 3 === 1
                              ? "bg-forest-300/80 text-forest-950"
                              : "bg-cream-100/90 text-forest-800"
                        }`}
                      >
                        {mat}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute -right-6 -top-6 h-20 w-20 rounded-2xl border border-gold-400/30 bg-gold-500/10 backdrop-blur"
            style={{ animation: "var(--animate-float)" }}
          />
        </motion.div>
      </Container>
    </section>
  );
}
