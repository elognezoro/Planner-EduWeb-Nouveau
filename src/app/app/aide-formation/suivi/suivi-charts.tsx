"use client";

import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  AreaChart, Area,
} from "recharts";

const axisStyle = { fontSize: 12, fill: "#2b3a33" } as const;
const tooltipStyle = { borderRadius: 12, border: "1px solid #e9dcbe", fontSize: 13, boxShadow: "0 8px 24px rgba(15,53,39,0.08)" } as const;
const MIXTE = ["#246a48", "#e3b536", "#57a47b", "#ad821f", "#8cc4a4", "#c9a227"];

function Vide({ message = "Aucune donnée pour l'instant." }: { message?: string }) {
  return <div className="flex h-[240px] items-center justify-center rounded-xl bg-cream-50 text-sm text-ink-700/55">{message}</div>;
}

/** Inscriptions par catégorie de formation. */
export function ChartInscriptionsCategorie({ data }: { data: { categorie: string; inscriptions: number }[] }) {
  if (data.length === 0) return <Vide message="Aucune inscription à un cours." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="categorie" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} formatter={(v) => [`${v}`, "Inscriptions"]} />
        <Bar dataKey="inscriptions" name="Inscriptions" radius={[6, 6, 0, 0]} maxBarSize={54}>
          {data.map((_, i) => <Cell key={i} fill={MIXTE[i % MIXTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Flux d'inscriptions dans le temps (courbe d'adoption). */
export function ChartInscriptionsTemps({ data }: { data: { label: string; inscriptions: number }[] }) {
  if (data.every((d) => d.inscriptions === 0)) return <Vide message="Pas encore d'inscription enregistrée." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="aireSuivi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34855c" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#34855c" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval="preserveStartEnd" />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} formatter={(v) => [`${v}`, "Inscriptions"]} />
        <Area type="monotone" dataKey="inscriptions" stroke="#246a48" strokeWidth={2} fill="url(#aireSuivi)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Répartition des inscriptions par tranche d'avancement (une inscription = un cours suivi). */
export function ChartAvancement({ data }: { data: { tranche: string; inscriptions: number }[] }) {
  if (data.every((d) => d.inscriptions === 0)) return <Vide message="Pas encore d'avancement à afficher." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="tranche" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} formatter={(v) => [`${v}`, "Inscriptions"]} />
        <Bar dataKey="inscriptions" name="Inscriptions" fill="#246a48" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
