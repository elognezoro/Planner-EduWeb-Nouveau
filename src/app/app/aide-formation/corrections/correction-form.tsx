"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, FileDown } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { EditeurRiche } from "@/components/ui/editeur-riche";
import { RenduRiche } from "@/components/ui/rendu-riche";
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
  // L'éditeur riche n'est pas contrôlé : on le remonte (clé) pour injecter la suggestion IA.
  const [appreciation, setAppreciation] = useState(soumission.appreciation ?? "");
  const [cleEditeur, setCleEditeur] = useState(0);
  const [pendingIA, startIA] = useTransition();
  const [sourceIA, setSourceIA] = useState<string | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);

  const suggerer = () =>
    startIA(async () => {
      setErreurIA(null);
      const r = await suggererObservation(soumission.id);
      if (r.ok && r.texte) {
        setAppreciation(r.texte);
        setCleEditeur((k) => k + 1); // remonte l'éditeur avec la proposition
        setSourceIA(r.source ?? null);
      } else {
        setErreurIA(r.message ?? "Suggestion indisponible pour le moment.");
      }
    });

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={soumission.id} />

      {/* Production de l'apprenant : réponse écrite (texte saisi) + fichier déposé, clairement libellées. */}
      <div className="space-y-2 rounded-xl border border-cream-200 bg-cream-50/60 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/55">Production de l&apos;apprenant</p>
        {soumission.texte ? (
          <div>
            <p className="mb-1 text-[11px] font-medium text-ink-700/50">Réponse écrite (saisie)</p>
            <div className="rounded-lg bg-white px-3 py-2 text-sm text-ink-800"><RenduRiche contenu={soumission.texte} /></div>
          </div>
        ) : (
          <p className="text-xs italic text-ink-700/50">Aucune réponse écrite saisie.</p>
        )}
        {soumission.fichierUrl ? (
          <div>
            <p className="mb-1 text-[11px] font-medium text-ink-700/50">Fichier déposé</p>
            <a href={soumission.fichierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
              <FileDown size={14} /> {soumission.fichierNom ?? "Fichier déposé"}
            </a>
          </div>
        ) : (
          <p className="text-xs italic text-ink-700/50">Aucun fichier déposé.</p>
        )}
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="w-32">
        <label className="mb-1 block text-sm font-medium text-forest-900">Note / {soumission.noteSur}</label>
        <input name="note" type="number" min={0} max={soumission.noteSur} defaultValue={soumission.note ?? ""} className={champ} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-forest-900">Appréciation</label>
          <button type="button" onClick={suggerer} disabled={pendingIA} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50">
            <Sparkles size={13} /> {pendingIA ? "Analyse…" : "Avis détaillé (IA)"}
          </button>
        </div>
        <EditeurRiche key={cleEditeur} name="appreciation" initial={appreciation} minHauteur={110} />
        {sourceIA && <p className="mt-1 text-[11px] text-ink-700/50">Proposition {sourceIA === "ia" ? "générée par IA" : "issue d'un modèle local"} — modifiable avant enregistrement.</p>}
        {erreurIA && <p className="mt-1 text-[11px] font-medium text-amber-700">{erreurIA}</p>}
      </div>
      <SubmitButton className="w-auto px-5"><Check size={15} /> {soumission.statut === "corrige" ? "Mettre à jour la correction" : "Valider la correction"}</SubmitButton>
    </form>
  );
}
