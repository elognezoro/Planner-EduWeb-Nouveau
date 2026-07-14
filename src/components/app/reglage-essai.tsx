"use client";

import { useEffect, useState } from "react";
import { DUREES_ESSAI_JOURS, DUREE_ESSAI_DEFAUT } from "@/lib/premium/essai";

/** Date ISO (yyyy-mm-dd) à N jours d'aujourd'hui — appelé côté client uniquement. */
function isoDans(jours: number): string {
  return new Date(Date.now() + jours * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Réglage de la période d'essai à l'affectation (admin système, rôle établissement) : case
 * d'activation + DATE DE FIN libre (calendrier) avec des durées rapides. Émet `essaiActif`
 * (case) et `essaiFinDate` (date). L'état par défaut est posé après montage (useEffect) pour
 * éviter toute divergence d'hydratation liée au temps courant. La fenêtre réelle est validée
 * et bornée côté serveur dans `affecterRoleEtPerimetre`.
 */
export function ReglageEssai({
  finLeInitial,
  onChange,
}: {
  finLeInitial: string | null;
  /** Reporte l'état courant (utile quand le parent construit sa FormData à la main, ex. modale). */
  onChange?: (v: { actif: boolean; finDate: string }) => void;
}) {
  const [actif, setActif] = useState(false);
  const [dateFin, setDateFin] = useState("");
  const [minFin, setMinFin] = useState("");

  useEffect(() => {
    const enCours = Boolean(finLeInitial && new Date(finLeInitial).getTime() > Date.now());
    setActif(enCours);
    setDateFin(enCours && finLeInitial ? finLeInitial.slice(0, 10) : isoDans(DUREE_ESSAI_DEFAUT));
    setMinFin(isoDans(1));
  }, [finLeInitial]);

  useEffect(() => {
    onChange?.({ actif, finDate: dateFin });
    // onChange volontairement hors dépendances (le parent peut passer une closure ré-instanciée).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, dateFin]);

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3.5">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          name="essaiActif"
          checked={actif}
          onChange={(e) => setActif(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-cream-400 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm">
          <span className="font-medium text-forest-900">Période d&apos;essai</span>
          <span className="block text-xs text-ink-700/60">
            Pendant l&apos;essai, l&apos;utilisateur configure entièrement son établissement jusqu&apos;à
            l&apos;élaboration des EDT ; le reste est en lecture seule. Un bandeau rouge de compte à rebours
            s&apos;affiche.
          </span>
        </span>
      </label>
      {actif && (
        <div className="mt-3 ml-6 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="essaiFinDate" className="text-xs font-medium text-forest-900">
              Fin de l&apos;essai
            </label>
            <input
              id="essaiFinDate"
              name="essaiFinDate"
              type="date"
              value={dateFin}
              min={minFin || undefined}
              onChange={(e) => setDateFin(e.target.value)}
              className="rounded-lg border border-cream-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-700/55">Durées rapides :</span>
            {DUREES_ESSAI_JOURS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDateFin(isoDans(n))}
                className="rounded-full border border-cream-300 bg-white px-2.5 py-0.5 text-xs font-medium text-forest-700 hover:border-forest-400 hover:bg-forest-50"
              >
                {n} j
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
