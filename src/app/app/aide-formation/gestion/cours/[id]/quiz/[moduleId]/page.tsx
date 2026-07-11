import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ListChecks, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/app/ui";
import { TYPES_QUESTION } from "@/lib/lms";
import { FormReglages, FormQuestion, SupprimerQuestionBtn } from "./quiz-editeur";

export const metadata: Metadata = { title: "Quiz — Aide et Formation" };
export const dynamic = "force-dynamic";

const BASE = "/app/aide-formation";
const libelleType = (v: string) => TYPES_QUESTION.find((t) => t.v === v)?.libelle ?? v;

export default async function QuizEditeurPage({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  await requireRole(["admin"]);
  const { id: coursId, moduleId } = await params;

  const lecon = await prisma.moduleCours.findFirst({
    where: { id: moduleId, coursId },
    select: {
      titre: true,
      quiz: { select: { id: true, consigne: true, seuilReussite: true, mode: true, revelationSolutions: true, questions: { orderBy: { ordre: "asc" }, select: { id: true, enonce: true, type: true, points: true, explication: true, choix: { orderBy: { ordre: "asc" }, select: { texte: true, correct: true, apparie: true } } } } } },
    },
  });
  if (!lecon) redirect(`${BASE}/gestion/cours/${coursId}`);
  // Crée le quiz si la leçon vient de passer en type « quiz » sans quiz encore rattaché.
  const quizBase = lecon.quiz ?? (await prisma.quiz.create({ data: { moduleId }, select: { id: true, consigne: true, seuilReussite: true, mode: true, revelationSolutions: true } }));
  const questions = lecon.quiz?.questions ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`${BASE}/gestion/cours/${coursId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900"><ArrowLeft size={15} /> Édition du cours</Link>
      <PageHeader titre={`Quiz — ${lecon.titre}`} description="Réglez le seuil de réussite et composez les questions. La leçon est validée quand l'apprenant atteint le seuil." />

      <section className="space-y-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-700/55">Réglages</h2>
        <FormReglages moduleId={moduleId} coursId={coursId} seuil={quizBase.seuilReussite} consigne={quizBase.consigne} mode={quizBase.mode} revelation={quizBase.revelationSolutions} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-ink-700/55"><ListChecks size={16} /> Questions ({questions.length})</h2>
          <FormQuestion quizId={quizBase.id} />
        </div>
        {questions.length === 0 ? (
          <Card><p className="text-sm text-ink-700/60">Aucune question. Ajoutez-en pour rendre le quiz opérationnel.</p></Card>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <Card key={q.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-forest-900"><span className="text-ink-700/40">{i + 1}.</span> {q.enonce}</p>
                    <p className="text-xs text-ink-700/55">{libelleType(q.type)} · {q.points} pt(s)</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <FormQuestion quizId={quizBase.id} question={{ id: q.id, enonce: q.enonce, type: q.type, points: q.points, explication: q.explication, choix: q.choix }} />
                    <SupprimerQuestionBtn id={q.id} />
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {q.choix.map((c, j) => (
                    <li key={j} className={`flex items-center gap-2 text-sm ${c.correct ? "text-forest-800" : "text-ink-700/70"}`}>
                      {c.correct ? <CheckCircle2 size={14} className="text-forest-600" /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-cream-300" />}
                      {c.texte}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
