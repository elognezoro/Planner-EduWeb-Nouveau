"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compteur qui s'incrémente de 0 à la valeur (ease-out) au montage. */
function CompteurAnime({ valeur, suffixe }: { valeur: number; suffixe?: string }) {
  const [v, setV] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    let raf = 0;
    const debut = performance.now();
    const duree = 900;
    const depart = ref.current;
    const tick = (t: number) => {
      const p = Math.min(1, (t - debut) / duree);
      const val = Math.round(depart + (valeur - depart) * (1 - Math.pow(1 - p, 3)));
      setV(val);
      ref.current = val;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valeur]);
  return (
    <>
      {v.toLocaleString("fr-FR")}
      {suffixe}
    </>
  );
}

const tons = {
  forest: { fond: "bg-forest-50", texte: "text-forest-700", accent: "from-forest-500/10" },
  gold: { fond: "bg-gold-100", texte: "text-gold-700", accent: "from-gold-400/15" },
  cream: { fond: "bg-cream-200", texte: "text-forest-800", accent: "from-forest-400/10" },
  red: { fond: "bg-red-100", texte: "text-red-600", accent: "from-red-400/10" },
} as const;

export interface KpiCardProps {
  libelle: string;
  valeur: number;
  suffixe?: string;
  icone: React.ReactNode;
  ton?: keyof typeof tons;
  href?: string;
  sousTitre?: string;
  index?: number;
}

export function KpiCard({ libelle, valeur, suffixe, icone, ton = "forest", href, sousTitre, index = 0 }: KpiCardProps) {
  const t = tons[ton];
  const contenu = (
    <>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60", t.accent)} />
      <div className="relative flex items-start justify-between">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", t.fond, t.texte)}>{icone}</span>
        {href && (
          <ArrowUpRight size={16} className="text-ink-700/25 transition-colors group-hover:text-gold-600" />
        )}
      </div>
      <div className="relative mt-4">
        <p className="font-display text-3xl font-bold tracking-tight text-forest-900">
          <CompteurAnime valeur={valeur} suffixe={suffixe} />
        </p>
        <p className="mt-0.5 text-sm font-medium text-ink-700/70">{libelle}</p>
        {sousTitre && <p className="mt-0.5 text-xs text-ink-700/45">{sousTitre}</p>}
      </div>
    </>
  );

  const classeBase =
    "group relative overflow-hidden rounded-3xl border border-cream-200 bg-white p-5 shadow-soft";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.21, 0.5, 0.27, 1] }}
    >
      {href ? (
        <Link href={href} className={cn(classeBase, "block transition-all hover:-translate-y-1 hover:border-gold-300 hover:shadow-[var(--shadow-gold)]")}>
          {contenu}
        </Link>
      ) : (
        <div className={classeBase}>{contenu}</div>
      )}
    </motion.div>
  );
}
