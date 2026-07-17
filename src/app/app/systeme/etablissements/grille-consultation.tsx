"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { School, MapPin, Search, X } from "lucide-react";

export interface TuileEtablissement {
  id: string;
  nom: string;
  ville: string | null;
  code: string | null;
  typeLibelle: string;
}

/** Recherche insensible à la casse ET aux accents (« sainte-therese » trouve « Sainte-Thérèse »). */
const nettoyer = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Grille cliquable des établissements d'un diocèse (consultation SENEC/SEDEC) avec
 * recherche rapide à la frappe pour isoler un établissement quand la liste est longue.
 * La zone de recherche n'apparaît qu'au-delà de quelques tuiles (inutile pour 2-3).
 */
export function GrilleEtablissementsConsultation({ etabs }: { etabs: TuileEtablissement[] }) {
  const [q, setQ] = useState("");
  const terme = nettoyer(q.trim());
  const visibles = useMemo(
    () => (terme ? etabs.filter((e) => nettoyer([e.nom, e.ville ?? "", e.code ?? ""].join(" ")).includes(terme)) : etabs),
    [terme, etabs],
  );

  return (
    <div className="space-y-4">
      {etabs.length > 6 && (
        <div>
          <div className="relative max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un établissement… (nom, ville ou code)"
              aria-label="Rechercher un établissement"
              className="h-11 w-full rounded-2xl border border-cream-300 bg-white pl-10 pr-9 text-sm shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-700/45 transition-colors hover:bg-cream-100 hover:text-ink-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {terme && (
            <p className="mt-1.5 text-xs text-ink-700/60" role="status">
              {visibles.length.toLocaleString("fr-FR")} établissement{visibles.length > 1 ? "s" : ""} sur{" "}
              {etabs.length.toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-cream-300 bg-white p-6 text-center">
          <p className="text-sm text-ink-700/70">
            Aucun établissement ne correspond à « {q.trim()} ».
          </p>
          <button
            type="button"
            onClick={() => setQ("")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-4 py-1.5 text-sm font-medium text-forest-800 transition-colors hover:bg-forest-50"
          >
            <X size={14} /> Effacer la recherche
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((e) => (
            <Link
              key={e.id}
              href={`/app/systeme/etablissements/${e.id}`}
              className="group flex items-start gap-3 rounded-2xl border border-cream-300 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-forest-400 hover:shadow-soft"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-forest-700">
                <School size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-forest-900">{e.nom}</span>
                <span className="block text-xs text-ink-700/55">{e.typeLibelle}</span>
                {(e.ville || e.code) && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-700/60">
                    <MapPin size={11} className="shrink-0" />
                    {[e.ville, e.code].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
