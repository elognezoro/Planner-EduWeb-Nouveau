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
              {/* Pénalités des contraintes SOUPLES — une BULLE explique chacune au survol
                  (définitions alignées sur le calcul réel du solveur, penalitesBrutesClasse). */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {[
                  {
                    l: "Heures creuses",
                    v: etat.qualite.penalites.trous,
                    aide:
                      "Heures d'attente : créneaux vides entre le premier et le dernier cours d'une journée de classe — les élèves patientent sans cours. Plus ce nombre est bas, plus les journées sont compactes (0 = aucun trou).",
                  },
                  {
                    l: "Répétitions/jour",
                    v: etat.qualite.penalites.repartition,
                    aide:
                      "Nombre de fois où une même discipline revient plusieurs fois dans la MÊME journée pour une classe, au lieu d'être répartie sur la semaine. Plus ce nombre est bas, mieux la semaine est équilibrée.",
                  },
                  {
                    l: "Heures consécutives",
                    v: etat.qualite.penalites.consecutives,
                    aide:
                      "Heures d'une même discipline enchaînées AU-DELÀ de 2 heures d'affilée pour une classe (fatigue, attention en baisse). 0 = jamais plus de 2 heures de suite de la même matière.",
                  },
                  {
                    l: "Fin de journée",
                    v: etat.qualite.penalites.finJournee,
                    aide:
                      "Cours placés sur la TOUTE DERNIÈRE période de la journée, moment de moindre concentration des élèves. Plus ce nombre est bas, plus les fins de journée sont allégées.",
                  },
                  {
                    l: "Sans pause midi",
                    v: etat.qualite.penalites.pauseMidi,
                    aide:
                      "Journées de classe dont la période CENTRALE est occupée par un cours : la classe n'a pas de vraie coupure à la mi-journée ce jour-là. Chaque journée concernée compte pour 1.",
                  },
                ].map((p) => (
                  <span
                    key={p.l}
                    title={p.aide}
                    className={`cursor-help rounded-full px-2.5 py-0.5 font-medium underline decoration-dotted decoration-1 underline-offset-2 ${p.v === 0 ? "bg-forest-100 text-forest-800 decoration-forest-400" : "bg-cream-200 text-ink-700/75 decoration-ink-700/40"}`}
                  >
                    {p.l} : {p.v}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[0.68rem] text-ink-700/50">
                Ces compteurs mesurent le confort de l&apos;emploi du temps (contraintes souples) —
                plus ils sont bas, mieux c&apos;est. Survolez une pastille pour l&apos;explication.
              </p>
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
            Le système ne produit jamais d&apos;emploi du temps incomplet : ajustez les points
            ci-dessus puis relancez.
          </p>
        </div>
      )}
    </div>
  );
}
