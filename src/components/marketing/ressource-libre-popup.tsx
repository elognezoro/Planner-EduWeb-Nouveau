"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, ArrowUpRight, Unlock, X } from "lucide-react";

/** Durée d'affichage avant disparition automatique. */
const DUREE_MS = 10_000;

/**
 * Pop-up « Ressource en accès libre » affichée en haut de page à l'arrivée :
 * met en avant le module DHFC-EBiS (consultable sans connexion), disparaît
 * automatiquement au bout de 10 s, et peut être masquée avant terme par
 * l'utilisateur (bouton ✕). Responsive : pleine largeur (marges) sur mobile,
 * carte centrée limitée en largeur sur desktop.
 */
export function RessourceLibrePopup() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), DUREE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -28 }}
          transition={{ duration: 0.45, ease: [0.21, 0.5, 0.27, 1] }}
          className="fixed inset-x-4 top-20 z-[60] mx-auto max-w-2xl sm:top-24"
          role="dialog"
          aria-modal="false"
          aria-label="Ressource en accès libre : module DHFC-EBiS"
        >
          <div className="relative overflow-hidden rounded-3xl border border-cream-200 bg-cream-50/95 p-5 shadow-[0_30px_80px_-24px_rgba(15,53,39,0.55)] backdrop-blur-xl sm:p-6">
            {/* Filet doré supérieur */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent"
              aria-hidden
            />

            {/* Bouton masquer (avant les 10 s) */}
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Masquer"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 transition hover:bg-cream-200 hover:text-ink-800"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-800 text-cream-50">
                  <BarChart3 size={20} />
                </span>
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-forest-600">
                    <Unlock size={11} /> Ressource en accès libre · sans connexion
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold leading-snug text-forest-900">
                    Module maître interactif — Analyse des besoins DHFC-EBiS
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-700/70">
                    Rapport navigable : contexte, 5 critères objectifs, besoins par population,
                    graphiques interactifs et quiz de maîtrise.
                  </p>
                </div>
              </div>

              <a
                href="/dhfc/module-maitre.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-6 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-all duration-300 hover:-translate-y-0.5 hover:from-gold-200 hover:to-gold-400"
              >
                Consulter le module
                <ArrowUpRight size={16} />
              </a>
            </div>

            {/* Barre de progression : indique le temps restant avant disparition (10 s). */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 rounded-full bg-gold-400/70"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: DUREE_MS / 1000, ease: "linear" }}
              aria-hidden
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
