"use client";

import { useEffect } from "react";

/**
 * Compteur de visites : enregistre UNE visite par session de navigation
 * (sessionStorage), quel que soit le point d'entrée (accueil ou application).
 * Totalement anonyme — seul le chemin d'entrée est journalisé.
 */
export function TraqueurVisite() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ew_visite")) return;
      sessionStorage.setItem("ew_visite", "1");
      void fetch("/api/visites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chemin: window.location.pathname }),
        keepalive: true,
      });
    } catch {
      // stockage indisponible (navigation privée stricte…) : on ignore silencieusement
    }
  }, []);
  return null;
}
