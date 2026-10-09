"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, SlidersHorizontal, Globe2, Check, ChevronDown } from "lucide-react";
import Image from "next/image";
import { drapeauUrl, trouverPays } from "@/lib/referentiels/pays";
import { FAMILLES_ENSEIGNEMENT, RESEAUX_CONFESSIONNELS } from "@/lib/referentiels/etablissement";
import type { RegionOption } from "./etablissement-form";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";

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
  ville: string;
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
  className,
}: {
  valeur: string;
  paysListe: PaysCompte[];
  onChoisir: (v: string) => void;
  /** Classes AJOUTÉES à la racine (variantes « mobile: » seulement). */
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [rech, setRech] = useState("");
  const racineRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLInputElement>(null);

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
    <div ref={racineRef} className={className ? `relative ${className}` : "relative"}>
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
                className="h-9 w-full rounded-xl border border-cream-300 bg-white pl-8 pr-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:h-11 mobile:text-base"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            <li>
              <button type="button" onClick={() => choisir("all")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50 mobile:min-h-12">
                <Globe2 size={14} className="text-ink-700/50" />
                <span className="flex-1">Tous les pays</span>
                {tousPays && <Check size={14} className="text-forest-600" />}
              </button>
            </li>
            {filtres.map((p) => {
              const info = trouverPays(p.nom);
              return (
                <li key={p.nom}>
                  <button type="button" onClick={() => choisir(p.nom)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-50 mobile:min-h-12">
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
 * Filtre avancé DYNAMIQUE du répertoire, EN CASCADE : Pays → Région → Ville, plus
 * Statut → Réseau confessionnel. Chaque changement s'applique immédiatement (navigation d'URL,
 * le serveur recalcule les options du niveau suivant).
 *
 * CLOISONNEMENT : les options reçues (`paysListe`, `regions`, `villes`) sont DÉJÀ bornées au
 * périmètre par le serveur, et le WHERE serveur part toujours du filtre de périmètre. Un rôle
 * verrouillé sur son pays ne reçoit pas de sélecteur de pays (`montrerPays = false`) et ses
 * régions se limitent à son pays. Les filtres ne peuvent donc que RESTREINDRE dans la
 * circonscription, jamais en sortir.
 */
export function FiltresEtablissements({
  regions,
  villes,
  paysListe,
  valeurs,
  paysParDefaut,
  montrerPays = true,
}: {
  regions: RegionOption[];
  /** Villes du périmètre + région sélectionnée (cascade) — vide tant qu'aucune région n'est choisie. */
  villes: string[];
  paysListe: PaysCompte[];
  valeurs: FiltresValeurs;
  /** Pays géolocalisé appliqué par défaut (pour le bouton « réinitialiser »). */
  paysParDefaut: string;
  /** Sélecteur de pays affiché ? Faux pour un rôle verrouillé sur son pays (périmètre « pays »). */
  montrerPays?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(valeurs.q);
  const [pays, setPays] = useState(valeurs.pays);
  const [region, setRegion] = useState(valeurs.region);
  const [ville, setVille] = useState(valeurs.ville);
  const [famille, setFamille] = useState(valeurs.famille);
  const [statut, setStatut] = useState(valeurs.statut);
  const [reseau, setReseau] = useState(valeurs.reseau);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const premierRendu = useRef(true);
  // Téléphone : feuille montante des listes de filtres.
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const paysChoisi = montrerPays && pays && pays !== "all" ? pays : "";

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
  // Régions groupées par pays UNIQUEMENT quand plusieurs pays sont possibles (rôle global sans pays
  // choisi). Pour un rôle verrouillé sur son pays, la liste est déjà mono-pays → affichage plat.
  const grouperRegions = montrerPays && !paysChoisi;

  function appliquer(prochaines: Partial<FiltresValeurs>) {
    const v = { q, pays, region, ville, famille, statut, reseau, ...prochaines };
    const p = new URLSearchParams();
    if (v.q.trim()) p.set("q", v.q.trim());
    if (montrerPays && v.pays) p.set("pays", v.pays); // « all » ou nom de pays — vide = défaut géo
    if (v.region) p.set("region", v.region);
    if (v.ville) p.set("ville", v.ville);
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
    // La région ne survit que si elle appartient au nouveau pays ; la ville dépend de la région.
    const regionValide = !country || regions.some((r) => r.id === region && r.pays === country);
    const prochaineRegion = regionValide ? region : "";
    if (!regionValide) setRegion("");
    setVille("");
    appliquer({ pays: valeur, region: prochaineRegion, ville: "" });
  }

  function choisirRegion(valeur: string) {
    setRegion(valeur);
    // Cascade : changer de région invalide la ville précédente.
    setVille("");
    appliquer({ region: valeur, ville: "" });
  }

  function choisirStatut(valeur: string) {
    setStatut(valeur);
    const prochainReseau = valeur === "confessionnel" ? reseau : "";
    if (valeur !== "confessionnel") setReseau("");
    appliquer({ statut: valeur, reseau: prochainReseau });
  }

  function reinitialiser() {
    setQ("");
    setPays(montrerPays ? paysParDefaut || "all" : "");
    setRegion("");
    setVille("");
    setFamille("");
    setStatut("");
    setReseau("");
    startTransition(() => router.replace(BASE, { scroll: false }));
  }

  const chips: { cle: keyof FiltresValeurs; libelle: string }[] = [];
  if (q.trim()) chips.push({ cle: "q", libelle: `« ${q.trim()} »` });
  if (paysChoisi) chips.push({ cle: "pays", libelle: paysChoisi });
  if (region) chips.push({ cle: "region", libelle: regions.find((r) => r.id === region)?.nom ?? "Région" });
  if (ville) chips.push({ cle: "ville", libelle: ville });
  if (famille) chips.push({ cle: "famille", libelle: FAMILLES_ENSEIGNEMENT.find((f) => f.v === famille)?.l ?? famille });
  if (statut) chips.push({ cle: "statut", libelle: STATUTS.find(([v]) => v === statut)?.[1] ?? statut });
  if (reseau) chips.push({ cle: "reseau", libelle: `Réseau : ${reseau}` });

  // Filtres actifs hors recherche texte (pastille du bouton « Filtres » du téléphone).
  const nbFiltresActifs = chips.filter((c) => c.cle !== "q").length;

  function retirer(cle: keyof FiltresValeurs) {
    if (cle === "q") {
      setQ("");
      appliquer({ q: "" });
    } else if (cle === "pays") {
      choisirPays("all");
    } else if (cle === "region") {
      choisirRegion("");
    } else if (cle === "statut") {
      setStatut("");
      setReseau("");
      appliquer({ statut: "", reseau: "" });
    } else {
      const poseurs: Record<string, (v: string) => void> = { ville: setVille, famille: setFamille, reseau: setReseau };
      poseurs[cle]?.("");
      appliquer({ [cle]: "" });
    }
  }

  /** Listes de filtres (pays, région, ville, enseignement, statut, réseau) : rendues dans la
   *  grille (masquées sur téléphone) ET dans la feuille du téléphone — mêmes états, mêmes
   *  gestionnaires, donc toujours synchronisées. */
  function rendreListes(dansGrille: boolean) {
    const cls = dansGrille ? `${selectClasse} mobile:hidden` : selectClasse;
    return (
      <>
        {/* Pays — combobox avec recherche (masqué pour un rôle verrouillé sur son pays) */}
        {montrerPays && (
          <ComboboxPays valeur={pays} paysListe={paysListe} onChoisir={choisirPays} className={dansGrille ? "mobile:hidden" : undefined} />
        )}

        {/* Région — cascade sous le pays */}
        <select value={region} onChange={(e) => choisirRegion(e.target.value)} aria-label="Région" className={cls}>
          <option value="">{paysChoisi ? `Toutes les régions (${paysChoisi})` : "Toutes les régions"}</option>
          {grouperRegions
            ? regionsParPays.map(([nomPays, liste]) => (
                <optgroup key={nomPays} label={nomPays}>
                  {liste.map((r) => (
                    <option key={r.id} value={r.id}>{r.nom}</option>
                  ))}
                </optgroup>
              ))
            : regionsVisibles.map((r) => (
                <option key={r.id} value={r.id}>{r.nom}</option>
              ))}
        </select>

        {/* Ville — cascade sous la région (n'apparaît qu'une fois une région choisie) */}
        {region && villes.length > 0 && (
          <select
            value={ville}
            onChange={(e) => {
              setVille(e.target.value);
              appliquer({ ville: e.target.value });
            }}
            className={cls}
          >
            <option value="">Toutes les villes</option>
            {villes.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}

        {/* Famille / ordre d'enseignement */}
        <select
          value={famille}
          onChange={(e) => {
            setFamille(e.target.value);
            appliquer({ famille: e.target.value });
          }}
          className={cls}
        >
          <option value="">Tous les enseignements</option>
          {FAMILLES_ENSEIGNEMENT.map((f) => (
            <option key={f.v} value={f.v}>{f.l}</option>
          ))}
        </select>

        {/* Statut */}
        <select value={statut} onChange={(e) => choisirStatut(e.target.value)} aria-label="Statut" className={cls}>
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
            className={cls}
          >
            <option value="">Tous les réseaux</option>
            {RESEAUX_CONFESSIONNELS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
      </>
    );
  }

  return (
    <section className="rounded-3xl border border-cream-200 bg-white p-5 shadow-soft mobile:p-3">
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
              className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-medium text-ink-700/70 hover:bg-red-50 hover:text-red-600 mobile:h-10"
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

        {/* Téléphone : bouton « Filtres (n) » — les listes ci-dessous y sont masquées et
            s'ouvrent dans une feuille montante (5 à 7 listes repoussaient le premier
            établissement d'un écran entier). Absent de l'ordinateur et du papier. */}
        <div className="lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setFeuilleOuverte(true)}
            aria-haspopup="dialog"
            aria-expanded={feuilleOuverte}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cream-300 bg-white px-4 text-sm font-semibold text-forest-800 shadow-sm active:bg-cream-100"
          >
            <SlidersHorizontal aria-hidden size={16} />
            Filtres
            {nbFiltresActifs > 0 && (
              <span className="rounded-full bg-forest-800 px-2 py-0.5 text-xs font-bold text-cream-50 tabular-nums">
                {nbFiltresActifs}
                <span className="sr-only"> actif{nbFiltresActifs > 1 ? "s" : ""}</span>
              </span>
            )}
          </button>
        </div>

        {rendreListes(true)}
      </div>

      <FeuilleBas ouvert={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)} titre="Filtres du répertoire" hauteurMax="85dvh">
        {feuilleOuverte && (
          <div className="space-y-3 px-2 pb-2">
            {rendreListes(false)}
            {nbFiltresActifs > 0 && (
              <button
                type="button"
                onClick={reinitialiser}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border border-cream-300 bg-white text-sm font-medium text-ink-700/80 active:bg-red-50"
              >
                <X aria-hidden size={14} /> Tout réinitialiser
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeuilleOuverte(false)}
              className="min-h-12 w-full rounded-full bg-forest-800 font-semibold text-cream-50 active:bg-forest-700"
            >
              {pending ? "Mise à jour…" : "Voir les résultats"}
            </button>
          </div>
        )}
      </FeuilleBas>

      {/* Puces des filtres actifs — téléphone : une bande qui défile au doigt. */}
      {chips.length > 0 && (
        <div className="rangee-defilante-mobile mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.cle}
              type="button"
              onClick={() => retirer(c.cle)}
              title="Retirer ce filtre"
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-50 py-1 pl-3 pr-2 text-xs font-medium text-forest-800 ring-1 ring-forest-200 transition-colors hover:bg-red-50 hover:text-red-700 hover:ring-red-200 mobile:min-h-10 mobile:pr-3"
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
