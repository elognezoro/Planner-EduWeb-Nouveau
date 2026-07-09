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

const axisStyle = { fontSize: 11, fill: "#2b3a33" };
const tooltipStyle = { borderRadius: 12, border: "1px solid #e9dcbe", fontSize: 13, boxShadow: "0 8px 24px rgba(15,53,39,0.08)" };

function Vide({ texte = "Aucune donnée disponible." }: { texte?: string }) {
  return <div className="flex h-[240px] items-center justify-center text-sm text-ink-700/50">{texte}</div>;
}

/** Aire — évolution d'un taux (%). */
export function ChartAire({ data, nomSerie = "Taux (%)" }: { data: { label: string; valeur: number }[]; nomSerie?: string }) {
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
        <Area type="monotone" dataKey="valeur" name={nomSerie} stroke="#246a48" strokeWidth={2} fill="url(#aireForest)" />
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
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 56 : 30} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="promotions" name="Places (promotions)" fill="#57a47b" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="scolaires" name="Élèves-maîtres" fill="#2f6fb0" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
