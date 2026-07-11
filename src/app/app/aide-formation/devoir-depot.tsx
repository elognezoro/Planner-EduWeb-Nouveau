"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, FileDown, Clock } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { soumettreDevoir } from "./devoir-actions";
import { BoutonEcouter } from "./bouton-ecouter";

const initial = { ok: false } as { ok: boolean; message?: string };
const dateHeure = (d: Date) => new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

export function DevoirDepot({ moduleId, devoir, soumission }: {
  moduleId: string;
  devoir: { consigne: string | null; accepteTexte: boolean; accepteFichier: boolean; noteSur: number; dateLimite: Date | null };
  soumission: { texte: string | null; fichierUrl: string | null; fichierNom: string | null; statut: string; note: number | null; appreciation: string | null; dateSoumission: Date } | null;
}) {
  const router = useRouter();
  const [etat, action] = useActionState(soumettreDevoir, initial);
  const vu = useRef<typeof initial>(initial);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; router.refresh(); } }, [etat, router]);
  const corrige = soumission?.statut === "corrige";

  return (
    <div className="space-y-3">
      {devoir.consigne && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-cream-100 px-4 py-3">
          <p className="whitespace-pre-line text-sm text-ink-800">{devoir.consigne}</p>
          <BoutonEcouter texte={devoir.consigne} compact />
        </div>
      )}
      {devoir.dateLimite && (
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-700/60"><Clock size={13} /> À rendre avant le {dateHeure(devoir.dateLimite)}</p>
      )}

      {corrige && (
        <div className="rounded-xl border border-forest-200 bg-forest-50/60 p-4">
          <p className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-800">
            <CheckCircle2 size={17} /> Corrigé{soumission!.note != null ? ` — ${soumission!.note}/${devoir.noteSur}` : ""}
          </p>
          {soumission!.appreciation && (
            <div className="mt-1.5 text-sm text-ink-800">
              <p className="whitespace-pre-line">{soumission!.appreciation}</p>
              <div className="mt-1.5"><BoutonEcouter texte={soumission!.appreciation} compact label="Écouter l'appréciation" /></div>
            </div>
          )}
        </div>
      )}

      {soumission && !corrige && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-800">
          <Upload size={13} /> Déposé le {new Date(soumission.dateSoumission).toLocaleDateString("fr-FR")} — en attente de correction
        </p>
      )}
      {soumission?.fichierUrl && (
        <a href={soumission.fichierUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
          <FileDown size={14} /> {soumission.fichierNom ?? "Votre fichier déposé"}
        </a>
      )}

      <form action={action} className="space-y-2 border-t border-cream-200 pt-3">
        <input type="hidden" name="moduleId" value={moduleId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        {devoir.accepteTexte && (
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-900">Votre réponse</label>
            <textarea name="texte" rows={5} defaultValue={soumission?.texte ?? ""} placeholder="Rédigez votre travail…" className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200" />
          </div>
        )}
        {devoir.accepteFichier && (
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-900">Fichier <span className="font-normal text-ink-700/50">(PDF, image, doc… max 8 Mo)</span></label>
            <input type="file" name="fichier" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" className="text-xs" />
          </div>
        )}
        <SubmitButton className="w-auto px-6"><Upload size={15} /> {soumission ? "Redéposer" : "Déposer mon devoir"}</SubmitButton>
      </form>
    </div>
  );
}
