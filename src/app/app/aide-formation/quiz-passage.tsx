"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, RotateCcw, HelpCircle, Send } from "lucide-react";
import { soumettreQuiz, type ResultatQuiz } from "./quiz-actions";

type ChoixVue = { id: string; texte: string };
export type QuestionPublique = { id: string; enonce: string; type: string; points: number; choix: ChoixVue[] };

export function QuizPassage({
  moduleId,
  questions,
  consigne,
  seuil,
  dejaReussi,
}: {
  moduleId: string;
  questions: QuestionPublique[];
  consigne: string | null;
  seuil: number;
  dejaReussi: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reponses, setReponses] = useState<Record<string, string[]>>({});
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const choisir = (qId: string, choixId: string, multiple: boolean) =>
    setReponses((r) => {
      if (!multiple) return { ...r, [qId]: [choixId] };
      const cur = r[qId] ?? [];
      return { ...r, [qId]: cur.includes(choixId) ? cur.filter((x) => x !== choixId) : [...cur, choixId] };
    });

  const soumettre = () => {
    setErreur(null);
    if (questions.some((q) => (reponses[q.id] ?? []).length === 0)) {
      setErreur("Répondez à toutes les questions avant de valider.");
      return;
    }
    start(async () => {
      const res = await soumettreQuiz(moduleId, reponses);
      setResultat(res);
      if (!res.ok) setErreur(res.message ?? "Erreur technique.");
      if (res.ok && res.reussi) router.refresh();
    });
  };

  const reessayer = () => {
    setResultat(null);
    setReponses({});
    setErreur(null);
  };

  if (questions.length === 0) {
    return <p className="text-sm text-ink-700/60">Ce quiz n&apos;a pas encore de question.</p>;
  }

  // Quiz déjà validé : état replié par défaut, réouvrable pour s'exercer.
  if (dejaReussi && !ouvert && !resultat) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-forest-200 bg-forest-50/60 px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest-800"><CheckCircle2 size={16} /> Quiz réussi</p>
        <button type="button" onClick={() => setOuvert(true)} className="text-sm font-semibold text-forest-700 hover:text-forest-900">Refaire le quiz</button>
      </div>
    );
  }

  if (resultat?.ok) {
    const ok = resultat.reussi;
    return (
      <div className={`rounded-xl border p-4 ${ok ? "border-forest-200 bg-forest-50/60" : "border-amber-200 bg-amber-50/70"}`}>
        <p className={`inline-flex items-center gap-2 font-display text-base font-bold ${ok ? "text-forest-800" : "text-amber-800"}`}>
          {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {ok ? "Réussi !" : "Pas encore atteint"}
        </p>
        <p className="mt-1 text-sm text-ink-800">
          Score : <strong>{resultat.pourcentage}%</strong> ({resultat.score}/{resultat.scoreMax} pt) · Seuil requis : {resultat.seuil}%
        </p>
        {!ok && (
          <button type="button" onClick={reessayer} className="mt-3 inline-flex items-center gap-2 rounded-full border border-forest-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50">
            <RotateCcw size={15} /> Réessayer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consigne && <p className="rounded-xl bg-cream-100 px-4 py-2.5 text-sm text-ink-800">{consigne}</p>}
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700/60"><HelpCircle size={14} /> {questions.length} question(s) · seuil de réussite {seuil}%</p>

      {questions.map((q, i) => {
        const multiple = q.type === "choix_multiple";
        const sel = reponses[q.id] ?? [];
        return (
          <div key={q.id} className="rounded-xl border border-cream-200 bg-white p-4">
            <p className="mb-1 font-medium text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {q.enonce}</p>
            {multiple && <p className="mb-2 text-xs text-ink-700/50">Plusieurs réponses possibles</p>}
            <div className="mt-2 space-y-1.5">
              {q.choix.map((c) => {
                const coche = sel.includes(c.id);
                return (
                  <label key={c.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${coche ? "border-forest-300 bg-forest-50" : "border-cream-200 hover:bg-cream-50"}`}>
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name={q.id}
                      checked={coche}
                      onChange={() => choisir(q.id, c.id, multiple)}
                      className="accent-forest-600"
                    />
                    <span className="text-ink-800">{c.texte}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
      <button type="button" onClick={soumettre} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-forest-700 disabled:opacity-50">
        <Send size={15} /> {pending ? "Correction…" : "Valider mes réponses"}
      </button>
    </div>
  );
}
