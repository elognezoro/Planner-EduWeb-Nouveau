/**
 * Direction d'ouverture d'une liste déroulante : VERS LE HAUT quand l'espace sous le bouton
 * ne suffit pas à afficher le panneau ET que l'espace au-dessus est plus généreux.
 *
 * L'espace est mesuré jusqu'à la PREMIÈRE limite de rognage : l'ancêtre défilant ou tronquant
 * (overflow-y auto/scroll/hidden — les listes du produit vivent souvent dans des blocs à
 * hauteur bornée) ; à défaut, la fenêtre. À appeler AU MOMENT de l'ouverture (clic).
 */
export function ouvrirVersLeHaut(bouton: HTMLElement, hauteurPanneau = 236): boolean {
  const rect = bouton.getBoundingClientRect();
  let basLimite = window.innerHeight;
  let hautLimite = 0;
  for (let parent = bouton.parentElement; parent; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll|hidden)/.test(style.overflowY)) {
      const r = parent.getBoundingClientRect();
      basLimite = Math.min(basLimite, r.bottom);
      hautLimite = Math.max(hautLimite, r.top);
      break;
    }
  }
  const dispoBas = basLimite - rect.bottom;
  const dispoHaut = rect.top - hautLimite;
  return dispoBas < hauteurPanneau && dispoHaut > dispoBas;
}
