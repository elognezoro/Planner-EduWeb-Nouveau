"use client";

import { useSyncExternalStore } from "react";

/**
 * DÉTECTEURS D'APPAREIL — la même bascule que le CSS, jamais une autre.
 *
 * Le seuil est celui de Tailwind (« lg: » = min-width: 64rem). Il est exprimé en REM, comme
 * dans le CSS : un seuil écrit en pixels (1024 px) divergerait dès que l'utilisateur change
 * la taille de police de son navigateur. Avec une police « grande » (20 px), 64rem vaut
 * 1280 px : entre 1024 et 1280 px, le CSS affiche la coquille MOBILE — si le détecteur disait
 * encore « ordinateur », le menu « Plus », le compte et les réglages ne s'ouvriraient plus.
 * « Sous le seuil » est donc défini comme la NÉGATION exacte de « lg: ».
 *
 * On écoute à la fois les changements des requêtes média ET le redimensionnement de la
 * fenêtre : l'événement de changement de média n'est pas émis de façon fiable partout.
 *
 * Rendu serveur : les deux détecteurs renvoient « false », ce qui évite toute différence
 * entre le HTML du serveur et celui du client.
 */
const REQUETE_BUREAU = "(min-width: 64rem)";
const REQUETE_DOIGT = "(pointer: coarse)";

function sabonnerMedias(rappel: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const listes = [window.matchMedia(REQUETE_BUREAU), window.matchMedia(REQUETE_DOIGT)];
  for (const l of listes) l.addEventListener("change", rappel);
  window.addEventListener("resize", rappel);
  return () => {
    for (const l of listes) l.removeEventListener("change", rappel);
    window.removeEventListener("resize", rappel);
  };
}

function sousSeuil(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return !window.matchMedia(REQUETE_BUREAU).matches;
}

function tactileCompact(): boolean {
  return sousSeuil() && window.matchMedia(REQUETE_DOIGT).matches;
}

const FAUX = () => false;

/**
 * Largeur SOUS LE SEUIL MOBILE (coquille mobile affichée), sans condition de pointeur.
 *
 * Sert à ne monter qu'UN exemplaire des composants lourds présents dans les deux en-têtes :
 *  - l'en-tête BUREAU rend ses outils quand « !sousSeuil » — donc au rendu serveur (HTML
 *    identique à avant) et sur ordinateur, mais plus sur téléphone après hydratation ;
 *  - l'en-tête MOBILE les rend quand « sousSeuil » — jamais au rendu serveur ni sur ordinateur.
 */
export function useSousSeuilMobile(): boolean {
  return useSyncExternalStore(sabonnerMedias, sousSeuil, FAUX);
}

/**
 * APPAREIL TACTILE COMPACT — téléphone ou tablette au doigt, et non une fenêtre de bureau
 * rétrécie. Les gestes (tirer pour rafraîchir…) sont réservés à ce cas.
 */
export function useAppareilTactileCompact(): boolean {
  return useSyncExternalStore(sabonnerMedias, tactileCompact, FAUX);
}
