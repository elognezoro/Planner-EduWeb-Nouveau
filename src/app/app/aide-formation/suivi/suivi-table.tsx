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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
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
                  {!l.publie && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-800">Brouillon</span>}
                </div>
                <span className="text-xs text-ink-700/50">{l.lecons} leçon(s)</span>
              </td>
              <td className="py-2.5 pr-3 text-ink-700/75">{l.categorie}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-forest-800">{l.inscrits}</td>
              <td className="py-2.5 pr-3"><div className="flex justify-end"><Jauge pct={l.avancement} /></div></td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-ink-700/75">{l.termines}</td>
              <td className="py-2.5 pr-3"><div className="flex justify-end"><Jauge pct={l.completion} ton="gold" /></div></td>
              <td className="py-2.5 text-right">
                <Link href={`${BASE}/gestion/cours/${l.id}`} className="inline-flex items-center gap-1 rounded-lg p-1.5 text-ink-700/45 hover:bg-cream-100 hover:text-forest-700" title="Ouvrir le cours">
                  <ExternalLink size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
