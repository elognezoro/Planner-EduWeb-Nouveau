"use client";

import { Printer } from "lucide-react";

export function BoutonImprimerGuide() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-200 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50 print:hidden"
    >
      <Printer size={16} /> Imprimer / PDF
    </button>
  );
}
