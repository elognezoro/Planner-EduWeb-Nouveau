"use client";

import { Printer } from "lucide-react";

/**
 * Impression d'un document officiel de l'espace APFC (supervision, rapports d'antennes…) : la
 * boîte de dialogue du navigateur permet d'imprimer ou d'enregistrer en PDF — l'en-tête et le
 * pied officiels apparaissent automatiquement sur la version imprimée (voir `en-tete-officiel-apfc.tsx`).
 */
export function BoutonImprimerApfc() {
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
