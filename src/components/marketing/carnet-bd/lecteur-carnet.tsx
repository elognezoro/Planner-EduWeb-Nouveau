"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronLeft, ChevronRight, X, BookOpen } from "lucide-react";
import { NB_CASES, TITRE_COLLECTION, cheminCase, cheminPlanche } from "@/lib/bd/planches";

type Props = {
  planche: number;
  titre: string;
  semaine: string;
  onClose: () => void;
};

const EASE = [0.4, 0, 0.2, 1] as const;

/** Une page du carnet : une case, avec repli « livre » si le SVG ne charge pas. */
function PageCase({ planche, page, titre }: { planche: number; page: number; titre: string }) {
  const [erreur, setErreur] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-cream-100/70 bg-cream-50 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)]">
      {/* Reliure : léger dégradé sur le bord gauche façon pli central */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-black/12 to-transparent" aria-hidden />
      {erreur ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-forest-700/60">
          <BookOpen size={40} />
          <p className="text-sm">Case {page + 1} indisponible</p>
        </div>
      ) : (
        <img
          src={cheminCase(planche, page)}
          alt={`Semaine ${planche} — ${titre}, case ${page + 1} sur ${NB_CASES}`}
          className="h-full w-full select-none object-contain"
          draggable={false}
          onError={() => setErreur(true)}
        />
      )}
      {/* Numéro de page, coin bas-droit */}
      <span className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-forest-900/70 px-2 py-0.5 text-[0.62rem] font-semibold text-cream-100">
        {page + 1} / {NB_CASES}
      </span>
    </div>
  );
}

/**
 * Lecteur « carnet ePub » plein écran : les 6 cases de la planche de la semaine,
 * une case par page, feuilletables (flèches, clavier ←/→, glissé tactile, zones
 * de clic gauche/droite) et refermables (« Quitter », ✕, Échap, clic sur le fond).
 * Modale accessible : focus déplacé dans le dialogue, piégé, puis restauré.
 */
