"use client";

import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

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

// ── Variantes de CONTENU (graphiques, listes…) : bornées à l'ÉCRAN ────────────────────────────
// Une page imprimée (A4 ≈ 794 px) passe SOUS le seuil : un contenu basculé par la seule largeur
// imprimerait sa variante mobile. Ce détecteur exige en plus le média « screen » — faux pendant
// l'impression — et réagit aux événements d'impression : le papier garde la version ordinateur.
const REQUETE_ECRAN = "screen";
// « beforeprint » précède la bascule en média « print » : matchMedia("print") y est encore faux.
// On force donc la variante ordinateur nous-mêmes, en SYNCHRONE (window.print() lancé depuis un
// onClick ne laisse passer aucune microtâche avant la capture), et en DEUX passes : la 1re
// remonte les contenus ordinateur ; ResponsiveContainer (Recharts) mesure alors dans un useEffect,
// mise à jour de priorité « Default », donc différée APRÈS la capture ; la 2e passe synchrone
// l'entraîne (React 19 rend Sync et Default ensemble). Sur ordinateur, aucun rendu.
const abonnesEcran = new Set<() => void>();
let passeImpression = 0; // 0 = hors impression
let mobileAvantImpression = false;
let ecouteImpression = false;

function ecranMobile(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REQUETE_ECRAN).matches && !window.matchMedia("print").matches && !window.matchMedia(REQUETE_BUREAU).matches;
}

function notifierEcran() {
  for (const r of abonnesEcran) r();
}

function avantImpression() {
  if (passeImpression > 0) return;
  mobileAvantImpression = ecranMobile();
  passeImpression = 1;
  if (!mobileAvantImpression) return; // ordinateur : l'instantané reste 0, aucun rendu
  flushSync(notifierEcran);
  passeImpression = 2;
  flushSync(notifierEcran);
}

function apresImpression() {
  const rendre = mobileAvantImpression;
  passeImpression = 0;
  mobileAvantImpression = false;
  if (rendre) notifierEcran();
}

function sabonnerEcran(rappel: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  if (!ecouteImpression) {
    ecouteImpression = true;
    window.addEventListener("beforeprint", avantImpression);
    window.addEventListener("afterprint", apresImpression);
  }
  abonnesEcran.add(rappel);
  const listes = [window.matchMedia(REQUETE_BUREAU), window.matchMedia(REQUETE_ECRAN), window.matchMedia("print")];
  for (const l of listes) l.addEventListener("change", rappel);
  window.addEventListener("resize", rappel);
  return () => {
    abonnesEcran.delete(rappel);
    for (const l of listes) l.removeEventListener("change", rappel);
    window.removeEventListener("resize", rappel);
  };
}

// 1 = écran mobile ; 0 = ordinateur, rendu serveur ou impression lancée depuis un ordinateur ;
// -1 / -2 = passes d'impression lancées depuis un écran mobile (rendu ordinateur).
function instantaneEcran(): number {
  if (passeImpression > 0) return mobileAvantImpression ? -passeImpression : 0;
  return ecranMobile() ? 1 : 0;
}

const ZERO = () => 0;

/**
 * ÉCRAN MOBILE — même seuil que la variante CSS « mobile: » (screen and width < 64rem).
 * À utiliser pour basculer un CONTENU (graphique Recharts → classement lisible, etc.) : jamais
 * vrai au rendu serveur ni à l'impression, l'ordinateur et le papier gardent leur rendu.
 */
export function useEcranMobile(): boolean {
  return useSyncExternalStore(sabonnerEcran, instantaneEcran, ZERO) === 1;
}

/**
 * IMPRESSION LANCÉE DEPUIS UN ÉCRAN MOBILE — vrai seulement pendant les passes -1 / -2, où la
 * variante ordinateur est (re)montée à l'intérieur de « beforeprint ». Les graphiques Recharts
 * y coupent leur animation (« isAnimationActive={impression ? false : undefined} ») : sans
 * requestAnimationFrame avant la capture, ils resteraient à t = 0 (barres nulles) sur le papier.
 * Toujours faux au rendu serveur et sur ordinateur : « undefined » y laisse le défaut Recharts.
 * À appeler AVANT tout « if (mobile) return … » (ordre des hooks stable).
 */
export function useImpressionDepuisEcranMobile(): boolean {
  return useSyncExternalStore(sabonnerEcran, instantaneEcran, ZERO) < 0;
}
