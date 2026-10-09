"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MailPlus, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { envoyerRappelRattachement, type RappelResultat } from "./actions";

/**
 * Bouton (admin) : envoie le rappel de rattachement aux comptes restés au statut « élève » avec
 * une adresse e-mail fonctionnelle et une demande de rôle administratif en attente. Confirmation
 * obligatoire — action irréversible (envoi d'e-mails à de vrais comptes).
 *
 * `className` : classes ajoutées au bouton (ex. « mobile:hidden » — sur téléphone, l'action est
 * proposée dans la feuille « Plus » de ComptesActions, qui ouvre la même fenêtre).
 */
export function BoutonRappelRattachement({ className = "" }: { className?: string }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className={`inline-flex h-11 items-center gap-2 rounded-full border border-gold-300 bg-gold-50 px-5 text-sm font-semibold text-gold-900 transition-colors hover:bg-gold-100 ${className}`}
      >
        <MailPlus size={16} /> Rappel de rattachement
      </button>

      <ModaleRappelRattachement ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  );
}

/** Fenêtre de confirmation et de compte-rendu du rappel (ouverte par le bouton ci-dessus, ou
 *  depuis la feuille « Plus » des actions de la page Comptes sur téléphone). */
export function ModaleRappelRattachement({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const [res, setRes] = useState<RappelResultat | null>(null);
  const [enCours, demarrer] = useTransition();

  function envoyer() {
    demarrer(async () => {
      const r = await envoyerRappelRattachement();
      setRes(r);
    });
  }

  function fermer() {
    if (enCours) return;
    onFermer();
    setRes(null);
  }

  return (
    <>
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
              // Téléphone : feuille ancrée en bas de l'écran (hauteur en dvh), boutons pleine largeur.
              className="fixed left-1/2 top-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-soft mobile:inset-x-0 mobile:top-auto mobile:bottom-0 mobile:w-full mobile:max-w-none mobile:max-h-[92dvh] mobile:translate-x-0 mobile:translate-y-0 mobile:overflow-y-auto mobile:overscroll-contain mobile:rounded-b-none"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-cream-100 px-5 py-3.5">
                <h2 className="font-display text-base font-bold text-forest-900">Rappel de rattachement</h2>
                <button onClick={fermer} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-700/50 hover:bg-cream-100 mobile:h-11 mobile:w-11" aria-label="Fermer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 mobile:pb-[calc(1.25rem+var(--marge-sure-bas))]">
                {res ? (
                  <div className="space-y-3">
                    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${res.ok ? "border-forest-200 bg-forest-50 text-forest-800" : "border-gold-300/70 bg-gold-50 text-gold-900"}`}>
                      {res.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0" />}
                      <span>{res.message}</span>
                    </div>
                    {typeof res.total === "number" && (
                      <p className="text-xs text-ink-700/60">
                        Comptes ciblés : {res.total} · envoyés : {res.envoyes ?? 0}
                        {res.echecs ? ` · échecs : ${res.echecs}` : ""}
                        {res.simules ? ` · simulés : ${res.simules}` : ""}
                      </p>
                    )}
                    <div className="flex justify-end pt-1">
                      <button onClick={fermer} className="h-11 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 mobile:w-full">Fermer</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed text-ink-700/80">
                      Un e-mail va être envoyé aux comptes restés au statut <strong>« élève »</strong> qui ont une
                      <strong> adresse e-mail fonctionnelle</strong> et une <strong>demande de rôle administratif en
                      attente</strong>. Il les invite à préciser leur établissement et leur statut (Chef d&apos;établissement,
                      ACE, Fondateur, Directeur des études…).
                    </p>
                    <p className="mt-2 text-xs text-ink-700/55">
                      Action irréversible : de vrais e-mails partent (depuis la production). En environnement sans clé
                      Resend, l&apos;envoi est simulé et le compte-rendu l&apos;indique.
                    </p>
                    <div className="mt-5 flex justify-end gap-2 mobile:flex-col-reverse mobile:items-stretch">
                      <button type="button" onClick={fermer} disabled={enCours} className="h-11 rounded-full border border-cream-300 px-5 text-sm font-medium text-ink-700/70 hover:bg-cream-100 disabled:opacity-60">Annuler</button>
                      <button type="button" onClick={envoyer} disabled={enCours} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-70 mobile:justify-center">
                        {enCours ? <Loader2 size={16} className="animate-spin" /> : <MailPlus size={16} />} Envoyer le rappel
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
