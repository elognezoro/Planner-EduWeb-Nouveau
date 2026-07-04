"use client";

import { Printer } from "lucide-react";

/**
 * Impression de l'emploi du temps affiché : la boîte de dialogue du navigateur permet
 * d'imprimer ou d'enregistrer en PDF — l'en-tête officiel de l'établissement apparaît
 * automatiquement sur la version imprimée.
 */
export function BoutonImprimerEdt() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-200 bg-white px-5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 print:hidden"
    >
      <Printer size={16} /> Imprimer / PDF
    </button>
  );
}
