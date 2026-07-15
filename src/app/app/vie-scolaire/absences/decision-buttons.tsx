"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { deciderDemande, type EtatForm } from "./actions";
import { FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

function Boutons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit" name="decision" value="approuver" disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approuver
      </button>
      <button
        type="submit" name="decision" value="refuser" disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        <X size={14} /> Refuser
      </button>
    </div>
  );
}

export function DecisionButtons({ demandeId }: { demandeId: string }) {
  const [etat, action] = useActionState(deciderDemande, initial);
  const [ouvertMotif, setOuvertMotif] = useState(false);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="demandeId" value={demandeId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      {ouvertMotif ? (
        <textarea
          name="motifDecision" rows={2} maxLength={400} placeholder="Observation (facultatif)…"
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      ) : (
        <button type="button" onClick={() => setOuvertMotif(true)} className="text-xs font-medium text-forest-700 hover:underline">
          + Ajouter une observation
        </button>
      )}
      <Boutons />
    </form>
  );
}
