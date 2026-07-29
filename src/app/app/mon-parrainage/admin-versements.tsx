"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { marquerVersee } from "./actions";

interface Ligne {
  id: string;
  parrain: string;
  filleul: string;
  montant: number;
  creeLe: string;
}

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Liste des commissions « acquise » à régler (admin) : référence + bouton « Versé ». */
export function AdminVersements({ commissions }: { commissions: Ligne[] }) {
  const [message, setMessage] = useState<string | null>(null);
  if (commissions.length === 0) {
    return <p className="text-sm text-ink-700/60">Aucune commission en attente de versement.</p>;
  }
  return (
    <div className="space-y-2">
      {message && <p className="rounded-lg bg-forest-50 px-3 py-2 text-sm text-forest-800">{message}</p>}
      <ul className="divide-y divide-cream-100">
        {commissions.map((c) => (
          <LigneVersement key={c.id} c={c} onFait={setMessage} />
        ))}
      </ul>
    </div>
  );
}

function LigneVersement({ c, onFait }: { c: Ligne; onFait: (m: string) => void }) {
  const [reference, setReference] = useState("");
  const [pending, start] = useTransition();
  const [fait, setFait] = useState(false);

  function verser() {
    start(async () => {
      const r = await marquerVersee(c.id, reference);
      if (r.ok) {
        setFait(true);
        onFait(r.message ?? "Versement enregistré.");
      } else {
        onFait(r.message ?? "Erreur.");
      }
    });
  }

  if (fait) return null; // la ligne disparaît de la file dès qu'elle est réglée

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0 text-sm">
        <p className="font-medium text-forest-900">{fcfa(c.montant)}</p>
        <p className="text-xs text-ink-700/60">
          Pour <strong>{c.parrain}</strong> · filleul {c.filleul} · {c.creeLe}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Réf. de transaction"
          className="h-9 w-40 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400"
        />
        <button
          type="button"
          onClick={verser}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-800 px-3.5 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-50"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Marquer versé
        </button>
      </div>
    </li>
  );
}
