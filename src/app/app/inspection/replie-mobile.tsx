"use client";

import { useState } from "react";
import { ChevronUp, Plus, Settings2 } from "lucide-react";

/**
 * FORMULAIRE REPLIÉ SUR TÉLÉPHONE.
 *
 * Sur ordinateur (et à l'impression), le bloc enveloppé s'affiche exactement comme avant : la
 * seule différence est une simple <div> bloc autour de lui (neutre en mise en page).
 * Sur téléphone, un long formulaire de saisie (« Planifier une visite », « Nouvelle APFC »…)
 * repoussait la liste consultée sur le terrain de plusieurs écrans : il est replié derrière un
 * bouton pleine largeur, la liste vient tout de suite après. Bascule purement CSS : aucun saut
 * de mise en page au chargement, et le formulaire n'est monté qu'une fois (pas de champ « name »
 * en double).
 */
export function ReplieMobile({
  libelle,
  children,
  variante = "principal",
}: {
  /** Libellé du bouton d'ouverture (ex. « Planifier une visite »). */
  libelle: string;
  children: React.ReactNode;
  /** « principal » : bouton plein (action de la page) ; « secondaire » : bouton contour (réglage). */
  variante?: "principal" | "secondaire";
}) {
  const [ouvert, setOuvert] = useState(false);
  const Icone = ouvert ? ChevronUp : variante === "principal" ? Plus : Settings2;
  return (
    <>
      <div className="lg:hidden print:hidden">
        <button
          type="button"
          aria-expanded={ouvert}
          onClick={() => setOuvert((o) => !o)}
          className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-semibold shadow-soft ${
            variante === "principal"
              ? "bg-forest-800 text-cream-50 active:bg-forest-700"
              : "border border-cream-300 bg-white text-forest-800 active:bg-cream-100"
          }`}
        >
          <Icone aria-hidden size={18} />
          {ouvert ? "Replier le formulaire" : libelle}
        </button>
      </div>
      <div className={ouvert ? undefined : "mobile:hidden"}>{children}</div>
    </>
  );
}
