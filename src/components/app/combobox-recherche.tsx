"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, ChevronDown } from "lucide-react";

export interface OptionCombobox {
  value: string;
  label: string;
}

/**
 * Liste déroulante générique AVEC recherche rapide, soumise via un input caché (`name`).
 * Réutilisable dans les formulaires : rendu identique à un champ standard.
 * Passer `key` sur le parent pour réinitialiser la sélection (ex. quand le pays change).
 */
export function ComboboxRecherche({
  name,
  options,
  defaultValue = "",
  placeholder = "Sélectionner…",
  videLabel,
  rechercheLabel = "Rechercher…",
}: {
  name: string;
  options: OptionCombobox[];
  defaultValue?: string;
  placeholder?: string;
  /** Libellé de l'option « vide » (value=""), placée en tête (ex. « — Non rattaché — »). */
  videLabel?: string;
  rechercheLabel?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [rech, setRech] = useState("");
  const [sel, setSel] = useState(defaultValue);
  const racineRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLInputElement>(null);

  // Fermeture au clic à l'extérieur (setState dans un gestionnaire d'événement : conforme au lint).
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: PointerEvent) => {
      if (racineRef.current && !racineRef.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", surClic);
    return () => document.removeEventListener("pointerdown", surClic);
  }, [ouvert]);

  useEffect(() => {
    if (ouvert) champRef.current?.focus();
  }, [ouvert]);

  const filtres = useMemo(() => {
    const t = rech.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [rech, options]);

  const labelSel = sel ? options.find((o) => o.value === sel)?.label ?? placeholder : videLabel ?? placeholder;
  const choisir = (v: string) => {
    setSel(v);
    setOuvert(false);
    setRech("");
  };

  return (
    <div ref={racineRef} className="relative">
      <input type="hidden" name={name} value={sel} />
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2 rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-left text-sm text-ink-900 shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      >
        <span className={`flex-1 truncate ${sel ? "" : "text-ink-700/50"}`}>{labelSel}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-700/40 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-lg">
          <div className="border-b border-cream-100 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                ref={champRef}
                value={rech}
                onChange={(e) => setRech(e.target.value)}
                placeholder={rechercheLabel}
                className="h-9 w-full rounded-xl border border-cream-300 bg-white pl-8 pr-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {videLabel != null && (
              <li>
                <button type="button" onClick={() => choisir("")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-700/70 hover:bg-cream-50">
                  <span className="flex-1 truncate">{videLabel}</span>
                  {!sel && <Check size={14} className="text-forest-600" />}
                </button>
              </li>
            )}
            {filtres.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => choisir(o.value)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50">
                  <span className="flex-1 truncate">{o.label}</span>
                  {sel === o.value && <Check size={14} className="text-forest-600" />}
                </button>
              </li>
            ))}
            {filtres.length === 0 && <li className="px-3 py-3 text-center text-xs text-ink-700/50">Aucun résultat.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
