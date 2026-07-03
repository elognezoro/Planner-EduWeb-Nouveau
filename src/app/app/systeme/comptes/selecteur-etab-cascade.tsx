"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Landmark, Search } from "lucide-react";

export interface EtabCascade {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
}

const SANS_REGION = "Sans direction régionale";

/** Retire les accents et met en minuscules (comparaison de recherche). */
function plat(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Sélecteur d'établissement « en cascade » : les établissements sont regroupés par
 * direction régionale (DRENA / DRENAET), avec une zone de recherche rapide qui filtre
 * sur le nom, la ville et la direction régionale.
 */
export function SelecteurEtabCascade({
  etabs,
  valeur,
  onChange,
  pays,
}: {
  etabs: EtabCascade[] | null; // null = chargement en cours
  valeur: string;
  onChange: (id: string) => void;
  pays: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const conteneur = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);

  const selection = (etabs ?? []).find((e) => e.id === valeur) ?? null;
  const prefixeRegion = pays === "Côte d'Ivoire" ? "DRENAET" : "";

  // Fermeture au clic hors du sélecteur et à la touche Échap.
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (ev: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(ev.target as Node)) setOuvert(false);
    };
    const surTouche = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        setOuvert(false);
      }
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche, true);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche, true);
    };
  }, [ouvert]);

  useEffect(() => {
    if (ouvert) champRecherche.current?.focus();
    else setQ("");
  }, [ouvert]);

  // Filtre : chaque mot saisi doit apparaître dans le nom, la ville ou la direction régionale.
  const groupes = useMemo(() => {
    const termes = plat(q).split(/\s+/).filter(Boolean);
    const visibles = (etabs ?? []).filter((e) => {
      if (termes.length === 0) return true;
      const cible = plat(`${e.nom} ${e.ville ?? ""} ${e.region ?? ""}`);
      return termes.every((t) => cible.includes(t));
    });
    const parRegion = new Map<string, EtabCascade[]>();
    for (const e of visibles) {
      const cle = e.region ?? SANS_REGION;
      if (!parRegion.has(cle)) parRegion.set(cle, []);
      parRegion.get(cle)!.push(e);
    }
    return [...parRegion.entries()]
      .sort(([a], [b]) =>
        a === SANS_REGION ? 1 : b === SANS_REGION ? -1 : a.localeCompare(b, "fr"),
      )
      .map(([region, liste]) => ({
        region,
        liste: [...liste].sort((x, y) => x.nom.localeCompare(y.nom, "fr")),
      }));
  }, [etabs, q]);

  const nbVisibles = groupes.reduce((n, g) => n + g.liste.length, 0);

  return (
    <div ref={conteneur} className="relative">
      {/* Champ (état replié) */}
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        disabled={etabs === null}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-cream-300 bg-white px-3 text-left text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60"
      >
        <span className={`truncate ${selection ? "text-ink-900" : "text-ink-700/55"}`}>
          {etabs === null ? "Chargement…" : selection ? selection.nom : "Choisir un établissement…"}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-ink-700/45 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {/* Panneau déroulant : recherche rapide + cascade par direction régionale */}
      {ouvert && etabs !== null && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
          <div className="flex items-center gap-2 border-b border-cream-100 px-3 py-2">
            <Search size={15} className="shrink-0 text-ink-700/45" />
            <input
              ref={champRecherche}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Recherche rapide (nom, ville${prefixeRegion ? ", " + prefixeRegion : ", région"})…`}
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-ink-700/40"
            />
            {q && (
              <span className="shrink-0 text-[0.65rem] font-medium text-ink-700/45">
                {nbVisibles} résultat{nbVisibles > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {nbVisibles === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-700/55">
                Aucun établissement ne correspond à « {q} ».
              </li>
            )}
            {groupes.map((g) => (
              <li key={g.region}>
                <p className="flex items-center gap-1.5 bg-cream-50/80 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-forest-700">
                  <Landmark size={11} className="shrink-0" />
                  {prefixeRegion ? `${prefixeRegion} · ${g.region}` : g.region}
                </p>
                <ul>
                  {g.liste.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={e.id === valeur}
                        onClick={() => {
                          onChange(e.id);
                          setOuvert(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 pl-6 text-left text-sm hover:bg-forest-50 ${
                          e.id === valeur ? "bg-forest-50/70 font-semibold text-forest-900" : "text-ink-900"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{e.nom}</span>
                          {e.ville && <span className="block truncate text-xs text-ink-700/50">{e.ville}</span>}
                        </span>
                        {e.id === valeur && <Check size={15} className="shrink-0 text-forest-700" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
