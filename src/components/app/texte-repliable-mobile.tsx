"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useEcranMobile } from "@/lib/mobile/appareil";

const LIMITE: Record<2 | 3 | 4, string> = {
  2: "mobile:line-clamp-2",
  3: "mobile:line-clamp-3",
  4: "mobile:line-clamp-4",
};

/**
 * PARAGRAPHE REPLIÉ SUR TÉLÉPHONE — limité à quelques lignes, avec « Lire la suite » quand le
 * texte dépasse (descriptions d'en-tête de page, notes explicatives longues).
 *
 * Ordinateur et impression : le <p> est rendu tel quel, avec les classes de l'appelant (la limite
 * est une classe « mobile: », le bouton n'existe qu'à l'écran sous le seuil et vit dans un bloc
 * « lg:hidden print:hidden ») — rendu strictement identique.
 *
 * Le bouton n'apparaît que si le texte est RÉELLEMENT tronqué (mesure au redimensionnement) :
 * une description courte reste un simple paragraphe.
 */
export function TexteRepliableMobile({
  className,
  children,
  lignes = 3,
}: {
  className?: string;
  children: React.ReactNode;
  /** Nombre de lignes visibles sur téléphone avant « Lire la suite ». */
  lignes?: 2 | 3 | 4;
}) {
  const paragraphe = useRef<HTMLParagraphElement>(null);
  const ecranMobile = useEcranMobile();
  const [deplie, setDeplie] = useState(false);
  const [deborde, setDeborde] = useState(false);

  useEffect(() => {
    const el = paragraphe.current;
    if (!el || !ecranMobile || deplie || typeof ResizeObserver === "undefined") return;
    // L'observateur se déclenche dès l'observation, puis à chaque changement de largeur.
    const observateur = new ResizeObserver(() => setDeborde(el.scrollHeight > el.clientHeight + 1));
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [ecranMobile, deplie]);

  return (
    <>
      <p ref={paragraphe} className={cn(className, !deplie && LIMITE[lignes])}>
        {children}
      </p>
      {ecranMobile && (deborde || deplie) && (
        <div className="lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setDeplie((v) => !v)}
            aria-expanded={deplie}
            className="-my-1 inline-flex min-h-11 items-center text-sm font-semibold text-forest-700 active:text-forest-900"
          >
            {deplie ? "Réduire" : "Lire la suite"}
          </button>
        </div>
      )}
    </>
  );
}
