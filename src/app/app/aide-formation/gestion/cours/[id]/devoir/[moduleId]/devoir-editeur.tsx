"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { EditeurRiche } from "@/components/ui/editeur-riche";
import { enregistrerReglagesDevoir } from "@/app/app/aide-formation/devoir-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function FormReglagesDevoir({ moduleId, coursId, devoir }: {
  moduleId: string; coursId: string;
  devoir: { consigne: string | null; accepteTexte: boolean; accepteFichier: boolean; noteSur: number; dateLimite: Date | null };
}) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerReglagesDevoir, initial);
  const vu = useRef<typeof initial>(initial);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; router.refresh(); } }, [etat, router]);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="coursId" value={coursId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Consigne du devoir</label>
        <EditeurRiche name="consigne" initial={devoir.consigne ?? ""} minHauteur={130} aide="Décrivez le travail attendu et les critères d'évaluation — titres, gras, couleurs, listes et alignement disponibles." /></div>
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-ink-800"><input type="checkbox" name="accepteTexte" defaultChecked={devoir.accepteTexte} className="accent-forest-600" /> Dépôt en texte libre</label>
        <label className="inline-flex items-center gap-2 text-sm text-ink-800"><input type="checkbox" name="accepteFichier" defaultChecked={devoir.accepteFichier} className="accent-forest-600" /> Dépôt d&apos;un fichier</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Note sur</label><input name="noteSur" type="number" min={1} defaultValue={devoir.noteSur} className={champ} /></div>
        <div><label className={label}>Date limite (facultatif)</label><input name="dateLimite" type="datetime-local" defaultValue={devoir.dateLimite ? iso(devoir.dateLimite) : ""} className={champ} /></div>
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5">Enregistrer le devoir</SubmitButton></div>
    </form>
  );
}
