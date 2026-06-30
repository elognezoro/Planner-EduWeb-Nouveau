"use client";

import { useFormStatus } from "react-dom";
import { Check, X, Loader2 } from "lucide-react";
import { approuverDemande, refuserDemande } from "./actions";

function Bouton({ ton }: { ton: "approuver" | "refuser" }) {
  const { pending } = useFormStatus();
  const approuver = ton === "approuver";
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all disabled:opacity-60 " +
        (approuver
          ? "bg-forest-700 text-cream-50 hover:bg-forest-600"
          : "border border-red-200 text-red-600 hover:bg-red-50")
      }
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : approuver ? (
        <Check size={14} />
      ) : (
        <X size={14} />
      )}
      {approuver ? "Approuver" : "Refuser"}
    </button>
  );
}

export function RowActions({
  demandeId,
  libellePortee,
  options,
}: {
  demandeId: string;
  /** Libellé du type de périmètre requis par le rôle (ex : « Établissement »), ou undefined. */
  libellePortee?: string;
  options: { id: string; nom: string }[];
}) {
  const demandePerimetre = Boolean(libellePortee);
  const sansOption = demandePerimetre && options.length === 0;

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
      <form action={approuverDemande} className="flex flex-wrap items-end justify-end gap-2">
        <input type="hidden" name="demandeId" value={demandeId} />
        {demandePerimetre && options.length > 0 && (
          <div>
            <label className="mb-1 block text-[0.65rem] font-medium text-ink-700/60">
              Périmètre ({libellePortee})
            </label>
            <select
              name="perimetreId"
              required
              defaultValue=""
              className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            >
              <option value="" disabled>
                Choisir…
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        <Bouton ton="approuver" />
      </form>

      {sansOption && (
        <p className="max-w-[14rem] text-right text-[0.7rem] text-gold-700">
          Aucun {libellePortee?.toLowerCase()} enregistré — créez-en un avant d'approuver pour
          rattacher le périmètre.
        </p>
      )}

      <form action={refuserDemande} className="flex justify-end">
        <input type="hidden" name="demandeId" value={demandeId} />
        <Bouton ton="refuser" />
      </form>
    </div>
  );
}
