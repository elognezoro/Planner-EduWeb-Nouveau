"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2 } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { ajouterTuteur, retirerTuteur } from "@/app/app/aide-formation/devoir-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function FormTuteur({ coursId }: { coursId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(ajouterTuteur, initial);
  const vu = useRef<typeof initial>(initial);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; router.refresh(); } }, [etat, router]);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="coursId" value={coursId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-sm font-medium text-forest-900">Ajouter un tuteur <span className="font-normal text-ink-700/50">(e-mail du compte)</span></label>
          <input name="email" type="email" required placeholder="tuteur@exemple.org" className={champ} />
        </div>
        <SubmitButton className="w-auto px-5"><UserPlus size={15} /> Ajouter</SubmitButton>
      </div>
    </form>
  );
}

export function SupprimerTuteurBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button type="button" disabled={pending} title="Retirer ce tuteur"
      onClick={async () => { setPending(true); await retirerTuteur(id); router.refresh(); }}
      className="rounded-lg p-1.5 text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 size={14} /></button>
  );
}
