/**
 * Consolide le programme DHFC-EBiS en UN SEUL COURS « DHFC-EBiS — Analyse des besoins de
 * formation » dont les 15 anciens cours deviennent les MODULES (structure « Équilibrée ») :
 *   - le module maître en tête : ses 6 chapitres (leçons) + son quiz de maîtrise ;
 *   - puis chacun des 14 syllabus = 1 leçon (présentation + contenus fusionnés)
 *     + son quiz d'auto-positionnement + son travail à rendre.
 *   => ~49 modules, en accordéons, sur la page du cours.
 *
 * Effets de bord (RÉVERSIBLES) :
 *   - masque (statut « brouillon ») les 15 cours sources dhfc-* et les 4 parcours dhfc-parcours-*
 *     pour éviter le doublon dans le catalogue « Guides d'utilisateurs » ;
 *   - repointe la session « DHFC-EBiS - ANALYSE DE BESOINS » sur ce cours unique
 *     (coursIds = [cours unique]) et met à jour sa description.
 *
 * Idempotent : réexécutable (supprime puis recrée le cours unique par slug ; re-masque les sources).
 * NB : ne PAS relancer prisma/seed-dhfc.ts après coup (il republierait/écraserait les sources).
 *
 *   npm run db:seed:dhfc-unique
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SYLLABI, MODULE_MAITRE, type Syllabus, type QuestionData } from "./dhfc-data";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

/**
 * Contenu enrichi par syllabus (contenu développé + activités + quiz), généré et vérifié
 * hors-ligne puis figé dans prisma/dhfc-enrichi.json (versionné, réversible : supprimer le
 * fichier ou une clé rétablit la fiche de base). Absent = repli sur la fiche source.
 */
