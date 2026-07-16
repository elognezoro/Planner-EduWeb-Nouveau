/**
 * Publie, PAR RÔLE, dans « Aide et Formation › Guides d'utilisateurs » :
 *  1. le « Guide d'utilisateur » détaillé (Cours estGuide, leçons texte Markdown) ;
 *  2. la « FORMATION INTERACTIVE » associée (Cours estGuide, progression séquentielle,
 *     leçons texte courtes + leçons QUIZ formatifs à vérification immédiate — choix,
 *     vrai/faux, association, texte à trous, remise en ordre — avec explications).
 *
 * Source : prisma/guides/<roleId>.json — { guide: {...}, formation: {...} | null }
 * (générés et vérifiés par workflow ; valider avec `node prisma/valider-guides.mjs`).
 *
 * Idempotent : chaque cours est identifié par son slug (guide-<roleId> /
 * formation-<roleId>) : supprimé (cascade leçons/quiz) puis recréé.
 *
 *   npm run db:seed:guides
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DOSSIER = "prisma/guides";
const CATEGORIE = "Guides d'utilisation";
const TYPES_QUESTION = ["choix_unique", "choix_multiple", "vrai_faux", "association", "texte_a_trous", "remise_en_ordre"];

type ChoixSeed = { texte: string; correct?: boolean; apparie?: string };
type QuestionSeed = { enonce: string; type: string; points?: number; explication?: string; choix: ChoixSeed[] };
type QuizSeed = { consigne?: string; seuilReussite?: number; mode?: string; questions: QuestionSeed[] };
type LeconSeed = { titre: string; type?: "texte" | "quiz"; contenu?: string; dureeMinutes?: number; quiz?: QuizSeed };
type CoursSeed = {
  roleId?: string;
  titre: string;
  description?: string;
  niveau?: string;
  dureeMinutes?: number;
  lecons: LeconSeed[];
};
type FichierRole = { guide: CoursSeed; formation?: CoursSeed | null };

function niveauValide(n?: string): string {
  return ["debutant", "intermediaire", "avance"].includes(n ?? "") ? (n as string) : "debutant";
}

/** Données imbriquées Prisma d'une leçon (texte ou quiz complet). */
function leconData(l: LeconSeed, ordre: number) {
  if ((l.type ?? "texte") === "quiz" && l.quiz) {
    const questions = l.quiz.questions.filter((q) => q.enonce && TYPES_QUESTION.includes(q.type));
    return {
      titre: l.titre,
      type: "quiz",
      contenu: null,
      ordre,
      dureeMinutes: l.dureeMinutes ?? Math.max(4, questions.length * 2),
      quiz: {
        create: {
          consigne: l.quiz.consigne ?? null,
          seuilReussite: l.quiz.seuilReussite ?? 70,
          mode: l.quiz.mode === "sommatif" ? "sommatif" : "formatif",
          revelationSolutions: "apres_tentative",
          verificationImmediate: true,
          questions: {
            create: questions.map((q, k) => ({
              enonce: q.enonce,
              type: q.type,
              points: q.points && q.points > 0 ? Math.round(q.points) : 1,
              ordre: k,
              explication: q.explication ?? null,
              choix: {
                create: (q.choix ?? [])
                  .filter((c) => c.texte)
                  .map((c, m) => ({
                    texte: c.texte,
                    // Pour association / trous / ordre, tous les choix sont « corrects » par
                    // construction (la notation compare apparie / ordre / saisie).
                    correct: ["association", "texte_a_trous", "remise_en_ordre"].includes(q.type) ? true : c.correct === true,
                    apparie: c.apparie ?? null,
                    ordre: m,
                  })),
              },
            })),
          },
        },
      },
    };
  }
  return { titre: l.titre, type: "texte", contenu: l.contenu ?? "", ordre, dureeMinutes: l.dureeMinutes ?? null };
}

async function publierCours(opts: {
  slug: string;
  cours: CoursSeed;
  roleId: string;
  categorieId: string;
  ordre: number;
  progressionSequentielle: boolean;
}) {
  const lecons = (opts.cours.lecons || []).filter((l) => l && l.titre && ((l.type ?? "texte") === "quiz" ? l.quiz : l.contenu));
  if (lecons.length === 0) throw new Error(`${opts.slug} : aucune leçon exploitable.`);
  const dureeMinutes =
    opts.cours.dureeMinutes && opts.cours.dureeMinutes > 0 ? Math.round(opts.cours.dureeMinutes) : lecons.length * 6;

  // Idempotence : fiche propre (cascade : leçons, quiz, questions, choix).
  await prisma.cours.deleteMany({ where: { slug: opts.slug } });
  await prisma.cours.create({
    data: {
      titre: opts.cours.titre,
      slug: opts.slug,
      description: opts.cours.description ?? null,
      categorieId: opts.categorieId,
      niveau: niveauValide(opts.cours.niveau),
      publicCible: [opts.roleId],
      statut: "publie",
      estGuide: true,
      ordre: opts.ordre,
      dureeMinutes,
      seuilCompletion: 100,
      progressionSequentielle: opts.progressionSequentielle,
      modules: { create: lecons.map((l, j) => leconData(l, j)) },
    },
  });
  const nbQuiz = lecons.filter((l) => (l.type ?? "texte") === "quiz").length;
  console.log(`✓ ${opts.slug} — « ${opts.cours.titre} » (${lecons.length} leçons${nbQuiz ? `, dont ${nbQuiz} quiz` : ""}).`);
}

async function main() {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".json")).sort();
  if (fichiers.length === 0) throw new Error(`${DOSSIER} : aucun fichier de guide.`);

  // Catégorie « Guides d'utilisation » (créée si absente).
  let categorie = await prisma.categorieFormation.findFirst({ where: { nom: CATEGORIE }, select: { id: true } });
  if (!categorie) {
    categorie = await prisma.categorieFormation.create({
      data: { nom: CATEGORIE, description: "Prise en main d'EduWeb Planner, un guide par rôle.", icone: "BookOpen", ordre: 0 },
      select: { id: true },
    });
    console.log(`Catégorie créée : « ${CATEGORIE} ».`);
  }

  let guides = 0;
  let formations = 0;
  let ignores = 0;
  for (let i = 0; i < fichiers.length; i++) {
    const data: FichierRole = JSON.parse(readFileSync(join(DOSSIER, fichiers[i]), "utf8"));
    const roleId = data.guide?.roleId ?? fichiers[i].replace(/\.json$/, "");
    try {
      await publierCours({
        slug: `guide-${roleId}`,
        cours: data.guide,
        roleId,
        categorieId: categorie.id,
        ordre: i * 2,
        progressionSequentielle: false,
      });
      guides++;
    } catch (e) {
      console.warn(`⚠ guide-${roleId} ignoré :`, e instanceof Error ? e.message : e);
      ignores++;
    }
    if (data.formation) {
      try {
        await publierCours({
          slug: `formation-${roleId}`,
          cours: data.formation,
          roleId,
          categorieId: categorie.id,
          ordre: i * 2 + 1,
          // Formation interactive : on avance leçon par leçon (pédagogie guidée).
          progressionSequentielle: true,
        });
        formations++;
      } catch (e) {
        console.warn(`⚠ formation-${roleId} ignorée :`, e instanceof Error ? e.message : e);
        ignores++;
      }
    }
  }

  console.log(`\nTerminé : ${guides} guide(s), ${formations} formation(s) interactive(s), ${ignores} ignoré(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
