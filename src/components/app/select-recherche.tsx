"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Normalise pour une recherche insensible à la casse et aux accents. */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Liste déroulante AVEC zone de recherche rapide (combobox). Filtre `options` à la frappe.
 * La valeur sélectionnée (id) est soumise via un champ caché `name` — utilisable dans un
 * <form> classique (Server Actions comprises).
 */
export function SelectRecherche({
  name,
  options,
  requis,
  placeholder = "Rechercher / choisir…",
  className,
}: {
  name: string;
  options: { id: string; nom: string }[];
  requis?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [id, setId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [surbrillance, setSurbrillance] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);
  const nomSel = useRef("");

  // Fermeture au clic extérieur ; le champ reflète alors la sélection (ou se vide).
  useEffect(() => {
    const clic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) {
        setOuvert(false);
        setQuery(id ? nomSel.current : "");
      }
    };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [id]);

  const filtres = useMemo(() => {
    const q = norm(query.trim());
    const liste = q && query !== nomSel.current ? options.filter((o) => norm(o.nom).includes(q)) : options;
    return liste.slice(0, 100);
  }, [query, options]);

  const choisir = (o: { id: string; nom: string }) => {
    setId(o.id);
    nomSel.current = o.nom;
    setQuery(o.nom);
    setOuvert(false);
  };

  return (
    <div ref={conteneur} className={cn("relative", className)}>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          type="text"
          value={query}
          required={requis}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={ouvert}
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setId(""); nomSel.current = ""; setOuvert(true); setSurbrillance(0); }}
          onFocus={() => setOuvert(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOuvert(true); setSurbrillance((s) => Math.min(s + 1, filtres.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSurbrillance((s) => Math.max(s - 1, 0)); }
            else if (e.key === "Enter" && ouvert && filtres[surbrillance]) { e.preventDefault(); choisir(filtres[surbrillance]); }
            else if (e.key === "Escape") setOuvert(false);
          }}
          className="h-9 w-full rounded-lg border border-cream-300 bg-white pl-8 pr-8 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
        <ChevronDown size={15} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-700/40" />
      </div>
      <input type="hidden" name={name} value={id} />

      {ouvert && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-cream-200 bg-white py-1 shadow-lg">
          {filtres.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-700/50">Aucun résultat</li>
          ) : (
            filtres.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseEnter={() => setSurbrillance(i)}
                  onClick={() => choisir(o)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                    i === surbrillance ? "bg-forest-50 text-forest-900" : "text-ink-800 hover:bg-cream-100",
                  )}
                >
                  <span className="truncate">{o.nom}</span>
                  {o.id === id && <Check size={14} className="shrink-0 text-forest-600" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
