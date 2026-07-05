/**
 * Volumes horaires hebdomadaires affichés en bonne vue sous un emploi du temps de classe :
 * le volume total par discipline et le volume total de cours de la semaine.
 * Les durées réelles des périodes (minutes) proviennent des horaires de l'établissement ;
 * à défaut, repli sur 55 minutes par période (modèle national).
 */

export interface CreneauVolume {
  disciplineNom: string;
  periode: number;
  duree: number;
}

/** « 4h35 » à partir de minutes. */
function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const r = Math.round(min % 60);
  return `${h}h${String(r).padStart(2, "0")}`;
}

/** Minutes réelles d'un créneau (somme de ses périodes ; repli 55 min / période). */
function minutesDuCreneau(c: CreneauVolume, minutes: number[] | null): number {
  if (!minutes) return c.duree * 55;
  let total = 0;
  for (let d = 0; d < c.duree; d++) total += minutes[c.periode + d] ?? 55;
  return total;
}

export function VolumesHebdo({
  creneaux,
  minutes,
}: {
  creneaux: CreneauVolume[];
  minutes: number[] | null;
}) {
  if (creneaux.length === 0) return null;
  const parDiscipline = new Map<string, number>();
  for (const c of creneaux) {
    parDiscipline.set(
      c.disciplineNom,
      (parDiscipline.get(c.disciplineNom) ?? 0) + minutesDuCreneau(c, minutes),
    );
  }
  const lignes = [...parDiscipline.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"),
  );
  const total = lignes.reduce((acc, [, m]) => acc + m, 0);

  return (
    <div className="edt-volumes mt-5 border-t border-cream-100 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-forest-900">
          Volumes horaires hebdomadaires
        </h3>
        <p className="text-sm text-ink-700/70">
          Total de cours :{" "}
          <span className="font-display text-lg font-bold text-forest-900">{fmtMinutes(total)}</span>
          <span className="text-ink-700/55"> / semaine</span>
        </p>
      </div>
      <ul className="mt-2.5 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {lignes.map(([nom, m]) => (
          <li key={nom} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-ink-800">{nom}</span>
            <span className="shrink-0 font-semibold text-forest-800">{fmtMinutes(m)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
