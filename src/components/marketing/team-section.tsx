"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Users2 } from "lucide-react";
import { Container } from "@/components/ui/container";

/**
 * Section « Notre équipe » — panneau institutionnel avec onglets et cartes membres.
 * ⚠️ Données de DÉMONSTRATION : remplacer `EQUIPE` par les vrais membres (nom, rôle,
 * expertise). Les avatars sont des initiales (pas de photo) — cohérent avec la charte.
 */

type CategorieId = "tous" | "produit" | "pedagogie" | "support";

const ONGLETS: { id: CategorieId; libelle: string }[] = [
  { id: "tous", libelle: "Toute l'équipe" },
  { id: "produit", libelle: "Produit & Ingénierie" },
  { id: "pedagogie", libelle: "Pédagogie" },
  { id: "support", libelle: "Support & Formation" },
];

const EQUIPE: {
  nom: string;
  role: string;
  expertise: string;
  cat: Exclude<CategorieId, "tous">;
  initiales: string;
  couleur: string;
}[] = [
  { nom: "Direction Produit", role: "Vision & feuille de route", expertise: "Gestion scolaire", cat: "produit", initiales: "DP", couleur: "from-gold-300 to-gold-500" },
  { nom: "Ingénierie Plateforme", role: "Architecture & sécurité", expertise: "Next.js · Prisma · RBAC", cat: "produit", initiales: "IP", couleur: "from-forest-400 to-forest-600" },
  { nom: "Solveur Emplois du temps", role: "Optimisation sous contraintes", expertise: "Algorithmes", cat: "produit", initiales: "ST", couleur: "from-forest-300 to-forest-500" },
  { nom: "Pédagogie & Contenus", role: "Ingénierie de formation", expertise: "CAFOP · APFC · LMS", cat: "pedagogie", initiales: "PC", couleur: "from-gold-200 to-gold-400" },
  { nom: "Conformité Éducative", role: "Programmes & référentiels", expertise: "Système ivoirien", cat: "pedagogie", initiales: "CE", couleur: "from-forest-400 to-forest-600" },
  { nom: "Support & Déploiement", role: "Accompagnement des établissements", expertise: "Formation · Assistance", cat: "support", initiales: "SD", couleur: "from-gold-300 to-gold-500" },
];

function CarteMembre({ m, index }: { m: (typeof EQUIPE)[number]; index: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group relative flex flex-col justify-between rounded-2xl border border-cream-50/12 bg-forest-950/40 p-5 backdrop-blur-sm transition-colors hover:border-gold-400/40 hover:bg-forest-950/60"
    >
      <ArrowUpRight
        size={18}
        className="absolute right-4 top-4 text-cream-200/30 transition-all group-hover:text-gold-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
      <div>
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br font-display text-lg font-bold text-forest-950 shadow-lg ${m.couleur}`}>
          {m.initiales}
        </span>
        <h3 className="mt-4 font-display text-lg font-bold text-cream-50">{m.nom}</h3>
        <p className="mt-0.5 text-sm text-cream-200/70">{m.role}</p>
      </div>
      <p className="mt-5 inline-flex w-fit items-center rounded-full border border-cream-50/10 bg-forest-900/60 px-3 py-1 text-[0.7rem] font-medium text-forest-200">
        {m.expertise}
      </p>
    </motion.div>
  );
}

export function TeamSection() {
  const [onglet, setOnglet] = useState<CategorieId>("tous");
  const membres = onglet === "tous" ? EQUIPE : EQUIPE.filter((m) => m.cat === onglet);

  return (
    <section id="equipe" className="bg-background py-24 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-gold-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
            <Users2 size={14} /> Notre équipe
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-forest-900 text-balance sm:text-4xl">
            Une équipe qui connaît l&apos;école, du terrain à la nation
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-700/70">
            Produit, ingénierie, pédagogie et accompagnement : des expertises réunies pour
            faire d&apos;EduWeb Planner un outil fidèle aux réalités du système éducatif.
          </p>
        </div>

        {/* Panneau institutionnel (non plat : dégradé forêt + grille + halo) */}
        <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-forest-800/60 bg-gradient-to-br from-forest-900 to-forest-950 p-6 shadow-[0_40px_120px_-40px_rgba(7,31,23,0.7)] sm:p-10">
          <div className="absolute inset-0 bg-grid-forest opacity-[0.15]" aria-hidden />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-500/10 blur-[110px]" aria-hidden />

          <div className="relative grid gap-10 lg:grid-cols-[1.35fr_0.65fr]">
            {/* Onglets + cartes */}
            <div>
              <div className="flex flex-wrap gap-2">
                {ONGLETS.map((o) => {
                  const actif = o.id === onglet;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOnglet(o.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        actif
                          ? "bg-gradient-to-br from-gold-300 to-gold-500 text-forest-950 shadow-[var(--shadow-gold)]"
                          : "border border-cream-50/12 text-cream-200/75 hover:bg-white/5 hover:text-cream-50"
                      }`}
                    >
                      {o.libelle}
                    </button>
                  );
                })}
              </div>

              <motion.div layout className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {membres.map((m, i) => (
                  <CarteMembre key={m.nom} m={m} index={i} />
                ))}
              </motion.div>
            </div>

            {/* Panneau descriptif */}
            <div className="flex flex-col justify-center border-t border-cream-50/10 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <h3 className="font-display text-2xl font-bold text-cream-50">
                Au service de tout le cycle scolaire
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-cream-200/75">
                De la génération des emplois du temps à la vie scolaire, de la formation des
                maîtres au pilotage national, notre équipe conçoit une plateforme unique,
                sécurisée par périmètre, qui accompagne chaque acteur de l&apos;école — sans
                jamais complexifier son quotidien.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-cream-100/85">
                {["Conçu pour le système éducatif ivoirien", "Sécurité et confidentialité par rôle", "Accompagnement au déploiement"].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/inscription"
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-cream-50 px-5 py-2.5 text-sm font-semibold text-forest-900 shadow-soft transition hover:-translate-y-0.5 hover:bg-white"
              >
                Rejoindre l&apos;aventure
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
