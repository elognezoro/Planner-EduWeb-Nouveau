/**
 * Seed du programme DHFC-EBiS (MENA · DPFC · AUF · AFD) dans le LMS « Aide et Formation ».
 *
 * À partir de prisma/dhfc-data.ts, crée :
 *  - 14 cours (un par syllabus) : présentation & objectifs, contenus & activités,
 *    quiz d'auto-positionnement (sommatif), devoir à rendre ; attestation personnalisée ;
 *  - le « Module maître » (analyse des besoins) : chapitres + quiz de maîtrise ;
 *  - 4 parcours par population, chacun avec son badge.
 * Tout est publié. Idempotent (nettoie les objets « dhfc-… » avant de recréer).
 *
 *   npm run db:seed:dhfc
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SYLLABI, MODULE_MAITRE, POPULATIONS, type Syllabus, type QuestionData } from "./dhfc-data";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TYPES_CHOIX = ["choix_unique", "choix_multiple", "vrai_faux"];
const SIGNATAIRE = "La DPFC — Direction de la Pédagogie et de la Formation Continue";
const FONCTION = "MENA · DPFC · AUF · AFD";
const MENTION = "Programme DHFC-EBiS · Dispositif Hybride de Formation Continue des Enseignants Bivalents de Sciences";

const puces = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

function leconPresentation(s: Syllabus): string {
  return (
    `## ${s.titre}\n\n` +
    `**Code** ${s.code} · **Public cible** ${s.publicCible}\n\n` +
    `**Durée** ${s.duree}\n\n**Modalité** ${s.modalite}\n\n**Prérequis** ${s.prerequis}\n\n` +
    `### Besoins couverts\n${puces(s.besoins)}\n\n` +
    `### Objectif général\n${s.objectifGeneral}\n\n` +
    `### Objectifs spécifiques (taxonomie de Bloom)\n${puces(s.objectifs)}`
  );
}

function leconContenus(s: Syllabus): string {
  return (
    `### Contenus & séquences\n${puces(s.contenus)}\n\n` +
    `### Activités & ressources\n${puces(s.activites)}\n\n` +
    `### Évaluation\n${s.evalModalites}\n\n**Critères de réussite** ${s.evalCriteres}\n\n**Badge visé** « ${s.badge} »`
  );
}

function quizModule(titre: string, consigne: string, questions: QuestionData[], ordre: number) {
  return {
    titre, type: "quiz", ordre,
    quiz: {
      create: {
        consigne, mode: "sommatif", revelationSolutions: "apres_reussite", seuilReussite: 70,
        questions: {
          create: questions.map((q, qi) => ({
            enonce: q.enonce, type: q.type, points: 1, explication: q.explication ?? null, ordre: qi,
            choix: {
              create: q.choix.map((c, ci) => ({
                texte: c.texte,
                correct: TYPES_CHOIX.includes(q.type) ? !!c.correct : true,
                apparie: c.apparie ?? null, ordre: ci,
              })),
            },
          })),
        },
      },
    },
  };
}

async function categorie(nom: string, cache: Map<string, string>): Promise<string> {
  const cle = nom.toLowerCase();
  if (cache.has(cle)) return cache.get(cle)!;
  const ex = await prisma.categorieFormation.findFirst({ where: { nom }, select: { id: true } });
  const id = ex?.id ?? (await prisma.categorieFormation.create({ data: { nom }, select: { id: true } })).id;
  cache.set(cle, id);
  return id;
}

async function main() {
  // 1) Nettoyage idempotent.
  await prisma.parcours.deleteMany({ where: { slug: { startsWith: "dhfc-parcours-" } } });
  await prisma.badge.deleteMany({ where: { nom: { in: Object.values(POPULATIONS).map((p) => p.badge) } } });
  await prisma.cours.deleteMany({ where: { slug: { startsWith: "dhfc-" } } });

  const cacheCat = new Map<string, string>();
  const idParSlug = new Map<string, string>();
  let nbQuestions = 0;

  // 2) Les 14 cours de syllabus.
  for (const s of SYLLABI) {
    const catId = await categorie(POPULATIONS[s.population].categorie, cacheCat);
    nbQuestions += s.quiz.length;
    const cree = await prisma.cours.create({
      data: {
        titre: `${s.code} — ${s.titre}`, slug: s.slug,
        description: s.objectifGeneral, niveau: "intermediaire", statut: "publie", publicCible: [],
        categorieId: catId, seuilCompletion: 100,
        attestationSignataire: SIGNATAIRE, attestationFonction: FONCTION, attestationMention: MENTION,
        modules: {
          create: [
            { titre: "Présentation & objectifs", type: "texte", contenu: leconPresentation(s), ordre: 0 },
            { titre: "Contenus & activités", type: "texte", contenu: leconContenus(s), ordre: 1 },
            quizModule("Quiz d'auto-positionnement", "Vérifiez votre maîtrise des points clés. Réussite à 70 % pour valider la leçon.", s.quiz, 2),
            { titre: "Travail à rendre", type: "devoir", ordre: 3, devoir: { create: { consigne: s.devoir, accepteTexte: true, accepteFichier: true, noteSur: 20 } } },
          ],
        },
      },
      select: { id: true, titre: true, _count: { select: { modules: true } } },
    });
    idParSlug.set(s.slug, cree.id);
    console.log(`  ✔ ${cree.titre} — ${cree._count.modules} leçon(s)`);
  }

  // 3) Module maître.
  const catMM = await categorie(MODULE_MAITRE.categorie, cacheCat);
  nbQuestions += MODULE_MAITRE.quiz.length;
  const mm = await prisma.cours.create({
    data: {
      titre: MODULE_MAITRE.titre, slug: MODULE_MAITRE.slug, description: MODULE_MAITRE.description,
      niveau: "debutant", statut: "publie", publicCible: [], categorieId: catMM, seuilCompletion: 100,
      attestationSignataire: SIGNATAIRE, attestationFonction: FONCTION, attestationMention: MENTION,
      modules: {
        create: [
          ...MODULE_MAITRE.lecons.map((l, i) => ({ titre: l.titre, type: "texte", contenu: l.contenu, ordre: i })),
          quizModule("Quiz de maîtrise", "Huit questions pour vérifier votre maîtrise des besoins réels et des critères qui les fondent.", MODULE_MAITRE.quiz, MODULE_MAITRE.lecons.length),
        ],
      },
    },
    select: { id: true, titre: true, _count: { select: { modules: true } } },
  });
  console.log(`  ✔ ${mm.titre} — ${mm._count.modules} leçon(s)`);

  // 4) Un parcours par population + badge.
  for (const pop of ["EBiS", "EP", "CA", "CE"] as const) {
    const cfg = POPULATIONS[pop];
    const cours = SYLLABI.filter((s) => s.population === pop);
    const badge = await prisma.badge.create({ data: { nom: cfg.badge, description: cfg.badgeDesc, icone: "Award", couleur: "gold" }, select: { id: true } });
    await prisma.parcours.create({
      data: {
        titre: cfg.parcoursTitre, slug: cfg.parcoursSlug,
        description: `Parcours de formation continue pour la population « ${pop} » du programme DHFC-EBiS. Terminez tous les cours pour obtenir le badge « ${cfg.badge} ».`,
        niveau: "intermediaire", publicCible: [], statut: "publie", badgeId: badge.id,
        etapes: { create: cours.map((s, i) => ({ coursId: idParSlug.get(s.slug)!, ordre: i })) },
      },
    });
    console.log(`  ✔ Parcours ${cfg.parcoursTitre} (${cours.length} cours) + badge « ${cfg.badge} »`);
  }

  console.log(`\nDHFC-EBiS : ${SYLLABI.length} cours + module maître, ${nbQuestions} questions, 4 parcours. Publié.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
