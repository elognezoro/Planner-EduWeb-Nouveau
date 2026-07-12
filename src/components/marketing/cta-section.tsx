"use client";

import { motion, type Variants } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  UserPlus,
  ClipboardList,
  BadgeCheck,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const conteneur: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const enfant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.21, 0.5, 0.27, 1] } },
};

/** Gages de réassurance affichés sous les boutons (fidèles au parcours réel). */
const garanties = [
  "Inscription 100 % gratuite",
  "Compte actif dès la confirmation",
  "Accès cloisonné par rôle et périmètre",
];

/** Les 3 étapes du parcours d'inscription (voir logique d'authentification). */
const etapes = [
  {
    icone: UserPlus,
    titre: "Créez votre compte",
    texte: "E-mail, mot de passe et confirmation par e-mail.",
  },
  {
    icone: ClipboardList,
    titre: "Déclarez le rôle souhaité",
    texte: "Avec votre établissement ou structure de rattachement.",
  },
  {
    icone: BadgeCheck,
    titre: "Accédez à votre espace",
    texte: "Dès l'approbation de votre demande de rôle.",
  },
];

export function CtaSection() {
  return (
    <section id="cta" className="scroll-mt-24 py-24 sm:py-28">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.21, 0.5, 0.27, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] border border-cream-50/10 bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 px-6 py-14 text-cream-50 shadow-[0_40px_120px_-40px_rgba(7,31,23,0.9)] sm:px-12 sm:py-16 lg:px-16"
        >
          {/* Décor : grille, halos, filet doré et fondu supérieur */}
          <div className="absolute inset-0 bg-grid-forest opacity-30" aria-hidden />
          <div
            className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-500/15 blur-[110px]"
            aria-hidden
          />
          <div
            className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-forest-400/20 blur-[120px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent"
            aria-hidden
          />

          <div className="relative grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            {/* Colonne gauche — message et actions */}
            <motion.div
              variants={conteneur}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
            >
              <motion.span
                variants={enfant}
                className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-forest-900/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur"
              >
                <Sparkles size={14} />
                Rejoignez la plateforme
              </motion.span>

              <motion.h2
                variants={enfant}
                className="mt-6 font-display text-3xl font-bold leading-[1.12] tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]"
              >
                Prêt à{" "}
                <span className="text-gold-gradient">digitaliser</span>{" "}
                votre établissement&nbsp;?
              </motion.h2>

              <motion.p
                variants={enfant}
                className="mt-5 max-w-xl text-lg leading-relaxed text-cream-200/85"
              >
                Créez votre compte, déclarez le rôle souhaité, et accédez à votre espace dès
                l&apos;approbation. L&apos;inscription est gratuite et l&apos;activation
                immédiate.
              </motion.p>

              <motion.div
                variants={enfant}
                className="mt-9 flex flex-wrap items-center gap-4"
              >
                <Button href="/inscription" variant="gold" size="lg">
                  Créer un compte
                  <ArrowRight size={18} />
                </Button>
                <Button
                  href="/connexion"
                  variant="outline"
                  size="lg"
                  className="border-cream-50/20 bg-white/5 text-cream-50 hover:border-cream-50/40 hover:bg-white/10"
                >
                  J&apos;ai déjà un compte
                </Button>
              </motion.div>

              <motion.ul
                variants={enfant}
                className="mt-8 flex flex-col gap-3 border-t border-cream-50/10 pt-7 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3"
              >
                {garanties.map((g) => (
                  <li key={g} className="flex items-center gap-2 text-sm text-cream-200/75">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-300">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {g}
                  </li>
                ))}
              </motion.ul>
            </motion.div>

            {/* Colonne droite — carte « verre » : parcours en 3 étapes */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.25, ease: [0.21, 0.5, 0.27, 1] }}
              className="relative mx-auto w-full max-w-md lg:mx-0"
            >
              {/* Halo doux derrière la carte */}
              <div
                className="absolute -inset-5 -z-10 rounded-[2.25rem] bg-gradient-to-br from-gold-500/10 via-transparent to-forest-400/10 blur-2xl"
                aria-hidden
              />

              <div className="rounded-3xl border border-cream-50/15 bg-forest-900/50 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
                {/* En-tête façon fenêtre applicative (cohérence hero) */}
                <div className="flex items-center gap-2 border-b border-cream-50/10 pb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-gold-300/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-forest-300/80" />
                  <span className="ml-2 text-xs font-medium text-cream-200/60">
                    EduWeb Planner · Inscription
                  </span>
                </div>

                <p className="mt-4 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-200/80">
                  <span className="h-px w-4 bg-gold-300/50" />
                  Votre parcours en 3 étapes
                </p>

                <ol className="mt-5 space-y-1">
                  {etapes.map((e, i) => {
                    const dernier = i === etapes.length - 1;
                    return (
                      <motion.li
                        key={e.titre}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 0.45, delay: 0.5 + i * 0.14 }}
                        className="relative flex gap-4"
                      >
                        {/* Pastille numérotée + trait de liaison (timeline) */}
                        <div className="flex flex-col items-center">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-forest-950/60 font-display text-sm font-bold text-gold-200">
                            {i + 1}
                          </span>
                          {!dernier && (
                            <span
                              className="mt-1 w-px flex-1 bg-gradient-to-b from-gold-400/30 to-transparent"
                              aria-hidden
                            />
                          )}
                        </div>

                        <div className={dernier ? "pb-1" : "pb-6"}>
                          <h3 className="flex items-center gap-2 font-semibold text-cream-50">
                            <e.icone size={15} className="text-forest-300" />
                            {e.titre}
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-cream-200/65">
                            {e.texte}
                          </p>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              </div>

              {/* Puce flottante décorative — « Compte activé » (desktop) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 1 }}
                className="animate-float absolute -right-4 -top-4 z-20 hidden items-center gap-2 rounded-2xl border border-cream-50/15 bg-forest-900/80 px-3 py-2 shadow-2xl backdrop-blur-xl lg:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold-400/20 text-gold-200">
                  <Zap size={16} />
                </span>
                <div className="leading-tight">
                  <p className="text-[0.7rem] font-semibold text-cream-50">Compte activé</p>
                  <p className="text-[0.6rem] text-cream-200/60">accès immédiat</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
