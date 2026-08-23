"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Balise de PRÉSENCE : signale chaque page touchée (changements de route côté client
 * compris — un layout serveur ne les verrait pas) à /api/presence, qui alimente la page
 * « Utilisateurs connectés ». Silencieuse, dédupliquée, et jamais bloquante : sendBeacon
 * survit à la navigation, avec repli fetch keepalive.
 */
export function SuiviAcces() {
  const chemin = usePathname();
  const dernier = useRef<string | null>(null);

  useEffect(() => {
    if (!chemin || dernier.current === chemin) return;
    dernier.current = chemin;
    const corps = JSON.stringify({ chemin });
    try {
      const envoye = navigator.sendBeacon?.(
        "/api/presence",
        new Blob([corps], { type: "application/json" }),
      );
      if (!envoye) {
        void fetch("/api/presence", {
          method: "POST",
          body: corps,
          keepalive: true,
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
    } catch {
      /* la présence ne doit jamais gêner la navigation */
    }
  }, [chemin]);

  return null;
}
