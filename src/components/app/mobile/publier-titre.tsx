"use client";

import { useEffect } from "react";
import { publierTitrePage } from "@/lib/mobile/titre-page";

/**
 * Publie le titre de la page vers l'en-tête mobile (voir lib/mobile/titre-page.ts).
 * Ne rend AUCUN élément : sur ordinateur, ce composant est strictement invisible et sans
 * effet — l'en-tête mobile, seul abonné, n'existe pas au-dessus de 1024 px.
 */
export function PublierTitreMobile({ titre }: { titre: string }) {
  useEffect(() => {
    publierTitrePage(titre);
    return () => publierTitrePage(null);
  }, [titre]);
  return null;
}
