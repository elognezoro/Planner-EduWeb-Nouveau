const CYCLE_LABEL: Record<string, string> = {
  college: "1er cycle",
  lycee: "2nd cycle",
  primaire: "primaire",
  prescolaire: "préscolaire",
};

export interface CompetenceBilan {
  discipline: string;
  cycle: string;
  nbEnseignants: number;
  max: number;
  min: number;
}

/**
 * Bilan de service affiché au bas de l'EDT d'un enseignant : heures dues (volume horaire),
 * charge effective, et — pour chaque discipline/cycle enseigné — la charge du collègue le plus
 * et le moins chargé de la même compétence (pour visualiser l'équilibrage).
 */
export function BilanServiceEnseignant({
  nom,
  heuresDues,
  chargeEffective,
  competences,
}: {
  nom: string;
  heuresDues: number; // 0 = non défini
  chargeEffective: number;
  competences: CompetenceBilan[];
}) {
  const ecart = heuresDues > 0 ? chargeEffective - heuresDues : null;
  const tonEcart = ecart === null ? "" : ecart < -1 ? "text-gold-800" : ecart > 1 ? "text-red-600" : "text-forest-700";

  return (
    <div className="mt-6 rounded-2xl border border-cream-200 bg-cream-50/50 p-4 print:mt-3">
      <p className="mb-3 font-display text-base font-bold text-forest-900">Bilan de service — {nom}</p>

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-baseline gap-1.5 rounded-xl border border-cream-200 bg-white px-3 py-1.5">
          <span className="text-ink-700/60">Heures dues :</span>
          <strong className="text-forest-900">{heuresDues > 0 ? `${heuresDues} h` : "non défini"}</strong>
        </span>
        <span className="inline-flex items-baseline gap-1.5 rounded-xl border border-cream-200 bg-white px-3 py-1.5">
          <span className="text-ink-700/60">Charge effective :</span>
          <strong className="text-forest-900">{chargeEffective} h</strong>
        </span>
        {ecart !== null && (
          <span className="inline-flex items-baseline gap-1.5 rounded-xl border border-cream-200 bg-white px-3 py-1.5">
            <span className="text-ink-700/60">Écart :</span>
            <strong className={tonEcart}>{ecart > 0 ? "+" : ""}{ecart} h</strong>
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {competences.map((c, i) => (
          <div
            key={`${c.discipline}:${c.cycle}:${i}`}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-cream-100 bg-white px-3 py-2 text-sm"
          >
            <span className="font-medium text-forest-900">
              {c.discipline} · {CYCLE_LABEL[c.cycle] ?? c.cycle}
            </span>
            <span className="text-xs text-ink-700/70">
              {c.nbEnseignants} enseignant(s) — le plus chargé : <strong className="text-forest-800">{c.max} h</strong>
              {" · "}le moins chargé : <strong className="text-forest-800">{c.min} h</strong>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-ink-700/55">
        Comparaison entre enseignants d&apos;une même discipline et d&apos;un même cycle. À effectif
        d&apos;enseignants donné, le solveur répartit les heures au plus près des heures dues.
      </p>
    </div>
  );
}
