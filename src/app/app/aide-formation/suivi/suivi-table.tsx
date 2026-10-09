"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

export type LigneCours = {
  id: string;
  slug: string;
  titre: string;
  categorie: string;
  publie: boolean;
  lecons: number;
  inscrits: number;
  avancement: number; // % moyen
  termines: number;
  completion: number; // % terminés / inscrits
};

type Cle = "titre" | "categorie" | "inscrits" | "avancement" | "termines" | "completion";
const BASE = "/app/aide-formation";

const colonnes: { cle: Cle; libelle: string; num: boolean }[] = [
  { cle: "titre", libelle: "Cours", num: false },
  { cle: "categorie", libelle: "Catégorie", num: false },
  { cle: "inscrits", libelle: "Inscrits", num: true },
  { cle: "avancement", libelle: "Avanc. moyen", num: true },
  { cle: "termines", libelle: "Terminés", num: true },
  { cle: "completion", libelle: "Complétion", num: true },
];

function Jauge({ pct, ton = "forest" }: { pct: number; ton?: "forest" | "gold" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-cream-200">
        <div className={`h-full rounded-full ${ton === "gold" ? "bg-gold-500" : "bg-forest-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="tabular-nums text-xs font-semibold text-forest-800">{pct}%</span>
    </div>
  );
}

export function TableauCours({ lignes }: { lignes: LigneCours[] }) {
  const [tri, setTri] = useState<Cle>("inscrits");
  const [sens, setSens] = useState<"asc" | "desc">("desc");

  const basculer = (cle: Cle) => {
    if (cle === tri) setSens((s) => (s === "asc" ? "desc" : "asc"));
    else { setTri(cle); setSens(cle === "titre" || cle === "categorie" ? "asc" : "desc"); }
  };

  const triees = [...lignes].sort((a, b) => {
    const va = a[tri], vb = b[tri];
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr");
    return sens === "asc" ? cmp : -cmp;
  });

  if (lignes.length === 0) {
    return <p className="rounded-xl bg-cream-50 px-4 py-8 text-center text-sm text-ink-700/55">Aucun cours dans le catalogue.</p>;
  }

  const colonneTri = colonnes.find((c) => c.cle === tri);

  return (
    <div className="overflow-x-auto">
      {/* Téléphone : l'en-tête (et ses boutons de tri) disparaît avec la mise en cartes → tri par
          une liste + un bouton de sens. Absent de l'ordinateur et de l'impression. */}
      <div className="lg:hidden print:hidden">
        <div className="mb-3 flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold text-ink-700/70">Trier par</span>
            <select
              value={tri}
              // Nouvelle colonne (onChange) → basculer() applique son sens par défaut.
              onChange={(e) => basculer(e.target.value as Cle)}
              className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-base text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            >
              {colonnes.map((c) => (
                <option key={c.cle} value={c.cle}>
                  {c.libelle}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSens((s) => (s === "asc" ? "desc" : "asc"))}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-cream-300 bg-white px-3 text-sm font-semibold text-forest-800 active:bg-cream-100"
          >
            {sens === "asc" ? <ArrowUp size={16} aria-hidden /> : <ArrowDown size={16} aria-hidden />}
            {colonneTri?.num ? (sens === "asc" ? "Croissant" : "Décroissant") : sens === "asc" ? "A → Z" : "Z → A"}
            {/* Nom accessible = texte visible, complété de l'action (lecteurs d'écran seulement). */}
            <span className="sr-only">{" — inverser l'ordre"}</span>
          </button>
        </div>
      </div>
      {/* Téléphone : chaque cours devient une carte « libellé : valeur » (globals.css). */}
      <table className="w-full min-w-[640px] border-collapse text-sm tableau-cartes-mobile">
        <thead>
          <tr className="border-b border-cream-200 text-left">
            {colonnes.map((c) => {
              const actif = c.cle === tri;
              return (
                <th key={c.cle} className={`py-2.5 pr-3 font-semibold text-ink-700/60 ${c.num ? "text-right" : ""}`}>
                  <button type="button" onClick={() => basculer(c.cle)} className={`inline-flex items-center gap-1 hover:text-forest-800 ${c.num ? "flex-row-reverse" : ""} ${actif ? "text-forest-800" : ""}`}>
                    {c.libelle}
                    {actif ? (sens === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
                  </button>
                </th>
              );
            })}
            <th className="py-2.5" />
          </tr>
        </thead>
        <tbody>
          {triees.map((l) => (
            <tr key={l.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/60">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-forest-900">{l.titre}</span>
                  {!l.publie && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-800 mobile:text-[0.9375rem]">Brouillon</span>}
                </div>
                <span className="text-xs text-ink-700/50">{l.lecons} leçon(s)</span>
              </td>
              <td data-label="Catégorie" className="py-2.5 pr-3 text-ink-700/75">{l.categorie}</td>
              <td data-label="Inscrits" className="py-2.5 pr-3 text-right tabular-nums font-semibold text-forest-800">{l.inscrits}</td>
              <td data-label="Avanc. moyen" className="py-2.5 pr-3"><div className="flex justify-end"><Jauge pct={l.avancement} /></div></td>
              <td data-label="Terminés" className="py-2.5 pr-3 text-right tabular-nums text-ink-700/75">{l.termines}</td>
              <td data-label="Complétion" className="py-2.5 pr-3"><div className="flex justify-end"><Jauge pct={l.completion} ton="gold" /></div></td>
              <td className="py-2.5 text-right">
                {/* Téléphone : lien libellé de 44 px en pied de carte (icône seule de 26 px sinon). */}
                <Link href={`${BASE}/gestion/cours/${l.id}`} className="inline-flex items-center gap-1 rounded-lg p-1.5 text-ink-700/45 hover:bg-cream-100 hover:text-forest-700 mobile:min-h-11 mobile:gap-2 mobile:px-0 mobile:text-sm mobile:font-semibold mobile:text-forest-700" title="Ouvrir le cours">
                  <ExternalLink size={14} />
                  <span className="hidden mobile:inline">Ouvrir le cours</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
