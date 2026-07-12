"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Building2, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import {
  CATEGORIES_DEPARTEMENT, resoudreIconeDepartement, type DepartementVue,
} from "@/lib/departements-ui";

/**
 * Section « Nos départements » — liste dynamique alimentée par la base et gérée depuis
 * Système › Départements (admin). Onglets par catégorie + cartes à icône. Le panneau
 * institutionnel (dégradé forêt + grille + halo) évite l'effet « bloc plat ».
 */
export function DepartementsSection({ departements }: { departements: DepartementVue[] }) {
  const cats = CATEGORIES_DEPARTEMENT.filter((c) => departements.some((d) => d.categorie === c.v));
  const onglets = [{ v: "tous", libelle: "Tous" }, ...cats];
  const [onglet, setOnglet] = useState("tous");

  if (departements.length === 0) return null;
  const visibles = onglet === "tous" ? departements : departements.filter((d) => d.categorie === onglet);

  return (
    <section id="departements" className="scroll-mt-24 bg-background py-24 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-300/40 bg-gold-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
            <Building2 size={14} /> Nos départements
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-forest-900 text-balance sm:text-4xl">
            Une organisation structurée, au service de l&apos;école
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-700/70">
            Des équipes dédiées — du produit à la pédagogie, de l&apos;ingénierie au support —
            qui font vivre chaque pan de la plateforme, du terrain à la nation.
          </p>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-[2rem] border border-forest-800/60 bg-gradient-to-br from-forest-900 to-forest-950 p-6 shadow-[0_40px_120px_-40px_rgba(7,31,23,0.7)] sm:p-10">
          <div className="absolute inset-0 bg-grid-forest opacity-[0.15]" aria-hidden />
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-500/10 blur-[110px]" aria-hidden />
          <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-forest-400/15 blur-[110px]" aria-hidden />

          <div className="relative">
            {onglets.length > 2 && (
              <div className="mb-8 flex flex-wrap justify-center gap-2">
                {onglets.map((o) => {
                  const actif = o.v === onglet;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setOnglet(o.v)}
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
            )}

            <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibles.map((d, i) => {
                const Icone = resoudreIconeDepartement(d.icone);
                const or = d.couleur === "gold";
                return (
                  <motion.div
                    key={d.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.04 }}
                    className="group relative flex flex-col rounded-2xl border border-cream-50/12 bg-forest-950/40 p-5 backdrop-blur-sm transition-colors hover:border-gold-400/40 hover:bg-forest-950/60"
                  >
                    <ArrowUpRight size={16} className="absolute right-4 top-4 text-cream-200/25 transition group-hover:text-gold-300" />
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-forest-950 shadow-lg ${or ? "bg-gradient-to-br from-gold-300 to-gold-500" : "bg-gradient-to-br from-forest-300 to-forest-500"}`}>
                      <Icone size={20} />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold text-cream-50">{d.nom}</h3>
                    {d.description && <p className="mt-2 text-sm leading-relaxed text-cream-200/70">{d.description}</p>}
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </Container>
    </section>
  );
}
