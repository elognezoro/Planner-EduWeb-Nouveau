/**
 * Seed des formations SEDEC Agboville dans le LMS « Aide et Formation ».
 * Idempotent : supprime le cours existant (même slug) puis recrée le cours + leçons + quiz.
 * Contenu authoré depuis les documents de scénarisation (prisma/formations-sedec.json).
 * Les cours sont créés en BROUILLON (l'admin publie après relecture).
 *
 *   npm run db:seed:formations
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TYPES_QUESTION = ["choix_unique", "choix_multiple", "vrai_faux", "association", "texte_a_trous", "remise_en_ordre"];
const TYPES_CHOIX = ["choix_unique", "choix_multiple", "vrai_faux"];

type ChoixJ = { texte: string; correct?: boolean; apparie?: string | null };
type QuestionJ = { enonce: string; type: string; points?: number; explication?: string | null; choix: ChoixJ[] };
type QuizJ = { consigne?: string | null; mode?: string; revelationSolutions?: string; seuilReussite?: number; questions: QuestionJ[] };
type LeconJ = { titre: string; type: string; contenu?: string | null; dureeMinutes?: number | null; quiz?: QuizJ };
type CoursJ = { titre: string; description?: string | null; niveau?: string | null; categorie?: string | null; lecons: LeconJ[] };

function slugifier(t: string): string {
  return t
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80) || "cours";
}

/** Ne conserve que les questions structurellement valides (défensif). */
function questionsValides(questions: QuestionJ[]): QuestionJ[] {
  return questions.filter((q) => {
    if (!q.enonce || !TYPES_QUESTION.includes(q.type)) return false;
    const ch = q.choix ?? [];
    if (TYPES_CHOIX.includes(q.type)) return ch.length >= 2 && ch.some((c) => c.correct);
    if (q.type === "association") return ch.length >= 2 && ch.every((c) => c.texte && c.apparie);
    if (q.type === "remise_en_ordre") return ch.length >= 2 && ch.every((c) => c.texte);
    if (q.type === "texte_a_trous") return ch.length >= 1 && ch.every((c) => c.texte);
    return false;
  });
}

async function categorieId(nom: string | null | undefined, cache: Map<string, string>): Promise<string | null> {
  if (!nom) return null;
  const cle = nom.toLowerCase();
  if (cache.has(cle)) return cache.get(cle)!;
  const existante = await prisma.categorieFormation.findFirst({ where: { nom }, select: { id: true } });
  const id = existante?.id ?? (await prisma.categorieFormation.create({ data: { nom }, select: { id: true } })).id;
  cache.set(cle, id);
  return id;
}

async function main() {
  const cours: CoursJ[] = JSON.parse(readFileSync(join(process.cwd(), "prisma", "formations-sedec.json"), "utf8"));
  const cacheCat = new Map<string, string>();
  let nbCours = 0, nbLecons = 0, nbQuestions = 0;

  for (const c of cours) {
    const slug = slugifier(c.titre);
    await prisma.cours.deleteMany({ where: { slug } }); // idempotent (cascade leçons/quiz)
    const catId = await categorieId(c.categorie, cacheCat);

    const cree = await prisma.cours.create({
      data: {
        titre: c.titre,
        slug,
        description: c.description ?? null,
        niveau: c.niveau ?? null,
        statut: "brouillon",
        publicCible: [],
        categorieId: catId,
        modules: {
          create: c.lecons.map((l, i) => {
            if (l.type === "quiz" && l.quiz) {
              const questions = questionsValides(l.quiz.questions ?? []);
              nbQuestions += questions.length;
              return {
                titre: l.titre, type: "quiz", dureeMinutes: l.dureeMinutes ?? null, ordre: i,
                quiz: {
                  create: {
                    consigne: l.quiz.consigne ?? null,
                    mode: l.quiz.mode ?? "formatif",
                    revelationSolutions: l.quiz.revelationSolutions ?? "apres_tentative",
                    seuilReussite: l.quiz.seuilReussite ?? 70,
                    questions: {
                      create: questions.map((q, qi) => ({
                        enonce: q.enonce, type: q.type, points: q.points ?? 1, explication: q.explication ?? null, ordre: qi,
                        choix: { create: (q.choix ?? []).map((ch, ci) => ({ texte: ch.texte, correct: !!ch.correct, apparie: ch.apparie ?? null, ordre: ci })) },
                      })),
                    },
                  },
                },
              };
            }
            return { titre: l.titre, type: "texte", contenu: l.contenu ?? null, dureeMinutes: l.dureeMinutes ?? null, ordre: i };
          }),
        },
      },
      select: { id: true, titre: true, _count: { select: { modules: true } } },
    });
    nbCours++;
    nbLecons += cree._count.modules;
    console.log(`  ✔ ${cree.titre} — ${cree._count.modules} leçon(s) [brouillon]`);
  }

  console.log(`\n${nbCours} cours, ${nbLecons} leçons, ${nbQuestions} questions importés (en brouillon).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
