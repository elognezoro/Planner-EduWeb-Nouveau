"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { TYPES_QUESTION } from "@/lib/lms";
import { enregistrerReglagesQuiz, enregistrerQuestion, supprimerQuestion } from "@/app/app/aide-formation/quiz-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

function useFerme(ok: boolean, cb: () => void) {
  const vu = useRef(false);
  useEffect(() => { if (ok && !vu.current) { vu.current = true; cb(); } }, [ok, cb]);
}

export function FormReglages({ moduleId, coursId, seuil, consigne }: { moduleId: string; coursId: string; seuil: number; consigne: string | null }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerReglagesQuiz, initial);
  useFerme(etat.ok, () => router.refresh());
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="coursId" value={coursId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Consigne (facultatif)</label><textarea name="consigne" rows={2} defaultValue={consigne ?? ""} className={`${champ} h-auto py-2`} /></div>
      <div className="flex items-end gap-3">
        <div className="w-40"><label className={label}>Seuil de réussite (%)</label><input name="seuilReussite" type="number" min={0} max={100} defaultValue={seuil} className={champ} /></div>
        <SubmitButton className="w-auto px-5">Enregistrer les réglages</SubmitButton>
      </div>
    </form>
  );
}

type Choix = { texte: string; correct: boolean };
export interface QuestionVue { id: string; enonce: string; type: string; points: number; choix: { texte: string; correct: boolean }[] }

export function FormQuestion({ quizId, question }: { quizId: string; question?: QuestionVue }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerQuestion, initial);
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState(question?.type ?? "choix_unique");
  const [choix, setChoix] = useState<Choix[]>(question?.choix ?? [{ texte: "", correct: true }, { texte: "", correct: false }]);
  useFerme(etat.ok, () => { setOuvert(false); router.refresh(); });

  const changerType = (t: string) => {
    setType(t);
    if (t === "vrai_faux") setChoix([{ texte: "Vrai", correct: true }, { texte: "Faux", correct: false }]);
    else if (choix.length < 2) setChoix([{ texte: "", correct: true }, { texte: "", correct: false }]);
  };
  const setCorrect = (i: number, val: boolean) =>
    setChoix((cs) => cs.map((c, j) => (type === "choix_multiple" ? (j === i ? { ...c, correct: val } : c) : { ...c, correct: j === i })));
  const setTexte = (i: number, v: string) => setChoix((cs) => cs.map((c, j) => (j === i ? { ...c, texte: v } : c)));
  const ajouter = () => setChoix((cs) => [...cs, { texte: "", correct: false }]);
  const retirer = (i: number) => setChoix((cs) => cs.filter((_, j) => j !== i));

  if (!ouvert && !question) return <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Plus size={15} /> Ajouter une question</button>;
  if (!ouvert && question) return <button type="button" onClick={() => setOuvert(true)} className="rounded-lg p-1.5 text-ink-700/50 hover:bg-cream-100 hover:text-forest-700" title="Modifier"><Pencil size={14} /></button>;

  const verrou = type === "vrai_faux";
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-soft">
      {question && <input type="hidden" name="id" value={question.id} />}
      <input type="hidden" name="quizId" value={quizId} />
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm font-bold text-forest-900">{question ? "Modifier la question" : "Nouvelle question"}</h4>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Énoncé</label><textarea name="enonce" required rows={2} defaultValue={question?.enonce} className={`${champ} h-auto py-2`} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Type</label>
          <select name="type" value={type} onChange={(e) => changerType(e.target.value)} className={champ}>{TYPES_QUESTION.map((t) => <option key={t.v} value={t.v}>{t.libelle}</option>)}</select>
        </div>
        <div><label className={label}>Points</label><input name="points" type="number" min={1} defaultValue={question?.points ?? 1} className={champ} /></div>
      </div>
      <div>
        <label className={label}>Propositions <span className="font-normal text-ink-700/50">(cochez la/les bonne(s) réponse(s))</span></label>
        <div className="space-y-2">
          {choix.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type={type === "choix_multiple" ? "checkbox" : "radio"} name="choixCorrect" value={i} checked={c.correct} onChange={(e) => setCorrect(i, e.target.checked)} className="accent-forest-600" />
              <input name="choixTexte" value={c.texte} onChange={(e) => setTexte(i, e.target.value)} readOnly={verrou} placeholder={`Proposition ${i + 1}`} className={`${champ} ${verrou ? "bg-cream-50 text-ink-700/70" : ""}`} />
              {!verrou && choix.length > 2 && <button type="button" onClick={() => retirer(i)} className="rounded-lg p-1.5 text-ink-700/40 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
        {!verrou && <button type="button" onClick={ajouter} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900"><Plus size={14} /> Ajouter une proposition</button>}
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5"><Check size={15} /> Enregistrer la question</SubmitButton></div>
    </form>
  );
}

export function SupprimerQuestionBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button type="button" disabled={pending} onClick={async () => { if (window.confirm("Supprimer cette question ?")) { setPending(true); await supprimerQuestion(id); router.refresh(); } }}
      className="rounded-lg p-1.5 text-ink-700/40 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Supprimer"><Trash2 size={14} /></button>
  );
}
