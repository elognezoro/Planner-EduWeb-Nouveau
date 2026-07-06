const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export interface DemiJournee {
  jour: number;
  moment: 0 | 1; // 0 = matin, 1 = après-midi
}

const fmt = (liste: DemiJournee[]) =>
  liste.length
    ? liste.map((d) => `${JOURS[d.jour] ?? "?"} ${d.moment === 0 ? "matin" : "après-midi"}`).join(", ")
    : "—";

function LigneDemi({ label, liste }: { label: string; liste: DemiJournee[] }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span className="font-medium text-forest-900">{label} :</span>
      <span className="text-ink-700/75">{fmt(liste)}</span>
    </div>
  );
}

/**
 * Point des demi-journées où AUCUNE classe du périmètre n'a cours, à trois échelles : le niveau
 * de la classe, son cycle, et l'établissement entier. Affiché sous l'EDT « par classe » (élève).
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
  return (
    <div className="edt-volumes mt-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4 text-sm print:mt-3">
      <p className="mb-2 font-display text-base font-bold text-forest-900">Demi-journées sans cours pour tous</p>
      <div className="space-y-1">
        <LigneDemi label={`Tout le niveau ${niveauNom}`} liste={parNiveau} />
        <LigneDemi label={`Tout le cycle (${cycleLabel})`} liste={parCycle} />
        <LigneDemi label="Tout l'établissement" liste={parEtablissement} />
      </div>
      <p className="mt-2 text-xs text-ink-700/55">
        Demi-journées où aucune classe du périmètre concerné n&apos;a cours (utile pour planifier
        activités, réunions ou sorties communes).
      </p>
    </div>
  );
}

/**
 * Point des demi-journées où AUCUN enseignant du périmètre n'a cours, à trois échelles : sa/ses
 * spécialité(s) (discipline × cycle), son/ses cycle(s), et tout l'établissement. Affiché sous
 * l'EDT « par enseignant ».
 */
export function DemiJourneesLibresEnseignant({
  specialites,
  cycles,
  etablissement,
}: {
  specialites: { label: string; liste: DemiJournee[] }[];
  cycles: { label: string; liste: DemiJournee[] }[];
  etablissement: DemiJournee[];
}) {
  return (
    <div className="edt-volumes mt-4 rounded-2xl border border-cream-200 bg-cream-50/50 p-4 text-sm print:mt-3">
      <p className="mb-2 font-display text-base font-bold text-forest-900">Demi-journées sans cours pour tous</p>
      <div className="space-y-1">
        {specialites.map((s, i) => (
          <LigneDemi key={`sp-${i}`} label={s.label} liste={s.liste} />
        ))}
        {cycles.map((c, i) => (
          <LigneDemi key={`cy-${i}`} label={c.label} liste={c.liste} />
        ))}
        <LigneDemi label="Tout l'établissement" liste={etablissement} />
      </div>
      <p className="mt-2 text-xs text-ink-700/55">
        Demi-journées où aucun enseignant du périmètre concerné n&apos;a cours (coordination de
        spécialité, conseil de cycle, réunion générale).
      </p>
    </div>
  );
}
