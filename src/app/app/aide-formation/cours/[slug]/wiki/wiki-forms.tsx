"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Trash2, Loader2, Star, Sparkles } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { EditeurRiche } from "@/components/ui/editeur-riche";
import { creerPageWiki, modifierPageWiki, supprimerPageWiki, evaluerPageWiki, suggererEvaluationWiki } from "../../../wiki-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

// Se déclenche à CHAQUE succès distinct (chaque appel d'action renvoie un nouvel objet `etat`).
function useSucces(etat: { ok: boolean }, cb: () => void) {
  const vu = useRef<{ ok: boolean } | null>(null);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; cb(); } }, [etat, cb]);
}

export function FormNouvellePage({ coursId }: { coursId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(creerPageWiki, initial);
  const [ouvert, setOuvert] = useState(false);
  useSucces(etat, () => { setOuvert(false); router.refresh(); });

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white hover:bg-forest-700">
        <Plus size={16} /> Nouvelle page
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="coursId" value={coursId} />
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-forest-900">Nouvelle page collaborative</h3>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Titre</label><input name="titre" required placeholder="Ex : Synthèse du groupe A — plan d'action" className={champ} /></div>
      <div>
        <label className={label}>Contenu</label>
        <EditeurRiche name="contenu" minHauteur={180} aide="Travail collaboratif : chaque membre peut compléter la page ; l'historique conserve toutes les révisions." />
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5">Créer la page</SubmitButton></div>
    </form>
  );
}

export function FormModifierPage({ page }: { page: { id: string; titre: string; contenu: string } }) {
  const router = useRouter();
  const [etat, action] = useActionState(modifierPageWiki, initial);
  const [ouvert, setOuvert] = useState(false);
  useSucces(etat, () => { setOuvert(false); router.refresh(); });

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-white px-4 py-1.5 text-sm font-semibold text-forest-800 hover:bg-forest-50">
        <Pencil size={14} /> Modifier la page
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="pageId" value={page.id} />
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-forest-900">Modifier la page</h3>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Titre</label><input name="titre" required defaultValue={page.titre} className={champ} /></div>
      <div>
        <label className={label}>Contenu</label>
        <EditeurRiche name="contenu" initial={page.contenu} minHauteur={220} aide="Votre modification est enregistrée comme une nouvelle révision (l'historique est conservé)." />
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5">Enregistrer</SubmitButton></div>
    </form>
  );
}

export function BoutonSupprimerPage({ pageId }: { pageId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Supprimer cette page et tout son historique ?")) {
          start(async () => { await supprimerPageWiki(pageId); router.push("../"); router.refresh(); });
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer
    </button>
  );
}

export function FormEvaluation({ pageId, estTuteur, dejaEvaluee }: { pageId: string; estTuteur: boolean; dejaEvaluee?: { note: number | null; commentaire: string | null } }) {
  const router = useRouter();
  const [etat, action] = useActionState(evaluerPageWiki, initial);
  useSucces(etat, () => router.refresh());
  // Éditeur non contrôlé : on le remonte (clé) pour y injecter la suggestion IA.
  const [commentaire, setCommentaire] = useState(dejaEvaluee?.commentaire ?? "");
  const [cleEditeur, setCleEditeur] = useState(0);
  // Note contrôlée : la suggestion IA la pré-remplit, l'évaluateur l'ajuste ensuite.
  const [note, setNote] = useState(dejaEvaluee?.note != null ? String(dejaEvaluee.note) : "");
  const [noteSuggeree, setNoteSuggeree] = useState(false);
  const [pendingIA, startIA] = useTransition();
  const [sourceIA, setSourceIA] = useState<string | null>(null);
  const [erreurIA, setErreurIA] = useState<string | null>(null);

  const suggerer = () =>
    startIA(async () => {
      setErreurIA(null);
      const r = await suggererEvaluationWiki(pageId);
      if (r.ok && r.texte) {
        setCommentaire(r.texte); setCleEditeur((k) => k + 1); setSourceIA(r.source ?? null);
        if (r.note != null) { setNote(String(r.note)); setNoteSuggeree(true); }
      }
      else setErreurIA(r.message ?? "Suggestion indisponible pour le moment.");
    });

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-gold-200 bg-gold-50/40 p-4">
      <input type="hidden" name="pageId" value={pageId} />
      <h3 className="flex items-center gap-2 font-display text-sm font-bold text-forest-900">
        <Star size={15} className="text-gold-600" /> {estTuteur ? "Évaluation du formateur / tuteur" : "Évaluer ce travail (pairs)"}
        {dejaEvaluee && <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-semibold text-forest-700">Déjà évaluée — vous pouvez réviser</span>}
      </h3>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="flex items-end gap-3">
        <div className="w-40">
          <label className={label}>Note / 20 <span className="font-normal text-ink-700/50">(facultatif)</span></label>
          <input name="note" type="number" min={0} max={20} value={note} onChange={(e) => { setNote(e.target.value); setNoteSuggeree(false); }} className={champ} />
          {noteSuggeree && <p className="mt-1 text-[11px] text-ink-700/50">Note proposée par l&apos;IA — ajustez selon votre appréciation.</p>}
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className={label + " mb-0"}>Commentaire</label>
          {estTuteur && (
            <button type="button" onClick={suggerer} disabled={pendingIA} className="inline-flex items-center gap-1 rounded-full border border-forest-200 px-2.5 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50">
              <Sparkles size={13} /> {pendingIA ? "Analyse…" : "Avis détaillé (IA)"}
            </button>
          )}
        </div>
        <EditeurRiche key={cleEditeur} name="commentaire" initial={commentaire} minHauteur={90} />
        {sourceIA && <p className="mt-1 text-[11px] text-ink-700/50">Proposition {sourceIA === "ia" ? "générée par IA" : "issue d'un modèle local"} — modifiable avant enregistrement.</p>}
        {erreurIA && <p className="mt-1 text-[11px] font-medium text-amber-700">{erreurIA}</p>}
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5">Enregistrer l&apos;évaluation</SubmitButton></div>
    </form>
  );
}
