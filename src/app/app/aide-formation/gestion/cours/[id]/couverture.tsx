"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { televerserCouverture, supprimerCouverture, type EtatLms } from "../../../actions";

const initial: EtatLms = { ok: false };

function Depot({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="button" onClick={onClick} disabled={pending}
      className="flex h-36 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-cream-300 bg-white text-ink-700/50 transition hover:border-forest-300 hover:bg-forest-50/40 hover:text-forest-700 disabled:opacity-60">
      {pending ? <Loader2 className="h-6 w-6 animate-spin text-forest-600" /> : <ImageUp className="h-6 w-6" />}
      <span className="text-sm font-medium">{pending ? "Téléversement…" : "Déposer une image de couverture"}</span>
      <span className="text-xs text-ink-700/45">PNG, JPG ou WebP — 4 Mo max</span>
    </button>
  );
}

export function CouvertureCours({ coursId, imageUrl }: { coursId: string; imageUrl: string | null }) {
  const [etat, action] = useActionState(televerserCouverture, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-4">
      <p className="mb-2 text-sm font-medium text-forest-900">Image de couverture <span className="font-normal text-ink-700/50">(bannière de la carte du cours)</span></p>
      {imageUrl ? (
        <div>
          <div className="relative h-40 w-full overflow-hidden rounded-xl border border-cream-300 bg-white">
            <Image src={imageUrl} alt="Couverture" fill unoptimized className="object-cover" sizes="(min-width:768px) 50vw, 100vw" />
          </div>
          <form action={async () => { await supprimerCouverture(coursId); }} className="mt-2">
            <BoutonRetirer />
          </form>
        </div>
      ) : (
        <form ref={formRef} action={action}>
          <input type="hidden" name="coursId" value={coursId} />
          <input ref={inputRef} type="file" name="fichier" accept="image/*" className="hidden"
            onChange={(e) => { if (e.currentTarget.files?.[0]) formRef.current?.requestSubmit(); }} />
          <Depot onClick={() => inputRef.current?.click()} />
          {etat.message && !etat.ok && <p className="mt-1.5 text-xs text-red-600">{etat.message}</p>}
        </form>
      )}
    </div>
  );
}

function BoutonRetirer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline disabled:opacity-60">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Retirer la couverture
    </button>
  );
}
