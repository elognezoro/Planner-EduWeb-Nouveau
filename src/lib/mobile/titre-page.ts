/**
 * TITRE DE LA PAGE COURANTE, pour l'en-tête mobile.
 *
 * Problème : l'en-tête vit dans la COQUILLE, donc AU-DESSUS des pages dans l'arbre React ;
 * le titre, lui, est écrit DANS chaque page (composant `PageHeader`). Un contexte React ne
 * remonte pas. On passe donc par un tout petit magasin de module : `PageHeader` publie son
 * titre à l'affichage, l'en-tête mobile s'y abonne.
 *
 * Aucune incidence sur l'ordinateur : l'en-tête mobile est le seul abonné, et il n'existe
 * qu'en dessous de 1024 px. Sur les pages sans `PageHeader`, l'en-tête retombe sur le libellé
 * de la navigation (voir entete-mobile.tsx).
 */
let titreCourant: string | null = null;
const abonnes = new Set<() => void>();

export function publierTitrePage(titre: string | null): void {
  if (titreCourant === titre) return;
  titreCourant = titre;
  for (const prevenir of abonnes) prevenir();
}

export function sabonnerTitrePage(prevenir: () => void): () => void {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
}

export function lireTitrePage(): string | null {
  return titreCourant;
}

/** Instantané serveur : aucun titre publié au rendu initial (évite toute divergence d'hydratation). */
export function titrePageServeur(): null {
  return null;
}
