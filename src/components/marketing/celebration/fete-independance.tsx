"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useReducedMotion } from "motion/react";

/**
 * « 66e anniversaire de l'indépendance de la Côte d'Ivoire » — affiche FLOTTANTE de la page
 * d'accueil, visible UN MOIS autour de la fête (7 août 2026) :
 *  - miniature déplaçable par glisser (souris ET tactile) sur toute la surface de l'écran ;
 *  - fermeture par la croix (mémorisée pour la session — elle revient à la prochaine visite
 *    tant que la fenêtre d'affichage court) ;
 *  - au survol (ou d'un toucher sur mobile), l'affiche s'agrandit avec des feux d'artifice
 *    animés (désactivés si l'utilisateur préfère réduire les animations).
 * Après le 24 août 2026, le composant ne rend plus rien — aucun nettoyage de code requis.
 */

// Fenêtre d'affichage : un mois couvrant la fête du 7 août 2026.
const DEBUT = Date.UTC(2026, 6, 23); // 23 juillet 2026
const FIN = Date.UTC(2026, 7, 23, 23, 59, 59); // 23 août 2026 inclus
const CLE_FERMETURE = "fete-ci-2026-fermee";

const IMAGE = "/celebration/fete-independance-ci-2026.webp";
const RATIO = 960 / 640; // hauteur / largeur de l'affiche optimisée
const LARGEUR_MINI = 132;
const LARGEUR_GRANDE = 300;
const MARGE = 12;

/** Étincelles des feux d'artifice : direction (--tx/--ty), teinte et délai de chacune. */
const ETINCELLES: { tx: number; ty: number; couleur: string; delai: number }[] = [
  { tx: -70, ty: -90, couleur: "#f5b942", delai: 0 },
  { tx: 60, ty: -100, couleur: "#f97316", delai: 0.15 },
  { tx: -100, ty: -30, couleur: "#22c55e", delai: 0.3 },
  { tx: 105, ty: -45, couleur: "#fde68a", delai: 0.45 },
  { tx: -45, ty: -115, couleur: "#fb923c", delai: 0.6 },
  { tx: 90, ty: -80, couleur: "#4ade80", delai: 0.75 },
  { tx: -115, ty: -70, couleur: "#fbbf24", delai: 0.9 },
  { tx: 40, ty: -120, couleur: "#f8fafc", delai: 1.05 },
];

// Visibilité calculée UNIQUEMENT côté client (fenêtre de dates + fermeture de session) —
// `false` au rendu serveur : aucun écart d'hydratation, aucun setState d'effet.
const sabonner = () => () => {};
const affichableServeur = () => false;
const affichableClient = () => {
  const maintenant = Date.now();
  if (maintenant < DEBUT || maintenant > FIN) return false;
  try {
    return sessionStorage.getItem(CLE_FERMETURE) !== "1";
  } catch {
    return true; // stockage indisponible : on affiche quand même
  }
};

