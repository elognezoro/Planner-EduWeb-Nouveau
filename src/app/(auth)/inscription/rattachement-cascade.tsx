"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Landmark, Search, X } from "lucide-react";
import { Input, Label } from "@/components/ui/form";
import { SelecteurPays } from "@/components/app/selecteur-pays";
import { SelecteurEtabCascade, type EtabCascade } from "@/app/app/systeme/comptes/selecteur-etab-cascade";
import type { PaysDetecte } from "@/lib/geo";
import {
  regionsPaysInscription,
  listerEtablissementsInscription,
  rechercherEtablissementsInscription,
  type EtabInscription,
} from "./cascade-actions";

function plat(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Region = { id: string; nom: string; nb: number };

/** Liste déroulante recherchable des régions académiques (contrôlée : pilote la cascade). */
function ComboRegion({
  regions,
  valeur,
  onChange,
  prefixe,
}: {
  regions: Region[];
  valeur: string;
  onChange: (id: string) => void;
  prefixe: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  const sel = regions.find((r) => r.id === valeur) ?? null;
  const libelle = (nom: string) => (prefixe ? `${prefixe} · ${nom}` : nom);
  const liste = useMemo(() => {
    const nq = plat(q);
    return nq ? regions.filter((r) => plat(r.nom).includes(nq)) : regions;
  }, [q, regions]);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    champ.current?.focus();
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-cream-300 bg-white px-3 pr-16 text-left text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      >
        <span className={`truncate ${sel ? "text-ink-900" : "text-ink-700/55"}`}>
          {sel ? libelle(sel.nom) : "Choisir une région académique…"}
        </span>
        <ChevronDown size={16} className={`absolute right-3 shrink-0 text-ink-700/45 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>
      {sel && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Retirer la région sélectionnée"
          className="absolute right-9 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-700/45 hover:bg-cream-100 hover:text-ink-700/70"
        >
          <X size={14} />
        </button>
      )}

      {ouvert && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-cream-100 px-3 py-2">
            <Search size={15} className="shrink-0 text-ink-700/45" />
            <input
              ref={champ}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une région académique…"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-ink-700/40"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {liste.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-700/55">Aucune région ne correspond.</li>
            )}
            {liste.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={r.id === valeur}
                  onClick={() => {
                    onChange(r.id);
                    setOuvert(false);
                    setQ("");
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-forest-50 ${
                    r.id === valeur ? "bg-forest-50/70 font-semibold text-forest-900" : "text-ink-900"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Landmark size={12} className="shrink-0 text-forest-600" />
                    <span className="truncate">{libelle(r.nom)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-700/45">{r.nb}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Rattachement en cascade pour l'inscription : Pays → Région académique (DRENAET) →
 * Établissement (répertoire public, recherche rapide), plus le code établissement.
 * Chaque étage est recherchable ; les identifiants choisis sont transmis à l'action
 * `sinscrire` via des champs cachés (`paysChoisi`, `regionDeclareeId`,
 * `etablissementDeclareId`, `structureDeclaree`) et le champ `codeEtablissement`.
 */
export function RattachementCascade({ paysDetecte }: { paysDetecte: PaysDetecte }) {
  const [pays, setPays] = useState(paysDetecte.nom);
  const [regions, setRegions] = useState<Region[]>([]);
  const [total, setTotal] = useState(0);
  const [regionsPretes, setRegionsPretes] = useState(false);
  const [regionId, setRegionId] = useState("");
  const [etabs, setEtabs] = useState<EtabInscription[] | null>([]);
  const [chargement, setChargement] = useState(false);
  const [etabSel, setEtabSel] = useState<EtabInscription | null>(null);
  const [code, setCode] = useState("");

  const prefixe = pays === "Côte d'Ivoire" ? "DRENAET" : "";

  // Étage 1 → 2 : quand le pays change, réinitialiser la cascade (avant le rendu, sans passer
  // par un effet) puis ne garder dans l'effet que le chargement asynchrone des régions.
  const [paysPrec, setPaysPrec] = useState(pays);
  if (paysPrec !== pays) {
    setPaysPrec(pays);
    setRegionsPretes(false);
    setRegions([]);
    setTotal(0);
    setRegionId("");
    setEtabSel(null);
    setEtabs([]);
  }

  useEffect(() => {
    let vivant = true;
    if (!pays.trim()) return;
    regionsPaysInscription(pays)
      .then((r) => {
        if (vivant) {
          setRegions(r.regions);
          setTotal(r.total);
          setRegionsPretes(true);
        }
      })
      .catch(() => {
        if (vivant) setRegionsPretes(true);
      });
    return () => {
      vivant = false;
    };
  }, [pays]);

  // Étage 2 → 3 : charger les établissements (liste locale si portée réduite, sinon recherche
  // serveur). On attend que les régions du pays soient connues avant de décider du mode. La
  // bascule chargement/etabs se fait avant le rendu (dépendante du même jeu de valeurs que
  // l'effet) ; seul le fetch asynchrone reste dans l'effet.
  const cleEtabs = `${pays}|${regionId}|${regions.length}|${total}|${regionsPretes}`;
  const [cleEtabsPrec, setCleEtabsPrec] = useState(cleEtabs);
  if (cleEtabsPrec !== cleEtabs) {
    setCleEtabsPrec(cleEtabs);
    if (pays.trim() && regionsPretes) {
      const peutLister = Boolean(regionId) || (regions.length === 0 && total <= 500);
      if (peutLister) {
        setChargement(true);
      } else {
        setEtabs(null); // mode recherche serveur sur tout le pays
        setChargement(false);
      }
    }
  }

  useEffect(() => {
    let vivant = true;
    if (!pays.trim() || !regionsPretes) return;
    const peutLister = Boolean(regionId) || (regions.length === 0 && total <= 500);
    if (peutLister) {
      listerEtablissementsInscription(pays, regionId || undefined)
        .then((l) => {
          if (vivant) setEtabs(l);
        })
        .catch(() => {
          if (vivant) setEtabs([]);
        })
        .finally(() => {
          if (vivant) setChargement(false);
        });
    }
    return () => {
      vivant = false;
    };
  }, [pays, regionId, regions.length, total, regionsPretes]);

  const choisirEtab = (e: EtabCascade | null) => {
    const ei = e as EtabInscription | null;
    setEtabSel(ei);
    setCode(ei?.code ?? "");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>
          Pays<span className="text-red-500"> *</span>
        </Label>
        <SelecteurPays name="paysChoisi" valeur={pays} onSelect={(p) => setPays(p.nom)} />
        <p className="mt-1.5 text-xs text-ink-700/60">
          Pays de rattachement de votre compte (pré-rempli d&apos;après votre localisation).
        </p>
      </div>

      {regions.length > 0 && (
        <div>
          <Label>Région académique</Label>
          <ComboRegion regions={regions} valeur={regionId} onChange={setRegionId} prefixe={prefixe} />
          <input type="hidden" name="regionDeclareeId" value={regionId} />
          <p className="mt-1.5 text-xs text-ink-700/60">
            Sélectionnez votre région pour filtrer la liste des établissements.
          </p>
        </div>
      )}

      <div>
        <Label>Établissement</Label>
        <SelecteurEtabCascade
          etabs={etabs}
          chargement={chargement}
          rechercheServeur={(q) => rechercherEtablissementsInscription(pays, q, regionId || undefined)}
          indication={
            regions.length > 0 && !regionId
              ? "Choisissez d'abord une région, ou tapez au moins 2 caractères pour rechercher dans tout le pays."
              : "Tapez au moins 2 caractères pour rechercher."
          }
          selection={etabSel ? { id: etabSel.id, nom: etabSel.nom } : null}
          onChange={choisirEtab}
          pays={pays}
        />
        <input type="hidden" name="etablissementDeclareId" value={etabSel?.id ?? ""} />
        <input type="hidden" name="structureDeclaree" value={etabSel?.nom ?? ""} />
        <p className="mt-1.5 text-xs text-ink-700/60">
          Facultatif. À la validation de votre compte, ce rattachement sera vérifié par
          l&apos;administrateur.
        </p>
      </div>

      <div>
        <Label htmlFor="codeEtablissement">Code établissement</Label>
        <Input
          id="codeEtablissement"
          name="codeEtablissement"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex : 0012345A"
          maxLength={40}
        />
        <p className="mt-1.5 text-xs text-ink-700/60">
          Facultatif — identifie précisément votre établissement. Rempli automatiquement si vous le
          sélectionnez ci-dessus.
        </p>
      </div>
    </div>
  );
}
