"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";

export interface OptionChoixMobile {
  cle: string;
  libelle: string;
  href: string;
  actif: boolean;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * CHOIX PAR LIENS SUR TÉLÉPHONE — remplace un nuage de pastilles-liens (onglets du hub de
 * consultation, filtre de classe ou d'enseignant : 12 à 60 pastilles qui repoussaient le
 * contenu de plusieurs écrans) par UN bouton « Libellé : choix actif ▾ » ouvrant une feuille
 * montante (recherche au-delà de 8 options, sans focus automatique ; lignes de 48 px).
 *
 * L'appelant garde son nuage pour l'ordinateur et l'impression (« mobile:hidden ») et monte ce
 * composant à côté : il n'existe que sous le seuil mobile, à l'écran (« lg:hidden print:hidden »).
 */
export function ChoixMobile({
  libelle,
  titre,
  options,
  vide = "Aucun choix disponible.",
  className = "",
}: {
  /** Nature du choix, affichée au-dessus de la valeur (« Classe », « Section »…). */
  libelle: string;
  /** Titre de la feuille montante. */
  titre: string;
  options: OptionChoixMobile[];
  vide?: string;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const actifRef = useRef<HTMLAnchorElement>(null);
  const actif = options.find((o) => o.actif);

  // À l'ouverture, l'option active est amenée au centre de la liste.
  useEffect(() => {
    if (!ouvert) return;
    const t = window.setTimeout(() => actifRef.current?.scrollIntoView({ block: "center" }), 80);
    return () => window.clearTimeout(t);
  }, [ouvert]);

  const n = norm(recherche.trim());
  const liste = n ? options.filter((o) => norm(o.libelle).includes(n)) : options;

  function fermer() {
    setOuvert(false);
    setRecherche("");
  }

  return (
    <div className={`lg:hidden print:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        disabled={options.length === 0}
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-1.5 text-left shadow-soft active:bg-cream-100 disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-ink-700/70">{libelle}</span>
          <span className="block truncate font-semibold text-forest-900">
            {options.length === 0 ? vide : (actif?.libelle ?? "—")}
          </span>
        </span>
        <ChevronDown aria-hidden size={18} className="shrink-0 text-ink-700/60" />
      </button>

      <FeuilleBas ouvert={ouvert} onFermer={fermer} titre={titre} hauteurMax="85dvh">
        {ouvert && (
          <div className="pb-2">
            {options.length > 8 && (
              <div className="sticky top-0 z-10 bg-cream-50 px-2 pb-2">
                <div className="relative">
                  <Search
                    aria-hidden
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/50"
                  />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher…"
                    aria-label={`Rechercher (${libelle.toLowerCase()})`}
                    className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-9 pr-3 text-base text-ink-900 outline-none placeholder:text-ink-700/50 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </div>
              </div>
            )}
            <ul className="px-1">
              {liste.map((o) => (
                <li key={o.cle}>
                  <Link
                    ref={o.actif ? actifRef : undefined}
                    href={o.href}
                    onClick={fermer}
                    aria-current={o.actif ? "page" : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${
                      o.actif ? "bg-forest-50 font-semibold text-forest-900" : "text-forest-800 active:bg-cream-100"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.libelle}</span>
                    {o.actif && <Check aria-hidden size={18} className="shrink-0 text-forest-700" />}
                  </Link>
                </li>
              ))}
            </ul>
            {liste.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-700/60">Aucun résultat.</p>}
          </div>
        )}
      </FeuilleBas>
    </div>
  );
}
