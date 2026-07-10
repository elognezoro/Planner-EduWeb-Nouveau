"use client";

import { useEffect } from "react";

/**
 * Préserve la position de défilement après l'enregistrement d'un formulaire — valable sur
 * toute l'application (monté une seule fois dans le layout racine).
 *
 * Les Server Actions Next.js (revalidatePath) re-rendent la page courante et peuvent ramener
 * le défilement en haut. On mémorise la position AU MOMENT de la soumission (écouteur en phase
 * de capture, donc avant le traitement de React), puis pendant une courte fenêtre on la rétablit
 * si elle a « sauté ». On s'arrête dès que :
 *   - l'utilisateur défile lui-même (molette, tactile, clavier) — on respecte son intention ;
 *   - la page a changé (navigation) — restaurer l'ancienne position n'aurait pas de sens ;
 *   - la fenêtre de temps est écoulée.
 *
 * Sans effet nuisible si le défilement n'était pas réinitialisé : la boucle ne fait rien tant
 * que la position reste correcte.
 */
export function PreservationScroll() {
  useEffect(() => {
    let animation = 0;
    let nettoyer: (() => void) | null = null;

    const surSubmit = () => {
      const cible = window.scrollY;
      if (cible <= 0) return; // déjà en haut : rien à préserver

      // Annule une éventuelle restauration déjà en cours (soumissions rapprochées).
      cancelAnimationFrame(animation);
      nettoyer?.();

      const cheminInitial = window.location.pathname;
      const debut = performance.now();
      const DUREE = 2000; // couvre le temps du Server Action + du refresh
      let actif = true;

      const stop = () => {
        actif = false;
      };
      window.addEventListener("wheel", stop, { passive: true });
      window.addEventListener("touchmove", stop, { passive: true });
      window.addEventListener("keydown", stop);
      nettoyer = () => {
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchmove", stop);
        window.removeEventListener("keydown", stop);
        nettoyer = null;
      };

      const boucle = () => {
        if (!actif || window.location.pathname !== cheminInitial || performance.now() - debut > DUREE) {
          nettoyer?.();
          return;
        }
        // Le refresh peut ramener le défilement plus haut : on rétablit la position mémorisée.
        // « instant » est impératif : l'app applique `scroll-behavior: smooth`, un scrollTo animé
        // rentrerait en conflit avec cette boucle (position en retard, appels répétés, à-coups).
        if (Math.abs(window.scrollY - cible) > 2) window.scrollTo({ top: cible, left: 0, behavior: "instant" });
        animation = requestAnimationFrame(boucle);
      };
      animation = requestAnimationFrame(boucle);
    };

    // Capture : s'exécute avant le gestionnaire d'action de React, la position est donc exacte.
    document.addEventListener("submit", surSubmit, true);
    return () => {
      document.removeEventListener("submit", surSubmit, true);
      cancelAnimationFrame(animation);
      nettoyer?.();
    };
  }, []);

  return null;
}
