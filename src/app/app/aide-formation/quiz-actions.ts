"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, requireUtilisateur } from "@/lib/auth/session";
import { scoreQuestion, solutionsRevelables, descriptionSolution, TYPES_CHOIX } from "@/lib/lms";
import { recalculerParcoursPourCours } from "@/lib/lms-parcours";
import type { EtatLms } from "./actions";

const BASE = "/app/aide-formation";
const cheminQuiz = (coursId: string, moduleId: string) => `${BASE}/gestion/cours/${coursId}/quiz/${moduleId}`;

async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, def: number): number => {
  const v = Number(fd.get(k));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : def;
};

// ── Réglages du quiz ────────────────────────────────────────

export async function enregistrerReglagesQuiz(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const moduleId = str(fd, "moduleId");
  const coursId = str(fd, "coursId");
  const seuil = Math.min(100, Math.max(0, num(fd, "seuilReussite", 70)));
  const mode = str(fd, "mode") || "formatif";
  const revelation = str(fd, "revelationSolutions") || "apres_tentative";
  const consigne = str(fd, "consigne") || null;
  try {
    await prisma.quiz.upsert({
      where: { moduleId },
      create: { moduleId, seuilReussite: seuil, consigne, mode, revelationSolutions: revelation },
      update: { seuilReussite: seuil, consigne, mode, revelationSolutions: revelation },
    });
    if (coursId) revalidatePath(cheminQuiz(coursId, moduleId));
  } catch (e) {
    console.error("[lms] réglages quiz :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Réglages enregistrés." };
}

// ── Questions & choix ───────────────────────────────────────

export async function enregistrerQuestion(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const quizId = str(fd, "quizId");
  const id = str(fd, "id") || null;
  const enonce = str(fd, "enonce");
  const type = str(fd, "type") || "choix_unique";
  const points = Math.max(1, num(fd, "points", 1));
  const explication = str(fd, "explication") || null;
  if (!quizId || !enonce) return { ok: false, message: "Énoncé obligatoire." };

  const textes = fd.getAll("choixTexte").map((v) => String(v).trim());
  const appariesRaw = fd.getAll("choixApparie").map((v) => String(v).trim());
  let choix: { texte: string; correct: boolean; ordre: number; apparie: string | null }[];

  if (type === "association") {
    choix = textes.map((t, i) => ({ texte: t, apparie: appariesRaw[i] || null, correct: true, ordre: i })).filter((c) => c.texte && c.apparie);
    if (choix.length < 2) return { ok: false, message: "Ajoutez au moins deux paires à relier (gauche et droite)." };
  } else if (type === "texte_a_trous") {
    choix = textes.map((t, i) => ({ texte: t, apparie: appariesRaw[i] || null, correct: true, ordre: i })).filter((c) => c.texte);
    if (choix.length < 1) return { ok: false, message: "Indiquez au moins une réponse de trou." };
  } else if (type === "remise_en_ordre") {
    choix = textes.map((t, i) => ({ texte: t, apparie: null, correct: true, ordre: i })).filter((c) => c.texte);
    if (choix.length < 2) return { ok: false, message: "Ajoutez au moins deux éléments à ordonner." };
  } else {
    const corrects = new Set(fd.getAll("choixCorrect").map((v) => String(v)));
    choix = textes.map((t, i) => ({ texte: t, correct: corrects.has(String(i)), ordre: i, apparie: null })).filter((c) => c.texte);
    if (choix.length < 2) return { ok: false, message: "Ajoutez au moins deux propositions." };
    if (!choix.some((c) => c.correct)) return { ok: false, message: "Cochez au moins une bonne réponse." };
    if (type !== "choix_multiple" && choix.filter((c) => c.correct).length > 1) return { ok: false, message: "Ce type de question n'accepte qu'une bonne réponse." };
  }

  try {
    if (id) {
      await prisma.$transaction([
        prisma.questionQuiz.update({ where: { id }, data: { enonce, type, points, explication } }),
        prisma.choixQuestion.deleteMany({ where: { questionId: id } }),
        prisma.choixQuestion.createMany({ data: choix.map((c) => ({ ...c, questionId: id })) }),
      ]);
    } else {
      const dernier = await prisma.questionQuiz.aggregate({ where: { quizId }, _max: { ordre: true } });
      await prisma.questionQuiz.create({
        data: { quizId, enonce, type, points, explication, ordre: (dernier._max.ordre ?? -1) + 1, choix: { create: choix } },
      });
    }
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { module: { select: { coursId: true, id: true } } } });
    if (quiz) revalidatePath(cheminQuiz(quiz.module.coursId, quiz.module.id));
  } catch (e) {
    console.error("[lms] question :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Question enregistrée." };
}

