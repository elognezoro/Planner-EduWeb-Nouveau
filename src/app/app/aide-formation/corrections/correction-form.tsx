"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, FileDown } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { corrigerSoumission, suggererObservation } from "@/app/app/aide-formation/devoir-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function CorrectionForm({ soumission }: {
  soumission: { id: string; texte: string | null; fichierUrl: string | null; fichierNom: string | null; note: number | null; appreciation: string | null; statut: string; noteSur: number };
}) {
  const router = useRouter();
  const [etat, action] = useActionState(corrigerSoumission, initial);
  const vu = useRef<typeof initial>(initial);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; router.refresh(); } }, [etat, router]);
  const [appreciation, setAppreciation] = useState(soumission.appreciation ?? "");
  const [pendingIA, startIA] = useTransition();
  const [sourceIA, setSourceIA] = useState<string | null>(null);

  const suggerer = () =>
    startIA(async () => {
      const r = await suggererObservation(soumission.id);
      if (r.ok && r.texte) { setAppreciation(r.texte); setSourceIA(r.source ?? null); }
    });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={soumission.id} />
      {soumission.texte && <div className="whitespace-pre-line rounded-xl bg-cream-50 px-3 py-2 text-sm text-ink-800">{soumission.texte}</div>}
      {soumission.fichierUrl && (
        <a href={soumission.fichierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
          <FileDown size={14} /> {soumission.fichierNom ?? "Fichier déposé"}
        </a>
      )}
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="w-32">
        <label className="mb-1 block text-sm font-medium text-forest-900">Note / {soumission.noteSur}</label>
        <input name="note" type="number" min={0} max={soumission.noteSur} defaultValue={soumission.note ?? ""} className={champ} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-forest-900">Appréciation</label>
          <button type="button" onClick={suggerer} disabled={pendingIA} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50">
            <Sparkles size={13} /> {pendingIA ? "Génération…" : "Suggérer (IA)"}
          </button>
        </div>
        <textarea name="appreciation" value={appreciation} onChange={(e) => setAppreciation(e.target.value)} rows={4} placeholder="Points forts, axes d'amélioration, encouragement…" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
        {sourceIA && <p className="mt-1 text-[11px] text-ink-700/50">Proposition {sourceIA === "ia" ? "générée par IA" : "issue d'un modèle local"} — modifiable avant enregistrement.</p>}
      </div>
      <SubmitButton className="w-auto px-5"><Check size={15} /> {soumission.statut === "corrige" ? "Mettre à jour la correction" : "Valider la correction"}</SubmitButton>
    </form>
  );
}
