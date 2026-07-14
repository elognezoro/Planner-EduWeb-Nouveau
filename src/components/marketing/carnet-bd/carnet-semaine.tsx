"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import {
  TITRE_COLLECTION,
  cheminCase,
  cheminPlanche,
  infoPlanche,
  libelleSemaine,
  plancheDeLaSemaine,
  NB_CASES,
} from "@/lib/bd/planches";
import { LecteurCarnet } from "./lecteur-carnet";
import { TeaserCarnet } from "./teaser-carnet";

const CLE_TEASER = "bd-teaser-vu";

// Planche de la semaine : valeur dépendante de la date, donc calculée uniquement
// côté client (null au rendu serveur) — évite tout écart d'hydratation sans
// setState dans un effet.
const sabonner = () => () => {};
const plancheServeur = () => null;
const plancheClient = () => plancheDeLaSemaine(new Date());

/**
 * Point d'entrée du « Carnet BD de la semaine » sur l'accueil (zone haut-droite du hero) :
 *  - un bouton qui ouvre le carnet ePub feuilletable de la planche de la semaine ;
 *  - un teaser (une case) affiché ~5 s à l'arrivée, qui se fond ensuite sur le bouton.
 * Le numéro de planche est calculé côté client (dépend de la date), d'où le calcul
 * dans un effet de montage pour éviter tout écart d'hydratation.
 */
export function CarnetSemaine() {
  const planche = useSyncExternalStore(sabonner, plancheClient, plancheServeur);
  const [ouvert, setOuvert] = useState(false);
  const [teaserCase, setTeaserCase] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const [vignetteErreur, setVignetteErreur] = useState(false);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const reduit = useReducedMotion();

  // Halo de rappel (après le fondu du teaser sur le bouton) : timer nettoyable.
  useEffect(() => {
    if (!pulse) return;
    const id = setTimeout(() => setPulse(false), 2600);
    return () => clearTimeout(id);
  }, [pulse]);

  useEffect(() => {
    // Réchauffe le cache du SVG (les 6 fragments partagent le fichier).
    const img = new Image();
    img.src = cheminPlanche(plancheDeLaSemaine(new Date()));

    // Teaser : une fois par session, après un court délai (le temps que le hero se pose).
    let vu = false;
    try {
      vu = sessionStorage.getItem(CLE_TEASER) === "1";
    } catch {
      vu = false;
    }
    if (vu) return;
    const t = setTimeout(() => {
      setTeaserCase(Math.floor(Math.random() * NB_CASES));
      try {
        sessionStorage.setItem(CLE_TEASER, "1");
      } catch {
        /* stockage indisponible : le teaser s'affichera à la prochaine visite */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const info = planche != null ? infoPlanche(planche) : null;

  function ouvrir() {
    setTeaserCase(null);
    setOuvert(true);
  }

  return (
    <div className="relative">
      <motion.button
        ref={boutonRef}
        type="button"
        onClick={ouvrir}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        aria-label={`Ouvrir le carnet BD : ${TITRE_COLLECTION}${info ? ` — semaine ${planche}, ${info.titre}` : ""}`}
        className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-gold-300/30 bg-forest-900/50 p-3 text-left shadow-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-300/60 hover:bg-forest-900/70"
      >
        {/* Vignette : couverture (1re case) de la planche de la semaine */}
        <span className="relative aspect-[585/492] w-20 shrink-0 overflow-hidden rounded-xl border border-cream-50/15 bg-forest-950/40 sm:w-24">
          {planche != null && !vignetteErreur ? (
            <img
              src={cheminCase(planche, 0)}
              alt=""
              aria-hidden
              className="h-full w-full object-contain"
              draggable={false}
              onError={() => setVignetteErreur(true)}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-gold-200/70">
              <BookOpen size={22} />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-gold-200">
            <Sparkles size={11} /> Carnet BD de la semaine
          </span>
          <span className="mt-1 block truncate font-display text-base font-bold text-cream-50">
            Instants de Motivation
          </span>
          <span className="mt-0.5 block truncate text-[0.72rem] text-cream-200/70">
            {info ? `Shazmila & ses amis · Semaine ${planche} — ${info.titre}` : "Shazmila & ses amis"}
          </span>
        </span>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-gold-200 transition-all duration-300 group-hover:bg-gold-400 group-hover:text-forest-950">
          <ArrowRight size={17} />
        </span>

        {/* Halo de rappel après que le teaser s'est fondu sur le bouton */}
        <AnimatePresence>
          {pulse && (
            <motion.span
              key="pulse"
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-gold-300"
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0, 0.9, 0, 0.9, 0], scale: [1, 1.04, 1, 1.04, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Teaser d'arrivée (une case, ~5 s, se fond sur le bouton) */}
      {teaserCase != null && planche != null && info && !ouvert && (
        <TeaserCarnet
          planche={planche}
          caseIndex={teaserCase}
          titre={info.titre}
          cibleRef={boutonRef}
          onOpen={ouvrir}
          onDone={() => {
            setTeaserCase(null);
            if (!reduit) setPulse(true);
          }}
        />
      )}

      {/* Lecteur plein écran */}
      <AnimatePresence>
        {ouvert && planche != null && info && (
          <LecteurCarnet
            key="lecteur"
            planche={planche}
            titre={info.titre}
            semaine={libelleSemaine(new Date())}
            onClose={() => setOuvert(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
