"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const FOREST = ["#246a48", "#34855c", "#57a47b", "#8cc4a4", "#bbdec8"];
const MIXTE = ["#246a48", "#e3b536", "#57a47b", "#ad821f", "#8cc4a4", "#c9a227"];
const ASSIDUITE: Record<string, string> = {
  Présences: "#34855c",
  Absences: "#dc2626",
  Retards: "#e3b536",
  Excusés: "#8cc4a4",
};

const axisStyle = { fontSize: 12, fill: "#2b3a33" };
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e9dcbe",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(15,53,39,0.08)",
};

export function ChartEffectifsNiveau({ data }: { data: { niveau: string; eleves: number }[] }) {
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="niveau" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar dataKey="eleves" name="Élèves" fill="#246a48" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartRepartitionCycle({ data }: { data: { cycle: string; eleves: number }[] }) {
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="eleves"
          nameKey="cycle"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={MIXTE[i % MIXTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChartAssiduite({ data }: { data: { statut: string; valeur: number }[] }) {
  if (data.every((d) => d.valeur === 0)) return <Vide texte="Aucune donnée d'assiduité saisie." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valeur"
          nameKey="statut"
          cx="50%"
          cy="50%"
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={ASSIDUITE[d.statut] ?? FOREST[i % FOREST.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChartMoyennesDiscipline({
  data,
}: {
  data: { discipline: string; moyenne: number }[];
}) {
  if (data.length === 0) return <Vide texte="Aucune note saisie pour le moment." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 20]}
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: "#e9dcbe" }}
        />
        <YAxis
          type="category"
          dataKey="discipline"
          width={110}
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} formatter={(v) => [`${v}/20`, "Moyenne"]} />
        <Bar dataKey="moyenne" name="Moyenne /20" fill="#c9a227" radius={[0, 6, 6, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barre verticale générique : data {label, valeur}. */
export function ChartBarVertical({
  data,
  nomSerie = "Valeur",
  couleur = "#246a48",
  vide = "Aucune donnée disponible.",
}: {
  data: { label: string; valeur: number }[];
  nomSerie?: string;
  couleur?: string;
  vide?: string;
}) {
  if (data.length === 0) return <Vide texte={vide} />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar dataKey="valeur" name={nomSerie} fill={couleur} radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Vide({ texte = "Aucune donnée disponible." }: { texte?: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-ink-700/50">{texte}</div>
  );
}
