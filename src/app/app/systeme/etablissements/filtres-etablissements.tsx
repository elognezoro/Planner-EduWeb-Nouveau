"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, SlidersHorizontal, Globe2 } from "lucide-react";
import { drapeauUrl, trouverPays } from "@/lib/referentiels/pays";
import Image from "next/image";
import type { RegionOption } from "./etablissement-form";

const BASE = "/app/systeme/etablissements";

export interface PaysCompte {
  nom: string;
  total: number;
}

export interface FiltresValeurs {
  q: string;
  pays: string;
  region: string;
  type: string;
  statut: string;
}

const TYPES = [
  ["college", "Collège"],
  ["lycee", "Lycée"],
  ["groupe_scolaire", "Groupe scolaire"],
  ["primaire", "Primaire"],
  ["prescolaire", "Préscolaire"],
  ["autre", "Autre"],
] as const;
const STATUTS = [
  ["public", "Public"],
  ["prive", "Privé"],
  ["confessionnel", "Confessionnel"],
  ["autre", "Autre"],
] as const;

const selectClasse =
  "h-11 w-full rounded-2xl border border-cream-300 bg-white px-3 text-sm text-ink-900 shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/**
 * Filtre avancé DYNAMIQUE du répertoire : chaque changement s'applique immédiatement
 * (recherche avec anti-rebond), le pays pilote la liste des régions, et les régions
 * sont regroupées par pays quand aucun pays n'est choisi.
 */
export function FiltresEtablissements({
  regions,
  paysListe,
  valeurs,
}: {
  regions: RegionOption[];
  paysListe: PaysCompte[];
  valeurs: FiltresValeurs;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(valeurs.q);
  const [pays, setPays] = useState(valeurs.pays);
  const [region, setRegion] = useState(valeurs.region);
  const [type, setType] = useState(valeurs.type);
  const [statut, setStatut] = useState(valeurs.statut);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premierRendu = useRef(true);

  const regionsParPays = useMemo(() => {
    const m = new Map<string, RegionOption[]>();
    for (const r of regions) {
      const arr = m.get(r.pays) ?? [];
      arr.push(r);
      m.set(r.pays, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [regions]);

  const regionsVisibles = pays ? regions.filter((r) => r.pays === pays) : regions;

  function appliquer(prochaines: Partial<FiltresValeurs>) {
    const v = { q, pays, region, type, statut, ...prochaines };
    const p = new URLSearchParams();
    if (v.q.trim()) p.set("q", v.q.trim());
    if (v.pays) p.set("pays", v.pays);
    if (v.region) p.set("region", v.region);
    if (v.type) p.set("type", v.type);
    if (v.statut) p.set("statut", v.statut);
    startTransition(() => {
      router.replace(p.size > 0 ? `${BASE}?${p.toString()}` : BASE, { scroll: false });
    });
  }

  // Recherche : application automatique avec anti-rebond (450 ms).
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => appliquer({ q }), 450);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- déclenché uniquement par la saisie
  }, [q]);

  function choisirPays(valeur: string) {
    setPays(valeur);
    // La région ne survit que si elle appartient au nouveau pays.
    const regionValide = valeur === "" || regions.some((r) => r.id === region && r.pays === valeur);
    const prochaineRegion = regionValide ? region : "";
    if (!regionValide) setRegion("");
    appliquer({ pays: valeur, region: prochaineRegion });
  }

  function reinitialiser() {
    setQ("");
    setPays("");
    setRegion("");
    setType("");
    setStatut("");
    startTransition(() => router.replace(BASE, { scroll: false }));
  }

  const infoPays = pays ? trouverPays(pays) : null;
  const chips: { cle: keyof FiltresValeurs; libelle: string }[] = [];
  if (q.trim()) chips.push({ cle: "q", libelle: `« ${q.trim()} »` });
  if (pays) chips.push({ cle: "pays", libelle: pays });
  if (region) chips.push({ cle: "region", libelle: regions.find((r) => r.id === region)?.nom ?? "Région" });
  if (type) chips.push({ cle: "type", libelle: TYPES.find(([v]) => v === type)?.[1] ?? type });
  if (statut) chips.push({ cle: "statut", libelle: STATUTS.find(([v]) => v === statut)?.[1] ?? statut });

  function retirer(cle: keyof FiltresValeurs) {
    if (cle === "q") {
      setQ("");
      appliquer({ q: "" });
    } else if (cle === "pays") {
      choisirPays("");
    } else {
      const poseurs: Record<string, (v: string) => void> = { region: setRegion, type: setType, statut: setStatut };
      poseurs[cle]("");
      appliquer({ [cle]: "" });
    }
  }

  return (
    <section className="rounded-3xl border border-cream-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-forest-900">
          <SlidersHorizontal size={15} className="text-gold-600" /> Filtres du répertoire
        </p>
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-forest-700">
            <Loader2 size={13} className="animate-spin" /> Mise à jour…
          </span>
        ) : (
          chips.length > 0 && (
            <button
              type="button"
              onClick={reinitialiser}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-medium text-ink-700/70 hover:bg-red-50 hover:text-red-600"
            >
              <X size={13} /> Tout réinitialiser
            </button>
          )
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr]">
        {/* Recherche */}
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, ville ou code… (recherche instantanée)"
            className="h-11 w-full rounded-2xl border border-cream-300 bg-white pl-10 pr-3 text-sm shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        {/* Pays */}
        <div className="relative">
          {infoPays ? (
            <Image
              src={drapeauUrl(infoPays.code)}
              alt=""
              width={20}
              height={14}
              unoptimized
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-5 -translate-y-1/2 rounded-[2px] object-cover ring-1 ring-cream-300"
            />
          ) : (
            <Globe2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          )}
          <select value={pays} onChange={(e) => choisirPays(e.target.value)} className={`${selectClasse} pl-9`}>
            <option value="">Tous les pays</option>
            {paysListe.map((p) => (
              <option key={p.nom} value={p.nom}>
                {p.nom} ({p.total.toLocaleString("fr-FR")})
              </option>
            ))}
          </select>
        </div>

        {/* Région — groupée par pays tant qu'aucun pays n'est choisi */}
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            appliquer({ region: e.target.value });
          }}
          className={selectClasse}
        >
          <option value="">{pays ? `Toutes les régions (${pays})` : "Toutes les régions"}</option>
          {pays
            ? regionsVisibles.map((r) => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))
            : regionsParPays.map(([nomPays, liste]) => (
                <optgroup key={nomPays} label={nomPays}>
                  {liste.map((r) => (
                    <option key={r.id} value={r.id}>{r.nom}</option>
                  ))}
                </optgroup>
              ))}
        </select>

        {/* Type */}
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            appliquer({ type: e.target.value });
          }}
          className={selectClasse}
        >
          <option value="">Tous types</option>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Statut */}
        <select
          value={statut}
          onChange={(e) => {
            setStatut(e.target.value);
            appliquer({ statut: e.target.value });
          }}
          className={selectClasse}
        >
          <option value="">Tous statuts</option>
          {STATUTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Puces des filtres actifs */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.cle}
              type="button"
              onClick={() => retirer(c.cle)}
              title="Retirer ce filtre"
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 py-1 pl-3 pr-2 text-xs font-medium text-forest-800 ring-1 ring-forest-200 transition-colors hover:bg-red-50 hover:text-red-700 hover:ring-red-200"
            >
              {c.libelle}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
