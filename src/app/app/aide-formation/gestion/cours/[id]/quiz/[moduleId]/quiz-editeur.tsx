"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Check, ChevronUp, ChevronDown } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { TYPES_QUESTION, MODES_QUIZ, REVELATIONS_SOLUTION, TYPES_CHOIX } from "@/lib/lms";
import { enregistrerReglagesQuiz, enregistrerQuestion, supprimerQuestion } from "@/app/app/aide-formation/quiz-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

// Se déclenche à CHAQUE succès distinct (chaque appel d'action renvoie un nouvel objet `etat`).
function useFerme(etat: { ok: boolean }, cb: () => void) {
  const traite = useRef<{ ok: boolean } | null>(null);
  useEffect(() => { if (etat.ok && traite.current !== etat) { traite.current = etat; cb(); } }, [etat, cb]);
}

export function FormReglages({ moduleId, coursId, seuil, consigne, mode, revelation }: { moduleId: string; coursId: string; seuil: number; consigne: string | null; mode: string; revelation: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerReglagesQuiz, initial);
  useFerme(etat, () => router.refresh());
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="coursId" value={coursId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Consigne (facultatif)</label><textarea name="consigne" rows={2} defaultValue={consigne ?? ""} className={`${champ} h-auto py-2`} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Type d&apos;évaluation</label>
          <select name="mode" defaultValue={mode} className={champ}>{MODES_QUIZ.map((m) => <option key={m.v} value={m.v}>{m.libelle}</option>)}</select>
        </div>
        <div><label className={label}>Révélation des bonnes réponses</label>
          <select name="revelationSolutions" defaultValue={revelation} className={champ}>{REVELATIONS_SOLUTION.map((r) => <option key={r.v} value={r.v}>{r.libelle}</option>)}</select>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="w-40"><label className={label}>Seuil de réussite (%)</label><input name="seuilReussite" type="number" min={0} max={100} defaultValue={seuil} className={champ} /></div>
        <SubmitButton className="w-auto px-5">Enregistrer les réglages</SubmitButton>
      </div>
    </form>
  );
}

type Choix = { texte: string; correct: boolean; apparie: string };
export interface QuestionVue { id: string; enonce: string; type: string; points: number; explication?: string | null; choix: { texte: string; correct: boolean; apparie?: string | null }[] }

const defautChoix = (): Choix[] => [{ texte: "", correct: true, apparie: "" }, { texte: "", correct: false, apparie: "" }];
const labelChoix = (t: string) => t === "association" ? "Paires à relier (gauche → correspondance)" : t === "texte_a_trous" ? "Réponses des trous (dans l'ordre du texte)" : t === "remise_en_ordre" ? "Éléments dans le BON ordre (mélangés côté apprenant)" : "Propositions (cochez la/les bonne(s) réponse(s))";
const labelAjout = (t: string) => t === "association" ? "Ajouter une paire" : t === "texte_a_trous" ? "Ajouter un trou" : t === "remise_en_ordre" ? "Ajouter un élément" : "Ajouter une proposition";
const minChoix = (t: string) => (t === "texte_a_trous" ? 1 : 2);
const placeholderTexte = (t: string, i: number) => t === "association" ? "Élément de gauche" : t === "texte_a_trous" ? `Réponse du trou ${i + 1}` : t === "remise_en_ordre" ? `Élément ${i + 1}` : `Proposition ${i + 1}`;

