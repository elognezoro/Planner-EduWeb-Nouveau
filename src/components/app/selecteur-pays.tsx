"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { PAYS_ONU, drapeauUrl, trouverPays, type PaysInfo } from "@/lib/referentiels/pays";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function Drapeau({ code, nom }: { code: string; nom: string }) {
  return (
    <Image
      src={drapeauUrl(code)}
      alt={`Drapeau ${nom}`}
      width={22}
      height={16}
      unoptimized
      className="h-4 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-cream-300"
    />
  );
}

/**
 * Sélecteur de pays (193 États membres de l'ONU) avec drapeaux et recherche.
 * Pose un champ caché `name` contenant le nom du pays, et remonte le pays choisi
 * via `onSelect` (pour pré-remplir slogan et ministère).
 */
export function SelecteurPays({
  name,
  valeur,
  onSelect,
}: {
  name: string;
  valeur: string;
  onSelect?: (pays: PaysInfo) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const conteneur = useRef<HTMLDivElement>(null);
  const champRecherche = useRef<HTMLInputElement>(null);

  const actuel = trouverPays(valeur);
  const liste = useMemo(() => {
    const nq = norm(q);
    return nq ? PAYS_ONU.filter((x) => norm(x.nom).includes(nq)) : PAYS_ONU;
  }, [q]);

  // Fermeture au clic extérieur / Échap.
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    champRecherche.current?.focus();
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  return (
    <div ref={conteneur} className="relative">
      <input type="hidden" name={name} value={valeur} />
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="flex h-11 w-full items-center gap-2.5 rounded-2xl border border-cream-300 bg-white px-4 text-left text-sm text-ink-900 shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      >
        {actuel ? <Drapeau code={actuel.code} nom={actuel.nom} /> : null}
        <span className="flex-1 truncate">{valeur || "Choisir un pays…"}</span>
        <ChevronDown size={15} className={`shrink-0 text-ink-700/40 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-lg">
          <div className="relative border-b border-cream-100 p-2">
            <Search size={14} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              ref={champRecherche}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un pays…"
              className="h-9 w-full rounded-xl border border-cream-200 bg-cream-50 pl-8 pr-3 text-sm outline-none focus:border-forest-400"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {liste.length === 0 && (
              <li className="px-4 py-3 text-sm text-ink-700/55">Aucun pays trouvé.</li>
            )}
            {liste.map((x) => (
              <li key={x.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={x.nom === valeur}
                  onClick={() => {
                    onSelect?.(x);
                    setOuvert(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-forest-50 ${x.nom === valeur ? "bg-cream-100 font-semibold text-forest-900" : "text-ink-900"}`}
                >
                  <Drapeau code={x.code} nom={x.nom} />
                  <span className="truncate">{x.nom}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
