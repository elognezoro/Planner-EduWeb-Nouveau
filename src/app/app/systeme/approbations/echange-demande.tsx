"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Send, Loader2, ChevronDown } from "lucide-react";
import { envoyerMessageDemande } from "./actions";

export type EchangeVue = { id: string; contenu: string; duDemandeur: boolean; auteur: string; date: string };

/** Fil de discussion admin ↔ demandeur pour UNE demande (sur la page Approbations). */
export function EchangeDemande({ demandeId, echanges }: { demandeId: string; echanges: EchangeVue[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(echanges.length > 0);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, start] = useTransition();

  const envoyer = () => {
    const t = texte.trim();
    if (!t || envoi) return;
    setErreur(null);
    start(async () => {
      const r = await envoyerMessageDemande(demandeId, t);
      if (r.ok) { setTexte(""); router.refresh(); }
      else setErreur(r.message ?? "Envoi impossible.");
    });
  };

  return (
    <div className="rounded-xl border border-cream-200 bg-cream-50/50">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-forest-800"
      >
        <span className="inline-flex items-center gap-2">
          <MessagesSquare size={15} className="text-forest-600" />
          Échanger avec le demandeur
          {echanges.length > 0 && (
            <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-bold text-forest-700">{echanges.length}</span>
          )}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-700/50 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="space-y-3 border-t border-cream-200 px-3.5 py-3">
          {echanges.length > 0 ? (
            <ul className="space-y-2">
              {echanges.map((e) => (
                <li key={e.id} className={e.duDemandeur ? "flex justify-start" : "flex justify-end"}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${e.duDemandeur ? "rounded-tl-sm bg-white text-ink-800 ring-1 ring-cream-200" : "rounded-tr-sm bg-forest-700 text-cream-50"}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{e.contenu}</p>
                    <p className={`mt-1 text-[0.6rem] ${e.duDemandeur ? "text-ink-700/45" : "text-cream-200/70"}`}>
                      {e.duDemandeur ? "Demandeur" : e.auteur} · {e.date}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-700/55">
              Aucun échange. Posez une question pour clarifier le besoin du demandeur avant d&apos;approuver.
            </p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={2}
              placeholder="Votre message au demandeur…"
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
            <button
              type="button"
              onClick={envoyer}
              disabled={envoi || !texte.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-forest-800 px-3.5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
            >
              {envoi ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Envoyer
            </button>
          </div>
          {erreur && <p className="text-xs font-medium text-amber-700">{erreur}</p>}
          <p className="text-[0.65rem] text-ink-700/45">
            Copie envoyée à l&apos;administration ; le demandeur reçoit aussi cet échange par e-mail et peut répondre.
          </p>
        </div>
      )}
    </div>
  );
}
