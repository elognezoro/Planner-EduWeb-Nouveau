"use client";

import { useEffect, useRef } from "react";
import { CLE_ACTIVITE } from "@/lib/inactivite-partagee";

/**
 * Veilleur de RECONNEXION de la page /connexion : quand la connexion se fait dans un AUTRE
 * onglet du même navigateur, cet onglet-ci se recharge tout seul — la page serveur, voyant la
 * session, le redirige alors vers la page de retour ou l'accueil de l'espace.
 *
 * Déclencheurs : l'horodatage d'activité partagé (localStorage, écrit à la soumission du
 * formulaire de connexion et par le veilleur d'inactivité de l'espace connecté), le retour de
 * focus/visibilité, et la restauration depuis le cache d'historique (bouton Précédent). La
 * vérification passe par /api/auth/session : on ne recharge QUE si une session existe
 * réellement — jamais de boucle de rechargement, jamais de saisie en cours perdue pour rien.
 */
export function VeilleReconnexion() {
  const dejaRelance = useRef(false);

  useEffect(() => {
    let minuteries: number[] = [];
    // Avorte un fetch encore en vol au DÉMONTAGE : jamais de reload() après avoir quitté la
    // page (une saisie entamée sur /inscription ou /mot-de-passe-oublie serait perdue).
    const controleur = new AbortController();
    let enVol = false;

    const verifier = async () => {
      if (dejaRelance.current || enVol) return;
      enVol = true;
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store", signal: controleur.signal });
        if (!r.ok) return;
        const s = (await r.json()) as { user?: unknown } | null;
        // Gardes RE-testées après l'attente : démontage ou premier reload survenus entre-temps.
        if (s && s.user && !dejaRelance.current && !controleur.signal.aborted) {
          dejaRelance.current = true;
          window.location.reload();
        }
      } catch {
        /* hors-ligne / endpoint indisponible / avorté : silencieux, prochain signal */
      } finally {
        enVol = false;
      }
    };

    // La connexion de l'autre onglet prend une à quelques secondes (vérification du mot de
    // passe puis pose du cookie) : plusieurs vérifications espacées après chaque signal.
    const planifier = () => {
      for (const m of minuteries) window.clearTimeout(m);
      minuteries = [1500, 4000, 8000].map((d) => window.setTimeout(verifier, d));
    };

    const surStockage = (e: StorageEvent) => {
      if (e.key === CLE_ACTIVITE) planifier();
    };
    const surFocus = () => void verifier();
    const surVisibilite = () => {
      // Uniquement au RETOUR sur l'onglet — le quitter n'a rien à vérifier.
      if (document.visibilityState === "visible") void verifier();
    };
    const surRestauration = (e: PageTransitionEvent) => {
      // Page restaurée depuis le cache d'historique : l'état serveur n'a pas été rejoué.
      if (e.persisted) void verifier();
    };

    window.addEventListener("storage", surStockage);
    window.addEventListener("focus", surFocus);
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("pageshow", surRestauration);
    return () => {
      window.removeEventListener("storage", surStockage);
      window.removeEventListener("focus", surFocus);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pageshow", surRestauration);
      for (const m of minuteries) window.clearTimeout(m);
      controleur.abort();
    };
  }, []);

  return null;
}