export function LecteurCarnet({ planche, titre, semaine, onClose }: Props) {
  const [page, setPage] = useState(0); // 0..NB_CASES-1
  const [dir, setDir] = useState(1); // 1 = en avant, -1 = en arrière
  const reduit = useReducedMotion();
  const tactileX = useRef<number | null>(null);
  const dialogueRef = useRef<HTMLDivElement>(null);

  const aller = useCallback((delta: number) => {
    setDir(delta > 0 ? 1 : -1);
    setPage((p) => {
      const suivant = p + delta;
      return suivant < 0 || suivant > NB_CASES - 1 ? p : suivant;
    });
  }, []);

  const versPage = useCallback((cible: number) => {
    setDir(cible > page ? 1 : -1);
    setPage(cible);
  }, [page]);

  // Verrou du défilement de l'arrière-plan + préchargement du SVG (les 6 fragments
  // partagent le même fichier, un seul téléchargement suffit).
  useEffect(() => {
    const prec = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const img = new Image();
    img.src = cheminPlanche(planche);
    return () => {
      document.body.style.overflow = prec;
    };
  }, [planche]);

  // Clavier global : ←/→ pour feuilleter, Échap pour quitter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") aller(1);
      else if (e.key === "ArrowLeft") aller(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aller, onClose]);

  // Accessibilité modale : déplacer le focus dans le dialogue, le piéger, le restaurer.
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    const noeud = dialogueRef.current;
    const focusables = () =>
      Array.from(
        noeud?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => el.offsetParent !== null);
    // Focus initial sur le 1er élément focusable (évite l'échappement Shift+Tab).
    (focusables()[0] ?? noeud)?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !noeud) return;
      const cibles = focusables();
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    noeud?.addEventListener("keydown", onTab);
    return () => {
      noeud?.removeEventListener("keydown", onTab);
      precedent?.focus?.();
    };
  }, []);

  const variants: Variants = {
    enter: (d: number) => (reduit ? { opacity: 0 } : { opacity: 0, rotateY: d > 0 ? 55 : -55, x: d > 0 ? 60 : -60 }),
    centre: { opacity: 1, rotateY: 0, x: 0 },
    sortie: (d: number) => (reduit ? { opacity: 0 } : { opacity: 0, rotateY: d > 0 ? -55 : 55, x: d > 0 ? -60 : 60 }),
  };

  const premiere = page === 0;
  const derniere = page === NB_CASES - 1;

  return createPortal(
    <motion.div
      ref={dialogueRef}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      className="fixed inset-0 z-[120] flex flex-col bg-forest-950/80 outline-none backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${TITRE_COLLECTION} — Semaine ${planche} : ${titre}`}
    >
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-200 sm:flex">
            <BookOpen size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-cream-50 sm:text-base">{TITRE_COLLECTION}</p>
            <p className="truncate text-[0.7rem] text-cream-200/70 sm:text-xs">
              Semaine {planche} · {titre} <span className="hidden text-cream-200/40 sm:inline">— {semaine}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-cream-50/20 bg-forest-900/60 px-4 text-sm font-semibold text-cream-100 transition hover:border-cream-50/40 hover:bg-forest-900"
          aria-label="Quitter le carnet"
        >
          <X size={16} /> Quitter
        </button>
      </div>

      {/* Zone de lecture — un clic dans la marge sombre (le fond) referme le carnet. */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-2 sm:px-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Flèche précédente (desktop) */}
        <button
          type="button"
          onClick={() => aller(-1)}
          disabled={premiere}
          aria-label="Page précédente"
          className="absolute left-2 z-20 hidden h-12 w-12 items-center justify-center rounded-full border border-cream-50/15 bg-forest-900/60 text-cream-100 transition hover:bg-forest-900 disabled:pointer-events-none disabled:opacity-25 sm:left-4 md:flex"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Le carnet */}
        <div
          className="relative flex h-full w-full max-w-3xl items-center justify-center"
          style={{ perspective: 1600 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onTouchStart={(e) => (tactileX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (tactileX.current == null) return;
            const dx = e.changedTouches[0].clientX - tactileX.current;
            if (Math.abs(dx) > 45) aller(dx < 0 ? 1 : -1);
            tactileX.current = null;
          }}
        >
          <div className="relative aspect-[585/492] max-h-[76vh] w-full max-w-full">
            <AnimatePresence custom={dir} initial={false}>
              <motion.div
                key={page}
                custom={dir}
                variants={variants}
                initial="enter"
                animate="centre"
                exit="sortie"
                transition={{ duration: reduit ? 0.2 : 0.55, ease: EASE }}
                className="absolute inset-0"
                style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
              >
                <PageCase planche={planche} page={page} titre={titre} />
              </motion.div>
            </AnimatePresence>

            {/* Zones de clic gauche/droite, sous les flèches (hors tabulation) */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => aller(-1)}
              disabled={premiere}
              className="absolute inset-y-0 left-0 z-0 w-1/3 cursor-w-resize disabled:cursor-default"
            />
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => aller(1)}
              disabled={derniere}
              className="absolute inset-y-0 right-0 z-0 w-1/3 cursor-e-resize disabled:cursor-default"
            />
          </div>
        </div>

        {/* Flèche suivante (desktop) */}
        <button
          type="button"
          onClick={() => aller(1)}
          disabled={derniere}
          aria-label="Page suivante"
          className="absolute right-2 z-20 hidden h-12 w-12 items-center justify-center rounded-full border border-cream-50/15 bg-forest-900/60 text-cream-100 transition hover:bg-forest-900 disabled:pointer-events-none disabled:opacity-25 sm:right-4 md:flex"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Pied : pastilles de pages + flèches mobiles */}
      <div className="flex items-center justify-center gap-4 px-4 py-3">
        <button
          type="button"
          onClick={() => aller(-1)}
          disabled={premiere}
          aria-label="Page précédente"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-50/15 bg-forest-900/60 text-cream-100 transition hover:bg-forest-900 disabled:opacity-25 md:hidden"
        >
          <ChevronLeft size={20} />
        </button>

        <nav aria-label="Pages du carnet" className="flex items-center gap-1.5">
          {Array.from({ length: NB_CASES }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-current={i === page ? "page" : undefined}
              aria-label={`Aller à la page ${i + 1}`}
              onClick={() => versPage(i)}
              className="flex h-6 w-6 items-center justify-center rounded-full"
            >
              <span
                className={`h-2.5 rounded-full transition-all ${i === page ? "w-6 bg-gold-400" : "w-2.5 bg-cream-50/30 hover:bg-cream-50/50"}`}
              />
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => aller(1)}
          disabled={derniere}
          aria-label="Page suivante"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-50/15 bg-forest-900/60 text-cream-100 transition hover:bg-forest-900 disabled:opacity-25 md:hidden"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
