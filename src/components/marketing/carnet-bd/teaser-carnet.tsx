"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { TITRE_COLLECTION, cheminCase } from "@/lib/bd/planches";

type Props = {
  planche: number;
  caseIndex: number;
  titre: string;
  /** Bouton-cible vers lequel le teaser « se fond » après 5 s. */
  cibleRef: RefObject<HTMLElement | null>;
  onOpen: () => void;
  onDone: () => void;
};

/** Durée d'affichage avant que la case ne se fonde sur le bouton (exigence client : 10 s). */
const DUREE_MS = 10_000;

/**
 * À l'arrivée sur l'accueil : une case de la planche de la semaine s'affiche en
 * pop-up 10 s, puis se réduit et glisse vers le bouton du carnet (pour y attirer
 * l'attention) avant de disparaître. Un clic ouvre directement le carnet.
 */
export function TeaserCarnet({ planche, caseIndex, titre, cibleRef, onOpen, onDone }: Props) {
  const controls = useAnimationControls();
  const carteRef = useRef<HTMLDivElement>(null);
  const reduit = useReducedMotion();
  const fini = useRef(false);

  useEffect(() => {
    let vivant = true;

    const terminer = () => {
      if (!fini.current) {
        fini.current = true;
        onDone();
      }
    };

    if (reduit) {
      controls.set({ opacity: 0 });
      controls.start({ opacity: 1, transition: { duration: 0.3 } });
    } else {
      controls.set({ opacity: 0, scale: 0.9, y: 24 });
      controls.start({ opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.21, 0.5, 0.27, 1] } });
    }

    const t = setTimeout(async () => {
      if (!vivant || fini.current) return;
      const carte = carteRef.current;
      const cible = cibleRef.current;
      if (!reduit && carte && cible) {
        const a = carte.getBoundingClientRect();
        const b = cible.getBoundingClientRect();
        const dx = b.left + b.width / 2 - (a.left + a.width / 2);
        const dy = b.top + b.height / 2 - (a.top + a.height / 2);
        await controls.start({ x: dx, y: dy, scale: 0.1, opacity: 0, transition: { duration: 0.8, ease: [0.5, 0, 0.75, 0] } });
      } else {
        await controls.start({ opacity: 0, scale: 0.85, transition: { duration: 0.4 } });
      }
      if (vivant) terminer();
    }, DUREE_MS);

    return () => {
      vivant = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[110] flex items-end justify-center p-4 pb-24 sm:items-center sm:pb-4">
      <motion.div
        ref={carteRef}
        initial={reduit ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
        animate={controls}
        className="pointer-events-auto w-full max-w-xs overflow-hidden rounded-3xl border border-gold-300/40 bg-cream-50 shadow-[0_40px_90px_-28px_rgba(15,53,39,0.7)]"
      >
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left"
          aria-label={`Ouvrir le carnet : ${TITRE_COLLECTION}, semaine ${planche}`}
        >
          <div className="relative aspect-[585/492] w-full bg-cream-100">
            <img
              src={cheminCase(planche, caseIndex)}
              alt={`Aperçu de la planche de la semaine ${planche} : ${titre}`}
              className="h-full w-full object-contain"
              draggable={false}
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-forest-900/80 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-gold-200 backdrop-blur">
              <Sparkles size={11} /> Cette semaine
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="font-display text-sm font-bold leading-snug text-forest-900">{TITRE_COLLECTION}</p>
            <p className="mt-0.5 text-xs text-ink-700/70">
              Semaine {planche} · {titre} — <span className="font-semibold text-forest-700">cliquez pour feuilleter</span>
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!fini.current) {
              fini.current = true;
              onDone();
            }
          }}
          aria-label="Masquer"
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-forest-900/70 text-cream-100 transition hover:bg-forest-900"
        >
          <X size={14} />
        </button>
      </motion.div>
    </div>,
    document.body,
  );
}
