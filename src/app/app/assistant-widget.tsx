"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { poserQuestionAssistant } from "./assistant-actions";
import { BoutonDictee } from "@/components/ui/bouton-dictee";

type Msg = { role: "user" | "assistant"; contenu: string };

/** Rendu léger du texte de l'assistant : **gras** + retours à la ligne (sans HTML, anti-XSS). */
function TexteRiche({ texte }: { texte: string }) {
  return (
    <>
      {texte.split("\n").map((ligne, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {ligne.split(/(\*\*[^*]+\*\*)/g).map((bout, j) =>
            /^\*\*[^*]+\*\*$/.test(bout)
              ? <strong key={j}>{bout.slice(2, -2)}</strong>
              : <span key={j}>{bout}</span>,
          )}
        </span>
      ))}
    </>
  );
}

const SUGGESTIONS = [
  "Qu'est-ce qu'EduWeb Planner ?",
  "Comment créer un compte ?",
  "Que puis-je faire sur la plateforme ?",
];

/**
 * Chatbot d'assistance IA — bouton flottant présent sur toutes les pages de l'application.
 * L'historique reste local (non persisté) ; les données consultées sont cloisonnées au
 * périmètre de l'utilisateur côté serveur (cf. assistant-actions / lib/ia/assistant).
 */
export function AssistantWidget({ prenom }: { prenom?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ouvert) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ouvert, enCours]);

  async function envoyer(texte: string) {
    const q = texte.trim();
    if (!q || enCours) return;
    setSaisie("");
    const histo = messages;
    setMessages((m) => [...m, { role: "user", contenu: q }]);
    setEnCours(true);
    try {
      const r = await poserQuestionAssistant(histo, q);
      setMessages((m) => [...m, { role: "assistant", contenu: r.ok ? r.texte : r.message ?? "Une erreur est survenue." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", contenu: "L'assistant est momentanément indisponible. Réessayez." }]);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      {!ouvert && (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-forest-600 text-white shadow-lg ring-1 ring-forest-700/20 transition hover:bg-forest-700 hover:scale-105 print:hidden"
          aria-label="Ouvrir l'assistant IA"
          title="Assistant IA"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Panneau */}
      {ouvert && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[min(70vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-2xl print:hidden">
          <header className="flex items-center justify-between gap-2 border-b border-cream-200 bg-gradient-to-r from-forest-600 to-forest-800 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><Sparkles size={17} /></span>
              <div>
                <p className="font-display text-sm font-bold leading-tight">Assistant EduWeb</p>
                <p className="text-[11px] text-cream-50/80">Aide &amp; consultation de vos données</p>
              </div>
            </div>
            <button type="button" onClick={() => setOuvert(false)} className="rounded-full p-1 hover:bg-white/15" aria-label="Fermer"><X size={18} /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-sm bg-cream-100 px-3 py-2 text-sm text-ink-800">
                  Bonjour{prenom ? ` ${prenom}` : ""} 👋 Je suis l&apos;assistant EduWeb Planner. Posez-moi une question sur la plateforme ; une fois connecté, je peux aussi consulter vos données (emploi du temps, notes, notifications…).
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => envoyer(s)} className="rounded-full border border-forest-200 bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-forest-100">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-forest-600 px-3 py-2 text-sm text-white"
                  : "max-w-[90%] rounded-2xl rounded-tl-sm bg-cream-100 px-3 py-2 text-sm leading-relaxed text-ink-800"}>
                  {m.role === "assistant" ? <TexteRiche texte={m.contenu} /> : m.contenu}
                </div>
              </div>
            ))}
            {enCours && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-cream-100 px-3 py-2 text-sm text-ink-700/70">
                  <Loader2 size={14} className="animate-spin" /> L&apos;assistant réfléchit…
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          <div className="flex items-center justify-end px-3 pt-1">
            <BoutonDictee onTexte={(t) => setSaisie((s) => (s ? `${s} ${t}` : t))} compact label="Dicter" />
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); envoyer(saisie); }}
            className="flex items-end gap-2 border-t border-cream-200 px-3 py-2.5"
          >
            <textarea
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(saisie); } }}
              rows={1}
              placeholder="Votre question…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
            <button
              type="submit"
              disabled={enCours || !saisie.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-600 text-white hover:bg-forest-700 disabled:opacity-50"
              aria-label="Envoyer"
            >
              {enCours ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
