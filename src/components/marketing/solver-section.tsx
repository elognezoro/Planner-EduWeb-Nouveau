"use client";

import { motion, type Variants } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  MoveHorizontal,
  Cpu,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Container } from "@/components/ui/container";

/* ── Animations (motif de révélation commun à la charte) ───────────── */
const conteneur: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};
const enfant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.21, 0.5, 0.27, 1] },
  },
};
const grilleParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.25 } },
};
const cellule: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.21, 0.5, 0.27, 1] },
  },
};

/* ── Données (sens conservé à l'identique) ─────────────────────────── */
const etapes = [
  {
    num: "01",
    icone: Cpu,
    titre: "Solveur à backtracking",
    texte:
      "Pas un algorithme glouton : le moteur revient en arrière sur ses choix et explore des alternatives, avec des heuristiques qui placent d'abord les créneaux les plus contraints.",
  },
  {
    num: "02",
    icone: AlertTriangle,
    titre: "Aucun planning incomplet silencieux",
    texte:
      "En cas de sur-contrainte, le système n'invente rien : il identifie et affiche explicitement le point de blocage pour que vous sachiez quoi ajuster.",
  },
  {
    num: "03",
    icone: MoveHorizontal,
    titre: "Ajustement par glisser-déposer",
    texte:
      "Après génération, chaque déplacement manuel re-vérifie les contraintes dures en temps réel — impossible de valider un conflit.",
  },
];

const contraintesDures = [
  "Unicité enseignant · classe · salle sur un même créneau",
  "Volume horaire hebdomadaire par matière et niveau",
  "Disponibilités déclarées des enseignants",
  "Capacité de salle ≥ effectif de la classe",
  "Compatibilité salle / matière (labo, salle informatique…)",
  "Double vacation : créneaux disjoints, pression sur les salles",
];

/* Petite grille d'illustration (décorative, cohérente avec le hero). */
const jours = ["L", "M", "M", "J", "V"];
type Cellule = { m: string; etat?: "solving" | "vide" };
const grille: Cellule[] = [
  { m: "Maths" }, { m: "Fr." }, { m: "Hist." }, { m: "Angl." }, { m: "SVT" },
  { m: "EPS" }, { m: "SVT" }, { m: "Maths", etat: "solving" }, { m: "", etat: "vide" }, { m: "Fr." },
  { m: "Angl." }, { m: "Hist." }, { m: "Maths" }, { m: "EPS" }, { m: "SVT" },
];
const couleurMatiere: Record<string, string> = {
  Maths: "bg-gold-300/90 text-forest-950",
  SVT: "bg-forest-300/85 text-forest-950",
  "Fr.": "bg-cream-100/95 text-forest-800",
  "Angl.": "bg-forest-400/70 text-cream-50",
  "Hist.": "bg-gold-200/85 text-forest-950",
  EPS: "bg-cream-200/90 text-forest-800",
};

