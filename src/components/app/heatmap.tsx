import type { Heatmap } from "@/lib/reseau-catholique/agregats";

/** Couleur d'un TAUX de présence (%) : rouge (faible) → vert (élevé). */
function couleurTaux(pct: number): string {
  if (pct >= 95) return "bg-forest-600 text-cream-50";
  if (pct >= 85) return "bg-forest-400 text-forest-950";
  if (pct >= 70) return "bg-gold-300 text-forest-950";
  if (pct >= 50) return "bg-gold-400 text-forest-950";
  return "bg-red-400 text-cream-50";
}

/** Couleur d'un COMPTE d'absences relatif au max : clair (peu) → rouge foncé (beaucoup). */
function couleurCompte(v: number, max: number): string {
  if (v <= 0) return "bg-cream-100 text-ink-700/30";
  const r = v / Math.max(1, max);
  if (r >= 0.8) return "bg-red-600 text-cream-50";
  if (r >= 0.55) return "bg-red-500 text-cream-50";
  if (r >= 0.3) return "bg-red-400 text-cream-50";
  return "bg-red-200 text-red-900";
}

/**
 * Rendu générique d'une heatmap (jours/enseignants en lignes × créneaux/mois en colonnes).
 * mode « taux » : cellules 0-100 % (échelle verte) ; mode « compte » : effectifs (échelle rouge).
 */
export function HeatmapTable({
  data,
  mode,
  libelleColonne = "",
  cellSuffixe = "",
}: {
  data: Heatmap;
  mode: "taux" | "compte";
  libelleColonne?: string;
  cellSuffixe?: string;
}) {
  // Téléphone : la 1re colonne (noms, jours) reste COLLÉE à gauche pendant le défilement latéral
  // — on sait toujours quelle ligne on lit ; les noms passent à la ligne au lieu d'être tronqués,
  // les cellules sont un peu plus étroites (plus de mois visibles à la fois). Ordinateur et
  // impression : inchangés (classes « mobile: »).
  const premiereColonneMobile =
    "mobile:sticky mobile:left-0 mobile:z-10 mobile:bg-white mobile:shadow-[6px_0_6px_-6px_rgba(15,53,39,0.25)]";
  return (
    <div className="overflow-x-auto mobile:overscroll-x-contain">
      <table className="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className={`pr-2 text-left text-[0.65rem] font-medium uppercase tracking-wide text-ink-700/50 mobile:text-xs mobile:normal-case mobile:tracking-normal ${premiereColonneMobile}`}>{libelleColonne}</th>
            {data.slots.map((s) => (
              <th key={s} className="px-1 pb-1 text-center font-medium text-ink-700/60 mobile:leading-tight">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rangees.map((r) => (
            <tr key={r.libelle}>
              <td className={`max-w-[10rem] truncate pr-2 text-right font-medium text-ink-700/70 mobile:min-w-[5.5rem] mobile:max-w-[6.5rem] mobile:whitespace-normal mobile:text-left mobile:leading-tight mobile:[overflow-wrap:anywhere] ${premiereColonneMobile}`} title={r.libelle}>{r.libelle}</td>
              {r.cellules.map((c, i) => (
                <td key={i}>
                  <div
                    className={`flex h-9 w-12 items-center justify-center rounded-lg font-semibold mobile:h-8${mode === "compte" ? " mobile:w-10" : ""} ${
                      c === null
                        ? "bg-cream-100 text-ink-700/30"
                        : mode === "taux"
                          ? couleurTaux(c)
                          : couleurCompte(c, data.max)
                    }`}
                    title={c === null ? "Aucune donnée" : `${c}${cellSuffixe}`}
                  >
                    {c === null ? "—" : `${c}${cellSuffixe}`}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
