"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Send, Loader2 } from "lucide-react";
import { repondreEchangeDemande } from "./actions";

export type EchangeVue = { id: string; contenu: string; duDemandeur: boolean; date: string };

/** Fil d'échange du DEMANDEUR avec l'administration (au sujet de sa demande de rôle). */
export function EchangeDemandeur({ demandeId, echanges }: { demandeId: string; echanges: EchangeVue[] }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, start] = useTransition();

  const envoyer = () => {
    const t = texte.trim();
    if (!t || envoi) return;
    setErreur(null);
    start(async () => {
      const r = await repondreEchangeDemande(demandeId, t);
      if (r.ok) { setTexte(""); router.refresh(); }
      else setErreur(r.message ?? "Envoi impossible.");
    });
  };

  return (
    <div className="mt-4 rounded-2xl border border-gold-200 bg-white/60 p-4">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900">
        <MessagesSquare size={16} className="text-forest-600" /> Échanges avec l&apos;administration
      </p>
      <p className="mt-1 text-xs text-ink-700/60">
        Précisez votre besoin réel (fonction, établissement, statut souhaité) pour permettre une validation adaptée. Copie par e-mail des deux côtés.
      </p>

      {echanges.length === 0 ? (
        <p className="mt-3 rounded-xl bg-cream-100 px-3 py-2.5 text-xs text-ink-700/60">
          L&apos;administration vous contactera ici (et par e-mail) si des précisions sont nécessaires avant de valider votre demande. Vous pourrez alors répondre.
        </p>
      ) : (
        <>
      <ul className="mt-3 space-y-2">
          {echanges.map((e) => (
            <li key={e.id} className={e.duDemandeur ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${e.duDemandeur ? "rounded-tr-sm bg-forest-700 text-cream-50" : "rounded-tl-sm bg-cream-100 text-ink-800"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{e.contenu}</p>
                <p className={`mt-1 text-[0.6rem] ${e.duDemandeur ? "text-cream-200/70" : "text-ink-700/45"}`}>
                  {e.duDemandeur ? "Vous" : "Administration"} · {e.date}
                </p>
              </div>
            </li>
          ))}
        </ul>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={2}
          placeholder="Écrire à l'administration…"
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
      {erreur && <p className="mt-1.5 text-xs font-medium text-amber-700">{erreur}</p>}
        </>
      )}
    </div>
  );
}
