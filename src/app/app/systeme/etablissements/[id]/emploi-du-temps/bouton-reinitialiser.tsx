"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, X } from "lucide-react";

/**
 * Réinitialise la PAGE (rechargement) après confirmation : efface les messages de génération
 * affichés et les filtres de vue en revenant à l'URL de base. L'emploi du temps déjà
 * enregistré n'est PAS supprimé (action non destructive).
 */
export function BoutonReinitialiserPage() {
  const [ouvert, setOuvert] = useState(false);

  function reinitialiser() {
    // Recharge sur l'URL de base (sans les paramètres ?vue=&cible=), état initial propre.
    window.location.assign(window.location.pathname);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-cream-300 bg-white px-6 text-sm font-semibold text-ink-700/70 transition-colors hover:bg-cream-100"
      >
        <RotateCcw size={17} /> Réinitialiser la page
      </button>

      <AnimatePresence>
        {ouvert && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOuvert(false)}
              className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
              role="dialog"
              aria-modal="true"
              aria-labelledby="titre-reinit"
            >
              <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3.5">
                <h2 id="titre-reinit" className="font-display text-base font-bold text-forest-900">
                  Réinitialiser la page
                </h2>
                <button
                  onClick={() => setOuvert(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm leading-relaxed text-ink-700/75">
                  Voulez-vous vraiment réinitialiser la page ? L&apos;affichage sera rechargé : les
                  messages de génération (résultat, blocages, qualité) et les filtres de vue seront
                  effacés.
                </p>
                <p className="mt-2 text-xs text-ink-700/55">
                  L&apos;emploi du temps déjà enregistré n&apos;est pas supprimé.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOuvert(false)}
                    className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={reinitialiser}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
                  >
                    <RotateCcw size={16} /> Réinitialiser
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