export function FormQuestion({ quizId, question }: { quizId: string; question?: QuestionVue }) {
  const router = useRouter();
  const [etat, action] = useActionState(enregistrerQuestion, initial);
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState(question?.type ?? "choix_unique");
  const [choix, setChoix] = useState<Choix[]>(question?.choix?.map((c) => ({ texte: c.texte, correct: c.correct, apparie: c.apparie ?? "" })) ?? defautChoix());
  useFerme(etat, () => { setOuvert(false); router.refresh(); });

  const changerType = (t: string) => {
    setType(t);
    if (t === "vrai_faux") setChoix([{ texte: "Vrai", correct: true, apparie: "" }, { texte: "Faux", correct: false, apparie: "" }]);
    else if (choix.length < 2) setChoix(defautChoix());
    else if (t === "choix_unique") setChoix((cs) => { let vu = false; return cs.map((c) => { const keep = c.correct && !vu; if (keep) vu = true; return { ...c, correct: keep }; }); });
  };
  const ouvrirNouvelle = () => { setType("choix_unique"); setChoix(defautChoix()); setOuvert(true); };
  const setCorrect = (i: number, val: boolean) =>
    setChoix((cs) => cs.map((c, j) => (type === "choix_multiple" ? (j === i ? { ...c, correct: val } : c) : { ...c, correct: j === i })));
  const setTexte = (i: number, v: string) => setChoix((cs) => cs.map((c, j) => (j === i ? { ...c, texte: v } : c)));
  const setApparie = (i: number, v: string) => setChoix((cs) => cs.map((c, j) => (j === i ? { ...c, apparie: v } : c)));
  const ajouter = () => setChoix((cs) => [...cs, { texte: "", correct: false, apparie: "" }]);
  const retirer = (i: number) => setChoix((cs) => cs.filter((_, j) => j !== i));
  const bouger = (i: number, sens: -1 | 1) => setChoix((cs) => { const j = i + sens; if (j < 0 || j >= cs.length) return cs; const a = [...cs]; [a[i], a[j]] = [a[j], a[i]]; return a; });

  if (!ouvert && !question) return <button type="button" onClick={ouvrirNouvelle} className="inline-flex h-10 items-center gap-2 rounded-full border border-forest-300 bg-white px-4 text-sm font-semibold text-forest-800 hover:bg-forest-50"><Plus size={15} /> Ajouter une question</button>;
  if (!ouvert && question) return <button type="button" onClick={() => setOuvert(true)} className="rounded-lg p-1.5 text-ink-700/50 hover:bg-cream-100 hover:text-forest-700" title="Modifier"><Pencil size={14} /></button>;

  const verrou = type === "vrai_faux";
  const estChoix = TYPES_CHOIX.includes(type);
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
        <label className={label}>{labelChoix(type)}</label>
        <div className="space-y-2">
          {choix.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              {estChoix && <input type={type === "choix_multiple" ? "checkbox" : "radio"} name="choixCorrect" value={i} checked={c.correct} onChange={(e) => setCorrect(i, e.target.checked)} className="accent-forest-600" title="Bonne réponse" />}
              {type === "remise_en_ordre" && <span className="w-5 shrink-0 text-center text-xs font-bold text-ink-700/40">{i + 1}</span>}
              <input name="choixTexte" value={c.texte} onChange={(e) => setTexte(i, e.target.value)} readOnly={verrou} placeholder={placeholderTexte(type, i)} className={`${champ} ${verrou ? "bg-cream-50 text-ink-700/70" : ""}`} />
              {(type === "association" || type === "texte_a_trous") && (
                <>
                  {type === "association" && <span className="shrink-0 text-ink-700/40">→</span>}
                  <input name="choixApparie" value={c.apparie} onChange={(e) => setApparie(i, e.target.value)} placeholder={type === "association" ? "Correspondance" : "Alternatives a|b (facultatif)"} className={champ} />
                </>
              )}
              {type === "remise_en_ordre" && (
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => bouger(i, -1)} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => bouger(i, 1)} className="rounded p-0.5 text-ink-700/40 hover:text-forest-700"><ChevronDown size={14} /></button>
                </div>
              )}
              {!verrou && choix.length > minChoix(type) && <button type="button" onClick={() => retirer(i)} className="shrink-0 rounded-lg p-1.5 text-ink-700/40 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
        {!verrou && <button type="button" onClick={ajouter} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900"><Plus size={14} /> {labelAjout(type)}</button>}
      </div>
      <div><label className={label}>Explication / correction <span className="font-normal text-ink-700/50">(feedback révélé selon la politique du quiz)</span></label>
        <textarea name="explication" rows={2} defaultValue={question?.explication ?? ""} placeholder="Pourquoi cette réponse est correcte…" className={`${champ} h-auto py-2`} /></div>
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