export function SolverSection() {
  return (
    <section id="solveur" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      {/* Halos d'ambiance sur fond clair */}
      <div
        className="pointer-events-none absolute -left-40 top-24 h-[30rem] w-[30rem] rounded-full bg-gold-200/25 blur-[130px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-forest-200/30 blur-[130px]"
        aria-hidden
      />

      <Container className="relative">
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          {/* ── Colonne texte : eyebrow, titre, procédé en 3 étapes ── */}
          <motion.div
            variants={conteneur}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            <motion.span
              variants={enfant}
              className="inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-gold-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700"
            >
              <Cpu size={14} />
              Zoom sur un module
            </motion.span>

            <motion.h2
              variants={enfant}
              className="mt-5 font-display text-3xl font-bold tracking-tight text-balance text-forest-900 sm:text-4xl"
            >
              Des emplois du temps qui tiennent face au{" "}
              <span className="text-gold-gradient">terrain réel</span>
            </motion.h2>

            <motion.p
              variants={enfant}
              className="mt-4 max-w-xl text-lg leading-relaxed text-ink-700/80"
            >
              Effectifs élevés, pénurie de salles spécialisées, double vacation : les
              situations qui bloquent un algorithme naïf. EduWeb Planner les résout par un
              vrai solveur de contraintes.
            </motion.p>

            {/* Procédé : rail vertical + étapes numérotées */}
            <div className="relative mt-10 space-y-3">
              <div
                className="absolute bottom-6 left-9 top-6 w-px bg-gradient-to-b from-gold-400/60 via-forest-300/50 to-transparent"
                aria-hidden
              />
              {etapes.map((e) => (
                <motion.div
                  key={e.titre}
                  variants={enfant}
                  className="group relative flex gap-4 rounded-2xl border border-transparent p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-cream-200 hover:bg-white/70 hover:shadow-soft"
                >
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 text-gold-300 shadow-[0_10px_24px_-10px_rgba(15,53,39,0.6)] transition-transform duration-300 group-hover:scale-105">
                    <e.icone size={20} />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 text-[0.55rem] font-bold text-forest-950 ring-2 ring-background">
                      {e.num}
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <h3 className="font-display font-bold text-forest-900">{e.titre}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-700/75">{e.texte}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ── Colonne visuelle : console sombre du solveur ── */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.21, 0.5, 0.27, 1] }}
            className="relative"
          >
            <div
              className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-gold-500/15 via-transparent to-forest-500/15 blur-2xl"
              aria-hidden
            />

            <div className="relative overflow-hidden rounded-3xl border border-forest-800/50 bg-gradient-to-br from-forest-900 to-forest-950 p-5 shadow-[0_30px_90px_-35px_rgba(7,31,23,0.85)] sm:p-6">
              <div className="absolute inset-0 bg-grid-forest opacity-30" aria-hidden />
              <div
                className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold-500/10 blur-3xl"
                aria-hidden
              />

              <div className="relative">
                {/* Barre de fenêtre */}
                <div className="flex items-center gap-2 border-b border-cream-50/10 pb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-gold-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-forest-300/80" />
                  <span className="ml-2 text-xs font-medium text-cream-200/60">
                    EduWeb Planner · Solveur
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-500/10 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-gold-200">
                    <RotateCcw size={11} className="animate-spin [animation-duration:3s]" />
                    Backtracking
                  </span>
                </div>

                {/* Mini-grille d'emploi du temps (illustration) */}
                <div className="mt-4" aria-hidden>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-cream-200/70">
                      Emploi du temps · 4ᵉ A
                    </p>
                    <span className="text-[0.6rem] text-gold-200/80">résolution…</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {jours.map((j, i) => (
                      <span
                        key={`${j}-${i}`}
                        className="pb-0.5 text-center text-[0.6rem] font-semibold text-cream-200/45"
                      >
                        {j}
                      </span>
                    ))}
                  </div>

                  <motion.div
                    variants={grilleParent}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-40px" }}
                    className="mt-1 grid grid-cols-5 gap-1.5"
                  >
                    {grille.map((c, i) =>
                      c.etat === "vide" ? (
                        <motion.span
                          key={i}
                          variants={cellule}
                          className="flex h-7 items-center justify-center rounded-md border border-dashed border-cream-50/20 text-[0.6rem] text-cream-200/30"
                        >
                          ·
                        </motion.span>
                      ) : c.etat === "solving" ? (
                        <motion.span
                          key={i}
                          variants={cellule}
                          className="relative flex h-7 animate-pulse items-center justify-center rounded-md bg-forest-800/60 text-[0.6rem] font-semibold text-gold-200 ring-2 ring-gold-300/80"
                        >
                          {c.m}
                          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold-300 ring-2 ring-forest-950" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key={i}
                          variants={cellule}
                          className={`flex h-7 items-center justify-center rounded-md text-[0.6rem] font-semibold ${couleurMatiere[c.m] ?? "bg-cream-100/90 text-forest-800"}`}
                        >
                          {c.m}
                        </motion.span>
                      ),
                    )}
                  </motion.div>

                  {/* Légende */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.6rem] text-cream-200/55">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gold-300" /> Placé
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full ring-2 ring-gold-300/80" /> En cours
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <RotateCcw size={10} /> Créneau réattribué après conflit
                    </span>
                  </div>
                </div>

                {/* Contraintes dures */}
                <div className="mt-5 border-t border-cream-50/10 pt-4">
                  <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-cream-100">
                    <ShieldCheck size={15} className="text-forest-300" />
                    Contraintes dures — jamais violées
                  </p>
                  <ul className="mt-3 space-y-2">
                    {contraintesDures.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-2.5 text-[0.8rem] leading-snug text-cream-200/80"
                      >
                        <CheckCircle2
                          size={15}
                          className="mt-0.5 shrink-0 text-forest-300"
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Exemple de blocage signalé */}
                <div className="mt-5 rounded-2xl border border-gold-400/25 bg-gradient-to-br from-gold-500/12 to-forest-900/40 p-4">
                  <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-wider text-gold-200">
                    <AlertTriangle size={14} />
                    Exemple de blocage signalé
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-cream-100/85">
                    « Impossible de satisfaire le volume horaire de SVT pour la 4ᵉ B : 1 seul
                    laboratoire disponible pour 6 classes sur le créneau commun. »
                  </p>
                </div>
              </div>
            </div>

            {/* Puce flottante décorative (desktop) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="animate-float absolute -left-5 -bottom-5 z-20 hidden items-center gap-2.5 rounded-2xl border border-cream-200 bg-cream-50/95 px-3.5 py-2.5 shadow-[0_18px_50px_-18px_rgba(15,53,39,0.5)] backdrop-blur-xl lg:flex"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-800 text-gold-300">
                <ShieldCheck size={17} />
              </span>
              <div className="leading-tight">
                <p className="text-[0.72rem] font-bold text-forest-900">Zéro conflit</p>
                <p className="text-[0.62rem] text-ink-700/60">contraintes vérifiées</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
