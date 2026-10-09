"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";

/**
 * FILTRES REPLIÉS SUR TÉLÉPHONE.
 *
 * Sur ordinateur (et à l'impression), les filtres s'affichent EN LIGNE, exactement comme avant.
 * Sur téléphone, une barre de filtres empile 5 à 8 listes pleine largeur avant le moindre
 * résultat : elle est remplacée par un bouton « Filtres » (avec le nombre de filtres actifs) qui
 * ouvre une feuille montante contenant les MÊMES contrôles. Bascule purement CSS (aucun saut de
 * mise en page au chargement) ; dans la feuille, les contrôles ne sont montés qu'à l'ouverture.
 */
export function FiltresMobiles({
  children,
  actifs = 0,
  titre = "Filtres",
  className,
}: {
  children: React.ReactNode;
  /** Nombre de filtres différents de leur valeur par défaut (pastille sur le bouton). */
  actifs?: number;
  titre?: string;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <div className={`mobile:hidden ${className ?? ""}`}>{children}</div>
      <div className="lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-haspopup="dialog"
          aria-expanded={ouvert}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-cream-300 bg-white px-5 font-semibold text-forest-800 shadow-soft active:bg-cream-100"
        >
          <SlidersHorizontal aria-hidden size={18} />
          {titre}
          {actifs > 0 && (
            <span className="rounded-full bg-forest-800 px-2 py-0.5 text-xs font-bold text-cream-50 tabular-nums">
              {actifs}
              <span className="sr-only"> actif{actifs > 1 ? "s" : ""}</span>
            </span>
          )}
        </button>
        <FeuilleBas ouvert={ouvert} onFermer={() => setOuvert(false)} titre={titre} hauteurMax="85dvh">
          <div className="space-y-3 px-2 pb-2 [&_input:not([type=checkbox]):not([type=radio])]:w-full [&_select]:w-full [&_select]:max-w-none">
            {children}
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="mt-2 min-h-12 w-full rounded-full bg-forest-800 font-semibold text-cream-50 active:bg-forest-700"
            >
              Voir les résultats
            </button>
          </div>
        </FeuilleBas>
      </div>
    </>
  );
}
