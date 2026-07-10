"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, SlidersHorizontal, Globe2, Check, ChevronDown } from "lucide-react";
import Image from "next/image";
import { drapeauUrl, trouverPays } from "@/lib/referentiels/pays";
import { FAMILLES_ENSEIGNEMENT, RESEAUX_CONFESSIONNELS } from "@/lib/referentiels/etablissement";
import type { RegionOption } from "./etablissement-form";

const BASE = "/app/systeme/etablissements";

export interface PaysCompte {
  nom: string;
  total: number;
}

export interface FiltresValeurs {
  q: string;
  /** Nom du pays, ou « all » pour « Tous les pays », ou « » (défaut géolocalisé côté serveur). */
  pays: string;
  region: string;
  famille: string;
  statut: string;
  reseau: string;
}

const STATUTS = [
  ["public", "Public"],
  ["prive", "Privé"],
  ["confessionnel", "Confessionnel"],
  ["autre", "Autre"],
] as const;

const selectClasse =
  "h-11 w-full rounded-2xl border border-cream-300 bg-white px-3 text-sm text-ink-900 shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/** Liste déroulante de pays AVEC recherche rapide (drapeau + effectif). */
function ComboboxPays({
  valeur,
  paysListe,
  onChoisir,
}: {
  valeur: string;
  paysListe: PaysCompte[];
  onChoisir: (v: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [rech, setRech] = useState("");
  const racineRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLInputElement>(null);

  // Fermeture au clic à l'extérieur (setState dans un gestionnaire d'événement : conforme au lint).
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: PointerEvent) => {
      if (racineRef.current && !racineRef.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", surClic);
    return () => document.removeEventListener("pointerdown", surClic);
  }, [ouvert]);

  useEffect(() => {
    if (ouvert) champRef.current?.focus();
  }, [ouvert]);

  const tousPays = valeur === "all" || !valeur;
  const infoSel = tousPays ? null : trouverPays(valeur);
  const compteSel = paysListe.find((p) => p.nom === valeur)?.total;

  const filtres = useMemo(() => {
    const t = rech.trim().toLowerCase();
    return t ? paysListe.filter((p) => p.nom.toLowerCase().includes(t)) : paysListe;
  }, [rech, paysListe]);

  const choisir = (v: string) => {
    onChoisir(v);
    setOuvert(false);
    setRech("");
  };

  return (
    <div ref={racineRef} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className={`${selectClasse} flex items-center gap-2 pl-3 text-left`}
      >
        {infoSel ? (
          <Image src={drapeauUrl(infoSel.code)} alt="" width={20} height={14} unoptimized className="h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-cream-300" />
        ) : (
          <Globe2 size={15} className="text-ink-700/40" />
        )}
        <span className="flex-1 truncate">
          {tousPays ? "Tous les pays" : `${valeur}${compteSel != null ? ` (${compteSel.toLocaleString("fr-FR")})` : ""}`}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-ink-700/40 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-cream-300 bg-white shadow-lg">
          <div className="border-b border-cream-100 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                ref={champRef}
                value={rech}
                onChange={(e) => setRech(e.target.value)}
                placeholder="Rechercher un pays…"
                className="h-9 w-full rounded-xl border border-cream-300 bg-white pl-8 pr-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            <li>
              <button type="button" onClick={() => choisir("all")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50">
                <Globe2 size={14} className="text-ink-700/50" />
                <span className="flex-1">Tous les pays</span>
                {tousPays && <Check size={14} className="text-forest-600" />}
              </button>
            </li>
            {filtres.map((p) => {
              const info = trouverPays(p.nom);
              return (
                <li key={p.nom}>
                  <button type="button" onClick={() => choisir(p.nom)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50">
                    {info ? (
                      <Image src={drapeauUrl(info.code)} alt="" width={20} height={14} unoptimized className="h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-cream-300" />
                    ) : (
                      <span className="h-3.5 w-5 rounded-[2px] bg-cream-200" />
                    )}
                    <span className="flex-1 truncate">{p.nom}</span>
                    <span className="text-xs text-ink-700/50">{p.total.toLocaleString("fr-FR")}</span>
                    {valeur === p.nom && <Check size={14} className="text-forest-600" />}
                  </button>
                </li>
              );
            })}
            {filtres.length === 0 && <li className="px-3 py-3 text-center text-xs text-ink-700/50">Aucun pays trouvé.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Filtre avancé DYNAMIQUE du répertoire : chaque changement s'applique immédiatement.
 * Le pays par défaut est celui géolocalisé de l'utilisateur (calculé côté serveur) ;
 * « Tous les pays » (valeur « all ») le remplace explicitement.
 */
export function FiltresEtablissements({
  regions,
  paysListe,
  valeurs,
  paysParDefaut,
}: {
  regions: RegionOption[];
  paysListe: PaysCompte[];
  valeurs: FiltresValeurs;
  /** Pays géolocalisé appliqué par défaut (pour le bouton « réinitialiser »). */
  paysParDefaut: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(valeurs.q);
  const [pays, setPays] = useState(valeurs.pays);
  const [region, setRegion] = useState(valeurs.region);
  const [famille, setFamille] = useState(valeurs.famille);
  const [statut, setStatut] = useState(valeurs.statut);
  const [reseau, setReseau] = useState(valeurs.reseau);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premierRendu = useRef(true);

  const paysChoisi = pays && pays !== "all" ? pays : "";

  const regionsParPays = useMemo(() => {
    const m = new Map<string, RegionOption[]>();
    for (const r of regions) {
      const arr = m.get(r.pays) ?? [];
      arr.push(r);
      m.set(r.pays, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [regions]);

  const regionsVisibles = paysChoisi ? regions.filter((r) => r.pays === paysChoisi) : regions;

  function appliquer(prochaines: Partial<FiltresValeurs>) {
    const v = { q, pays, region, famille, statut, reseau, ...prochaines };
    const p = new URLSearchParams();
    if (v.q.trim()) p.set("q", v.q.trim());
    if (v.pays) p.set("pays", v.pays); // « all » ou nom de pays — vide = défaut géolocalisé
    if (v.region) p.set("region", v.region);
    if (v.famille) p.set("famille", v.famille);
    if (v.statut) p.set("statut", v.statut);
    if (v.reseau) p.set("reseau", v.reseau);
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
    const country = valeur && valeur !== "all" ? valeur : "";
    // La région ne survit que si elle appartient au nouveau pays.
    const regionValide = !country || regions.some((r) => r.id === region && r.pays === country);
    const prochaineRegion = regionValide ? region : "";
    if (!regionValide) setRegion("");
    appliquer({ pays: valeur, region: prochaineRegion });
  }

  function choisirStatut(valeur: string) {
    setStatut(valeur);
    const prochainReseau = valeur === "confessionnel" ? reseau : "";
    if (valeur !== "confessionnel") setReseau("");
    appliquer({ statut: valeur, reseau: prochainReseau });
  }

  function reinitialiser() {
    setQ("");
    setPays(paysParDefaut || "all");
    setRegion("");
    setFamille("");
    setStatut("");
    setReseau("");
    startTransition(() => router.replace(BASE, { scroll: false }));
  }

  const chips: { cle: keyof FiltresValeurs; libelle: string }[] = [];
  if (q.trim()) chips.push({ cle: "q", libelle: `« ${q.trim()} »` });
  if (paysChoisi) chips.push({ cle: "pays", libelle: paysChoisi });
  if (region) chips.push({ cle: "region", libelle: regions.find((r) => r.id === region)?.nom ?? "Région" });
  if (famille) chips.push({ cle: "famille", libelle: FAMILLES_ENSEIGNEMENT.find((f) => f.v === famille)?.l ?? famille });
  if (statut) chips.push({ cle: "statut", libelle: STATUTS.find(([v]) => v === statut)?.[1] ?? statut });
  if (reseau) chips.push({ cle: "reseau", libelle: `Réseau : ${reseau}` });

  function retirer(cle: keyof FiltresValeurs) {
    if (cle === "q") {
      setQ("");
      appliquer({ q: "" });
    } else if (cle === "pays") {
      choisirPays("all");
    } else if (cle === "statut") {
      setStatut("");
      setReseau("");
      appliquer({ statut: "", reseau: "" });
    } else {
      const poseurs: Record<string, (v: string) => void> = { region: setRegion, famille: setFamille, reseau: setReseau };
      poseurs[cle]?.("");
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Recherche */}
        <div className="relative sm:col-span-2">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, ville ou code… (recherche instantanée)"
            className="h-11 w-full rounded-2xl border border-cream-300 bg-white pl-10 pr-3 text-sm shadow-sm outline-none transition-all focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </div>

        {/* Pays — combobox avec recherche */}
        <ComboboxPays valeur={pays} paysListe={paysListe} onChoisir={choisirPays} />

        {/* Région — groupée par pays tant qu'aucun pays n'est choisi */}
        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            appliquer({ region: e.target.value });
          }}
          className={selectClasse}
        >
          <option value="">{paysChoisi ? `Toutes les régions (${paysChoisi})` : "Toutes les régions"}</option>
          {paysChoisi
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

        {/* Famille / ordre d'enseignement */}
        <select
          value={famille}
          onChange={(e) => {
            setFamille(e.target.value);
            appliquer({ famille: e.target.value });
          }}
          className={selectClasse}
        >
          <option value="">Tous les enseignements</option>
          {FAMILLES_ENSEIGNEMENT.map((f) => (
            <option key={f.v} value={f.v}>{f.l}</option>
          ))}
        </select>

        {/* Statut */}
        <select value={statut} onChange={(e) => choisirStatut(e.target.value)} className={selectClasse}>
          <option value="">Tous statuts</option>
          {STATUTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Réseau confessionnel — cascade visible uniquement quand statut = confessionnel */}
        {statut === "confessionnel" && (
          <select
            value={reseau}
            onChange={(e) => {
              setReseau(e.target.value);
              appliquer({ reseau: e.target.value });
            }}
            className={selectClasse}
          >
            <option value="">Tous les réseaux</option>
            {RESEAUX_CONFESSIONNELS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
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
