"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Champ en lecture seule + bouton « Copier » pour le lien d'invitation. */
export function CopierLien({ lien }: { lien: string }) {
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
    } catch {
      // Repli si l'API presse-papier est indisponible (contexte non sécurisé) : sélection manuelle.
      const champ = document.getElementById("lien-parrainage") as HTMLInputElement | null;
      champ?.select();
      document.execCommand?.("copy");
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2500);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        id="lien-parrainage"
        readOnly
        value={lien}
        onFocus={(e) => e.currentTarget.select()}
        className="h-11 flex-1 rounded-lg border border-cream-300 bg-cream-50 px-3 font-mono text-sm text-forest-900 outline-none"
      />
      <button
        type="button"
        onClick={copier}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-forest-800 px-4 text-sm font-semibold text-cream-50 transition-colors hover:bg-forest-700"
      >
        {copie ? <Check size={16} /> : <Copy size={16} />} {copie ? "Copié !" : "Copier le lien"}
      </button>
    </div>
  );
}
