"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { demarrerNavigation, signalerHorsLigne, terminerNavigation } from "@/lib/mobile/navigation";
import { estRouteFichier } from "@/lib/mobile/routes-fichiers";

/**
 * SUIVI DE NAVIGATION — téléphone uniquement (`actif` = coquille mobile affichée).
 *
 * 1. Repère l'appui sur un lien vers une AUTRE page de l'espace connecté et publie sa
 *    destination : la coquille affiche alors des zones grisées au lieu d'une page figée.
 * 2. Hors ligne, annule la navigation AVANT le routeur : sinon l'App Router, faute de réponse,
 *    recharge la page entière et le téléphone affiche sa propre page d'erreur réseau. Un écran
 *    « Pas de connexion — Réessayer » s'affiche à la place.
 * 3. À chaque VRAI changement de page, rejoue une courte animation d'entrée sur le contenu.
 *
 * La destination est effacée dès que l'adresse change (chemin OU recherche), au retour arrière,
 * à un appui sur la page courante (le routeur abandonne alors la navigation précédente) et au
 * démontage de la coquille : aucune zone grisée ne peut rester orpheline.
 *
 * Sur ordinateur, aucun écouteur n'est armé (`actif` est faux).
 */
export function SuiviNavigation({ actif, pathname }: { actif: boolean; pathname: string }) {
  const recherche = useSearchParams()?.toString() ?? "";
  const cheminAnime = useRef(pathname);

  useEffect(() => {
    if (!actif) return;
    const surClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const lien = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!lien || lien.target === "_blank" || lien.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(lien.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Seules les PAGES de l'espace connecté passent par le routeur ; les fichiers
      // (exports, PDF, Word) se téléchargent sans quitter la page.
      if (!(url.pathname === "/app" || url.pathname.startsWith("/app/"))) return;
      if (estRouteFichier(url.pathname)) return;
      // Même page (ancre, filtre, ou appui sur l'onglet courant) : le routeur abandonne une
      // éventuelle navigation en cours — on efface donc la destination au lieu de l'ignorer.
      if (url.pathname === window.location.pathname) {
        terminerNavigation();
        return;
      }
      if (!navigator.onLine) {
        // Le routeur de Next ignore un clic déjà annulé : la navigation n'est pas tentée.
        e.preventDefault();
        signalerHorsLigne(url.pathname + url.search);
        return;
      }
      demarrerNavigation(url.pathname + url.search);
    };
    // Retour arrière / avant du téléphone : la page affichée change sans clic.
    const surHistorique = () => terminerNavigation();
    // Phase de CAPTURE sur le document : passe avant le gestionnaire du routeur.
    document.addEventListener("click", surClic, true);
    window.addEventListener("popstate", surHistorique);
    return () => {
      document.removeEventListener("click", surClic, true);
      window.removeEventListener("popstate", surHistorique);
    };
  }, [actif]);

  // Adresse modifiée (chemin ou recherche) : la navigation est terminée.
  useEffect(() => {
    terminerNavigation();
  }, [pathname, recherche]);

  // Coquille démontée (déconnexion, page d'erreur) : rien ne doit survivre.
  useEffect(() => () => terminerNavigation(), []);

  // Entrée de page : seulement sur un VRAI changement de chemin — pas au chargement initial,
  // ni quand la largeur franchit le seuil.
  useEffect(() => {
    if (cheminAnime.current === pathname) return;
    cheminAnime.current = pathname;
    if (!actif) return;
    const contenu = document.querySelector<HTMLElement>("main[data-contenu-coquille]");
    if (!contenu) return;
    contenu.classList.remove("entree-page");
    // Relecture forcée de la mise en page : sans elle, retirer puis remettre la classe dans le
    // même instant ne rejouerait pas l'animation.
    void contenu.offsetWidth;
    contenu.classList.add("entree-page");
  }, [pathname, actif]);

  return null;
}
