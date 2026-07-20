"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag, Save } from "lucide-react";
import { enregistrerTermeApfc } from "@/lib/formation/actions";

/**
 * Réglage du nom local des APFC pour le pays consulté (menu, titres, boutons…). Miroir du
 * bloc « Nom local des centres » de la page Gestion des CAFOP
 * (src/app/app/systeme/cafop/gestion-cafop.tsx#L138-151), même mécanique côté APFC.
 */
export function ReglageTermeApfc({ pays, terme }: { pays: string; terme: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [termeSaisi, setTermeSaisi] = useState(terme);
  const [msg, setMsg] = useState<string | null>(null);

  function enregistrer() {
    setMsg(null);
    start(async () => {
      const r = await enregistrerTermeApfc(pays, termeSaisi);
      setMsg(r.message ?? null);
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-cream-200 bg-white px-4 py-3 shadow-soft">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
        <Tag size={17} />
      </span>
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-700/50">Nom local des antennes — {pays}</span>
        <input
          value={termeSaisi}
          onChange={(e) => setTermeSaisi(e.target.value)}
          placeholder="APFC"
          className="h-9 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </label>
      <button
        type="button"
        disabled={pending || !termeSaisi.trim()}
        onClick={enregistrer}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-4 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
      >
        <Save size={15} /> Enregistrer
      </button>
      {msg && <span className="text-xs text-ink-700/60">{msg}</span>}
    </div>
  );
}