export async function supprimerQuestion(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const q = await prisma.questionQuiz.findUnique({ where: { id }, select: { quiz: { select: { module: { select: { coursId: true, id: true } } } } } });
    await prisma.questionQuiz.delete({ where: { id } });
    if (q) revalidatePath(cheminQuiz(q.quiz.module.coursId, q.quiz.module.id));
  } catch (e) {
    console.error("[lms] suppr question :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Question supprimée." };
}

// ── Passage du quiz (apprenant) ─────────────────────────────

export type CorrectionQuestion = { questionId: string; bonnes: string[]; solution?: string; explication: string | null };
export type ResultatQuiz = { ok: boolean; message?: string; pourcentage?: number; reussi?: boolean; score?: number; scoreMax?: number; seuil?: number; corrections?: CorrectionQuestion[] };

export async function soumettreQuiz(moduleId: string, reponses: Record<string, string[]>): Promise<ResultatQuiz> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const quiz = await prisma.quiz.findUnique({
    where: { moduleId },
    select: { id: true, seuilReussite: true, revelationSolutions: true, module: { select: { coursId: true } }, questions: { select: { id: true, type: true, points: true, explication: true, choix: { select: { id: true, texte: true, correct: true, apparie: true, ordre: true } } } } },
  });
  if (!quiz) return { ok: false, message: "Quiz introuvable." };
  if (quiz.questions.length === 0) return { ok: false, message: "Ce quiz n'a pas encore de question." };

  let score = 0;
  let scoreMax = 0;
  for (const q of quiz.questions) {
    scoreMax += q.points;
    score += scoreQuestion(q.type, q.choix, q.points, reponses[q.id] ?? []);
  }
  const pourcentage = scoreMax > 0 ? Math.round((score / scoreMax) * 100) : 0;
  const reussi = pourcentage >= quiz.seuilReussite;

  try {
    await prisma.tentativeQuiz.create({ data: { quizId: quiz.id, utilisateurId: u.id, score, scoreMax, pourcentage, reussi, reponses } });
    if (reussi) {
      // Valide la leçon et recalcule la progression du cours.
      const insc = await prisma.inscriptionCours.upsert({
        where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: quiz.module.coursId } },
        create: { utilisateurId: u.id, coursId: quiz.module.coursId },
        update: { derniereActivite: new Date() },
        select: { id: true },
      });
      await prisma.progressionModule.upsert({
        where: { inscriptionId_moduleId: { inscriptionId: insc.id, moduleId } },
        create: { inscriptionId: insc.id, moduleId, termine: true, dateCompletion: new Date() },
        update: { termine: true, dateCompletion: new Date() },
      });
      const [total, faits] = await Promise.all([
        prisma.moduleCours.count({ where: { coursId: quiz.module.coursId } }),
        prisma.progressionModule.count({ where: { inscriptionId: insc.id, termine: true } }),
      ]);
      const pct = total > 0 ? Math.round((faits / total) * 100) : 0;
      await prisma.inscriptionCours.update({ where: { id: insc.id }, data: { progressionPct: pct, statut: pct >= 100 ? "termine" : "en_cours", dateFin: pct >= 100 ? new Date() : null } });
      // Répercute sur les parcours de l'apprenant (progression + badge éventuel) — best-effort.
      await recalculerParcoursPourCours(u.id, quiz.module.coursId).catch((e) => console.error("[lms] recalcul parcours :", e));
    }
    revalidatePath(`${BASE}/guides`);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] soumission quiz :", e);
    return { ok: false, message: "Erreur technique." };
  }
  // Révèle les bonnes réponses + explications selon la politique du quiz.
  const corrections = solutionsRevelables(quiz.revelationSolutions, reussi)
    ? quiz.questions.map((q) => TYPES_CHOIX.includes(q.type)
        ? { questionId: q.id, bonnes: q.choix.filter((c) => c.correct).map((c) => c.id), explication: q.explication }
        : { questionId: q.id, bonnes: [], solution: descriptionSolution(q.type, q.choix), explication: q.explication })
    : undefined;
  return { ok: true, pourcentage, reussi, score, scoreMax, seuil: quiz.seuilReussite, corrections };
}
