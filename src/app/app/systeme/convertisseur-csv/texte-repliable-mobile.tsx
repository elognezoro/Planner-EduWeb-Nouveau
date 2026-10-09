"use client";

import { useState } from "react";

/**
 * TEXTE REPLIABLE SUR TÉLÉPHONE — enveloppe NEUTRE (simple bloc) autour d'UN paragraphe.
 *
 * Ordinateur et impression : rendu identique (aucune troncature, bouton masqué ; la marge basse
 * du paragraphe traverse l'enveloppe comme avant). Téléphone : le paragraphe est limité à
 * 4 lignes, avec « Lire la suite » / « Réduire » — les longues explications ne repoussent plus
 * la zone de dépôt à ~25 lignes plus bas.
 */
export function TexteRepliableMobile({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className={ouvert ? undefined : "mobile:[&>p]:line-clamp-4"}>
      {children}
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="-mt-4 mb-3 flex min-h-11 items-center text-sm font-semibold text-forest-700 underline underline-offset-2 lg:hidden print:hidden"
      >
        {ouvert ? "Réduire" : "Lire la suite"}
      </button>
    </div>
  );
}
