"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Landmark, Loader2, Search, X } from "lucide-react";

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
 * Sélecteur d'établissement « en cascade » sur le répertoire complet : les établissements
 * sont regroupés par direction régionale (DRENA / DRENAET) avec une zone de recherche rapide.
 *
 * Deux modes de fonctionnement :
 *  - `etabs` fourni (direction régionale choisie, ou petit répertoire) : filtrage local ;
 *  - `etabs` à null : la recherche interroge le serveur sur TOUT le pays via `rechercheServeur`
 *    (dès 2 caractères), et `indication` s'affiche tant que rien n'est saisi.
 */
export function SelecteurEtabCascade({
  etabs,
  chargement = false,
  rechercheServeur,
  indication,
  selection,
  onChange,
  pays,
}: {
  etabs: EtabCascade[] | null;
  chargement?: boolean;
  rechercheServeur?: (q: string) => Promise<EtabCascade[]>;
  indication?: string;
  selection: { id: string; nom: string } | null;
  onChange: (e: EtabCascade | null) => void;
  pays: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [resultatsServeur, setResultatsServeur] = useState<EtabCascade[] | null>(null);
  const [enRecherche, setEnRecherche] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);
  const numRequete = useRef(0);

  const modeServeur = etabs === null && Boolean(rechercheServeur);
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
    else {
      setQ("");
      setResultatsServeur(null);
    }
  }, [ouvert]);

  // Mode serveur : recherche différée (300 ms) sur le répertoire complet du pays.
  useEffect(() => {
    if (!modeServeur || !ouvert) return;
    const terme = q.trim();
    if (terme.length < 2) {
      setResultatsServeur(null);
      setEnRecherche(false);
      return;
    }
    setEnRecherche(true);
    const requete = ++numRequete.current;
    const t = setTimeout(() => {
      rechercheServeur!(terme)
        .then((r) => {
          if (numRequete.current === requete) {
            setResultatsServeur(r);
            setEnRecherche(false);
          }
        })
        .catch(() => {
          if (numRequete.current === requete) setEnRecherche(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [q, modeServeur, ouvert, rechercheServeur]);

  // Filtre local (mode liste) : chaque mot doit apparaître dans nom, ville ou direction régionale.
  const groupes = useMemo(() => {
    let visibles: EtabCascade[];
    if (modeServeur) visibles = resultatsServeur ?? [];
    else {
      const termes = plat(q).split(/\s+/).filter(Boolean);
      visibles = (etabs ?? []).filter((e) => {
        if (termes.length === 0) return true;
        const cible = plat(`${e.nom} ${e.ville ?? ""} ${e.region ?? ""}`);
        return termes.every((t) => cible.includes(t));
      });
    }
    const parRegion = new Map<string, EtabCascade[]>();
    for (const e of visibles) {
      const cle = e.region ?? SANS_REGION;
      if (!parRegion.has(cle)) parRegion.set(cle, []);
      parRegion.get(cle)!.push(e);
    }
    return [...parRegion.entries()]
      .sort(([a], [b]) => (a === SANS_REGION ? 1 : b === SANS_REGION ? -1 : a.localeCompare(b, "fr")))
      .map(([region, liste]) => ({
        region,
        liste: [...liste].sort((x, y) => x.nom.localeCompare(y.nom, "fr")),
      }));
  }, [etabs, q, modeServeur, resultatsServeur]);

  const nbVisibles = groupes.reduce((n, g) => n + g.liste.length, 0);
  const attenteSaisie = modeServeur && q.trim().length < 2;

  return (
    <div ref={conteneur} className="relative">
      {/* Champ (état replié) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          disabled={chargement}
          aria-haspopup="listbox"
          aria-expanded={ouvert}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-cream-300 bg-white px-3 text-left text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60"
        >
          <span className={`truncate ${selection ? "text-ink-900" : "text-ink-700/55"} ${selection ? "pr-6" : ""}`}>
            {chargement ? "Chargement…" : selection ? selection.nom : "Choisir un établissement…"}
          </span>
          <ChevronDown size={16} className={`shrink-0 text-ink-700/45 transition-transform ${ouvert ? "rotate-180" : ""}`} />
        </button>
        {selection && !chargement && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Retirer l'établissement sélectionné"
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-700/45 hover:bg-cream-100 hover:text-ink-700/70"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Panneau déroulant : recherche rapide + cascade par direction régionale */}
      {ouvert && !chargement && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft">
          <div className="flex items-center gap-2 border-b border-cream-100 px-3 py-2">
            {enRecherche ? (
              <Loader2 size={15} className="shrink-0 animate-spin text-forest-600" />
            ) : (
              <Search size={15} className="shrink-0 text-ink-700/45" />
            )}
            <input
              ref={champRecherche}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                modeServeur
                  ? "Recherche dans tout le pays (nom, ville, code)…"
                  : `Recherche rapide (nom, ville${prefixeRegion ? ", " + prefixeRegion : ", région"})…`
              }
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-ink-700/40"
            />
            {q && !attenteSaisie && !enRecherche && (
              <span className="shrink-0 text-[0.65rem] font-medium text-ink-700/45">
                {nbVisibles}{modeServeur && nbVisibles >= 60 ? "+" : ""} résultat{nbVisibles > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {attenteSaisie && (
              <li className="px-4 py-6 text-center text-sm text-ink-700/55">
                {indication ?? "Tapez au moins 2 caractères pour rechercher."}
              </li>
            )}
            {!attenteSaisie && enRecherche && nbVisibles === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-700/55">Recherche en cours…</li>
            )}
            {!attenteSaisie && !enRecherche && nbVisibles === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-700/55">
                Aucun établissement ne correspond{q ? ` à « ${q} »` : ""}.
              </li>
            )}
            {groupes.map((g) => (
              <li key={g.region}>
                <p className="flex items-center gap-1.5 bg-cream-50/80 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-forest-700">
                  <Landmark size={11} className="shrink-0" />
                  {prefixeRegion && g.region !== SANS_REGION ? `${prefixeRegion} · ${g.region}` : g.region}
                </p>
                <ul>
                  {g.liste.map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={e.id === selection?.id}
                        onClick={() => {
                          onChange(e);
                          setOuvert(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 pl-6 text-left text-sm hover:bg-forest-50 ${
                          e.id === selection?.id ? "bg-forest-50/70 font-semibold text-forest-900" : "text-ink-900"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{e.nom}</span>
                          {e.ville && <span className="block truncate text-xs text-ink-700/50">{e.ville}</span>}
                        </span>
                        {e.id === selection?.id && <Check size={15} className="shrink-0 text-forest-700" />}
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
