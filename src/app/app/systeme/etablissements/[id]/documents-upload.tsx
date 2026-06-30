"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Upload, Loader2, X } from "lucide-react";
import { televerserDocument, supprimerDocument, type EtatForm } from "./config-actions";

const initial: EtatForm = { ok: false };

function BoutonUpload() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-800 px-4 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
      Téléverser
    </button>
  );
}

function Zone({
  etablissementId,
  type,
  libelle,
  url,
}: {
  etablissementId: string;
  type: string;
  libelle: string;
  url: string | null;
}) {
  const [etat, action] = useActionState(televerserDocument, initial);

  return (
    <div className="rounded-xl border border-cream-300 bg-cream-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/60">
        {libelle}
      </p>
      {url ? (
        <div className="flex items-center gap-3">
          <span className="relative h-16 w-16 overflow-hidden rounded-lg border border-cream-200 bg-white">
            <Image src={url} alt={libelle} fill className="object-contain" sizes="64px" />
          </span>
          <form action={supprimerDocument}>
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <input type="hidden" name="type" value={type} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <X size={13} /> Retirer
            </button>
          </form>
        </div>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="type" value={type} />
          <input
            type="file"
            name="fichier"
            accept="image/*"
            required
            className="block w-full text-xs text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-forest-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-forest-800"
          />
          <BoutonUpload />
          {etat.message && !etat.ok && (
            <p className="text-xs text-red-600">{etat.message}</p>
          )}
        </form>
      )}
    </div>
  );
}

export function DocumentsUpload({
  etablissementId,
  docs,
}: {
  etablissementId: string;
  docs: { embleme: string | null; logo: string | null; cachet: string | null; signature: string | null };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Zone etablissementId={etablissementId} type="embleme" libelle="Emblème national" url={docs.embleme} />
      <Zone etablissementId={etablissementId} type="logo" libelle="Logo de l'établissement" url={docs.logo} />
      <Zone etablissementId={etablissementId} type="cachet" libelle="Cachet" url={docs.cachet} />
      <Zone etablissementId={etablissementId} type="signature" libelle="Signature du chef" url={docs.signature} />
    </div>
  );
}
