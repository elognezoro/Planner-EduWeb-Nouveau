/** Aperçu de l'en-tête du bulletin (présentationnel, utilisable côté serveur et client). */
export function ApercuBulletin({
  ministere,
  regime,
  pays,
  slogan,
  annee,
}: {
  ministere: string;
  regime: string;
  pays: string;
  slogan: string;
  annee: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-5 py-4">
      <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-700/45">
        Aperçu en-tête du bulletin
      </p>
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-3">
        <p className="text-[0.7rem] font-semibold uppercase leading-tight text-forest-900">
          {ministere || "Ministère de tutelle…"}
        </p>
        <div className="text-center">
          <p className="font-display text-base font-bold tracking-wide text-forest-900">
            BULLETIN DE NOTES
          </p>
          <p className="text-xs text-ink-700/70">{regime}</p>
        </div>
        <div className="text-right text-[0.7rem] leading-tight text-ink-700/70">
          <p className="font-semibold text-forest-900">
            {pays ? `RÉPUBLIQUE DE ${pays.toUpperCase()}` : ""}
          </p>
          {slogan && <p className="italic">{slogan}</p>}
          {annee && <p>Année Scolaire {annee}</p>}
        </div>
      </div>
    </div>
  );
}