type FicheEnrichie = { contenu: string; activites: string; quiz: QuestionData[]; devoir: string };
let ENRICHI: Record<string, FicheEnrichie> = {};
try {
  ENRICHI = JSON.parse(readFileSync("prisma/dhfc-enrichi.json", "utf8"));
} catch {
  ENRICHI = {}; // pas de contenu enrichi : les leçons utilisent la fiche de base.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TYPES_CHOIX = ["choix_unique", "choix_multiple", "vrai_faux"];
const SIGNATAIRE = "La DPFC — Direction de la Pédagogie et de la Formation Continue";
const FONCTION = "MENA · DPFC · AUF · AFD";
const MENTION = "Programme DHFC-EBiS · Dispositif Hybride de Formation Continue des Enseignants Bivalents de Sciences";

const SLUG_UNIQUE = "dhfc-analyse-de-besoins";
const TITRE_COURS = "DHFC-EBiS — Analyse des besoins de formation";
const TITRE_SESSION = "DHFC-EBiS - ANALYSE DE BESOINS";
const CATEGORIE = "DHFC-EBiS · Analyse des besoins";
const MARQUEUR = "Paramètres fictifs à personnaliser";

/** Ordre pédagogique des syllabus : EBiS, EP, CA, CE. */
const ORDRE_SLUGS = [
  "dhfc-ebis-01", "dhfc-ebis-02", "dhfc-ebis-03", "dhfc-ebis-04", "dhfc-ebis-05", "dhfc-ebis-06", "dhfc-ebis-07",
  "dhfc-ep-01", "dhfc-ep-02", "dhfc-ep-03", "dhfc-ep-04",
  "dhfc-ca-01", "dhfc-ca-02",
  "dhfc-ce-01",
];

const puces = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

// Constructeurs de contenu identiques à seed-dhfc.ts (présentation + contenus).
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
/** « Équilibré » : les deux leçons texte d'un syllabus fusionnées en une seule. */
function leconFusionnee(s: Syllabus): string {
  return `${leconPresentation(s)}\n\n---\n\n${leconContenus(s)}`;
}

/** Bloc `quiz: { create: … }` pour un module de type quiz (sommatif, seuil 70 %). */
function quizCreate(consigne: string, questions: QuestionData[]) {
  return {
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
  };
}

async function main() {
  // 1) Catégorie du cours unique (réutilise celle du module maître si elle existe).
  const catExist = await prisma.categorieFormation.findFirst({ where: { nom: CATEGORIE }, select: { id: true } });
  const catId = catExist?.id ?? (await prisma.categorieFormation.create({ data: { nom: CATEGORIE }, select: { id: true } })).id;

  // 2) Construit la liste ordonnée des modules.
  type ModuleCreate = {
    titre: string; type: string; ordre: number; contenu?: string;
    quiz?: ReturnType<typeof quizCreate>;
    devoir?: { create: { consigne: string; accepteTexte: boolean; accepteFichier: boolean; noteSur: number } };
  };
  const modules: ModuleCreate[] = [];
  let ordre = 0;

  // 2a) Module maître : 6 chapitres + quiz de maîtrise.
  for (const l of MODULE_MAITRE.lecons) {
    modules.push({ titre: `Module maître · ${l.titre}`, type: "texte", contenu: l.contenu, ordre: ordre++ });
  }
  modules.push({
    titre: "Module maître · Quiz de maîtrise", type: "quiz", ordre: ordre++,
    quiz: quizCreate("Huit questions pour vérifier votre maîtrise des besoins réels et des critères qui les fondent.", MODULE_MAITRE.quiz),
  });

  // 2b) Les 14 syllabus : leçon fusionnée + quiz + devoir.
  const parSlug = new Map(SYLLABI.map((s) => [s.slug, s]));
  const syllabusOrdonnes = ORDRE_SLUGS.map((slug) => parSlug.get(slug)).filter((s): s is Syllabus => Boolean(s));
  let nbEnrichis = 0;
  for (const s of syllabusOrdonnes) {
    const e = ENRICHI[s.code];
    if (e) nbEnrichis++;
    // Leçon : fiche (objectifs) + contenu développé + activités d'apprentissage (si enrichi),
    // sinon repli sur la fiche fusionnée de base.
    const contenuLecon = e
      ? `${leconPresentation(s)}\n\n---\n\n${e.contenu.trim()}\n\n${e.activites.trim()}`
      : leconFusionnee(s);
    const questions = e && e.quiz?.length ? e.quiz : s.quiz;
    const consigne = (e?.devoir?.trim()) || s.devoir;
    modules.push({ titre: `${s.code} · ${s.titre}`, type: "texte", contenu: contenuLecon, ordre: ordre++ });
    modules.push({
      titre: `${s.code} · Quiz d'auto-positionnement`, type: "quiz", ordre: ordre++,
      quiz: quizCreate("Vérifiez votre maîtrise des points clés. Réussite à 70 % pour valider la leçon.", questions),
    });
    modules.push({
      titre: `${s.code} · Travail à rendre`, type: "devoir", ordre: ordre++,
      devoir: { create: { consigne, accepteTexte: true, accepteFichier: true, noteSur: 20 } },
    });
  }
  console.log(`  ✔ Contenu enrichi appliqué à ${nbEnrichis}/${syllabusOrdonnes.length} syllabus`);

  // 3) (Ré)crée le cours unique — idempotent par slug.
  await prisma.cours.deleteMany({ where: { slug: SLUG_UNIQUE } });
  const coursUnique = await prisma.cours.create({
    data: {
      titre: TITRE_COURS, slug: SLUG_UNIQUE,
      description:
        "Programme DHFC-EBiS (MENA · DPFC · AUF · AFD) rassemblé en un seul cours : le module maître (analyse des besoins de formation) puis les 14 syllabus (EBiS, EP, Chefs d'APFC, Chef d'établissement), chacun avec sa leçon, son quiz d'auto-positionnement et son travail à rendre.",
      niveau: "intermediaire", statut: "publie", publicCible: [], categorieId: catId, seuilCompletion: 100,
      attestationSignataire: SIGNATAIRE, attestationFonction: FONCTION, attestationMention: MENTION,
      modules: { create: modules },
    },
    select: { id: true, _count: { select: { modules: true } } },
  });
  console.log(`  ✔ Cours unique « ${TITRE_COURS} » — ${coursUnique._count.modules} modules`);

  // 4) Masque (réversible) les 15 cours sources dhfc-* et les 4 parcours dhfc-parcours-*.
  const majCours = await prisma.cours.updateMany({
    where: { slug: { startsWith: "dhfc-" }, NOT: { slug: SLUG_UNIQUE } },
    data: { statut: "brouillon" },
  });
  const majParcours = await prisma.parcours.updateMany({
    where: { slug: { startsWith: "dhfc-parcours-" } },
    data: { statut: "brouillon" },
  });
  console.log(`  ✔ ${majCours.count} cours source(s) masqué(s) (brouillon) · ${majParcours.count} parcours masqué(s)`);

  // 5) Repointe (ou crée) la session « Formations » sur le cours unique.
  const sess = await prisma.sessionFormation.findFirst({ where: { titre: TITRE_SESSION }, select: { id: true } });
  const description =
    "Formation unique du programme DHFC-EBiS (MENA · DPFC · AUF · AFD), issue de l'Analyse des besoins de formation. " +
    "Un seul cours structuré en modules : le module maître puis les 14 syllabus (EBiS, EP, Chefs d'APFC, Chef d'établissement), " +
    `chacun avec sa leçon, son quiz et son travail à rendre. Dispositif hybride : présentiel + distanciel. ${MARQUEUR} : ` +
    "dates, animateur, lieu/lien visio, places et public cible sont à ajuster depuis « Gérer ».";
  if (sess) {
    await prisma.sessionFormation.update({ where: { id: sess.id }, data: { coursIds: [coursUnique.id], description } });
    console.log(`  ✔ Session « ${TITRE_SESSION} » repointée sur le cours unique`);
  } else {
    await prisma.sessionFormation.create({
      data: {
        titre: TITRE_SESSION, description, format: "webinaire", animateur: "DPFC · Équipe DHFC-EBiS (à désigner)",
        dateDebut: new Date("2026-09-09T09:00:00"), dateFin: new Date("2026-11-04T17:00:00"),
        dureeMinutes: null, lienVisio: "https://meet.google.com/a-definir", lieu: null, placesMax: 100,
        publicCible: [], pays: null, statut: "planifiee", coursIds: [coursUnique.id],
      },
    });
    console.log(`  ✔ Session « ${TITRE_SESSION} » créée sur le cours unique`);
  }

  console.log("\nConsolidation terminée. Cours accessible : /app/aide-formation/cours/" + SLUG_UNIQUE);
  console.log("Réversible : republier les cours dhfc-* / parcours et resupprimer le cours unique restaure l'état antérieur.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
