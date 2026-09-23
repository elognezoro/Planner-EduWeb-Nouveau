"use client";

import { useSyncExternalStore } from "react";

/**
 * APPAREIL TACTILE COMPACT — téléphone ou tablette, et non une fenêtre de bureau rétrécie.
 *
 * L'APPARENCE de l'interface mobile bascule en CSS (media query < 1024 px, variantes
 * « max-lg: »). Les COMPORTEMENTS tactiles — tirer pour rafraîchir, feuilles que l'on fait
 * glisser — doivent, eux, rester inertes sur ordinateur : un utilisateur qui réduit sa
 * fenêtre ne doit hériter d'aucun geste. D'où la condition supplémentaire « pointer: coarse »
 * (doigt) plutôt que la seule largeur.
 *
 * Rendu serveur : renvoie `false` (aucun geste armé avant l'hydratation), ce qui évite
 * toute différence entre le HTML du serveur et celui du client.
 */
const REQUETE = "(max-width: 1023.98px) and (pointer: coarse)";

function sabonner(rappel: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const liste = window.matchMedia(REQUETE);
  liste.addEventListener("change", rappel);
  return () => liste.removeEventListener("change", rappel);
}

function lire(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REQUETE).matches;
}

export function useAppareilTactileCompact(): boolean {
  return useSyncExternalStore(sabonner, lire, () => false);
}
