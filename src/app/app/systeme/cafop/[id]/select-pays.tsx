"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { PAYS_ONU, drapeauUrl } from "@/lib/referentiels/pays";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Sélecteur de pays (liste ONU) avec drapeaux en couleur et recherche. Contrôlé par le nom du pays. */
export function SelectPays({ value, onChange }: { value: string; onChange: (nom: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const courant = PAYS_ONU.find((p) => p.nom === value);
  const filtres = q ? PAYS_ONU.filter((p) => norm(p.nom).includes(norm(q))) : PAYS_ONU;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none hover:border-forest-300 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      >
        <span className="flex items-center gap-2 truncate">
          {courant && <Image src={drapeauUrl(courant.code)} alt="" width={22} height={16} unoptimized className="h-4 w-auto rounded-sm object-contain" />}
          <span className="truncate">{value || "Sélectionner un pays…"}</span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-ink-700/50" />
      </button>

      {ouvert && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOuvert(false)} />
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-cream-200 bg-white shadow-soft">
            <div className="sticky top-0 border-b border-cream-100 bg-white p-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un pays…" className="h-8 w-full rounded-lg border border-cream-300 bg-white pl-8 pr-2 text-sm outline-none focus:border-forest-400" />
              </div>
            </div>
            {filtres.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-700/50">Aucun pays.</p>
            ) : (
              filtres.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => { onChange(p.nom); setOuvert(false); setQ(""); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-forest-50 ${p.nom === value ? "bg-forest-50/60 font-semibold text-forest-800" : "text-ink-700/85"}`}
                >
                  <Image src={drapeauUrl(p.code)} alt="" width={22} height={16} unoptimized className="h-4 w-auto rounded-sm object-contain" />
                  {p.nom}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
