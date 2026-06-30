"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Check, X } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { genererCode, traiterDemandePromo, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };
const inputCls =
  "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface DemandeVue {
  id: string;
  demandeurNom: string;
  etablissementNom: string | null;
  motif: string;
  date: string;
}

export function GenererCodeForm() {
  const [etat, action] = useActionState(genererCode, initial);
  return (
    <form action={action} className="space-y-3">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Code</label>
          <input name="code" required placeholder="EX : RENTREE2026" className={`${inputCls} uppercase`} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Remise (%)</label>
          <input name="pourcentage" type="number" min={0} max={100} required placeholder="20" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Libellé</label>
          <input name="libelle" required placeholder="Description du code" className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-forest-900">
        <input type="checkbox" name="partenaire" className="h-4 w-4 rounded border-cream-300" /> Taux préférentiel partenaire
      </label>
      <SubmitButton className="w-auto px-6">
        <Plus size={15} /> Générer le code
      </SubmitButton>
    </form>
  );
}

export function DemandesPromo({ demandes }: { demandes: DemandeVue[] }) {
  if (demandes.length === 0) {
    return <p className="text-sm text-ink-700/55">Aucune demande de code promo en attente.</p>;
  }
  return (
    <ul className="space-y-3">
      {demandes.map((d) => (
        <LigneDemande key={d.id} demande={d} />
      ))}
    </ul>
  );
}

function LigneDemande({ demande }: { demande: DemandeVue }) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <li className="rounded-xl border border-cream-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-forest-900">{demande.demandeurNom}</p>
          <p className="text-xs text-ink-700/60">
            {demande.etablissementNom ? `${demande.etablissementNom} · ` : ""}
            {demande.motif}
          </p>
        </div>
        <span className="text-[0.65rem] text-ink-700/45">{demande.date}</span>
      </div>
      {msg && <p className="mt-2 text-xs text-ink-700/70">{msg}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code à attribuer (option.)"
          className="h-8 w-44 rounded-lg border border-cream-300 bg-white px-2.5 text-xs uppercase outline-none focus:border-forest-400"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await traiterDemandePromo(demande.id, true, code || undefined);
              setMsg(r.message ?? null);
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-full bg-forest-700 px-3 text-xs font-semibold text-cream-50 hover:bg-forest-800 disabled:opacity-50"
        >
          <Check size={13} /> Approuver
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await traiterDemandePromo(demande.id, false);
              setMsg(r.message ?? null);
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-full border border-cream-300 px-3 text-xs font-semibold text-ink-700/70 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <X size={13} /> Refuser
        </button>
      </div>
    </li>
  );
}
