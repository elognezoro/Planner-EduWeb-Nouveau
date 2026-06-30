"use client";

import { useRef, useActionState } from "react";
import { Download, Upload } from "lucide-react";
import { importerConfiguration, type EtatForm } from "./config-actions";

const initial: EtatForm = { ok: false };

export function ExportImport({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(importerConfiguration, initial);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <a
          href={`/app/systeme/etablissements/${etablissementId}/export`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-cream-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"
        >
          <Download size={15} /> Exporter
        </a>
        <form ref={formRef} action={action}>
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-4 text-sm font-semibold text-forest-950 hover:-translate-y-0.5 transition-transform">
            <Upload size={15} /> Importer
            <input
              type="file"
              name="fichier"
              accept="application/json,.json"
              className="hidden"
              onChange={() => formRef.current?.requestSubmit()}
            />
          </label>
        </form>
      </div>
      {etat.message && (
        <span className={`text-xs ${etat.ok ? "text-forest-700" : "text-red-600"}`}>
          {etat.message}
        </span>
      )}
    </div>
  );
}
