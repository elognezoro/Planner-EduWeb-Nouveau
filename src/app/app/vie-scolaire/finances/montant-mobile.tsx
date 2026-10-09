import { fcfa } from "./types";

/** Montant abrégé (« 125,5 M F », « 45 k F ») pour les tuiles étroites du téléphone. */
export const fcfaCompact = (n: number) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n) + " F";

/**
 * MONTANT D'UNE TUILE — exact sur ordinateur et à l'impression (« 125 450 000 F », texte
 * strictement identique à fcfa()) ; ABRÉGÉ à l'écran du téléphone, où le montant exact,
 * insécable (espaces fines U+202F), débordait de la tuile dès 9 chiffres. Le montant exact
 * reste lu par les lecteurs d'écran.
 *
 * Composant neutre (ni client ni serveur) : utilisable partout.
 */
export function MontantTuile({ montant }: { montant: number }) {
  return (
    <>
      <span className="mobile:hidden">{fcfa(montant)}</span>
      <span className="hidden mobile:inline">
        <span aria-hidden>{fcfaCompact(montant)}</span>
        <span className="sr-only">{fcfa(montant)}</span>
      </span>
    </>
  );
}
