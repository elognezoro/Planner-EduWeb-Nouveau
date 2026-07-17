"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

/**
 * Bouton de DICTÉE VOCALE (audio → texte). Enregistre au micro puis envoie l'audio à
 * /api/transcription (OpenAI, gated par TTS_API_KEY) et transmet le texte via `onTexte`.
 * Ne s'affiche que si l'enregistrement micro est disponible dans le navigateur.
 */
export function BoutonDictee({ onTexte, compact, label = "Dicter" }: {
  onTexte: (texte: string) => void;
  compact?: boolean;
  label?: string;
}) {
  const [dispo] = useState(
    () =>
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window !== "undefined" &&
      "MediaRecorder" in window
  );
  const [etat, setEtat] = useState<"idle" | "enregistre" | "transcrit">("idle");
  const [erreur, setErreur] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => { arreterFlux(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function arreterFlux() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function demarrer() {
    setErreur(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => envoyer(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      rec.start();
      setEtat("enregistre");
    } catch {
      setErreur("Micro indisponible ou refusé.");
      setEtat("idle");
    }
  }

  function arreter() {
    recorderRef.current?.stop();
    arreterFlux();
    setEtat("transcrit");
  }

  async function envoyer(blob: Blob) {
    if (blob.size === 0) { setEtat("idle"); return; }
    try {
      const rep = await fetch("/api/transcription", {
        method: "POST",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!rep.ok) {
        setErreur(rep.status === 503 ? "Dictée non configurée." : "Transcription indisponible.");
      } else {
        const data = (await rep.json().catch(() => null)) as { texte?: string } | null;
        if (data?.texte) onTexte(data.texte);
      }
    } catch {
      setErreur("Transcription indisponible.");
    } finally {
      setEtat("idle");
    }
  }

  if (!dispo) return null;

  const actif = etat !== "idle";
  const cls = compact
    ? "inline-flex items-center gap-1 rounded-full border border-cream-300 px-2 py-0.5 text-[11px] font-semibold text-forest-700 hover:bg-cream-100"
    : "inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50";
  const taille = compact ? 11 : 13;

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => (etat === "enregistre" ? arreter() : etat === "idle" ? demarrer() : undefined)}
        disabled={etat === "transcrit"}
        className={cls + (etat === "enregistre" ? " !border-red-300 !text-red-700 !bg-red-50" : "")}
        title={etat === "enregistre" ? "Arrêter et transcrire" : "Dicter (micro)"}
        aria-label={etat === "enregistre" ? "Arrêter la dictée" : "Démarrer la dictée"}
      >
        {etat === "transcrit" ? <Loader2 size={taille} className="animate-spin" /> : etat === "enregistre" ? <Square size={taille} /> : <Mic size={taille} />}
        {etat === "transcrit" ? "Transcription…" : etat === "enregistre" ? "Arrêter" : label}
      </button>
      {erreur && <span className="text-[11px] font-medium text-amber-700">{erreur}</span>}
    </span>
  );
}
