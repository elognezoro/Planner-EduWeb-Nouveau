const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export interface DemiJournee {
  jour: number;
  moment: 0 | 1; // 0 = matin, 1 = après-midi
}

/**
 * Point des demi-journées où AUCUNE classe du périmètre n'a cours, à trois échelles : le niveau
 * de la classe, son cycle, et l'établissement entier. Affiché sous l'EDT « par classe » (élève),
 * en complément des volumes horaires.
 */
export function DemiJourneesLibres({
  niveauNom,
  cycleLabel,
  parNiveau,
  parCycle,
  parEtablissement,
}: {
  niveauNom: string;
  cycleLabel: string;
  parNiveau: DemiJournee[];
  parCycle: DemiJournee[];
  parEtablissement: DemiJournee[];
}) {
  const fmt = (liste: DemiJournee[]) =>
    liste.length
      ? liste.map((d) => `${JOURS[d.jour] ?? "?"} ${d.moment === 0 ? "matin" : "après-midi"}`).join(", ")
      : "—";

  const Ligne = ({ label, liste }: { label: string; liste: DemiJournee[] }) => (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span className="font-medium text-forest-900">{label} :</span>
      <span className="text-ink-700/75">{fmt(liste)}</span>
    </div>
  );

  return (
    <div className="edt-volumes mt-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4 text-sm print:mt-3">
      <p className="mb-2 font-display text-base font-bold text-forest-900">Demi-journées sans cours pour tous</p>
      <div className="space-y-1">
        <Ligne label={`Tout le niveau ${niveauNom}`} liste={parNiveau} />
        <Ligne label={`Tout le cycle (${cycleLabel})`} liste={parCycle} />
        <Ligne label="Tout l'établissement" liste={parEtablissement} />
      </div>
      <p className="mt-2 text-xs text-ink-700/55">
        Demi-journées où aucune classe du périmètre concerné n&apos;a cours (utile pour planifier
        activités, réunions ou sorties communes).
      </p>
    </div>
  );
}
