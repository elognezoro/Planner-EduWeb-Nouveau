"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Trash2, X, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { reinitialiserEmploiDuTemps } from "./actions";

/**
 * Réinitialise le CONTENU de l'emploi du temps : supprime tous les créneaux générés de
 * l'établissement (le bloc revient à l'état vide). Action destructive → confirmation obligatoire.
 */
export function BoutonReinitialiserEdt({ etablissementId }: { etablissementId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function fermer() {
    if (enCours) return;
    setOuvert(false);
    setRes(null);
  }

  function reinitialiser() {
    demarrer(async () => {
      const r = await reinitialiserEmploiDuTemps(etablissementId);
      setRes({ ok: r.ok, message: r.message });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-red-200 bg-white px-6 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
      >
        <Trash2 size={16} /> Réinitialiser
      </button>

      <AnimatePresence>
        {ouvert && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={fermer}
              className="fixed inset-0 z-50 bg-forest-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft"
              role="dialog"
              aria-modal="true"
              aria-labelledby="titre-reinit-edt"
            >
              <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3.5">
                <h2 id="titre-reinit-edt" className="font-display text-base font-bold text-forest-900">
                  Réinitialiser l&apos;emploi du temps
                </h2>
                <button
                  onClick={fermer}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100"
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                {res ? (
                  <div className="space-y-4">
                    <div
                      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${res.ok ? "border-forest-200 bg-forest-50 text-forest-800" : "border-red-200 bg-red-50 text-red-700"}`}
                    >
                      {res.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0" />}
                      <span>{res.message}</span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={fermer}
                        className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-ink-700/80">
                      Voulez-vous vraiment <strong>supprimer l&apos;emploi du temps généré</strong> de cet
                      établissement ? Tous les créneaux de toutes les classes seront effacés et le bloc
                      reviendra à l&apos;état « aucun emploi du temps ».
                    </p>
                    <p className="mt-2 text-xs text-ink-700/55">
                      Action irréversible. Vous pourrez ensuite relancer la génération.
                    </p>
                    <div className="mt-5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={fermer}
                        disabled={enCours}
                        className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 disabled:opacity-60"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={reinitialiser}
                        disabled={enCours}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                      >
                        {enCours ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Réinitialiser
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