export function FeteIndependance() {
  const affichable = useSyncExternalStore(sabonner, affichableClient, affichableServeur);
  const [fermee, setFermee] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [agrandie, setAgrandie] = useState(false);
  const [enDeplacement, setEnDeplacement] = useState(false);
  const reduit = useReducedMotion();
  // Point de départ d'un glisser en cours (positions pointeur + affiche à l'appui).
  const depart = useRef<{ px: number; py: number; x: number; y: number; bouge: boolean } | null>(null);
  const visible = affichable && !fermee;

  // L'affiche reste dans l'écran quand la fenêtre du navigateur est redimensionnée.
  useEffect(() => {
    if (!visible) return;
    const ajuster = () =>
      setPos((p) =>
        p
          ? {
              x: Math.min(Math.max(p.x, 0), Math.max(0, window.innerWidth - LARGEUR_MINI)),
              y: Math.min(Math.max(p.y, 0), Math.max(0, window.innerHeight - LARGEUR_MINI * RATIO)),
            }
          : p,
      );
    window.addEventListener("resize", ajuster);
    return () => window.removeEventListener("resize", ajuster);
  }, [visible]);

  if (!visible) return null;

  // Position par défaut (bas-gauche) tant que l'affiche n'a pas été déplacée — calculée au
  // rendu CLIENT uniquement (le composant ne rend rien côté serveur, cf. affichableServeur).
  const posEffective = pos ?? {
    x: MARGE,
    y: Math.max(MARGE, window.innerHeight - LARGEUR_MINI * RATIO - MARGE - 8),
  };
  const largeur = agrandie && !enDeplacement ? LARGEUR_GRANDE : LARGEUR_MINI;
  const hauteur = largeur * RATIO;
  // Position d'affichage bornée à l'écran (l'agrandissement ne doit pas sortir du cadre).
  const x = Math.min(Math.max(posEffective.x, MARGE), Math.max(MARGE, window.innerWidth - largeur - MARGE));
  const y = Math.min(Math.max(posEffective.y, MARGE), Math.max(MARGE, window.innerHeight - hauteur - MARGE));

  function fermer() {
    setFermee(true);
    try {
      sessionStorage.setItem(CLE_FERMETURE, "1");
    } catch {
      /* stockage indisponible : fermeture pour ce rendu seulement */
    }
  }

  function surAppui(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    depart.current = { px: e.clientX, py: e.clientY, x: posEffective.x, y: posEffective.y, bouge: false };
  }

  function surDeplacement(e: React.PointerEvent<HTMLDivElement>) {
    const d = depart.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.bouge && Math.hypot(dx, dy) > 4) {
      d.bouge = true;
      setEnDeplacement(true);
    }
    if (!d.bouge) return;
    setPos({
      x: Math.min(Math.max(d.x + dx, 0), Math.max(0, window.innerWidth - LARGEUR_MINI)),
      y: Math.min(Math.max(d.y + dy, 0), Math.max(0, window.innerHeight - LARGEUR_MINI * RATIO)),
    });
  }

  function surRelachement(e: React.PointerEvent<HTMLDivElement>) {
    const d = depart.current;
    depart.current = null;
    setEnDeplacement(false);
    // Un TOUCHER sans déplacement bascule l'agrandissement (le survol n'existe pas au tactile).
    if (d && !d.bouge && e.pointerType === "touch") setAgrandie((a) => !a);
  }

  const feuxActifs = agrandie && !enDeplacement && !reduit;

  return (
    <aside
      aria-label="66e anniversaire de l'indépendance de la Côte d'Ivoire — affiche déplaçable, survoler pour agrandir"
      className="fixed z-[60] print:hidden"
      style={{ left: x, top: y, width: largeur, transition: enDeplacement ? "none" : "left 0.3s ease, top 0.3s ease, width 0.3s ease" }}
    >
      {/* Animations des feux d'artifice (noms uniques pour ne rien polluer). */}
      <style>{`
        @keyframes fete-ci-etincelle {
          0% { transform: translate(0, 0) scale(1); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.2); opacity: 0; }
        }
        @keyframes fete-ci-anneau {
          0% { transform: scale(0.2); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>

      <div
        role="img"
        aria-label="Affiche : 66e anniversaire de l'indépendance de la Côte d'Ivoire, 7 août 1960 – 7 août 2026, bonne fête de l'Indépendance"
        onPointerDown={surAppui}
        onPointerMove={surDeplacement}
        onPointerUp={surRelachement}
        onPointerCancel={surRelachement}
        onMouseEnter={() => setAgrandie(true)}
        onMouseLeave={() => setAgrandie(false)}
        className={`relative select-none touch-none ${enDeplacement ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {/* Feux d'artifice au survol : étincelles + anneaux au-dessus de l'affiche. */}
        {feuxActifs && (
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
            {ETINCELLES.map((e, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/4 h-2 w-2 rounded-full"
                style={{
                  backgroundColor: e.couleur,
                  boxShadow: `0 0 8px 2px ${e.couleur}`,
                  ["--tx" as string]: `${e.tx}px`,
                  ["--ty" as string]: `${e.ty}px`,
                  animation: `fete-ci-etincelle 1.6s ease-out ${e.delai}s infinite`,
                }}
              />
            ))}
            <span
              className="absolute left-1/4 top-1/5 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/80"
              style={{ animation: "fete-ci-anneau 1.8s ease-out 0.2s infinite" }}
            />
            <span
              className="absolute left-3/4 top-1/4 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-orange-400/80"
              style={{ animation: "fete-ci-anneau 1.8s ease-out 0.9s infinite" }}
            />
          </span>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element -- fichier statique local optimisé (WebP), dimensions fixées par le conteneur */}
        <img
          src={IMAGE}
          alt="66e anniversaire de l'indépendance de la Côte d'Ivoire — 7 août 1960 – 7 août 2026 — Bonne fête de l'Indépendance !"
          width={640}
          height={960}
          draggable={false}
          className={`h-auto w-full rounded-2xl border-2 border-amber-300/70 shadow-2xl ${
            feuxActifs ? "shadow-amber-500/30" : ""
          }`}
        />

        {/* Fermeture (mémorisée pour la session). */}
        <button
          type="button"
          onClick={fermer}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Fermer l'affiche de la fête de l'Indépendance"
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-cream-200 bg-white text-ink-700/70 shadow-md transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X size={14} />
        </button>
      </div>
    </aside>
  );
}
