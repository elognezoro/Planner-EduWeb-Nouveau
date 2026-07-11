"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, RotateCcw, HelpCircle, Send, Eye, EyeOff, Lightbulb, Circle, BadgeCheck } from "lucide-react";
import { soumettreQuiz, verifierQuestion, type ResultatQuiz, type CorrectionQuestion, type VerifQuestion } from "./quiz-actions";
import { BoutonEcouter } from "./bouton-ecouter";
import { TYPES_CHOIX } from "@/lib/lms";
import { WidgetAssociation, WidgetTexteTrous, WidgetRemiseOrdre, resumeReponse } from "./exercice-widgets";

type ChoixVue = { id: string; texte: string };
export type QuestionPublique = { id: string; enonce: string; type: string; points: number; choix: ChoixVue[]; droites?: string[]; nbTrous?: number };

export function QuizPassage({
  moduleId,
  questions,
  consigne,
  seuil,
  dejaReussi,
  solutions,
  verifiable = true,
}: {
  moduleId: string;
  questions: QuestionPublique[];
  consigne: string | null;
  seuil: number;
  dejaReussi: boolean;
  /** Fournies seulement quand la révélation est « toujours » (mode révision) : solutions consultables avant de répondre. */
  solutions?: CorrectionQuestion[];
  /** Réglage admin : afficher le bouton « Vérifier » (correction immédiate) après chaque question. */
  verifiable?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reponses, setReponses] = useState<Record<string, string[]>>({});
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [revision, setRevision] = useState(false);
  const [verifs, setVerifs] = useState<Record<string, VerifQuestion>>({});
  const [verifEnCours, setVerifEnCours] = useState<string | null>(null);

  const verifier = async (qId: string) => {
    setVerifEnCours(qId);
    const res = await verifierQuestion(qId, reponses[qId] ?? []);
    setVerifEnCours(null);
    if (res.ok) setVerifs((v) => ({ ...v, [qId]: res }));
  };

  // Un changement de réponse invalide un éventuel retour « Vérifier » précédent (sinon il resterait figé).
  const oublierVerif = (qId: string) => setVerifs((v) => { if (!(qId in v)) return v; const n = { ...v }; delete n[qId]; return n; });
  const choisir = (qId: string, choixId: string, multiple: boolean) => {
    oublierVerif(qId);
    setReponses((r) => {
      if (!multiple) return { ...r, [qId]: [choixId] };
      const cur = r[qId] ?? [];
      return { ...r, [qId]: cur.includes(choixId) ? cur.filter((x) => x !== choixId) : [...cur, choixId] };
    });
  };
  const setRep = (qId: string, v: string[]) => { oublierVerif(qId); setReponses((r) => ({ ...r, [qId]: v })); };

  const soumettre = () => {
    setErreur(null);
    if (questions.some((q) => TYPES_CHOIX.includes(q.type) && (reponses[q.id] ?? []).length === 0)) {
      setErreur("Répondez à toutes les questions à choix avant de valider.");
      return;
    }
    start(async () => {
      const res = await soumettreQuiz(moduleId, reponses);
      setResultat(res);
      if (!res.ok) setErreur(res.message ?? "Erreur technique.");
      if (res.ok && res.reussi) router.refresh();
    });
  };

  const reessayer = () => { setResultat(null); setReponses({}); setErreur(null); };

  const mapSolutions = useMemo(() => new Map((solutions ?? []).map((c) => [c.questionId, c])), [solutions]);
  const mapResultat = useMemo(() => new Map((resultat?.corrections ?? []).map((c) => [c.questionId, c])), [resultat]);

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

  // Après soumission : score + revue des corrections (selon la politique de révélation).
  if (resultat?.ok) {
    const ok = resultat.reussi;
    const aCorrections = mapResultat.size > 0;
    return (
      <div className="space-y-4">
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
        {aCorrections && (
          <div className="space-y-3">
            <h4 className="inline-flex items-center gap-2 text-sm font-bold text-forest-900"><Lightbulb size={15} className="text-gold-600" /> Correction</h4>
            {questions.map((q, i) => <RevueQuestion key={q.id} q={q} index={i} sel={reponses[q.id] ?? []} correction={mapResultat.get(q.id)} />)}
          </div>
        )}
        {ok && <button type="button" onClick={reessayer} className="inline-flex items-center gap-2 rounded-full border border-forest-300 bg-white px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-forest-50"><RotateCcw size={15} /> Refaire</button>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consigne && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-cream-100 px-4 py-2.5">
          <p className="text-sm text-ink-800">{consigne}</p>
          <BoutonEcouter texte={consigne} compact />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700/60"><HelpCircle size={14} /> {questions.length} question(s) · seuil de réussite {seuil}%</p>
        {solutions && solutions.length > 0 && (
          <button type="button" onClick={() => setRevision((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-1 text-xs font-semibold text-forest-800 hover:bg-cream-100">
            {revision ? <EyeOff size={13} /> : <Eye size={13} />} {revision ? "Masquer" : "Voir"} les solutions
          </button>
        )}
      </div>

      {questions.map((q, i) => {
        const multiple = q.type === "choix_multiple";
        const sel = reponses[q.id] ?? [];
        if (revision) return <RevueQuestion key={q.id} q={q} index={i} sel={sel} correction={mapSolutions.get(q.id)} />;
        return (
          <div key={q.id} className="rounded-xl border border-cream-200 bg-white p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="font-medium text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {q.enonce}</p>
              <BoutonEcouter texte={q.enonce} compact />
            </div>
            {q.type === "choix_multiple" && <p className="mb-2 text-xs text-ink-700/50">Plusieurs réponses possibles</p>}
            {q.type === "association" && <p className="mb-2 text-xs text-ink-700/50">Reliez chaque élément à sa correspondance.</p>}
            {q.type === "texte_a_trous" && <p className="mb-2 text-xs text-ink-700/50">Complétez chaque trou.</p>}
            {q.type === "remise_en_ordre" && <p className="mb-2 text-xs text-ink-700/50">Remettez les éléments dans le bon ordre (flèches).</p>}
            <div className="mt-2">
              {q.type === "association" ? (
                <WidgetAssociation lefts={q.choix} droites={q.droites ?? []} valeur={sel} onChange={(v) => setRep(q.id, v)} />
              ) : q.type === "texte_a_trous" ? (
                <WidgetTexteTrous nbTrous={q.nbTrous ?? 0} valeur={sel} onChange={(v) => setRep(q.id, v)} />
              ) : q.type === "remise_en_ordre" ? (
                <WidgetRemiseOrdre items={q.choix} onChange={(v) => setRep(q.id, v)} />
              ) : (
                <div className="space-y-1.5">
                  {q.choix.map((c) => {
                    const coche = sel.includes(c.id);
                    return (
                      <label key={c.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${coche ? "border-forest-300 bg-forest-50" : "border-cream-200 hover:bg-cream-50"}`}>
                        <input type={multiple ? "checkbox" : "radio"} name={q.id} checked={coche} onChange={() => choisir(q.id, c.id, multiple)} className="accent-forest-600" />
                        <span className="text-ink-800">{c.texte}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            {verifiable && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cream-100 pt-2.5">
                <button
                  type="button"
                  onClick={() => verifier(q.id)}
                  disabled={verifEnCours === q.id || (reponses[q.id]?.length ?? 0) === 0}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
                >
                  <BadgeCheck size={13} /> {verifEnCours === q.id ? "Vérification…" : "Vérifier"}
                </button>
                {verifs[q.id] && <FeedbackVerif q={q} v={verifs[q.id]} />}
              </div>
            )}
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

/** Retour immédiat après un clic « Vérifier » : juste/à revoir + (selon la politique) réponse correcte et explication. */
function FeedbackVerif({ q, v }: { q: QuestionPublique; v: VerifQuestion }) {
  const bonnesTxt = v.bonnes && v.bonnes.length > 0 ? q.choix.filter((c) => v.bonnes!.includes(c.id)).map((c) => c.texte).join(", ") : null;
  return (
    <div className="w-full rounded-lg bg-cream-50 px-3 py-2">
      <p className={`inline-flex items-center gap-1.5 text-xs font-bold ${v.correct ? "text-forest-700" : "text-amber-700"}`}>
        {v.correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {v.correct ? "Bonne réponse" : "À revoir"}
      </p>
      {(bonnesTxt || v.solution) && (
        <p className="mt-0.5 text-xs text-ink-800"><span className="font-semibold text-forest-700/70">Réponse correcte : </span>{bonnesTxt ?? v.solution}</p>
      )}
      {v.explication && (
        <p className="mt-0.5 flex items-start gap-1 text-xs text-ink-800"><Lightbulb size={12} className="mt-0.5 shrink-0 text-gold-600" /> {v.explication}</p>
      )}
    </div>
  );
}

/** Rendu read-only d'une question avec les bonnes réponses mises en évidence + l'explication. */
function RevueQuestion({ q, index, sel, correction }: { q: QuestionPublique; index: number; sel: string[]; correction?: CorrectionQuestion }) {
  const estChoix = TYPES_CHOIX.includes(q.type);
  const bonnes = new Set(correction?.bonnes ?? []);
  return (
    <div className="rounded-xl border border-cream-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-medium text-forest-900"><span className="text-ink-700/40">{index + 1}.</span> {q.enonce}</p>
        <BoutonEcouter texte={q.enonce} compact />
      </div>
      {estChoix ? (
        <div className="space-y-1.5">
          {q.choix.map((c) => {
            const bon = bonnes.has(c.id);
            const choisi = sel.includes(c.id);
            const ton = bon ? "border-forest-300 bg-forest-50 text-forest-800" : choisi ? "border-red-300 bg-red-50 text-red-700" : "border-cream-200 text-ink-700/70";
            return (
              <div key={c.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm ${ton}`}>
                {bon ? <CheckCircle2 size={15} className="shrink-0 text-forest-600" /> : choisi ? <XCircle size={15} className="shrink-0 text-red-500" /> : <Circle size={14} className="shrink-0 text-ink-700/30" />}
                <span>{c.texte}</span>
                {choisi && <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide opacity-70">votre réponse</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5 text-sm">
          <div className="rounded-lg border border-cream-200 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-700/45">Votre réponse</p>
            <p className="text-ink-800">{resumeReponse(q, sel)}</p>
          </div>
          {correction?.solution && (
            <div className="rounded-lg border border-forest-200 bg-forest-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-forest-700/60">Réponse correcte</p>
              <p className="text-forest-800">{correction.solution}</p>
              <div className="mt-1"><BoutonEcouter texte={correction.solution} compact label="Écouter la réponse" /></div>
            </div>
          )}
        </div>
      )}
      {correction?.explication && (
        <div className="mt-2 rounded-lg bg-gold-50 px-3 py-2">
          <p className="flex items-start gap-1.5 text-sm text-ink-800">
            <Lightbulb size={14} className="mt-0.5 shrink-0 text-gold-600" /> {correction.explication}
          </p>
          <div className="mt-1.5"><BoutonEcouter texte={correction.explication} compact label="Écouter l'explication" /></div>
        </div>
      )}
    </div>
  );
}
