"use client";

import { Printer } from "lucide-react";

export function BoutonImprimerAttestation() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-forest-700 print:hidden"
    >
      <Printer size={16} /> Imprimer / Enregistrer en PDF
    </button>
  );
}
