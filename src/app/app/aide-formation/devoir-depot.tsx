"use client";

import { useActionState, useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, FileDown, Clock, FileUp } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { EditeurRiche } from "@/components/ui/editeur-riche";
import { RenduRiche } from "@/components/ui/rendu-riche";
import { soumettreDevoir } from "./devoir-actions";
import { BoutonEcouter } from "./bouton-ecouter";
import { cn } from "@/lib/utils";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; setNomFichier(null); router.refresh(); } }, [etat, router]);
  const corrige = soumission?.statut === "corrige";

  const majFichier = (files: FileList | null) => setNomFichier(files?.[0]?.name ?? null);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSurvol(false);
    if (fileRef.current && e.dataTransfer.files.length) {
      fileRef.current.files = e.dataTransfer.files; // affecte le fichier déposé au champ soumis
      majFichier(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      {devoir.consigne && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-cream-100 px-4 py-3">
          <RenduRiche contenu={devoir.consigne} className="text-sm text-ink-800" />
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
              <RenduRiche contenu={soumission!.appreciation} />
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
            <EditeurRiche name="texte" initial={soumission?.texte ?? ""} minHauteur={160} aide="Mettez en forme votre production : titres, gras, souligné, couleurs, listes, alignement." />
          </div>
        )}
        {devoir.accepteFichier && (
          <div>
            <label className="mb-1 block text-sm font-medium text-forest-900">Fichier <span className="font-normal text-ink-700/50">(PDF, image, doc… max 8 Mo)</span></label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
              onDragLeave={() => setSurvol(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs transition",
                survol ? "border-forest-400 bg-forest-50" : "border-cream-300 bg-cream-50 hover:border-forest-300",
              )}
            >
              <FileUp size={20} className="text-forest-600" />
              {nomFichier
                ? <span className="font-semibold text-forest-800">{nomFichier}</span>
                : <span className="text-ink-700/60">Glissez-déposez un fichier ici, ou cliquez pour parcourir</span>}
              <span className="text-ink-700/45">PDF, image, doc… max 8 Mo</span>
            </div>
            <input ref={fileRef} type="file" name="fichier" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*" className="hidden" onChange={(e) => majFichier(e.target.files)} />
          </div>
        )}
        <SubmitButton className="w-auto px-6"><Upload size={15} /> {soumission ? "Redéposer" : "Déposer mon devoir"}</SubmitButton>
      </form>
    </div>
  );
}
