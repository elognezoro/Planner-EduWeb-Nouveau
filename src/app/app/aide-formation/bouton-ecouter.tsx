"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";

/** Nettoie le Markdown/HTML léger et décode les entités pour une lecture vocale plus fluide. */
function nettoyer(t: string): string {
  let s = t.replace(/<[^>]+>/g, " ");
  // Décode les entités HTML (&amp; &nbsp; &lt;…) via le DOM — sinon elles seraient lues telles quelles.
  if (typeof document !== "undefined") {
    const el = document.createElement("textarea");
    el.innerHTML = s;
    s = el.value;
  }
  return s
    .replace(/`{1,3}/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[#>\-*+]\s*/gm, "")
    .replace(/[*_#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe un long texte en segments ≤ ~1500 caractères, aux frontières de phrases. */
function segmenter(texte: string, taille = 1500): string[] {
  if (texte.length <= taille) return [texte];
  const phrases = texte.match(/[^.!?]+[.!?]*\s*/g) ?? [texte];
  const segments: string[] = [];
  let courant = "";
  for (const p of phrases) {
    if (courant.length + p.length > taille && courant) { segments.push(courant.trim()); courant = ""; }
    courant += p;
  }
  if (courant.trim()) segments.push(courant.trim());
  return segments;
}

/**
 * Lecteur audio des narratifs. Tente d'abord la synthèse vocale NEURONALE côté serveur
 * (voix naturelle, via /api/tts si un fournisseur TTS est configuré), puis retombe
 * automatiquement sur la voix du navigateur (SpeechSynthesis) — sans clé ni réseau.
 */
export function BoutonEcouter({ texte, compact, label = "Écouter" }: { texte: string; compact?: boolean; label?: string }) {
  const [parle, setParle] = useState(false);
  const [charge, setCharge] = useState(false);
  const [dispoNavigateur, setDispoNavigateur] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const arreteRef = useRef(false);

  useEffect(() => {
    setDispoNavigateur(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => stopTout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!texte.trim()) return null;

  function stopTout() {
    arreteRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  /** Joue un segment via TTS neuronal. Renvoie « indisponible » pour déclencher le repli. */
  async function jouerSegmentNeural(segment: string): Promise<"ok" | "indisponible"> {
    abortRef.current = new AbortController();
    let rep: Response;
    try {
      rep = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: segment }),
        signal: abortRef.current.signal,
      });
    } catch {
      return "indisponible"; // réseau coupé ou requête annulée
    }
    if (!rep.ok) return "indisponible"; // 503 (non configuré), 401, etc. → repli navigateur
    const blob = await rep.blob();
    if (arreteRef.current) return "ok";
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("audio"));
        audio.play().catch(reject);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    return "ok";
  }

  function lireNavigateur(txt: string) {
    if (!(typeof window !== "undefined" && "speechSynthesis" in window)) { setParle(false); return; }
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = "fr-FR";
    u.rate = 0.98;
    const voixFr = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (voixFr) u.voice = voixFr;
    u.onend = () => setParle(false);
    u.onerror = () => setParle(false);
    synth.cancel();
    synth.speak(u);
  }

  async function lire() {
    if (parle || charge) { stopTout(); setParle(false); setCharge(false); return; }
    const txt = nettoyer(texte);
    if (!txt) return;

    arreteRef.current = false;
    setCharge(true);

    // 1) Voix neuronale (segment par segment). Repli au 1er segment si non disponible.
    const segments = segmenter(txt);
    let neuralOk = false;
    for (let i = 0; i < segments.length; i++) {
      if (arreteRef.current) break;
      const etat = await jouerSegmentNeural(segments[i]);
      if (etat === "indisponible") {
        if (i === 0) break; // aucun segment lu en neuronal → on bascule sur le navigateur
        neuralOk = true; // déjà commencé en neuronal : on s'arrête proprement
        break;
      }
      neuralOk = true;
      if (i === 0) { setCharge(false); setParle(true); } // 1er segment lancé
    }

    if (!neuralOk && !arreteRef.current) {
      // 2) Repli : voix du navigateur (tout le texte d'un coup).
      setCharge(false);
      setParle(true);
      lireNavigateur(txt);
      return;
    }
    if (!arreteRef.current) { setParle(false); setCharge(false); }
  }

  // N'affiche rien si aucune voie possible (ni navigateur, ni — potentiellement — neuronale).
  // La voix neuronale peut exister même sans support navigateur : on tente donc toujours.
  const rienDePossible = !dispoNavigateur && typeof window !== "undefined" && !("fetch" in window);
  if (rienDePossible) return null;

  const actif = parle || charge;
  const cls = compact
    ? "inline-flex items-center gap-1 rounded-full border border-cream-300 px-2 py-0.5 text-[11px] font-semibold text-forest-700 hover:bg-cream-100 disabled:opacity-60"
    : "inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-60";
  const taille = compact ? 11 : 13;

  return (
    <button
      type="button"
      onClick={lire}
      className={cls}
      title={actif ? "Arrêter la lecture" : "Écouter"}
      aria-label={actif ? "Arrêter la lecture" : "Écouter le texte"}
    >
      {charge ? <Loader2 size={taille} className="animate-spin" /> : parle ? <Square size={taille} /> : <Volume2 size={taille} />}
      {charge ? "Chargement…" : parle ? "Arrêter" : label}
    </button>
  );
}
