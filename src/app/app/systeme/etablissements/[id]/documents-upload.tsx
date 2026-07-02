"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Loader2 } from "lucide-react";
import { televerserDocument, supprimerDocument, type EtatForm } from "./config-actions";

const initial: EtatForm = { ok: false };

/** Zone de dépôt cliquable (état vide) — le téléversement part dès la sélection du fichier. */
function ZoneDepot({ onChoisir }: { onChoisir: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={pending}
      className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cream-300 bg-white text-ink-700/45 transition-colors hover:border-forest-300 hover:bg-forest-50/40 hover:text-forest-700 disabled:pointer-events-none"
    >
      {pending ? (
        <>
          <Loader2 size={22} className="animate-spin text-forest-600" />
          <span className="text-xs font-medium">Téléversement…</span>
        </>
      ) : (
        <>
          <ImageUp size={22} />
          <span className="px-3 text-center text-xs font-medium">
            Cliquez pour téléverser une image
          </span>
        </>
      )}
    </button>
  );
}

/** Lien « Retirer l'image » (état rempli). */
function BoutonRetirer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline disabled:opacity-60"
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      Retirer l&apos;image
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
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/60">
        {libelle}
      </p>

      {url ? (
        <>
          {/* Prévisualisation grand format dans la zone en pointillés — rendu direct du document. */}
          <div className="relative h-44 w-full overflow-hidden rounded-2xl border-2 border-dashed border-cream-300 bg-white">
            {/* `unoptimized` : chargement direct depuis le Blob — l'optimiseur Next peut rejeter
                l'hôte selon le réseau (DNS64/NAT64 → IP jugée privée), pour un simple aperçu. */}
            <Image src={url} alt={libelle} fill unoptimized className="object-contain p-4" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
          </div>
          <form action={supprimerDocument}>
            <input type="hidden" name="etablissementId" value={etablissementId} />
            <input type="hidden" name="type" value={type} />
            <BoutonRetirer />
          </form>
        </>
      ) : (
        <form ref={formRef} action={action}>
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="type" value={type} />
          <input
            ref={inputRef}
            type="file"
            name="fichier"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.currentTarget.files?.length) formRef.current?.requestSubmit();
            }}
          />
          <ZoneDepot onChoisir={() => inputRef.current?.click()} />
          {etat.message && !etat.ok && (
            <p className="mt-2 text-xs text-red-600">{etat.message}</p>
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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <Zone etablissementId={etablissementId} type="embleme" libelle="Emblème national (armoiries)" url={docs.embleme} />
      <Zone etablissementId={etablissementId} type="logo" libelle="Logo de l'établissement" url={docs.logo} />
      <Zone etablissementId={etablissementId} type="cachet" libelle="Cachet de l'établissement" url={docs.cachet} />
      <Zone etablissementId={etablissementId} type="signature" libelle="Signature électronique du chef d'établissement" url={docs.signature} />
    </div>
  );
}
