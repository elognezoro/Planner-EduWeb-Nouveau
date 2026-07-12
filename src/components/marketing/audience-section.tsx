"use client";

import { motion, type Variants } from "motion/react";
import { Container } from "@/components/ui/container";
import {
  Landmark,
  GraduationCap,
  School,
  Home,
  Users,
  ShieldCheck,
} from "lucide-react";

const conteneur: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const enfant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.21, 0.5, 0.27, 1] },
  },
};

/** Les quatre grandes familles d'usagers, de la nation à la famille.
 *  La pastille « niveau » reprend les couleurs de groupe de la section
 *  Plateforme, pour la cohérence d'un bout à l'autre du site. */
const publics = [
  {
    numero: "01",
    niveau: "Pilotage",
    icone: Landmark,
    titre: "National & régional",
    resume:
      "Piloter, superviser et arbitrer, de la stratégie nationale au suivi de terrain.",
    acteurs: ["Administrateur Système", "DRENA / DRENAET", "Inspecteurs"],
    pastille: "border-forest-200 bg-forest-50 text-forest-700",
  },
  {
    numero: "02",
    niveau: "Formation",
    icone: GraduationCap,
    titre: "Structures de formation",
    resume:
      "Former les maîtres et animer la formation continue, en CAFOP comme en APFC.",
    acteurs: [
      "Admin CAFOP",
      "Admin APFC",
      "Chefs d'antenne",
      "Conseillers pédagogiques",
    ],
    pastille: "border-gold-300/50 bg-gold-50 text-gold-700",
  },
  {
    numero: "03",
    niveau: "Établissement",
    icone: School,
    titre: "L'équipe pédagogique",
    resume:
      "Faire vivre la classe au quotidien : cours, vie scolaire et suivi des élèves.",
    acteurs: ["Chef d'établissement", "Enseignants", "Éducateurs"],
    pastille: "border-forest-200 bg-cream-200 text-forest-800",
  },
  {
    numero: "04",
    niveau: "Famille",
    icone: Home,
    titre: "Parents & élèves",
    resume:
      "Suivre la scolarité en toute transparence, côté parents comme côté élèves.",
    acteurs: ["Parents d'élèves", "Élèves"],
    pastille: "border-cream-300 bg-cream-50 text-ink-700",
  },
];

export function AudienceSection() {
  return (
    <section
      id="public"
      className="relative scroll-mt-24 overflow-hidden bg-cream-100 py-24 sm:py-32"
    >
      {/* Halos décoratifs très doux sur le fond crème */}
      <div
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-forest-300/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-gold-300/15 blur-3xl"
        aria-hidden
      />

      <Container className="relative">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.4fr] lg:items-start lg:gap-12">
          {/* ── Panneau institutionnel sombre (asymétrie + verre + grille) ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: [0.21, 0.5, 0.27, 1] }}
            className="relative overflow-hidden rounded-3xl border border-forest-800 bg-gradient-to-br from-forest-900 to-forest-950 p-8 text-cream-50 shadow-2xl sm:p-10 lg:sticky lg:top-28"
          >
            <div className="absolute inset-0 bg-grid-forest opacity-40" aria-hidden />
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-forest-400/20 blur-3xl"
              aria-hidden
            />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-forest-900/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur">
                <Users size={14} />
                Public cible
              </span>

              <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Tout l&apos;écosystème éducatif,{" "}
                <span className="text-gold-gradient">au même endroit</span>
              </h2>

              <p className="mt-4 text-lg leading-relaxed text-cream-200/85">
                De la famille à l&apos;administration nationale, chaque acteur
                dispose exactement des outils et des données qui le concernent.
              </p>

              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-cream-50/10 bg-forest-950/40 p-4 backdrop-blur">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-500/25 text-forest-200">
                  <ShieldCheck size={16} />
                </span>
                <p className="text-sm leading-relaxed text-cream-200/80">
                  Un accès cloisonné par rôle et par périmètre : chacun ne voit
                  que ce qui le concerne, vérifié côté serveur.
                </p>
              </div>

              <dl className="mt-8 flex items-center gap-6 border-t border-cream-50/10 pt-6">
                <div>
                  <dt className="font-display text-3xl font-bold text-gold-300">
                    13
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-cream-200/70">
                    rôles pris en charge
                  </dd>
                </div>
                <div className="h-10 w-px bg-cream-50/10" aria-hidden />
                <div>
                  <dt className="font-display text-3xl font-bold text-gold-300">
                    4
                  </dt>
                  <dd className="mt-1 text-xs leading-snug text-cream-200/70">
                    grandes familles d&apos;usagers
                  </dd>
                </div>
              </dl>
            </div>
          </motion.div>

          {/* ── Grille des quatre publics (cartes numérotées, riches) ── */}
          <motion.div
            variants={conteneur}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-5 sm:grid-cols-2"
          >
            {publics.map((p) => (
              <motion.article
                key={p.titre}
                variants={enfant}
                className="group relative h-full overflow-hidden rounded-2xl border border-cream-300 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-forest-300 hover:shadow-[0_22px_50px_-24px_rgba(15,53,39,0.55)]"
              >
                {/* Barre d'accent qui se révèle au survol */}
                <div
                  className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-forest-600 to-gold-400 transition-transform duration-300 group-hover:scale-x-100"
                  aria-hidden
                />
                {/* Grand numéro fantôme */}
                <span
                  className="pointer-events-none absolute -right-1 -top-5 select-none font-display text-7xl font-bold text-forest-900/[0.04]"
                  aria-hidden
                >
                  {p.numero}
                </span>

                <div className="relative flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-forest-700 to-forest-900 text-gold-300 shadow-[0_10px_24px_-12px_rgba(15,53,39,0.7)] transition-transform duration-300 group-hover:-rotate-3">
                    <p.icone size={22} />
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${p.pastille}`}
                  >
                    {p.niveau}
                  </span>
                </div>

                <h3 className="relative mt-5 font-display text-lg font-bold text-forest-900">
                  {p.titre}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-700/75">
                  {p.resume}
                </p>

                <ul className="relative mt-4 flex flex-wrap gap-2">
                  {p.acteurs.map((acteur) => (
                    <li
                      key={acteur}
                      className="rounded-full border border-cream-300 bg-cream-50 px-3 py-1 text-xs font-medium text-forest-800 transition-colors group-hover:border-forest-200"
                    >
                      {acteur}
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
