"use client";

import { useState } from "react";
import { ChevronUp, Plus } from "lucide-react";

/**
 * FORMULAIRE DE CRÉATION REPLIÉ SUR TÉLÉPHONE.
 *
 * Sur les pages de vie scolaire, le formulaire « Nouvelle … » occupe tout le premier écran du
 * téléphone, avant les listes que l'on vient consulter. Sur téléphone, il est replié derrière un
 * bouton pleine largeur et se déplie EN PLACE (le contenu n'est rendu qu'une fois : pas de
 * formulaire en double, pas d'identifiant dupliqué).
 *
 * Ordinateur et impression : le bouton est absent (« lg:hidden print:hidden ») et l'enveloppe du
 * contenu est un simple bloc sans style — le rendu reste identique au pixel près. L'enveloppe
 * entoure UN SEUL élément bloc (la carte du formulaire).
 */
export function FormulaireReplieMobile({
  libelle,
  children,
}: {
  /** Libellé du bouton (ex. « Nouvelle demande »). */
  libelle: string;
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <div className="lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-semibold shadow-soft ${
            ouvert ? "border border-cream-300 bg-white text-forest-800 active:bg-cream-100" : "bg-forest-800 text-cream-50 active:bg-forest-700"
          }`}
        >
          {ouvert ? <ChevronUp aria-hidden size={18} /> : <Plus aria-hidden size={18} />}
          {ouvert ? "Replier le formulaire" : libelle}
        </button>
      </div>
      <div className={ouvert ? undefined : "mobile:hidden"}>{children}</div>
    </>
  );
}
