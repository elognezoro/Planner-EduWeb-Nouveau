"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { BilanHeures } from "@/lib/absences/heures";

/**
 * Bilan des heures d'absence — DOUBLE comptabilité : heures réglementaires (barres empilées
 * par statut) ET demi-journées (courbe, axe de droite), avec totaux mois en cours / période
 * en cours (trimestre ou semestre selon le régime) / année scolaire.
 */

const axisStyle = { fontSize: 11, fill: "#2b3a33" };
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e9dcbe",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(15,53,39,0.08)",
};

const fmtHeures = (h: number) =>
  `${h.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
const fmtDemi = (n: number) => `${n.toLocaleString("fr-FR")} demi-journée${n > 1 ? "s" : ""}`;

function CarteTotal({ titre, heures, demiJournees, accent }: {
  titre: string; heures: number; demiJournees: number; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent ? "border-forest-200 bg-forest-50/60" : "border-cream-200 bg-white"}`}>
      <span className="block text-xs text-ink-700/60">{titre}</span>
      <span className="mt-0.5 block font-display text-xl font-bold text-forest-900">{fmtHeures(heures)}</span>
      <span className="block text-xs text-ink-700/60">{fmtDemi(demiJournees)}</span>
    </div>
  );
}

export function BilanHeuresAbsences({ bilan }: { bilan: BilanHeures }) {
  const vide = bilan.annuel.demiJournees === 0;
  const periodeEnCours = bilan.periodes.find((p) => p.enCours) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">
          Heures &amp; demi-journées d&apos;absence — année {bilan.anneeLibelle}
        </p>
        <span className="text-xs text-ink-700/50">Régime : {bilan.regimeLibelle}</span>
      </div>

      {/* Totaux : mois en cours, période en cours (selon le régime), année scolaire. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {bilan.moisEnCours && (
          <CarteTotal titre={`Mois en cours (${bilan.moisEnCours.libelle})`} heures={bilan.moisEnCours.heures} demiJournees={bilan.moisEnCours.demiJournees} />
        )}
        {periodeEnCours && (
          <CarteTotal titre={`${bilan.libellePeriode} en cours`} heures={periodeEnCours.heures} demiJournees={periodeEnCours.demiJournees} />
        )}
        <CarteTotal titre="Total annuel" heures={bilan.annuel.heures} demiJournees={bilan.annuel.demiJournees} accent />
      </div>

      {vide ? (
        <p className="text-sm text-ink-700/60">Aucune absence comptabilisée sur l&apos;année scolaire.</p>
      ) : (
        <>
          {/* Diagramme mensuel : heures par statut (barres empilées) + demi-journées (courbe).
              Défilement horizontal sur petit écran (12 libellés de mois affichés en entier). */}
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={bilan.parMois} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
                  <XAxis dataKey="libelle" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} angle={-38} textAnchor="end" height={44} />
                  <YAxis yAxisId="h" tick={axisStyle} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="dj" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "#f0f8f3" }}
                    formatter={(v, name) => [name === "Demi-journées" ? fmtDemi(Number(v ?? 0)) : fmtHeures(Number(v ?? 0)), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="h" dataKey="heuresAutorisees" name="Heures autorisées" stackId="h" fill="#34855c" maxBarSize={26} />
                  <Bar yAxisId="h" dataKey="heuresJustifiees" name="Heures justifiées" stackId="h" fill="#d4a72c" maxBarSize={26} />
                  <Bar yAxisId="h" dataKey="heuresNonAutorisees" name="Heures non autorisées" stackId="h" fill="#dc2626" maxBarSize={26} />
                  <Line yAxisId="dj" type="monotone" dataKey="demiJournees" name="Demi-journées" stroke="#0f3527" strokeWidth={2} dot={{ r: 2.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Totaux par période de notation (trimestres ou semestres) + année. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-cream-200 text-left text-xs uppercase tracking-wide text-ink-700/50">
                  <th className="py-1.5 pr-2">Période</th>
                  <th className="py-1.5 pr-2 text-right">Demi-journées</th>
                  <th className="py-1.5 text-right">Heures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {bilan.periodes.map((p) => (
                  <tr key={p.libelle} className={p.enCours ? "bg-forest-50/50" : undefined}>
                    <td className="py-1.5 pr-2 font-medium text-forest-900">
                      {p.libelle}
                      {p.enCours && <span className="ml-2 rounded-full bg-forest-100 px-2 py-0.5 text-[0.65rem] font-semibold text-forest-800">en cours</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{p.demiJournees.toLocaleString("fr-FR")}</td>
                    <td className="py-1.5 text-right font-medium">{fmtHeures(p.heures)}</td>
                  </tr>
                ))}
                <tr className="border-t border-cream-200">
                  <td className="py-1.5 pr-2 font-semibold text-forest-900">Année scolaire</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">{bilan.annuel.demiJournees.toLocaleString("fr-FR")}</td>
                  <td className="py-1.5 text-right font-semibold text-forest-900">{fmtHeures(bilan.annuel.heures)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs leading-relaxed text-ink-700/55">
        {bilan.heuresDuesParJour !== null && (
          <>Vos heures réglementaires dues (rôle actuel) : <strong className="text-ink-700/80">{fmtHeures(bilan.heuresDuesParJour)} par jour ouvrable</strong>.{" "}</>
        )}
        Convention : journée = 2 demi-journées ; matinée ou après-midi = 1. Heures = demi-journées × la moitié des
        heures réglementaires dues par jour, selon la nature de l&apos;absence (absence d&apos;enseignant : volume
        horaire hebdomadaire dû de son cycle — paramétré dans la configuration de l&apos;établissement, à défaut
        21 h au 1er cycle et 18 h au 2nd — ÷ 6 jours ouvrables ; absence de personnel non enseignant : 40 h ÷ 6).
      </p>
    </div>
  );
}
