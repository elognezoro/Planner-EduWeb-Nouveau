/**
 * Seed de DÉMONSTRATION du LMS « Aide et Formation ».
 *
 * Crée un jeu de contenus qui exploite TOUS les espaces du LMS :
 *  - 2 cours « Démo — … » (leçons texte + audio, vidéo, fichier, lien, quiz, devoir) ;
 *  - un quiz formatif couvrant tous les exerciseurs + un quiz sommatif (pour l'attestation) ;
 *  - un parcours « Démo — Parcours de découverte » + un badge « Explorateur EduWeb » ;
 *  - des sessions de formation (dates début/fin + cours associés).
 * Publie également tous les cours déjà élaborés (brouillons) pour les rendre consultables.
 *
 * Idempotent : réexécutable (nettoie les objets « Démo » par slug/nom avant de recréer).
 * Identifiable et supprimable : tout est préfixé « Démo — » / slug « demo-… ».
 *
 *   npm run db:seed:demo-lms
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const CAT = "Démonstration";
const BADGE = "Explorateur EduWeb";
const SLUG_C1 = "demo-decouverte-lms";
const SLUG_C2 = "demo-evaluation-certificat";
const SLUG_PARCOURS = "demo-parcours-decouverte";

type ChoixJ = { texte: string; correct?: boolean; apparie?: string | null };
type QuestionJ = { enonce: string; type: string; points?: number; explication?: string | null; choix: ChoixJ[] };
type LeconJ = {
  titre: string; type: string; contenu?: string | null; fichierUrl?: string; fichierNom?: string; dureeMinutes?: number;
  quiz?: { consigne?: string; mode?: string; revelationSolutions?: string; seuilReussite?: number; questions: QuestionJ[] };
  devoir?: { consigne?: string; accepteTexte?: boolean; accepteFichier?: boolean; noteSur?: number };
};
type CoursJ = { slug: string; titre: string; description: string; niveau: string; seuilCompletion?: number; attestationSignataire?: string; attestationFonction?: string; attestationMention?: string; lecons: LeconJ[] };

// ── Contenu de démonstration ────────────────────────────────

const COURS: CoursJ[] = [
  {
    slug: SLUG_C1,
    titre: "Démo — Découverte du LMS EduWeb",
    description: "Cours de démonstration qui présente tous les types de contenu du centre de formation : texte, vidéo, fichier, lien, quiz et devoir.",
    niveau: "debutant",
    lecons: [
      {
        titre: "Bienvenue dans le centre de formation",
        type: "texte",
        dureeMinutes: 5,
        contenu:
          "## Bienvenue 👋\n\n" +
          "Ce cours de **démonstration** vous fait découvrir chaque espace du LMS *Aide et Formation*.\n\n" +
          "Vous y trouverez successivement :\n\n" +
          "- une leçon **texte** (celle-ci, avec lecture audio) ;\n" +
          "- une leçon **vidéo** ;\n" +
          "- un **fichier** à télécharger ;\n" +
          "- un **lien** vers une ressource ;\n" +
          "- un **quiz** d'entraînement couvrant tous les exerciseurs ;\n" +
          "- un **devoir** à déposer, corrigé par un tuteur.\n\n" +
          "Astuce : cliquez sur **Écouter** au-dessus d'un texte pour l'entendre à voix haute.",
      },
      {
        titre: "Visite guidée en vidéo",
        type: "video",
        dureeMinutes: 10,
        contenu: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      },
      {
        titre: "Support de formation (PDF)",
        type: "fichier",
        dureeMinutes: 5,
        fichierUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        fichierNom: "support-demonstration.pdf",
      },
      {
        titre: "Ressource complémentaire (lien)",
        type: "lien",
        dureeMinutes: 3,
        contenu: "https://planning.eduweb.ci/app/aide-formation/guides/plateforme",
      },
      {
        titre: "Quiz d'entraînement — tous les exerciseurs",
        type: "quiz",
        dureeMinutes: 10,
        quiz: {
          consigne: "Un quiz formatif : entraînez-vous librement, les corrections s'affichent après chaque tentative.",
          mode: "formatif",
          revelationSolutions: "apres_tentative",
          seuilReussite: 70,
          questions: [
            {
              enonce: "Quel espace regroupe les cours à suivre en autonomie ?",
              type: "choix_unique",
              explication: "« Guides d'utilisateurs » est le catalogue des cours en autonomie.",
              choix: [
                { texte: "Guides d'utilisateurs", correct: true },
                { texte: "Formations" },
                { texte: "Parcours" },
                { texte: "Corrections" },
              ],
            },
            {
              enonce: "Parmi ces types de leçon, lesquels comportent une note ? (plusieurs réponses)",
              type: "choix_multiple",
              explication: "Le quiz produit un score ; le devoir reçoit une note du tuteur.",
              choix: [
                { texte: "Quiz", correct: true },
                { texte: "Devoir", correct: true },
                { texte: "Texte" },
                { texte: "Vidéo" },
              ],
            },
            {
              enonce: "Un badge est décerné automatiquement lorsqu'on termine tous les cours d'un parcours.",
              type: "vrai_faux",
              explication: "Exact : le badge rattaché au parcours est attribué automatiquement.",
              choix: [
                { texte: "Vrai", correct: true },
                { texte: "Faux" },
              ],
            },
            {
              enonce: "Reliez chaque espace du LMS à sa fonction.",
              type: "association",
              choix: [
                { texte: "Guides d'utilisateurs", apparie: "Cours en autonomie", correct: true },
                { texte: "Formations", apparie: "Sessions programmées", correct: true },
                { texte: "Parcours", apparie: "Suite de cours + badge", correct: true },
                { texte: "Corrections", apparie: "Devoirs corrigés par un tuteur", correct: true },
              ],
            },
            {
              enonce: "Complétez : le seuil de réussite d'un quiz vaut ___ % par défaut.",
              type: "texte_a_trous",
              explication: "Le seuil par défaut est 70 % (réglable par cours).",
              choix: [{ texte: "70", apparie: "70%|soixante-dix", correct: true }],
            },
            {
              enonce: "Remettez dans l'ordre les étapes pour obtenir une attestation.",
              type: "remise_en_ordre",
              explication: "On s'inscrit, on termine les leçons, on réussit les quiz sommatifs, puis on télécharge l'attestation.",
              choix: [
                { texte: "S'inscrire au cours", correct: true },
                { texte: "Terminer toutes les leçons", correct: true },
                { texte: "Réussir les quiz sommatifs", correct: true },
                { texte: "Obtenir son attestation", correct: true },
              ],
            },
          ],
        },
      },
      {
        titre: "Devoir — votre plan d'utilisation",
        type: "devoir",
        dureeMinutes: 15,
        devoir: {
          consigne: "Rédigez en quelques lignes comment vous comptez utiliser EduWeb Planner dans votre fonction. Vous pouvez aussi joindre un document. Un tuteur corrigera votre dépôt.",
          accepteTexte: true,
          accepteFichier: true,
          noteSur: 20,
        },
      },
    ],
  },
  {
    slug: SLUG_C2,
    titre: "Démo — Évaluation et certificat",
    description: "Cours court de démonstration montrant l'évaluation sommative et la délivrance d'une attestation de réussite avec mention.",
    niveau: "debutant",
    seuilCompletion: 100,
    attestationSignataire: "La Coordination EduWeb",
    attestationFonction: "Centre de formation · Académie EduWeb",
    attestationMention: "Attestation de démonstration",
    lecons: [
      {
        titre: "Comment obtenir votre certificat",
        type: "texte",
        dureeMinutes: 4,
        contenu:
          "## Obtenir votre attestation\n\n" +
          "Un cours est **validé** lorsque vous atteignez son seuil de complétion **et** que vous réussissez tous ses **quiz sommatifs**.\n\n" +
          "Une fois le cours validé, le bouton **« Obtenir mon attestation »** apparaît : l'attestation affiche votre nom, le cours, la date, votre **score moyen** et une **mention**.",
      },
      {
        titre: "Évaluation finale (sommative)",
        type: "quiz",
        dureeMinutes: 8,
        quiz: {
          consigne: "Évaluation notée : réussissez-la (≥ 70 %) pour valider le cours et débloquer votre attestation.",
          mode: "sommatif",
          revelationSolutions: "apres_reussite",
          seuilReussite: 70,
          questions: [
            {
              enonce: "À partir de quel pourcentage un quiz est-il réussi par défaut ?",
              type: "choix_unique",
              choix: [
                { texte: "70 %", correct: true },
                { texte: "50 %" },
                { texte: "60 %" },
                { texte: "100 %" },
              ],
            },
            {
              enonce: "Un quiz sommatif doit être réussi pour valider le cours.",
              type: "vrai_faux",
              choix: [
                { texte: "Vrai", correct: true },
                { texte: "Faux" },
              ],
            },
            {
              enonce: "Que contient une attestation de réussite ? (plusieurs réponses)",
              type: "choix_multiple",
              choix: [
                { texte: "Le nom de l'apprenant", correct: true },
                { texte: "Le titre du cours", correct: true },
                { texte: "La date de fin", correct: true },
                { texte: "Votre mot de passe" },
              ],
            },
          ],
        },
      },
    ],
  },
];

const TYPES_CHOIX = ["choix_unique", "choix_multiple", "vrai_faux"];

function moduleCreate(l: LeconJ, i: number) {
  const base = { titre: l.titre, dureeMinutes: l.dureeMinutes ?? null, ordre: i };
  if (l.type === "quiz" && l.quiz) {
    return {
      ...base, type: "quiz",
      quiz: {
        create: {
          consigne: l.quiz.consigne ?? null,
          mode: l.quiz.mode ?? "formatif",
          revelationSolutions: l.quiz.revelationSolutions ?? "apres_tentative",
          seuilReussite: l.quiz.seuilReussite ?? 70,
          questions: {
            create: l.quiz.questions.map((q, qi) => ({
              enonce: q.enonce, type: q.type, points: q.points ?? 1, explication: q.explication ?? null, ordre: qi,
              choix: {
                create: q.choix.map((c, ci) => ({
                  texte: c.texte,
                  // Pour les exerciseurs (association / trous / remise), tous les choix sont « corrects » (structure de réponse).
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
  if (l.type === "devoir" && l.devoir) {
    return {
      ...base, type: "devoir",
      devoir: {
        create: {
          consigne: l.devoir.consigne ?? null,
          accepteTexte: l.devoir.accepteTexte ?? true,
          accepteFichier: l.devoir.accepteFichier ?? true,
          noteSur: l.devoir.noteSur ?? 20,
        },
      },
    };
  }
  if (l.type === "fichier") return { ...base, type: "fichier", fichierUrl: l.fichierUrl ?? null, fichierNom: l.fichierNom ?? null };
  return { ...base, type: l.type, contenu: l.contenu ?? null };
}

async function main() {
  // 1) Publier tous les guides déjà élaborés (brouillons hors démo).
  const aPublier = await prisma.cours.findMany({ where: { statut: "brouillon", NOT: { slug: { startsWith: "demo-" } } }, select: { titre: true } });
  if (aPublier.length) {
    await prisma.cours.updateMany({ where: { statut: "brouillon", NOT: { slug: { startsWith: "demo-" } } }, data: { statut: "publie" } });
    console.log(`Publiés (${aPublier.length}) : ${aPublier.map((c) => c.titre).join(" · ")}`);
  } else {
    console.log("Aucun cours existant en brouillon à publier.");
  }

  // 2) Nettoyage idempotent des objets de démonstration.
  await prisma.sessionFormation.deleteMany({ where: { titre: { startsWith: "Démo —" } } });
  await prisma.parcours.deleteMany({ where: { slug: SLUG_PARCOURS } });
  await prisma.badge.deleteMany({ where: { nom: BADGE } });
  await prisma.cours.deleteMany({ where: { slug: { in: [SLUG_C1, SLUG_C2] } } });

  // 3) Catégorie de démonstration.
  const cat = (await prisma.categorieFormation.findFirst({ where: { nom: CAT }, select: { id: true } }))
    ?? (await prisma.categorieFormation.create({ data: { nom: CAT, description: "Contenus de démonstration (supprimables)." }, select: { id: true } }));

  // 4) Cours de démonstration (publiés).
  const idParSlug = new Map<string, string>();
  for (const c of COURS) {
    const cree = await prisma.cours.create({
      data: {
        titre: c.titre, slug: c.slug, description: c.description, niveau: c.niveau,
        statut: "publie", publicCible: [], categorieId: cat.id,
        seuilCompletion: c.seuilCompletion ?? 100,
        attestationSignataire: c.attestationSignataire ?? null,
        attestationFonction: c.attestationFonction ?? null,
        attestationMention: c.attestationMention ?? null,
        modules: { create: c.lecons.map((l, i) => moduleCreate(l, i)) },
      },
      select: { id: true, titre: true, _count: { select: { modules: true } } },
    });
    idParSlug.set(c.slug, cree.id);
    console.log(`  ✔ ${cree.titre} — ${cree._count.modules} leçon(s) [publié]`);
  }

  // 5) Badge + parcours (publié) reliant les deux cours de démo.
  const badge = await prisma.badge.create({ data: { nom: BADGE, description: "Décerné à la fin du parcours de découverte.", icone: "Award", couleur: "gold" }, select: { id: true } });
  await prisma.parcours.create({
    data: {
      titre: "Démo — Parcours de découverte", slug: SLUG_PARCOURS,
      description: "Enchaînez les deux cours de démonstration pour obtenir le badge « Explorateur EduWeb ».",
      niveau: "debutant", publicCible: [], statut: "publie", badgeId: badge.id,
      etapes: { create: [SLUG_C1, SLUG_C2].map((s, i) => ({ coursId: idParSlug.get(s)!, ordre: i })) },
    },
  });
  console.log(`  ✔ Parcours « Démo — Parcours de découverte » + badge « ${BADGE} »`);

  // 6) Sessions de formation (dates début/fin + cours associés).
  await prisma.sessionFormation.create({
    data: {
      titre: "Démo — Webinaire de prise en main", description: "Session de démonstration : présentation en direct du LMS et réponses aux questions.",
      format: "webinaire", animateur: "Équipe EduWeb",
      dateDebut: new Date("2026-07-25T10:00:00"), dateFin: new Date("2026-07-25T12:00:00"),
      dureeMinutes: 120, placesMax: 100, publicCible: [], statut: "planifiee",
      lienVisio: "https://planning.eduweb.ci",
      coursIds: [idParSlug.get(SLUG_C1)!, idParSlug.get(SLUG_C2)!],
    },
  });
  await prisma.sessionFormation.create({
    data: {
      titre: "Démo — Atelier pratique (présentiel)", description: "Atelier de démonstration en présentiel : mise en pratique guidée.",
      format: "atelier", animateur: "Équipe EduWeb",
      dateDebut: new Date("2026-08-01T09:00:00"), dateFin: new Date("2026-08-01T16:00:00"),
      dureeMinutes: 420, placesMax: 30, publicCible: [], statut: "planifiee", lieu: "Salle de formation",
      coursIds: [idParSlug.get(SLUG_C1)!],
    },
  });
  console.log("  ✔ 2 sessions de démonstration");

  console.log("\nSeed de démonstration terminé.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
