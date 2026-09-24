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

/**
 * LARGEUR SOUS LE SEUIL MOBILE (< 64rem), sans condition de pointeur : sert à ne monter
 * qu'UNE fois les composants lourds partagés (barre d'outils, cloche de notifications),
 * présents à la fois dans l'en-tête bureau et dans l'en-tête mobile.
 *
 * L'instantané SERVEUR vaut TOUJOURS false, et c'est tout l'intérêt :
 *  - l'en-tête BUREAU rend ses outils quand « !sousSeuil » — donc au rendu serveur (HTML
 *    rigoureusement identique à aujourd'hui) et sur ordinateur, mais plus sur téléphone
 *    après hydratation ;
 *  - l'en-tête MOBILE les rend quand « sousSeuil » — donc jamais au rendu serveur ni sur
 *    ordinateur, et seulement sur téléphone après hydratation.
 * Chaque appareil ne conserve ainsi qu'UN exemplaire de chaque composant lourd.
 */
const REQUETE_LARGEUR = "(max-width: 1023.98px)";

function sabonnerLargeur(rappel: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const liste = window.matchMedia(REQUETE_LARGEUR);
  liste.addEventListener("change", rappel);
  return () => liste.removeEventListener("change", rappel);
}

function lireLargeur(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REQUETE_LARGEUR).matches;
}

const FAUX = () => false;

export function useSousSeuilMobile(): boolean {
  return useSyncExternalStore(sabonnerLargeur, lireLargeur, FAUX);
}
