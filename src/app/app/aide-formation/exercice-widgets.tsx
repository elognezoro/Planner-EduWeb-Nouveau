"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { QuestionPublique } from "./quiz-passage";

const selBase = "h-9 flex-1 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400";

/** Association « à relier » : chaque item de gauche reçoit un item de droite (via liste déroulante). */
export function WidgetAssociation({ lefts, droites, valeur, onChange }: {
  lefts: { id: string; texte: string }[]; droites: string[]; valeur: string[]; onChange: (v: string[]) => void;
}) {
  const rep = new Map<string, string>();
  for (const s of valeur) { const i = s.indexOf("="); if (i > 0) rep.set(s.slice(0, i), s.slice(i + 1)); }
  const set = (leftId: string, right: string) => {
    const m = new Map(rep);
    if (right) m.set(leftId, right); else m.delete(leftId);
    onChange([...m.entries()].map(([k, v]) => `${k}=${v}`));
  };
  return (
    <div className="space-y-2">
      {lefts.map((l) => (
        <div key={l.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 rounded-lg bg-cream-100 px-3 py-2 text-sm text-ink-800">{l.texte}</span>
          <span className="text-ink-700/40">→</span>
          <select value={rep.get(l.id) ?? ""} onChange={(e) => set(l.id, e.target.value)} className={selBase}>
            <option value="">— Relier à —</option>
            {droites.map((d, i) => <option key={i} value={d}>{d}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

/** Texte à trous : une saisie libre par trou (comparaison tolérante côté serveur). */
export function WidgetTexteTrous({ nbTrous, valeur, onChange }: { nbTrous: number; valeur: string[]; onChange: (v: string[]) => void }) {
  const set = (i: number, v: string) => {
    const arr = [...valeur];
    while (arr.length < nbTrous) arr.push("");
    arr[i] = v;
    onChange(arr);
  };
  return (
    <div className="space-y-2">
      {Array.from({ length: nbTrous }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-ink-700/60">Trou {i + 1}</span>
          <input value={valeur[i] ?? ""} onChange={(e) => set(i, e.target.value)} placeholder={`Réponse ${i + 1}`} className="h-9 flex-1 rounded-lg border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400" />
        </div>
      ))}
    </div>
  );
}

/** Remise en ordre : réordonner les éléments (présentés mélangés) via flèches haut/bas.
 *  État interne (ordre des positions locales) ; soumet les TEXTES dans l'ordre — l'id de base n'est jamais exposé. */
export function WidgetRemiseOrdre({ items, onChange }: { items: { id: string; texte: string }[]; onChange: (v: string[]) => void }) {
  const [ordre, setOrdre] = useState<string[]>(() => items.map((i) => i.id));
  const texteDe = (id: string) => items.find((i) => i.id === id)?.texte ?? "";
  useEffect(() => { onChange(ordre.map(texteDe)); }, [ordre]); // eslint-disable-line react-hooks/exhaustive-deps
  const bouger = (idx: number, sens: -1 | 1) => {
    const j = idx + sens;
    if (j < 0 || j >= ordre.length) return;
    setOrdre((o) => { const a = [...o]; [a[idx], a[j]] = [a[j], a[idx]]; return a; });
  };
  return (
    <div className="space-y-1.5">
      {ordre.map((id, idx) => (
        <div key={id} className="flex items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2">
          <span className="w-5 text-center text-xs font-bold text-ink-700/40">{idx + 1}</span>
          <span className="min-w-0 flex-1 text-sm text-ink-800">{texteDe(id)}</span>
          <div className="flex flex-col">
            <button type="button" onClick={() => bouger(idx, -1)} disabled={idx === 0} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700 disabled:opacity-30"><ChevronUp size={14} /></button>
            <button type="button" onClick={() => bouger(idx, 1)} disabled={idx === ordre.length - 1} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700 disabled:opacity-30"><ChevronDown size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Résumé lisible de la réponse de l'apprenant (revue de correction, types non-QCM). */
export function resumeReponse(q: QuestionPublique, valeur: string[]): string {
  if (valeur.length === 0) return "— (sans réponse)";
  if (q.type === "association") {
    const nom = new Map(q.choix.map((c) => [c.id, c.texte]));
    return valeur.map((s) => { const i = s.indexOf("="); return i > 0 ? `${nom.get(s.slice(0, i)) ?? "?"} → ${s.slice(i + 1)}` : s; }).join(" ; ");
  }
  if (q.type === "remise_en_ordre") {
    // valeur = textes dans l'ordre choisi par l'apprenant.
    return valeur.map((t, i) => `${i + 1}. ${t}`).join("   ");
  }
  return valeur.join(" · ");
}
