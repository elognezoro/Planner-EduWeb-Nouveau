"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { approuverDemandePromo, refuserDemandePromo, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

/**
 * Instruction d'une demande en attente : taux PRÉDÉFINI (code promo) OU taux PERSONNALISÉ
 * (champ d'incrément), puis approuver / refuser. Le demandeur est notifié avec le lien de
 * paiement au taux accordé.
 */
export function RowPromo({
  demandeId,
  codes,
  tauxDemande = null,
}: {
  demandeId: string;
  codes: { code: string; libelle: string; pourcentage: number }[];
  /** Taux souhaité par le demandeur (%) — pré-remplit le champ d'incrément. */
  tauxDemande?: number | null;
}) {
  const [etatA, approuver, pendingA] = useActionState(approuverDemandePromo, initial);
  const [etatR, refuser, pendingR] = useActionState(refuserDemandePromo, initial);
  const [code, setCode] = useState("");
  const [taux, setTaux] = useState(tauxDemande != null ? String(tauxDemande) : "");
  const message = etatA.message ?? etatR.message;
  const ok = etatA.message ? etatA.ok : etatR.ok;

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
      <form action={approuver} className="flex flex-wrap items-end justify-end gap-2">
        <input type="hidden" name="demandeId" value={demandeId} />
        <div>
          <label className="mb-1 block text-[0.65rem] font-medium text-ink-700/60">Taux prédéfini (code)</label>
          <select
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          >
            <option value="">Taux personnalisé →</option>
            {codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · −{c.pourcentage} % ({c.libelle})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[0.65rem] font-medium text-ink-700/60">Taux accordé (%)</label>
          <input
            name="taux"
            type="number"
            min={1}
            max={100}
            value={taux}
            disabled={Boolean(code)}
            onChange={(e) => setTaux(e.target.value)}
            placeholder="Ex. 15"
            className="h-9 w-24 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={pendingA || pendingR || (!code && !taux)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-600 disabled:opacity-60"
        >
          {pendingA ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approuver
        </button>
      </form>
      <form action={refuser} className="flex justify-end">
        <input type="hidden" name="demandeId" value={demandeId} />
        <button
          type="submit"
          disabled={pendingA || pendingR}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {pendingR ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Refuser
        </button>
      </form>
      {message && (
        <p className={`text-right text-xs font-medium ${ok ? "text-forest-700" : "text-red-600"}`}>{message}</p>
      )}
    </div>
  );
}
