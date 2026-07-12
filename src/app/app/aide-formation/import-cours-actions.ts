"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { slugifier, estHtmlRiche } from "@/lib/lms";
import { sanitiserHtmlRiche } from "@/lib/html-riche";
import { structurerCoursDepuisTexte } from "@/lib/ia/generer-cours";

const BASE = "/app/aide-formation";
const TYPES_CHOIX = ["choix_unique", "choix_multiple", "vrai_faux"];

export type ResultatImportCours = {
  ok: boolean;
  message: string;
  coursId?: string;
  source?: "ia" | "repli";
  nbLecons?: number;
  nbQuestions?: number;
};

async function gardeAdmin(): Promise<boolean> {
  const u = await getUtilisateurCourant();
  return !!u && !u.apercuActif && u.roleReel === "admin";
}

async function slugUnique(titre: string): Promise<string> {
  const base = slugifier(titre) || "cours";
  const proches = await prisma.cours.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  const pris = new Set(proches.map((c) => c.slug));
  if (!pris.has(base)) return base;
  let n = 2;
  while (pris.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Crée un cours (en brouillon) à partir du texte d'un fichier déposé : structuration
 * (IA ou repli déterministe) en leçons + quiz, avec un jeu de paramètres par défaut.
 * L'admin ajuste ensuite depuis l'édition du cours. Réservé à l'Admin système.
 */
export async function creerCoursDepuisFichier(texte: string, nomFichier: string): Promise<ResultatImportCours> {
  if (!(await gardeAdmin())) return { ok: false, message: "Action réservée à l'administrateur système." };
  if (!texte || texte.trim().length < 40) return { ok: false, message: "Le fichier semble vide ou trop court à structurer." };

  const structure = await structurerCoursDepuisTexte(texte, nomFichier);
  if (structure.lecons.length === 0) return { ok: false, message: "Impossible de structurer ce document en leçons." };

  const modules: Prisma.ModuleCoursCreateWithoutCoursInput[] = structure.lecons.map((l, i) => ({
    titre: l.titre,
    type: "texte",
    contenu: estHtmlRiche(l.contenu) ? sanitiserHtmlRiche(l.contenu) : l.contenu,
    ordre: i,
  }));

  if (structure.quiz.length > 0) {
    modules.push({
      titre: "Quiz de validation", type: "quiz", ordre: structure.lecons.length,
      quiz: {
        create: {
          consigne: "Vérifiez votre compréhension du cours. Réussite à 70 % pour valider.",
          mode: "sommatif", revelationSolutions: "apres_reussite", seuilReussite: 70,
          questions: {
            create: structure.quiz.map((q, qi) => ({
              enonce: q.enonce, type: q.type, points: 1, explication: q.explication ?? null, ordre: qi,
              choix: {
                create: q.choix.map((c, ci) => ({
                  texte: c.texte,
                  correct: TYPES_CHOIX.includes(q.type) ? !!c.correct : true,
                  apparie: null, ordre: ci,
                })),
              },
            })),
          },
        },
      },
    });
  }

  try {
    const slug = await slugUnique(structure.titre);
    const cours = await prisma.cours.create({
      data: {
        titre: structure.titre, slug,
        description: structure.description || null,
        niveau: structure.niveau, statut: "brouillon", publicCible: [], seuilCompletion: 100,
        modules: { create: modules },
      },
      select: { id: true },
    });
    revalidatePath(`${BASE}/gestion`);
    return {
      ok: true, coursId: cours.id, source: structure.source,
      nbLecons: structure.lecons.length, nbQuestions: structure.quiz.length,
      message: `Cours créé en brouillon (${structure.lecons.length} leçon(s)${structure.quiz.length ? `, ${structure.quiz.length} question(s)` : ""}).`,
    };
  } catch (e) {
    console.error("[import-cours] création :", e);
    return { ok: false, message: "Erreur technique pendant la création du cours." };
  }
}
