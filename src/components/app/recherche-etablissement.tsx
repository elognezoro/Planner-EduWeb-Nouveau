"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Loader2, School, X } from "lucide-react";
import {
  rechercherEtablissementsAction,
  type EtabResultat,
} from "@/app/app/systeme/comptes/recherche-action";

/**
 * Sélecteur d'établissement par RECHERCHE à la volée dans le répertoire complet
 * (41 000+ entrées — un <select> classique est impraticable à cette échelle).
 * Pose un champ caché `name` contenant l'identifiant choisi.
 */
export function RechercheEtablissement({
  name,
  defaut,
  requis,
}: {
  name: string;
  /** Établissement actuellement affecté (affiché avant toute recherche). */
  defaut?: { id: string; nom: string } | null;
  requis?: boolean;
}) {
  const [choisi, setChoisi] = useState<{ id: string; nom: string } | null>(defaut ?? null);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<EtabResultat[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recherche avec anti-rebond (300 ms) — l'état est posé dans le rappel différé,
  // jamais synchroniquement dans le corps de l'effet.
  useEffect(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(async () => {
      const terme = q.trim();
      if (terme.length < 2) {
        setResultats([]);
        setEnCours(false);
        return;
      }
      try {
        const r = await rechercherEtablissementsAction(terme);
        setResultats(r);
      } finally {
        setEnCours(false);
      }
    }, 300);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [q]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    return () => document.removeEventListener("mousedown", clic);
  }, [ouvert]);

  return (
    <div ref={conteneur} className="relative">
      <input type="hidden" name={name} value={choisi?.id ?? ""} required={requis} />

      {choisi ? (
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-forest-200 bg-forest-50/60 px-3.5">
          <School size={15} className="shrink-0 text-forest-600" />
          <span className="flex-1 truncate text-sm font-medium text-forest-900">{choisi.nom}</span>
          <button
            type="button"
            onClick={() => {
              setChoisi(null);
              setQ("");
              setOuvert(true);
            }}
            title="Changer d'établissement"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-700/50 hover:bg-white hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          {enCours ? (
            <Loader2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-forest-500" />
          ) : (
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
          )}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setEnCours(e.target.value.trim().length >= 2);
              setOuvert(true);
            }}
            onFocus={() => setOuvert(true)}
            placeholder="Rechercher un établissement (nom, ville, code)…"
            className="h-11 w-full rounded-2xl border border-cream-300 bg-white pl-10 pr-3 text-sm shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </div>
      )}

      {ouvert && !choisi && q.trim().length >= 2 && (
        <ul className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-cream-200 bg-white py-1 shadow-lg" role="listbox">
          {!enCours && resultats.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-700/55">Aucun établissement trouvé.</li>
          )}
          {resultats.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setChoisi({ id: r.id, nom: r.nom });
                  setOuvert(false);
                }}
                className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-forest-50"
              >
                <span className="text-sm font-medium text-forest-900">{r.nom}</span>
                <span className="text-xs text-ink-700/55">
                  {[r.ville, r.pays].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
