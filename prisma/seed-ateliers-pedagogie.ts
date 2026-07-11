/**
 * Transforme la formation « Pédagogie de Jésus, autonomie de l'élève et suivi scolaire
 * à l'ère du digital » en ATELIER DE PRODUCTION : un livrable manifeste après chaque
 * module, une production finale consolidée (dossier pédagogique de référence) et un
 * questionnaire de satisfaction en clôture. Idempotent.
 *
 *   npm run db:seed:ateliers-pedagogie
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TITRE_FINALE = "Production finale — Dossier pédagogique de référence";
const TITRE_SATISFACTION = "Questionnaire de satisfaction";

/** Un atelier par module, dans l'ordre des quiz formatifs du cours. */
const ATELIERS: { titre: string; consigne: string }[] = [
  {
    titre: "Atelier 1 — Fiche de différenciation inspirée de la pédagogie de Jésus",
    consigne:
      "Production individuelle ou collective. Choisissez une situation réelle de votre classe (élève en difficulté, groupe hétérogène…) et proposez, à la manière de Jésus éducateur (questionnement, exemple proche du vécu, patience, relation individuelle), trois gestes de différenciation concrets : pour chacun, décrivez le geste, le moment de la séance et l'effet attendu. Déposez votre fiche (texte ou fichier).",
  },
  {
    titre: "Atelier 2 — Carte des obstacles à l'apprentissage de ma classe",
    consigne:
      "Production individuelle ou en binôme. Dressez la carte des principaux obstacles à l'apprentissage observés dans votre classe — cognitifs, socio-affectifs, matériels, linguistiques : pour chaque obstacle, ses manifestations observables et une réponse pédagogique adaptée. Déposez la carte (texte ou fichier).",
  },
  {
    titre: "Atelier 3 — Grille des profils d'élèves et plan d'accompagnement",
    consigne:
      "Production individuelle ou collective. Identifiez 3 à 5 profils d'élèves présents dans votre classe (rythme, motivation, acquis, contexte) et construisez la grille correspondante, assortie d'un plan d'accompagnement ajusté par profil (individuel ou en petit groupe : activités, regroupements, consignes différenciées). Déposez la grille et le plan.",
  },
  {
    titre: "Atelier 4 — Maquette du carnet d'auto-évaluation de l'élève",
    consigne:
      "Production individuelle ou collective. Concevez la maquette d'un carnet d'auto-évaluation prêt à l'emploi pour vos élèves : rubriques (ce que je sais faire, mes difficultés, mes progrès), échelles simples, engagement de l'élève et rythme de remplissage. Déposez la maquette (texte ou fichier).",
  },
  {
    titre: "Atelier 5 — Plan de suivi scolaire digital avec EduWeb",
    consigne:
      "Production individuelle ou collective. Élaborez le plan de suivi scolaire digital de votre classe avec EduWeb Planner : indicateurs suivis (assiduité, notes, cahier de texte), rythme de saisie et de consultation, modalités de communication avec les parents, et rituels de régulation. Déposez le plan (texte ou fichier).",
  },
];

const FINALE = {
  titre: TITRE_FINALE,
  consigne:
    "Production finale du séminaire — individuelle ou d'équipe. Consolidez vos productions d'ateliers en un DOSSIER PÉDAGOGIQUE DE RÉFÉRENCE : fiche de différenciation, carte des obstacles, grille des profils et plan d'accompagnement, maquette du carnet d'auto-évaluation et plan de suivi digital, complétés par vos engagements de mise en œuvre (ce qui change dans votre classe dès la semaine prochaine). Ce dossier atteste des compétences visées par la formation. Déposez le document complet (fichier recommandé).",
};

const SATISFACTION = {
  titre: TITRE_SATISFACTION,
  consigne:
    "Votre avis nous aide à améliorer les prochaines sessions. Notez chaque point de 1 (très insatisfait) à 5 (très satisfait), puis commentez librement :\n" +
    "1) Clarté et utilité des contenus des modules ;\n" +
    "2) Pertinence des ateliers de production (livrables) ;\n" +
    "3) Accompagnement et corrections du formateur/tuteur ;\n" +
    "4) Facilité d'utilisation de la plateforme EduWeb Planner ;\n" +
    "5) Organisation générale du séminaire.\n" +
    "Puis répondez : quels sont les points forts ? les points à améliorer ? les thèmes à approfondir lors d'une prochaine session ? Recommanderiez-vous cette formation à un collègue, et pourquoi ?",
};

async function main() {
  const cours = await prisma.cours.findFirst({
    where: { slug: { startsWith: "pedagogie-de-jesus" } },
    select: { id: true, titre: true, description: true },
  });
  if (!cours) {
    console.log("Cours « Pédagogie de Jésus… » introuvable.");
    return;
  }
  console.log(`Cours : ${cours.titre}`);

  const purge = await prisma.moduleCours.deleteMany({
    where: {
      coursId: cours.id,
      type: "devoir",
      OR: [{ titre: { startsWith: "Atelier " } }, { titre: TITRE_FINALE }, { titre: TITRE_SATISFACTION }],
    },
  });
  if (purge.count) console.log(`  – ${purge.count} atelier(s) précédent(s) supprimé(s)`);

  const existants = await prisma.moduleCours.findMany({
    where: { coursId: cours.id },
    orderBy: { ordre: "asc" },
    select: { id: true, titre: true, type: true },
  });

  type Nouveau = { titre: string; consigne: string };
  const sequence: ({ existantId: string } | { nouveau: Nouveau })[] = [];
  let iAtelier = 0;
  for (const m of existants) {
    sequence.push({ existantId: m.id });
    if (m.type === "quiz" && m.titre.startsWith("Quiz formatif") && iAtelier < ATELIERS.length) {
      sequence.push({ nouveau: ATELIERS[iAtelier++] });
    }
    if (m.type === "quiz" && m.titre.startsWith("Évaluation sommative")) {
      sequence.push({ nouveau: FINALE });
      sequence.push({ nouveau: SATISFACTION });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < sequence.length; i++) {
      const s = sequence[i];
      if ("existantId" in s) {
        await tx.moduleCours.update({ where: { id: s.existantId }, data: { ordre: i } });
      } else {
        await tx.moduleCours.create({
          data: {
            coursId: cours.id,
            titre: s.nouveau.titre,
            type: "devoir",
            ordre: i,
            devoir: { create: { consigne: s.nouveau.consigne, accepteTexte: true, accepteFichier: s.nouveau.titre !== TITRE_SATISFACTION, noteSur: 20 } },
          },
        });
        console.log(`  ✔ [${String(i).padStart(2)}] ${s.nouveau.titre}`);
      }
    }
  }, { timeout: 120_000, maxWait: 15_000 });

  if (!cours.description?.includes("atelier de production")) {
    await prisma.cours.update({
      where: { id: cours.id },
      data: {
        description:
          `${cours.description ?? ""} Formation en atelier de production : chaque module aboutit à un livrable manifeste (fiche de différenciation, carte des obstacles, grille des profils, carnet d'auto-évaluation, plan de suivi digital), consolidé en fin de séminaire dans un dossier pédagogique de référence.`.trim(),
      },
    });
  }

  const total = await prisma.moduleCours.count({ where: { coursId: cours.id } });
  console.log(`\nTerminé — le cours compte désormais ${total} leçons (ateliers de production inclus).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
