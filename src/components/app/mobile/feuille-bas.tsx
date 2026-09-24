"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useSousSeuilMobile } from "@/lib/mobile/appareil";

/** Durée de l'ouverture et de la fermeture (ms) — doit rester alignée sur la transition CSS. */
const DUREE = 220;

/** Verrou de défilement PARTAGÉ : la première feuille le pose, la dernière le lève. Sans ce
 *  compteur, une feuille ouverte par-dessus une autre restituerait « hidden » en se fermant. */
let feuillesOuvertes = 0;
let defilementAvant = "";

function verrouillerDefilement(): () => void {
  if (feuillesOuvertes === 0) {
    defilementAvant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  feuillesOuvertes++;
  let libere = false;
  return () => {
    if (libere) return;
    libere = true;
    feuillesOuvertes = Math.max(0, feuillesOuvertes - 1);
    if (feuillesOuvertes === 0) document.body.style.overflow = defilementAvant;
  };
}

/**
 * FEUILLE MONTANTE — le dialogue du téléphone.
 *
 * Remplace, sur mobile, les menus déroulants conçus pour la souris : le contenu monte depuis le
 * bas, à portée du pouce, et se referme d'un glissement vers le bas, d'un appui à côté, du
 * bouton de fermeture ou de la touche Échap.
 *
 * DÉLIBÉRÉMENT SANS BIBLIOTHÈQUE D'ANIMATION : l'ouverture et la fermeture sont de simples
 * transitions CSS, et le retrait du document est piloté par une minuterie. Une animation
 * JavaScript dépend des images rendues par le navigateur ; si la page ne dessine pas (onglet en
 * arrière-plan, fenêtre masquée, appareil très sollicité), la fin d'animation n'arrive jamais
 * et la feuille resterait ouverte pour toujours. Ici, elle se ferme quoi qu'il arrive.
 *
 * Le PORTAIL vers <body> est indispensable : l'en-tête mobile porte un flou d'arrière-plan, ce
 * qui ferait de lui le bloc conteneur de ses descendants « fixed ».
 *
 * Accessibilité : rôle de dialogue, focus déplacé dans la feuille, tabulation capturée, focus
 * rendu au déclencheur, défilement de la page verrouillé, et transitions neutralisées par la
 * règle « prefers-reduced-motion » déjà en place dans globals.css.
 */
export function FeuilleBas({
  ouvert,
  onFermer,
  titre,
  children,
  /** Hauteur maximale de la feuille (défaut : 85 % de la hauteur visible). */
  hauteurMax = "85dvh",
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre: string;
  children: React.ReactNode;
  hauteurMax?: string;
}) {
  const feuille = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLElement | null>(null);
  const idTitre = useId();
  // Trois états : absente du document, montée (en position haute), ou en cours de fermeture.
  // L'ajustement se fait PENDANT le rendu (motif recommandé par React pour dériver un état
  // d'une propriété), et les minuteries ci-dessous ne changent l'état que depuis un rappel.
  const [etat, setEtat] = useState<"ferme" | "ouvert" | "fermeture">(ouvert ? "ouvert" : "ferme");
  const [ouvertPrecedent, setOuvertPrecedent] = useState(ouvert);
  const [affiche, setAffiche] = useState(false);
  if (ouvert !== ouvertPrecedent) {
    setOuvertPrecedent(ouvert);
    setEtat(ouvert ? "ouvert" : "fermeture");
  }
  const monte = etat !== "ferme";
  // Décalage vertical pendant un glissement du doigt (px).
  const [glisse, setGlisse] = useState(0);
  const [enGeste, setEnGeste] = useState(false);
  const sousSeuil = useSousSeuilMobile();
  const depart = useRef<number | null>(null);
  // Le décalage est AUSSI tenu dans une référence : à la levée du doigt, l'état React peut
  // ne pas encore refléter le dernier déplacement (événements traités dans le même lot).
  const decalage = useRef(0);

  const rappelFermeture = useRef(onFermer);
  useEffect(() => {
    rappelFermeture.current = onFermer;
  }, [onFermer]);
  const fermer = useCallback(() => rappelFermeture.current(), []);

  useEffect(() => {
    if (etat === "ouvert") {
      // Un souffle avant de passer en position haute : sans cela, le navigateur n'a pas de
      // point de départ et la transition ne joue pas.
      const t = window.setTimeout(() => setAffiche(true), 10);
      return () => window.clearTimeout(t);
    }
    if (etat === "fermeture") {
      const descente = window.setTimeout(() => setAffiche(false), 0);
      const retrait = window.setTimeout(() => setEtat("ferme"), DUREE);
      return () => {
        window.clearTimeout(descente);
        window.clearTimeout(retrait);
      };
    }
  }, [etat]);

  // Garde-fou de largeur : une feuille est une surface de TÉLÉPHONE. Si l'écran repasse
  // au-dessus du seuil (zoom, fenêtre élargie, écran externe), elle se referme — sans quoi
  // son verrou de défilement et son écouteur clavier resteraient armés sur un affichage de
  // bureau, où plus rien ne permet de la fermer (elle y est masquée par CSS).
  useEffect(() => {
    if (monte && !sousSeuil) fermer();
  }, [monte, sousSeuil, fermer]);

  useEffect(() => {
    if (!monte) return;
    declencheur.current = document.activeElement as HTMLElement | null;
    const libererDefilement = verrouillerDefilement();

    const focalisables = () =>
      Array.from(
        feuille.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    const minuteur = window.setTimeout(() => {
      feuille.current?.focus();
    }, 40);

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fermer();
        return;
      }
      if (e.key !== "Tab") return;
      const cibles = focalisables();
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

    document.addEventListener("keydown", surTouche);
    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener("keydown", surTouche);
      libererDefilement();
      declencheur.current?.focus?.();
    };
    // « fermer » est volontairement absent : il est stable (référence), et le remettre ici
    // relancerait l'effet à chaque rendu — donc replacerait le focus à chaque frappe.
  }, [monte]);

  // ── Glissement vers le bas depuis la poignée ──
  function debutGeste(e: React.PointerEvent) {
    depart.current = e.clientY;
    decalage.current = 0;
    setEnGeste(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function pendantGeste(e: React.PointerEvent) {
    if (depart.current === null) return;
    // Seul le sens « vers le bas » est suivi : tirer vers le haut ne décolle pas la feuille.
    const y = Math.max(0, e.clientY - depart.current);
    decalage.current = y;
    setGlisse(y);
  }
  function finGeste() {
    if (depart.current === null) return;
    const parcouru = decalage.current;
    depart.current = null;
    decalage.current = 0;
    setEnGeste(false);
    setGlisse(0);
    if (parcouru > 110) fermer();
  }

  if (typeof document === "undefined" || !monte) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] lg:hidden print:hidden">
      <div
        onClick={fermer}
        aria-hidden
        className={`absolute inset-0 bg-forest-950/50 backdrop-blur-sm transition-opacity duration-200 ${
          affiche ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={feuille}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitre}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl border-t border-cream-200 bg-cream-50 shadow-2xl outline-none"
        style={{
          maxHeight: hauteurMax,
          paddingBottom: "var(--marge-sure-bas, 0px)",
          transform: affiche ? `translateY(${glisse}px)` : "translateY(100%)",
          // Pendant le geste, la feuille suit le doigt sans amortissement.
          transition: enGeste ? "none" : `transform ${DUREE}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
      >
        <div
          onPointerDown={debutGeste}
          onPointerMove={pendantGeste}
          onPointerUp={finGeste}
          onPointerCancel={finGeste}
          className="flex shrink-0 cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing"
          style={{ touchAction: "none" }}
          aria-hidden
        >
          <span className="h-1.5 w-11 rounded-full bg-ink-700/15" />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2">
          <h2 id={idTitre} className="min-w-0 truncate font-display text-lg font-bold text-forest-900">
            {titre}
          </h2>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-700/60 active:bg-cream-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
