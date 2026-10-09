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
import { useEcranMobile, useImpressionDepuisEcranMobile } from "@/lib/mobile/appareil";
import { ClassementBarres, RepartitionAnneau } from "@/components/app/mobile/graphiques-mobiles";

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
  // Téléphone : 13 niveaux au plus → une ligne par niveau, dans l'ordre pédagogique, effectif
  // affiché (Recharts y sautait des graduations : barres sans nom de niveau).
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile) {
    return (
      <ClassementBarres
        donnees={data.map((d) => ({ libelle: d.niveau, valeur: d.eleves }))}
        unite="élèves"
        trier={false}
        limite={13}
        vide="Aucune donnée disponible."
      />
    );
  }
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="niveau" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar isAnimationActive={impression ? false : undefined} dataKey="eleves" name="Élèves" fill="#246a48" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartRepartitionCycle({ data }: { data: { cycle: string; eleves: number }[] }) {
  // Téléphone : anneau + total + légende chiffrée (valeur et %), mêmes couleurs que l'ordinateur.
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile) {
    return (
      <RepartitionAnneau
        donnees={data.map((d, i) => ({ libelle: d.cycle, valeur: d.eleves, couleur: MIXTE[i % MIXTE.length] }))}
        libelleTotal="élèves"
        vide="Aucune donnée disponible."
      />
    );
  }
  if (data.length === 0) return <Vide />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie isAnimationActive={impression ? false : undefined}
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
  // Téléphone : le taux de présence (la donnée utile) n'apparaissait qu'au toucher. Anneau +
  // lignes « statut, nombre, % », ordre et code couleur sémantique conservés (Absences en rouge).
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile) {
    return (
      <RepartitionAnneau
        donnees={data.map((d, i) => ({ libelle: d.statut, valeur: d.valeur, couleur: ASSIDUITE[d.statut] ?? FOREST[i % FOREST.length] }))}
        libelleTotal="relevés"
        trier={false}
        vide="Aucune donnée d'assiduité saisie."
      />
    );
  }
  if (data.every((d) => d.valeur === 0)) return <Vide texte="Aucune donnée d'assiduité saisie." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie isAnimationActive={impression ? false : undefined}
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
  // Téléphone : nom COMPLET de la discipline au-dessus de la barre (l'axe de 110 px le repliait
  // sur 3 lignes), moyenne affichée, échelle /20 ; en rouge sous la moyenne.
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile) {
    return (
      <ClassementBarres
        donnees={data.map((d) => ({ libelle: d.discipline, valeur: d.moyenne, couleur: d.moyenne < 10 ? "#dc2626" : "#c9a227" }))}
        unite="/20"
        max={20}
        decimales={1}
        vide="Aucune note saisie pour le moment."
      />
    );
  }
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
        <Bar isAnimationActive={impression ? false : undefined} dataKey="moyenne" name="Moyenne /20" fill="#c9a227" radius={[0, 6, 6, 0]} maxBarSize={26} />
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
  unite,
  max,
  ordonne = false,
  decimales = 0,
  limite = 8,
}: {
  /** `libelleComplet`, `detail` et `couleur` ne servent qu'à la présentation TÉLÉPHONE
   *  (l'ordinateur garde `label` sur l'axe et une couleur unique). */
  data: { label: string; valeur: number; libelleComplet?: string; detail?: string; couleur?: string }[];
  nomSerie?: string;
  couleur?: string;
  vide?: string;
  /** Téléphone : suffixe de la valeur (« élèves », « % », « /20 »). */
  unite?: string;
  /** Téléphone : pleine échelle (100 pour un %, 20 pour une note) ; sinon le maximum. */
  max?: number;
  /** Téléphone : garder l'ordre fourni (niveaux, tranches, promotions) au lieu de trier. */
  ordonne?: boolean;
  decimales?: number;
  /** Téléphone : nombre de lignes avant « Voir les N éléments ». */
  limite?: number;
}) {
  // Téléphone : les histogrammes à 10-30 catégories devenaient illisibles (noms tournés qui se
  // chevauchent, barres de 5 px, valeurs au toucher seulement) → classement horizontal, libellé
  // COMPLET au-dessus de chaque barre, valeur affichée. Ordinateur et impression : inchangés.
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : graphique sans animation (sinon vide sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  if (mobile) {
    return (
      <ClassementBarres
        donnees={data.map((d) => ({
          libelle: d.libelleComplet ?? d.label,
          valeur: d.valeur,
          detail: d.detail,
          couleur: d.couleur ?? couleur,
        }))}
        unite={unite}
        max={max && max > 0 ? max : undefined}
        trier={!ordonne}
        decimales={decimales}
        limite={limite}
        vide={vide}
      />
    );
  }
  if (data.length === 0) return <Vide texte={vide} />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar isAnimationActive={impression ? false : undefined} dataKey="valeur" name={nomSerie} fill={couleur} radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Vide({ texte = "Aucune donnée disponible." }: { texte?: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-ink-700/50">{texte}</div>
  );
}
