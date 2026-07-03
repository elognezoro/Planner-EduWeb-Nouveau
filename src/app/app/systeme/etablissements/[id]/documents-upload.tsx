"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Loader2 } from "lucide-react";
import { televerserDocument, supprimerDocument, type EtatForm } from "./config-actions";
import { TAILLE_MAX_DOCUMENT, TAILLE_MAX_DOCUMENT_LIBELLE } from "./limites";

const initial: EtatForm = { ok: false };

/**
 * Zone de dépôt (état vide) : cliquer pour choisir un fichier OU glisser-déposer
 * une image directement — le téléversement part dès la réception du fichier.
 */
function ZoneDepot({ onChoisir, onDeposer }: { onChoisir: () => void; onDeposer: (f: File) => void }) {
  const { pending } = useFormStatus();
  const [survol, setSurvol] = useState(false);
  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={pending}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const fichier = e.dataTransfer.files?.[0];
        if (fichier) onDeposer(fichier);
      }}
      className={`flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white transition-colors disabled:pointer-events-none ${
        survol
          ? "border-forest-500 bg-forest-50/70 text-forest-700"
          : "border-cream-300 text-ink-700/45 hover:border-forest-300 hover:bg-forest-50/40 hover:text-forest-700"
      }`}
    >
      {/* pointer-events-none : le survol de glisser-déposer reste mesuré sur le bouton entier. */}
      <span className="pointer-events-none flex flex-col items-center gap-2">
        {pending ? (
          <>
            <Loader2 size={22} className="animate-spin text-forest-600" />
            <span className="text-xs font-medium">Téléversement…</span>
          </>
        ) : survol ? (
          <>
            <ImageUp size={22} />
            <span className="px-3 text-center text-xs font-medium">Déposez l&apos;image ici</span>
          </>
        ) : (
          <>
            <ImageUp size={22} />
            <span className="px-3 text-center text-xs font-medium">
              Cliquez ou glissez-déposez une image
            </span>
          </>
        )}
      </span>
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
  const [erreurDepot, setErreurDepot] = useState<string | null>(null);

  // Contrôle commun (clic et glisser-déposer) avant envoi : type image et taille maximale.
  function controler(fichier: File): boolean {
    if (!fichier.type.startsWith("image/")) {
      setErreurDepot("Déposez une image (PNG, JPG, SVG…).");
      return false;
    }
    if (fichier.size > TAILLE_MAX_DOCUMENT) {
      setErreurDepot(
        `L'image dépasse ${TAILLE_MAX_DOCUMENT_LIBELLE} (${(fichier.size / 1024 / 1024).toFixed(1)} Mo) : réduisez-la avant de la téléverser.`,
      );
      return false;
    }
    setErreurDepot(null);
    return true;
  }

  // Fichier reçu par glisser-déposer : injecté dans l'input puis téléversé immédiatement.
  function deposerFichier(fichier: File) {
    if (!controler(fichier)) return;
    const dt = new DataTransfer();
    dt.items.add(fichier);
    if (inputRef.current) {
      inputRef.current.files = dt.files;
      formRef.current?.requestSubmit();
    }
  }

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
              const fichier = e.currentTarget.files?.[0];
              if (!fichier) return;
              if (!controler(fichier)) {
                e.currentTarget.value = "";
                return;
              }
              formRef.current?.requestSubmit();
            }}
          />
          <ZoneDepot onChoisir={() => inputRef.current?.click()} onDeposer={deposerFichier} />
          {erreurDepot && <p className="mt-2 text-xs text-red-600">{erreurDepot}</p>}
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
