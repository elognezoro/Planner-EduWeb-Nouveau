"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Church, Loader2, MapPin, Search, X } from "lucide-react";
import { Card } from "@/components/app/ui";
import { affecterDioceses } from "./actions";

export type EtabCatholique = {
  id: string;
  nom: string;
  ville: string | null;
  code: string | null;
  regionNom: string | null;
  diocese: string | null;
};

export type GroupePays = {
  pays: string;
  /** Diocèses du référentiel pour ce pays (vide si pays non référencé). */
  dioceses: string[];
  etablissements: EtabCatholique[];
};

const champ =
  "h-11 rounded-full border border-cream-300 bg-white px-4 text-sm text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

/** Une section par pays : recherche, filtre « sans diocèse », sélection multiple, affectation groupée. */
function SectionPays({ groupe }: { groupe: GroupePays }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sansUniquement, setSansUniquement] = useState(false);
  const [filtreDiocese, setFiltreDiocese] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [diocese, setDiocese] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, start] = useTransition();

  // Diocèses réellement présents parmi les établissements de ce pays (pour le filtre de recherche).
  const diocesesPresents = useMemo(
    () => [...new Set(groupe.etablissements.map((e) => e.diocese).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b, "fr")),
    [groupe.etablissements],
  );

  const visibles = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groupe.etablissements.filter((e) => {
      if (sansUniquement && e.diocese) return false;
      if (filtreDiocese && e.diocese !== filtreDiocese) return false;
      if (s && !`${e.nom} ${e.ville ?? ""} ${e.code ?? ""} ${e.regionNom ?? ""}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [groupe.etablissements, q, sansUniquement, filtreDiocese]);

  const sansDiocese = groupe.etablissements.filter((e) => !e.diocese).length;
  const idsVisibles = visibles.map((e) => e.id);
  const toutCoche = idsVisibles.length > 0 && idsVisibles.every((id) => selection.has(id));

  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toutBasculer = () =>
    setSelection((s) => {
      const n = new Set(s);
      if (toutCoche) idsVisibles.forEach((id) => n.delete(id));
      else idsVisibles.forEach((id) => n.add(id));
      return n;
    });

  const appliquer = () => {
    if (!diocese || selection.size === 0 || enCours) return;
    setMessage(null);
    start(async () => {
      const r = await affecterDioceses([...selection], diocese);
      if (r.ok) {
        setMessage({ ok: true, texte: `${r.nb} établissement(s) rattaché(s) à « ${diocese} ».` });
        setSelection(new Set());
        router.refresh();
      } else {
        setMessage({ ok: false, texte: r.message ?? "Affectation impossible." });
      }
    });
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <Church size={17} className="text-forest-600" /> {groupe.pays}
          <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs font-semibold text-forest-800">
            {groupe.etablissements.length}
          </span>
        </h2>
        {sansDiocese > 0 && (
          <span className="text-xs font-medium text-gold-700">
            {sansDiocese} sans diocèse renseigné
          </span>
        )}
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un établissement…"
            aria-label={`Rechercher un établissement (${groupe.pays})`}
            className={`${champ} w-full pl-10`}
          />
        </div>
        {diocesesPresents.length > 0 && (
          <select
            value={filtreDiocese}
            onChange={(e) => {
              setFiltreDiocese(e.target.value);
              if (e.target.value) setSansUniquement(false); // un diocèse choisi → on sort du mode « sans diocèse »
            }}
            aria-label="Filtrer par diocèse"
            className={`${champ} shrink-0 pr-8 sm:w-56`}
          >
            <option value="">Tous les diocèses</option>
            {diocesesPresents.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm text-forest-800">
          <input
            type="checkbox"
            checked={sansUniquement}
            onChange={(e) => {
              setSansUniquement(e.target.checked);
              if (e.target.checked) setFiltreDiocese(""); // exclusif du filtre par diocèse
            }}
            className="h-4 w-4 rounded border-cream-300"
          />
          Uniquement sans diocèse
        </label>
      </div>

      {/* Barre d'affectation groupée */}
      <div className="flex flex-col gap-3 rounded-2xl border border-forest-200 bg-forest-50/50 p-3 sm:flex-row sm:items-center">
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-forest-800">
          <input type="checkbox" checked={toutCoche} onChange={toutBasculer} disabled={idsVisibles.length === 0} className="h-4 w-4 rounded border-cream-300" />
          {selection.size > 0 ? `${selection.size} sélectionné(s)` : "Tout sélectionner"}
        </label>
        {groupe.dioceses.length > 0 ? (
          <select
            value={diocese}
            onChange={(e) => setDiocese(e.target.value)}
            aria-label="Diocèse à affecter"
            className={`${champ} min-w-0 flex-1 pr-8`}
          >
            <option value="">Choisir le diocèse à affecter…</option>
            {groupe.dioceses.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={diocese}
            onChange={(e) => setDiocese(e.target.value)}
            placeholder="Diocèse (pays non référencé — saisie libre)…"
            aria-label="Diocèse à affecter (saisie libre)"
            className={`${champ} min-w-0 flex-1`}
          />
        )}
        <button
          type="button"
          onClick={appliquer}
          disabled={enCours || !diocese || selection.size === 0}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-forest-800 px-5 text-sm font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Affecter à {selection.size || "…"}
        </button>
      </div>
      {message && (
        <p className={`text-xs font-medium ${message.ok ? "text-forest-700" : "text-red-600"}`}>{message.texte}</p>
      )}

      {/* Liste */}
      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-700/60">Aucun établissement ne correspond.</p>
      ) : (
        <ul className="divide-y divide-cream-200">
          {visibles.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={selection.has(e.id)}
                onChange={() => basculer(e.id)}
                aria-label={`Sélectionner ${e.nom}`}
                className="h-4 w-4 shrink-0 rounded border-cream-300"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-forest-900">{e.nom}</p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-700/55">
                  {(e.ville || e.regionNom) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="shrink-0" />
                      {[e.ville, e.regionNom].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {e.code && <span>Code {e.code}</span>}
                </p>
              </div>
              {e.diocese ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest-100 px-2.5 py-1 text-xs font-medium text-forest-800">
                  <Church size={11} /> {e.diocese}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-800">
                  <X size={11} /> Sans diocèse
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AffectationDioceses({ groupes }: { groupes: GroupePays[] }) {
  return (
    <div className="space-y-6">
      {groupes.map((g) => (
        <SectionPays key={g.pays} groupe={g} />
      ))}
    </div>
  );
}
