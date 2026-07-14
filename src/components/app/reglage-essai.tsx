"use client";

import { useEffect, useState } from "react";
import { DUREES_ESSAI_JOURS } from "@/lib/premium/essai";

/** Date ISO (yyyy-mm-dd) à N jours d'aujourd'hui — appelé côté client uniquement. */
function isoDans(jours: number): string {
  return new Date(Date.now() + jours * 86_400_000).toISOString().slice(0, 10);
}

export type ModeEssai = "essai" | "libre";

/**
 * Choix de l'accès d'un utilisateur à l'affectation à un établissement (admin système) :
 * DEUX options exclusives — « Période d'essai » (assigne l'essai) ou « Accès libre » (le retire).
 * En mode essai, une date de fin est proposée (vide = durée par défaut de la plateforme), avec des
 * durées rapides. L'état par défaut reflète l'essai en cours (posé après montage → pas de divergence
 * d'hydratation). Émet `essaiMode` (radio) + `essaiFinDate` (date). Le serveur valide et borne.
 */
export function ReglageEssai({
  finLeInitial,
  onChange,
}: {
  finLeInitial: string | null;
  onChange?: (v: { mode: ModeEssai; finDate: string }) => void;
}) {
  const [mode, setMode] = useState<ModeEssai>("libre");
  const [dateFin, setDateFin] = useState("");
  const [minFin, setMinFin] = useState("");

  useEffect(() => {
    const enCours = Boolean(finLeInitial && new Date(finLeInitial).getTime() > Date.now());
    setMode(enCours ? "essai" : "libre");
    setDateFin(enCours && finLeInitial ? finLeInitial.slice(0, 10) : "");
    setMinFin(isoDans(1));
  }, [finLeInitial]);

  useEffect(() => {
    onChange?.({ mode, finDate: dateFin });
    // onChange volontairement hors dépendances (le parent peut passer une closure ré-instanciée).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, dateFin]);

  const Option = ({ val, titre, desc }: { val: ModeEssai; titre: string; desc: string }) => (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
        mode === val ? "border-red-400 bg-white" : "border-cream-300 bg-white/60 hover:border-red-200"
      }`}
    >
      <input
        type="radio"
        name="essaiMode"
        value={val}
        checked={mode === val}
        onChange={() => setMode(val)}
        className="mt-0.5 h-4 w-4 text-red-600 focus:ring-red-500"
      />
      <span className="text-sm">
        <span className="font-medium text-forest-900">{titre}</span>
        <span className="block text-xs text-ink-700/60">{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-3.5">
      <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wide text-red-700">
        Accès de l&apos;utilisateur
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Option
          val="essai"
          titre="Période d'essai"
          desc="Configuration de l'établissement et EDT éditables ; le reste en lecture seule. Bandeau de compte à rebours affiché."
        />
        <Option val="libre" titre="Accès libre" desc="Aucune période d'essai — accès complet selon le rôle." />
      </div>
      {mode === "essai" && (
        <div className="mt-3 space-y-2">
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
            <span className="text-xs text-ink-700/55">Vide = durée par défaut de la plateforme.</span>
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
