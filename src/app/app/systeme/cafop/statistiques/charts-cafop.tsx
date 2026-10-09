"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useEcranMobile, useImpressionDepuisEcranMobile } from "@/lib/mobile/appareil";
import { ComparaisonBarres, SerieCompacte } from "@/components/app/mobile/graphiques-mobiles";

const axisStyle = { fontSize: 11, fill: "#2b3a33" };
const tooltipStyle = { borderRadius: 12, border: "1px solid #e9dcbe", fontSize: 13, boxShadow: "0 8px 24px rgba(15,53,39,0.08)" };

function Vide({ texte = "Aucune donnée disponible." }: { texte?: string }) {
  return <div className="flex h-[240px] items-center justify-center text-sm text-ink-700/50">{texte}</div>;
}

/** Aire — évolution d'un taux (%). */
export function ChartAire({ data, nomSerie = "Taux (%)" }: { data: { label: string; valeur: number }[]; nomSerie?: string }) {
  // Téléphone : une pastille chiffrée par mois (valeur lisible sans toucher la courbe).
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile && data.length > 0) return <SerieCompacte donnees={data.map((d) => ({ libelle: d.label, valeur: d.valeur }))} unite="%" />;
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="aireForest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34855c" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#34855c" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} %`, nomSerie]} />
        <Area isAnimationActive={impression ? false : undefined} type="monotone" dataKey="valeur" name={nomSerie} stroke="#246a48" strokeWidth={2} fill="url(#aireForest)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Barres groupées à deux séries. */
export function ChartBarGroupe({
  data,
}: {
  data: { label: string; scolaires: number; promotions: number }[];
}) {
  // Téléphone : ≈ 18 centres × 2 barres donnaient des barres de 3 px et des noms tournés
  // superposés → une ligne par centre (nom complet), deux jauges, « effectif / places » et taux
  // de remplissage. L'effectif passe en or (charte) au lieu du bleu de l'ordinateur.
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile && data.length > 0) {
    return (
      <ComparaisonBarres
        donnees={data.map((d) => ({ libelle: d.label, a: d.promotions, b: d.scolaires }))}
        serieA="Places (promotions)"
        serieB="Élèves-maîtres"
        couleurA="#57a47b"
        couleurB="#c9a227"
      />
    );
  }
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 56 : 30} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={impression ? false : undefined} dataKey="promotions" name="Places (promotions)" fill="#57a47b" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar isAnimationActive={impression ? false : undefined} dataKey="scolaires" name="Élèves-maîtres" fill="#2f6fb0" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
