"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useEcranMobile, useImpressionDepuisEcranMobile } from "@/lib/mobile/appareil";
import { ClassementBarres } from "@/components/app/mobile/graphiques-mobiles";

/**
 * Graphique des statistiques générales de la supervision APFC : barres HORIZONTALES
 * (une par antenne, top 10) — sobre, verts forest, lisible à l'impression (couleurs
 * pleines, quadrillage discret, pas de légende superflue : une seule série nommée).
 */

const axisStyle = { fontSize: 11, fill: "#2b3a33" };
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e9dcbe",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(15,53,39,0.08)",
};

/** Tronque les noms d'antennes trop longs sur l'axe (le nom complet reste au survol). */
function courtNom(nom: string): string {
  return nom.length > 26 ? `${nom.slice(0, 25)}…` : nom;
}

export function ChartTopAntennes({
  data,
  nomSerie,
}: {
  data: { nom: string; valeur: number }[];
  nomSerie: string;
}) {
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (data.length === 0) return null;
  // Téléphone : l'axe des noms (172 px) ne laissait qu'environ 50 px aux barres. Classement
  // lisible (noms complets, valeurs affichées) ; l'ordinateur et le papier gardent le Recharts.
  // « Établissements couverts » → « établissements » : le titre du bloc précise déjà la série.
  if (mobile) {
    return (
      <ClassementBarres
        donnees={data.map((d) => ({ libelle: d.nom, valeur: d.valeur, couleur: "#34855c" }))}
        unite={nomSerie.split(" ")[0].toLowerCase()}
        limite={10}
      />
    );
  }
  // Hauteur proportionnelle au nombre de barres : compacte mais jamais écrasée.
  const hauteur = Math.max(150, data.length * 32 + 36);
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" horizontal={false} />
        <XAxis
          type="number"
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: "#e9dcbe" }}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="nom"
          width={172}
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          tickFormatter={courtNom}
          interval={0}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar isAnimationActive={impression ? false : undefined} dataKey="valeur" name={nomSerie} fill="#34855c" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
