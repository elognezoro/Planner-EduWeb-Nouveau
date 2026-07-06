"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Sélecteur de cible (classe / enseignant / salle) à RECHERCHE RAPIDE : liste déroulante maison
 * avec un champ de saisie qui filtre les options à la frappe (sans accents). Alimente un
 * `<input type="hidden" name>` dans le formulaire parent et le soumet à la sélection (chargement
 * immédiat de l'emploi du temps choisi). Remplace le `<select>` natif, peu commode avec
 * beaucoup de classes.
 */
export function SelecteurCible({
  name,
  options,
  valeur,
  libelle,
}: {
  name: string;
  options: { v: string; l: string }[];
  valeur: string;
  libelle: string;
}) {
  const [value, setValue] = useState(valeur);
  const [label, setLabel] = useState(libelle);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const n = norm(query.trim());
  const filtres = n ? options.filter((o) => norm(o.l).includes(n)) : options;

  function choisir(o: { v: string; l: string }) {
    // Valeur posée IMPÉRATIVEMENT (champ non contrôlé) : la soumission qui suit lit alors la bonne
    // valeur — un setState est asynchrone et le DOM ne serait pas à jour au moment du requestSubmit.
    if (hidden.current) hidden.current.value = o.v;
    setValue(o.v);
    setLabel(o.l);
    setOpen(false);
    setQuery("");
    // Charge immédiatement l'emploi du temps choisi (soumet le formulaire GET parent).
    hidden.current?.form?.requestSubmit();
  }

  return (
    <div ref={ref} className="relative">
      <input ref={hidden} type="hidden" name={name} defaultValue={valeur} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 min-w-[12rem] items-center justify-between gap-2 rounded-xl border border-cream-300 bg-white px-3 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      >
        <span className="truncate">{label || "—"}</span>
        <ChevronDown size={15} className="shrink-0 text-ink-700/50" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1.5 w-full min-w-[15rem] overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
          <div className="border-b border-cream-100 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="h-9 w-full rounded-lg border border-cream-200 bg-cream-50/60 pl-8 pr-2 text-sm outline-none placeholder:text-ink-700/40 focus:border-forest-400"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto p-1.5">
            {filtres.map((o) => (
              <li key={o.v}>
                <button
                  type="button"
                  onClick={() => choisir(o)}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    o.v === value ? "bg-forest-50 font-semibold text-forest-900" : "text-forest-800 hover:bg-cream-100"
                  }`}
                >
                  <span className="truncate">{o.l}</span>
                </button>
              </li>
            ))}
            {filtres.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-ink-700/50">Aucun résultat.</p>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
