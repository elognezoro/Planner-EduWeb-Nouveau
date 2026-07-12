"use client";

import { useFormStatus } from "react-dom";
import { Check, X, Loader2 } from "lucide-react";
import { approuverDemande, refuserDemande } from "./actions";
import { RechercheEtablissement } from "@/components/app/recherche-etablissement";
import { SelectRecherche } from "@/components/app/select-recherche";

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
  rechercheEtablissement = false,
  options,
  suggestion = null,
}: {
  demandeId: string;
  /** Libellé du type de périmètre requis par le rôle (ex : « Établissement »), ou undefined. */
  libellePortee?: string;
  /** Vrai si le périmètre est un établissement (choix par recherche dans le répertoire complet). */
  rechercheEtablissement?: boolean;
  options: { id: string; nom: string }[];
  /** Établissement rapproché automatiquement du texte déclaré (pré-sélectionné, modifiable). */
  suggestion?: { id: string; nom: string; score: number } | null;
}) {
  const demandePerimetre = Boolean(libellePortee);
  const sansOption = demandePerimetre && !rechercheEtablissement && options.length === 0;

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
      <form action={approuverDemande} className="flex flex-wrap items-end justify-end gap-2">
        <input type="hidden" name="demandeId" value={demandeId} />
        {rechercheEtablissement && (
          <div className="w-72">
            <label className="mb-1 block text-[0.65rem] font-medium text-ink-700/60">
              Périmètre (Établissement)
            </label>
            <RechercheEtablissement
              name="perimetreId"
              requis
              defaut={suggestion ? { id: suggestion.id, nom: suggestion.nom } : null}
            />
            {suggestion && (
              <p className="mt-1 text-[0.65rem] text-forest-700">
                Rapproché automatiquement de la structure déclarée ({Math.round(suggestion.score * 100)} % de
                similarité) — modifiable.
              </p>
            )}
          </div>
        )}
        {demandePerimetre && !rechercheEtablissement && options.length > 0 && (
          <div className="w-60">
            <label className="mb-1 block text-[0.65rem] font-medium text-ink-700/60">
              Périmètre ({libellePortee})
            </label>
            <SelectRecherche name="perimetreId" options={options} requis placeholder={`Rechercher un(e) ${libellePortee?.toLowerCase()}…`} />
          </div>
        )}
        <Bouton ton="approuver" />
      </form>

      {sansOption && (
        <p className="max-w-[14rem] text-right text-[0.7rem] text-gold-700">
          Aucun {libellePortee?.toLowerCase()} enregistré — créez-en un avant d&apos;approuver pour
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
