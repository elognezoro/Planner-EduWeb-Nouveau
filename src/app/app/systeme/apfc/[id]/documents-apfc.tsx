"use client";

import Image from "next/image";
import { Fragment, useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Loader2 } from "lucide-react";
import { televerserDocumentApfc, supprimerDocumentApfc, type EtatForm } from "@/lib/formation/actions";
import { appliquerTermeApfc } from "@/lib/apfc-terme";

const initial: EtatForm = { ok: false };
const TAILLE_MAX = 4 * 1024 * 1024;

/**
 * Zones de dépôt du LOGO, du CACHET et de la SIGNATURE de l'APFC — mécanisme de stockage
 * IDENTIQUE à `documents-cafop.tsx` (Vercel Blob via `televerserDocumentApfc`, 4 Mo max).
 * Pas de zone « emblème » ici : les armoiries du pays sont affichées en LECTURE (voir
 * `ArmoiriesApfc`), sans dépôt personnalisé possible pour l'APFC.
 */
function ZoneDepot({ onChoisir, onDeposer }: { onChoisir: () => void; onDeposer: (f: File) => void }) {
  const { pending } = useFormStatus();
  const [survol, setSurvol] = useState(false);
  return (
    <button
      type="button"
      onClick={onChoisir}
      disabled={pending}
      onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => { e.preventDefault(); setSurvol(false); const f = e.dataTransfer.files?.[0]; if (f) onDeposer(f); }}
      className={`flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white p-3 transition-colors disabled:pointer-events-none ${
        survol ? "border-forest-500 bg-forest-50/70 text-forest-700" : "border-cream-300 text-ink-700/45 hover:border-forest-300 hover:bg-forest-50/40 hover:text-forest-700"
      }`}
    >
      <span className="pointer-events-none flex flex-col items-center gap-1.5 text-center">
        {pending ? (
          <><Loader2 size={22} className="animate-spin text-forest-600" /><span className="text-xs font-medium">Téléversement…</span></>
        ) : survol ? (
          <><ImageUp size={22} /><span className="px-3 text-xs font-medium">Déposez l&apos;image ici</span></>
        ) : (
          <><ImageUp size={22} /><span className="px-3 text-xs font-medium">Cliquez ou glissez-déposez</span></>
        )}
      </span>
    </button>
  );
}

/** Retrait en 2 clics (bouton unique de suppression d'une image déjà déposée — action serveur directe). */
function BoutonRetirer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline disabled:opacity-60">
      {pending && <Loader2 size={13} className="animate-spin" />} Retirer l&apos;image
    </button>
  );
}

function Zone({ apfcId, type, libelle, url }: { apfcId: string; type: string; libelle: string; url: string | null }) {
  const [etat, action] = useActionState(televerserDocumentApfc, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function controler(f: File): boolean {
    if (!f.type.startsWith("image/")) { setErreur("Déposez une image (PNG, JPG, SVG…)."); return false; }
    if (f.size > TAILLE_MAX) { setErreur(`L'image dépasse 4 Mo (${(f.size / 1024 / 1024).toFixed(1)} Mo).`); return false; }
    setErreur(null);
    return true;
  }
  function deposer(f: File) {
    if (!controler(f)) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    if (inputRef.current) { inputRef.current.files = dt.files; formRef.current?.requestSubmit(); }
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/60">{libelle}</p>
      {url ? (
        <>
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border-2 border-dashed border-cream-300 bg-white">
            <Image src={url} alt={libelle} fill unoptimized className="object-contain p-4" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
          </div>
          <form action={supprimerDocumentApfc}>
            <input type="hidden" name="apfcId" value={apfcId} />
            <input type="hidden" name="type" value={type} />
            <BoutonRetirer />
          </form>
        </>
      ) : (
        <form ref={formRef} action={action}>
          <input type="hidden" name="apfcId" value={apfcId} />
          <input type="hidden" name="type" value={type} />
          <input ref={inputRef} type="file" name="fichier" accept="image/*" className="hidden" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (!f) return; if (!controler(f)) { e.currentTarget.value = ""; return; } formRef.current?.requestSubmit(); }} />
          <ZoneDepot onChoisir={() => inputRef.current?.click()} onDeposer={deposer} />
          {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
          {etat.message && !etat.ok && <p className="mt-2 text-xs text-red-600">{etat.message}</p>}
        </form>
      )}
    </div>
  );
}

/**
 * Rend les trois zones (logo, cachet, signature) SANS wrapper de grille — pour s'insérer aux
 * côtés de `ArmoiriesApfc` (lecture) dans la grille commune de la section « Documents officiels ».
 */
export function DocumentsApfc({
  apfcId,
  docs,
  terme = "APFC",
}: {
  apfcId: string;
  docs: { logo: string | null; cachet: string | null; signature: string | null };
  terme?: string;
}) {
  return (
    <Fragment>
      <Zone apfcId={apfcId} type="logo" libelle={appliquerTermeApfc("Logo de l'APFC", terme)} url={docs.logo} />
      <Zone apfcId={apfcId} type="cachet" libelle="Cachet du chef d'antenne" url={docs.cachet} />
      <Zone apfcId={apfcId} type="signature" libelle="Signature électronique du chef d'antenne" url={docs.signature} />
    </Fragment>
  );
}
