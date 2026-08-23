"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarCog, Loader2, AlertTriangle, CheckCircle2, Timer, Sparkles } from "lucide-react";
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

/** Zone du compte à rebours : montée UNIQUEMENT pendant la soumission — le chrono démarre
 *  donc à zéro à chaque génération (remontage), sans remise à zéro d'état dans un effet. */
function ZoneCompteARebours({ estimationSecondes }: { estimationSecondes: number }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <CompteARebours estimationSecondes={estimationSecondes} />;
}

/** Compte à rebours du temps d'attente ESTIMÉ pendant la génération (tic chaque seconde). */
function CompteARebours({ estimationSecondes }: { estimationSecondes: number }) {
  const [restant, setRestant] = useState(estimationSecondes);
  useEffect(() => {
    const debut = Date.now();
    const timer = setInterval(() => {
      setRestant(Math.max(0, estimationSecondes - Math.floor((Date.now() - debut) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [estimationSecondes]);
  const mm = Math.floor(restant / 60);
  const ss = String(restant % 60).padStart(2, "0");
  return (
    <span
      role="timer"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-800 tabular-nums"
    >
      <Timer size={14} className="text-forest-700" />
      {restant > 0 ? (
        <>
          Résultat estimé dans <strong className="font-semibold text-forest-900">{mm}:{ss}</strong> au plus
        </>
      ) : (
        <>Finalisation (optimisation et enregistrement)…</>
      )}
    </span>
  );
}

/** Rapport de qualité PERSISTÉ en base à la génération (Etablissement.qualiteEdt) : le bloc
 *  « Qualité de l'emploi du temps » reste consultable tant que l'EDT existe. Les corrections
 *  automatiques de l'IA y sont jointes (traçabilité durable, indépendante de la réponse d'action). */
export type QualitePersistee = NonNullable<EtatGeneration["qualite"]> & {
  genereLe?: string;
  corrections?: string[];
};

export function GenerationButton({
  etablissementId,
  estimationSecondes,
  qualitePersistee,
}: {
  etablissementId: string;
  /** Temps d'attente estimé (majorant) affiché en compte à rebours pendant la génération. */
  estimationSecondes: number;
  /** Rapport de qualité du dernier EDT généré (null si aucun EDT ou rapport absent). */
  qualitePersistee?: QualitePersistee | null;
}) {
  const [etat, action] = useActionState(genererEmploiDuTemps, initial);
  // Pastille de pénalité SÉLECTIONNÉE (clic) : affiche les classes concernées en dessous.
  const [detailCle, setDetailCle] = useState<
    "trous" | "repartition" | "consecutives" | "finJournee" | "pauseMidi" | null
  >(null);
  // Qualité AFFICHÉE : le résultat FRAIS d'une génération prime ; sinon le rapport persisté.
  const qualiteAffichee = etat.qualite ?? qualitePersistee ?? null;
  // Corrections AFFICHÉES : celles de la génération courante, sinon celles PERSISTÉES avec
  // l'EDT (le chef les retrouve après rechargement, ou s'il n'a pas déclenché lui-même).
  const correctionsAffichees = etat.corrections ?? qualitePersistee?.corrections ?? null;

  return (
    <div className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <Btn />
          <ZoneCompteARebours estimationSecondes={estimationSecondes} />
        </form>
        <BoutonReinitialiserPage />
      </div>

      {etat.ok && etat.message && (
        <div className="flex items-start gap-2.5 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{etat.message}</span>
        </div>
      )}

      {/* Corrections de configuration appliquées AUTOMATIQUEMENT par l'IA pour débloquer la
          génération : listées intégralement (transparence — la console de configuration
          reflète déjà ces changements, le chef peut les ajuster à tout moment). Affichées
          depuis la génération courante OU depuis le rapport persisté (durable). */}
      {correctionsAffichees && correctionsAffichees.length > 0 && (
        <div className="rounded-xl border border-forest-300/70 bg-white px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-forest-900">
            <Sparkles size={17} className="text-gold-500" /> Corrections appliquées automatiquement par
            l&apos;IA
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-7 text-sm text-ink-800">
            {correctionsAffichees.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {etat.explicationIA && (
            <p className="mt-2.5 rounded-xl border border-cream-200 bg-cream-50/70 px-3 py-2 text-xs leading-relaxed text-ink-700/80">
              {etat.explicationIA}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-700/55">
            Ces réglages ont été mis à jour dans la console de configuration de l&apos;établissement —
            vous pouvez les y ajuster puis relancer la génération si vous préférez un autre arbitrage.
          </p>
        </div>
      )}

      {qualiteAffichee && (
            <div className="rounded-xl border border-cream-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-forest-900">Qualité de l&apos;emploi du temps</p>
                <span className="font-display text-2xl font-bold text-forest-800">
                  {qualiteAffichee.score}
                  <span className="text-sm font-medium text-ink-700/50">/100</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${qualiteAffichee.score}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-700/55">
                Optimisation des contraintes souples : {qualiteAffichee.scoreInitial}/100 → {qualiteAffichee.score}/100.
              </p>
              {!etat.qualite && qualitePersistee?.genereLe && (
                <p className="mt-0.5 text-[0.68rem] text-ink-700/50" suppressHydrationWarning>
                  Rapport de la génération du{" "}
                  {new Date(qualitePersistee.genereLe).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  .
                </p>
              )}
              {/* Pénalités des contraintes SOUPLES — une BULLE explique chacune au survol
                  (définitions alignées sur le calcul réel du solveur, penalitesBrutesClasse). */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {(
                  [
                    {
                      cle: "trous",
                      l: "Heures creuses",
                      v: qualiteAffichee.penalites.trous,
                      aide:
                        "Heures d'attente : créneaux vides entre le premier et le dernier cours d'une journée de classe — les élèves patientent sans cours. Plus ce nombre est bas, plus les journées sont compactes (0 = aucun trou).",
                    },
                    {
                      cle: "repartition",
                      l: "Répétitions/jour",
                      v: qualiteAffichee.penalites.repartition,
                      aide:
                        "Nombre de fois où une même discipline revient plusieurs fois dans la MÊME journée pour une classe, au lieu d'être répartie sur la semaine. Plus ce nombre est bas, mieux la semaine est équilibrée.",
                    },
                    {
                      cle: "consecutives",
                      l: "Heures consécutives",
                      v: qualiteAffichee.penalites.consecutives,
                      aide:
                        "Heures d'une même discipline enchaînées AU-DELÀ de 2 heures d'affilée pour une classe (fatigue, attention en baisse). 0 = jamais plus de 2 heures de suite de la même matière.",
                    },
                    {
                      cle: "finJournee",
                      l: "Fin de journée",
                      v: qualiteAffichee.penalites.finJournee,
                      aide:
                        "Cours placés sur la TOUTE DERNIÈRE période de la journée, moment de moindre concentration des élèves. Plus ce nombre est bas, plus les fins de journée sont allégées.",
                    },
                    {
                      cle: "pauseMidi",
                      l: "Sans pause midi",
                      v: qualiteAffichee.penalites.pauseMidi,
                      aide:
                        "Journées de classe dont la période CENTRALE est occupée par un cours : la classe n'a pas de vraie coupure à la mi-journée ce jour-là. Chaque journée concernée compte pour 1.",
                    },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.l}
                    type="button"
                    title={p.aide}
                    aria-pressed={detailCle === p.cle}
                    onClick={() => setDetailCle(detailCle === p.cle ? null : p.cle)}
                    className={`cursor-pointer rounded-full px-2.5 py-0.5 font-medium underline decoration-dotted decoration-1 underline-offset-2 transition-shadow ${
                      p.v === 0 ? "bg-forest-100 text-forest-800 decoration-forest-400" : "bg-cream-200 text-ink-700/75 decoration-ink-700/40"
                    } ${detailCle === p.cle ? "ring-2 ring-forest-400" : "hover:ring-1 hover:ring-cream-300"}`}
                  >
                    {p.l} : {p.v}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[0.68rem] text-ink-700/50">
                Ces compteurs mesurent le confort de l&apos;emploi du temps (contraintes souples) —
                plus ils sont bas, mieux c&apos;est. Survolez une pastille pour l&apos;explication,
                cliquez-la pour voir les classes concernées.
              </p>
              {/* Classes concernées par la pastille sélectionnée (détail remonté par le solveur). */}
              {detailCle && (
                <div className="mt-2 rounded-xl border border-cream-200 bg-cream-50/70 p-2.5 text-xs" role="region" aria-live="polite">
                  {(() => {
                    const libelle = {
                      trous: "Heures creuses",
                      repartition: "Répétitions/jour",
                      consecutives: "Heures consécutives",
                      finJournee: "Fin de journée",
                      pauseMidi: "Sans pause midi",
                    }[detailCle];
                    const detail = qualiteAffichee?.parClasse;
                    if (!detail) {
                      return (
                        <p className="text-ink-700/60">
                          Détail par classe disponible après une nouvelle génération.
                        </p>
                      );
                    }
                    const concernees = detail
                      .filter((c) => c[detailCle] > 0)
                      .sort((a, b) => b[detailCle] - a[detailCle] || a.classeNom.localeCompare(b.classeNom, "fr"));
                    if (concernees.length === 0) {
                      return (
                        <p className="font-medium text-forest-800">
                          {libelle} : aucune classe concernée. 👍
                        </p>
                      );
                    }
                    return (
                      <>
                        <p className="mb-1.5 font-semibold text-forest-900">
                          {libelle} — {concernees.length} classe(s) concernée(s) :
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {concernees.map((c) => (
                            <span key={c.classeNom} className="rounded-full border border-cream-300 bg-white px-2 py-0.5 text-ink-800">
                              {c.classeNom} <strong className="text-forest-800">· {c[detailCle]}</strong>
                            </span>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
      )}

      {/* Signalements NON bloquants du solveur (ex : séances isolées résiduelles malgré
          l'option « Empêcher l'isolement d'une séance ») — jamais de silence. */}
      {etat.ok && etat.avertissements && etat.avertissements.length > 0 && (
        <div className="rounded-xl border border-gold-300/70 bg-gold-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-900">
            <AlertTriangle size={17} /> À vérifier après génération
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-7 text-sm text-gold-900/85">
            {etat.avertissements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
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
