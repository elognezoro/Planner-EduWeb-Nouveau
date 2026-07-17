"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Activity, LogIn, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

interface StatsTrafic {
  totalVisites: number;
  totalConnexions: number;
  actifs: number;
  serie: { heure: string; visites: number; connexions: number }[];
}

const INTERVALLE_MS = 15_000; // actualisation « temps réel »

/**
 * Compteur de visites + diagramme temps réel des connexions et visites (24 h),
 * affiché dans le hero de la page d'accueil. Les données proviennent de /api/visites
 * et sont réactualisées toutes les 15 secondes.
 */
export function TraficLive() {
  const [stats, setStats] = useState<StatsTrafic | null>(null);

  useEffect(() => {
    let actif = true;
    const charger = () =>
      fetch("/api/visites", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (actif && d && Array.isArray(d.serie)) setStats(d as StatsTrafic);
        })
        .catch(() => undefined);
    charger();
    const minuterie = setInterval(charger, INTERVALLE_MS);
    return () => {
      actif = false;
      clearInterval(minuterie);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.55, ease: [0.21, 0.5, 0.27, 1] }}
      className="mb-4 rounded-3xl border border-cream-50/15 bg-forest-900/50 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-gold-200/80">
          <Activity size={12} /> Trafic en temps réel
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-300/30 bg-forest-950/50 px-2.5 py-1 text-[0.65rem] font-semibold text-forest-200">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-300 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-forest-300" />
          </span>
          {stats ? stats.actifs : "…"} en ligne
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 font-display text-2xl font-bold text-gold-300">
            <Users size={17} className="shrink-0 opacity-80" />
            <span className="truncate">{stats ? stats.totalVisites.toLocaleString("fr-FR") : "—"}</span>
          </p>
          <p className="mt-0.5 text-[0.62rem] text-cream-200/60">visites de la plateforme</p>
        </div>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 font-display text-2xl font-bold text-cream-50">
            <LogIn size={17} className="shrink-0 opacity-80" />
            <span className="truncate">{stats ? stats.totalConnexions.toLocaleString("fr-FR") : "—"}</span>
          </p>
          <p className="mt-0.5 text-[0.62rem] text-cream-200/60">connexions d&apos;utilisateurs</p>
        </div>
      </div>

      {/* Diagramme : visites & connexions des 24 dernières heures */}
      <div className="mt-2 h-[76px]">
        {stats && stats.serie.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.serie} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="degradeVisites" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8c468" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#e8c468" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="degradeConnexions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7fb8a4" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#7fb8a4" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="heure"
                interval={5}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "rgba(245,240,225,0.45)", fontSize: 9 }}
              />
              <Tooltip
                cursor={{ stroke: "rgba(245,240,225,0.25)" }}
                contentStyle={{
                  background: "#0c2a1f",
                  border: "1px solid rgba(245,240,225,0.15)",
                  borderRadius: 12,
                  fontSize: 11,
                  color: "#f5f0e1",
                }}
                labelStyle={{ color: "rgba(245,240,225,0.6)" }}
                formatter={(valeur, nom) => [valeur ?? 0, nom === "visites" ? "Visites" : "Connexions"]}
              />
              <Area
                type="monotone"
                dataKey="visites"
                stroke="#e8c468"
                strokeWidth={1.5}
                fill="url(#degradeVisites)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="connexions"
                stroke="#7fb8a4"
                strokeWidth={1.5}
                fill="url(#degradeConnexions)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[0.65rem] text-cream-200/40">
            Chargement du trafic…
          </div>
        )}
      </div>
      <p className="mt-1 text-right text-[0.58rem] text-cream-200/40">
        Dernières 24 h · <span className="text-gold-200/70">visites</span> ·{" "}
        <span className="text-forest-200/80">connexions</span>
      </p>
    </motion.div>
  );
}
