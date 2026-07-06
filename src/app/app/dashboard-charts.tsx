"use client";

import { motion } from "motion/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COULEURS = ["#246a48", "#c9a227", "#57a47b", "#e3b536", "#8cc4a4", "#ad821f", "#34855c", "#f4df8d"];
const tooltipStyle = { borderRadius: 12, border: "1px solid #e9dcbe", fontSize: 13, boxShadow: "0 8px 24px rgba(15,53,39,0.08)" };
const axisStyle = { fontSize: 12, fill: "#2b3a33" };

export function DonutRoles({ data }: { data: { role: string; total: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-sm text-ink-700/50">Aucune donnée.</div>;
  }
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
      {/* Diagramme seul : sans la légende Recharts (qui rognait le haut du cercle). */}
      <ResponsiveContainer width="100%" height={208}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="role" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {/* Légende personnalisée, nettement séparée sous le diagramme (aucun rognage). */}
      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {data.map((d, i) => (
          <span key={d.role} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COULEURS[i % COULEURS.length] }} />
            <span className="text-ink-700/80">{d.role}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export function BarEtablissements({ data }: { data: { label: string; valeur: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-sm text-ink-700/50">Aucun effectif inscrit.</div>;
  }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 50 : 30} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
          <Bar dataKey="valeur" name="Élèves" fill="#246a48" radius={[6, 6, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
