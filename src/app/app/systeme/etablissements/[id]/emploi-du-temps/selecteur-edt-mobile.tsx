"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";

type Vue = "classe" | "enseignant" | "salle";

const VUES: { v: Vue; l: string; titre: string }[] = [
  { v: "classe", l: "Classe", titre: "Choisir une classe" },
  { v: "enseignant", l: "Enseignant", titre: "Choisir un enseignant" },
  { v: "salle", l: "Salle", titre: "Choisir une salle" },
];

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * SÉLECTEUR VUE / CIBLE POUR TÉLÉPHONE — remplace, sous le seuil mobile, le formulaire
 * « Vue · Classe · Afficher » de l'ordinateur (masqué par « mobile:hidden », inchangé ailleurs).
 *
 *  - Vue : contrôle segmenté de 3 liens (pas de bouton « Afficher » à part : changer de vue
 *    recharge directement, avec la première cible de la nouvelle vue — jamais un identifiant
 *    de l'ancienne vue envoyé par erreur).
 *  - Cible : bouton pleine largeur qui ouvre une feuille montante avec recherche (sans focus
 *    automatique : le clavier ne recouvre pas la liste), lignes de 48 px, option active cochée.
 *
 * Navigation en REMPLACEMENT d'historique : le bouton Retour de l'en-tête mobile ramène à la
 * page précédente, pas à chacune des classes consultées.
 */
export function SelecteurEdtMobile({
  base,
  vue,
  options,
  cible,
  cibleLibelle,
}: {
  base: string;
  vue: Vue;
  options: { v: string; l: string }[];
  cible: string;
  cibleLibelle: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [enCours, demarrer] = useTransition();
  const actif = useRef<HTMLButtonElement>(null);
  const meta = VUES.find((x) => x.v === vue) ?? VUES[0];

  // À l'ouverture, l'option active est amenée au centre de la liste (lycées : 40 à 60 classes).
  useEffect(() => {
    if (!ouvert) return;
    const t = window.setTimeout(() => actif.current?.scrollIntoView({ block: "center" }), 80);
    return () => window.clearTimeout(t);
  }, [ouvert]);

  const n = norm(recherche.trim());
  const liste = n ? options.filter((o) => norm(o.l).includes(n)) : options;

  // La recherche est remise à vide à l'OUVERTURE, pas à la fermeture : la liste filtrée garde
  // sa hauteur pendant la descente de la feuille.
  function fermer() {
    setOuvert(false);
  }

  function choisir(v: string) {
    // Feuille en cours de fermeture (≈ 220 ms) : une ligne touchée ne relance rien.
    if (!ouvert) return;
    fermer();
    if (v === cible) return;
    demarrer(() => {
      router.replace(`${base}?vue=${vue}&cible=${encodeURIComponent(v)}`, { scroll: false });
    });
  }

  return (
    <div className="mb-5 space-y-3 lg:hidden print:hidden">
      <div
        role="group"
        aria-label="Vue de l'emploi du temps"
        className="grid grid-cols-3 gap-1 rounded-full border border-cream-300 bg-cream-50 p-1"
      >
        {VUES.map((x) => (
          <Link
            key={x.v}
            // Segment déjà actif : la cible en cours est conservée (sinon retour à la première).
            href={x.v === vue && cible ? `${base}?vue=${x.v}&cible=${encodeURIComponent(cible)}` : `${base}?vue=${x.v}`}
            replace
            scroll={false}
            aria-current={x.v === vue ? "page" : undefined}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-full px-1 text-xs font-semibold transition-colors ${
              x.v === vue ? "bg-forest-800 text-cream-50 shadow-soft" : "text-forest-800 active:bg-cream-200"
            }`}
          >
            <span className="truncate">{x.l}</span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setRecherche("");
          setOuvert(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        disabled={options.length === 0}
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-cream-300 bg-white px-4 py-1.5 text-left shadow-soft active:bg-cream-100 disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-ink-700/70">{meta.l}</span>
          <span className="block truncate font-semibold text-forest-900">{cibleLibelle || "—"}</span>
        </span>
        {enCours ? (
          <Loader2 aria-hidden size={18} className="shrink-0 animate-spin text-forest-700" />
        ) : (
          <ChevronDown aria-hidden size={18} className="shrink-0 text-ink-700/60" />
        )}
      </button>

      {/* Contenu rendu sans condition : FeuilleBas ne rend rien une fois fermée, et la liste reste
          en place pendant l'animation de fermeture (sinon la feuille s'écrase avant de descendre). */}
      <FeuilleBas ouvert={ouvert} onFermer={fermer} titre={meta.titre} hauteurMax="85dvh">
        <div className="pb-2">
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
                aria-label={`Rechercher (${meta.l.toLowerCase()})`}
                className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-9 pr-3 text-base text-ink-900 outline-none placeholder:text-ink-700/50 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>
          <ul className="px-1">
            {liste.map((o) => {
              const estActif = o.v === cible;
              return (
                <li key={o.v}>
                  <button
                    ref={estActif ? actif : undefined}
                    type="button"
                    onClick={() => choisir(o.v)}
                    aria-current={estActif ? "true" : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${
                      estActif ? "bg-forest-50 font-semibold text-forest-900" : "text-forest-800 active:bg-cream-100"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.l}</span>
                    {estActif && <Check aria-hidden size={18} className="shrink-0 text-forest-700" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {liste.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-700/60">Aucun résultat.</p>}
        </div>
      </FeuilleBas>
    </div>
  );
}
