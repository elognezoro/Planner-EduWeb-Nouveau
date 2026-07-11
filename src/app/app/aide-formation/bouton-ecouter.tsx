"use client";

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";

/** Nettoie le Markdown/HTML léger pour une lecture vocale plus fluide. */
function nettoyer(t: string): string {
  return t
    .replace(/<[^>]+>/g, " ")
    .replace(/`{1,3}/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+]\s*/gm, "")
    .replace(/[*_#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lecteur audio par synthèse vocale du navigateur (fr-FR). Aucune dépendance ni fichier :
 * lit le texte fourni via l'API SpeechSynthesis. Ne s'affiche que si l'API est disponible.
 */
export function BoutonEcouter({ texte, compact, label = "Écouter" }: { texte: string; compact?: boolean; label?: string }) {
  const [parle, setParle] = useState(false);
  const [dispo, setDispo] = useState(false);

  useEffect(() => {
    setDispo(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  if (!dispo || !texte.trim()) return null;

  const lire = () => {
    const synth = window.speechSynthesis;
    if (parle) { synth.cancel(); setParle(false); return; }
    const u = new SpeechSynthesisUtterance(nettoyer(texte));
    u.lang = "fr-FR";
    u.rate = 0.98;
    const voixFr = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (voixFr) u.voice = voixFr;
    u.onend = () => setParle(false);
    u.onerror = () => setParle(false);
    synth.cancel();
    synth.speak(u);
    setParle(true);
  };

  const cls = compact
    ? "inline-flex items-center gap-1 rounded-full border border-cream-300 px-2 py-0.5 text-[11px] font-semibold text-forest-700 hover:bg-cream-100"
    : "inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50";

  return (
    <button type="button" onClick={lire} className={cls} title={parle ? "Arrêter la lecture" : "Écouter"} aria-label={parle ? "Arrêter la lecture" : "Écouter le texte"}>
      {parle ? <Square size={compact ? 11 : 13} /> : <Volume2 size={compact ? 11 : 13} />}
      {parle ? "Arrêter" : label}
    </button>
  );
}
