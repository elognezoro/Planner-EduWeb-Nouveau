"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarCog, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { genererEmploiDuTemps, type EtatGeneration } from "./actions";
import { BoutonReinitialiserPage } from "./bouton-reinitialiser";

const initial: EtatGeneration = { ok: false };

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-8 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : <CalendarCog size={18} />}
      {pending ? "Génération en cours…" : "Lancer la génération"}
    </button>
  );
}

export function GenerationButton({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(genererEmploiDuTemps, initial);

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <form action={action}>
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <Btn />
        </form>
        <BoutonReinitialiserPage />
      </div>

      {etat.ok && etat.message && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{etat.message}</span>
          </div>

          {etat.qualite && (
            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-forest-900">Qualité de l&apos;emploi du temps</p>
                <span className="font-display text-2xl font-bold text-forest-800">
                  {etat.qualite.score}
                  <span className="text-sm font-medium text-ink-700/50">/100</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${etat.qualite.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-700/55">
                Optimisation des contraintes souples : {etat.qualite.scoreInitial}/100 → {etat.qualite.score}/100.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {[
                  { l: "Heures creuses", v: etat.qualite.penalites.trous },
                  { l: "Répétitions/jour", v: etat.qualite.penalites.repartition },
                  { l: "Heures consécutives", v: etat.qualite.penalites.consecutives },
                  { l: "Fin de journée", v: etat.qualite.penalites.finJournee },
                  { l: "Sans pause midi", v: etat.qualite.penalites.pauseMidi },
                ].map((p) => (
                  <span
                    key={p.l}
                    className={`rounded-full px-2.5 py-0.5 font-medium ${p.v === 0 ? "bg-forest-100 text-forest-800" : "bg-cream-200 text-ink-700/75"}`}
                  >
                    {p.l} : {p.v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!etat.ok && etat.message && (
        <div className="rounded-xl border border-gold-300/70 bg-gold-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-900">
            <AlertTriangle size={17} /> {etat.message}
          </p>
          {etat.blocages && etat.blocages.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-7 text-sm text-gold-900/85">
              {etat.blocages.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gold-900/70">
            Le système ne produit jamais d'emploi du temps incomplet : ajustez les points
            ci-dessus puis relancez.
          </p>
        </div>
      )}
    </div>
  );
}
