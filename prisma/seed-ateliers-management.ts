/**
 * Transforme la formation « Management administratif d'un établissement catholique »
 * en ATELIER DE PRODUCTION : chaque module aboutit à un livrable manifeste (devoir à
 * dépôt, production individuelle ou collective), conformément au découpage modulaire
 * du syllabus SEDEC (fiche forces/faiblesses, grille de diagnostic, plan d'action,
 * matrice documentaire, communiqué + mini-charte, tableau de bord).
 * Le séminaire se clôt par la production d'un DOCUMENT DE RÉFÉRENCE consolidé,
 * puis un QUESTIONNAIRE DE SATISFACTION.
 *
 * Idempotent : supprime les ateliers précédemment générés avant de les recréer.
 *
 *   npm run db:seed:ateliers-management
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TITRE_FINALE = "Production finale — Document de référence";
const TITRE_SATISFACTION = "Questionnaire de satisfaction";

/** Ateliers de production : un par module (production = livrable du découpage modulaire). */
const ATELIERS: Record<number, { titre: string; consigne: string; accepteFichier: boolean }> = {
  1: {
    titre: "Atelier 1 — Fiche forces/faiblesses de l'organisation administrative",
    consigne:
      "Production individuelle ou collective. Analysez l'organisation administrative de votre établissement au regard de la mission éducative catholique : dressez une fiche forces/faiblesses (au moins 5 forces et 5 faiblesses). Pour chaque faiblesse, précisez le risque induit pour la continuité administrative et une première piste d'amélioration. Déposez votre fiche (texte ou fichier).",
    accepteFichier: true,
  },
  2: {
    titre: "Atelier 2 — Grille de diagnostic administratif",
    consigne:
      "Production individuelle ou en binôme. Établissez la grille de diagnostic administratif de votre établissement : pour chaque domaine (inscriptions et dossiers des élèves, dossiers du personnel, finances, correspondances, archives…), indiquez l'état actuel, les risques de rupture de la continuité administrative identifiés et la priorité d'action (1 = urgente, 2 = importante, 3 = à planifier). Déposez la grille (texte ou fichier).",
    accepteFichier: true,
  },
  3: {
    titre: "Atelier 3 — Plan d'action annuel ou trimestriel (première version)",
    consigne:
      "Production individuelle ou collective. À partir de votre grille de diagnostic, élaborez la première version de votre plan d'action annuel ou trimestriel : 4 à 6 priorités transformées en activités mesurables — pour chacune : objectif, activité, responsable, échéance, indicateur de réussite. Déposez le plan (texte ou fichier).",
    accepteFichier: true,
  },
  4: {
    titre: "Atelier 4 — Matrice documentaire de l'établissement",
    consigne:
      "Production individuelle ou collective. Construisez la matrice documentaire de votre établissement pour organiser la mémoire institutionnelle et les procédures : documents administratifs essentiels, lieu de classement (physique/numérique), responsable, durée de conservation et procédure de mise à jour. Déposez la matrice (texte ou fichier).",
    accepteFichier: true,
  },
  5: {
    titre: "Atelier 5 — Communiqué institutionnel et mini-charte de communication",
    consigne:
      "Production individuelle ou collective. Rédigez : (1) un communiqué institutionnel adapté à un destinataire réel de votre choix (enseignants, parents, élèves, SEDEC ou partenaires) ; (2) une mini-charte de communication de votre établissement (5 à 8 règles : clarté, cohérence, responsabilité, canaux et délais de réponse) pour améliorer la communication avec l'ensemble des parties prenantes. Déposez les deux productions.",
    accepteFichier: true,
  },
  6: {
    titre: "Atelier 6 — Tableau de bord simple de suivi",
    consigne:
      "Production individuelle ou collective. Construisez un tableau de bord simple de suivi de votre plan d'action : 5 à 10 indicateurs (libellé, source de la donnée, périodicité, cible, état actuel) pour piloter, évaluer, ajuster et capitaliser. Un fichier tableur est recommandé. Déposez le tableau de bord.",
    accepteFichier: true,
  },
};

const FINALE = {
  titre: TITRE_FINALE,
  consigne:
    "Production finale du séminaire — individuelle ou d'équipe. Consolidez vos productions d'ateliers en un DOCUMENT DE RÉFÉRENCE pour votre établissement : plan d'action final, tableau de bord de suivi, matrice documentaire, communiqué type et mini-charte de communication, complétés par vos routines administratives durables (rituels hebdomadaires et mensuels : vérifications, classements, communications). Ce document atteste des compétences visées par la formation et servira de référence pour la continuité administrative de votre établissement. Déposez le document complet (fichier recommandé).",
  accepteFichier: true,
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
  accepteFichier: false,
};

async function main() {
  const cours = await prisma.cours.findFirst({
    where: { slug: { startsWith: "management-administratif" } },
    select: { id: true, titre: true, description: true },
  });
  if (!cours) {
    console.log("Cours « Management administratif… » introuvable.");
    return;
  }
  console.log(`Cours : ${cours.titre}`);

  // 1) Purge idempotente des ateliers générés précédemment.
  const purge = await prisma.moduleCours.deleteMany({
    where: {
      coursId: cours.id,
      type: "devoir",
      OR: [{ titre: { startsWith: "Atelier " } }, { titre: TITRE_FINALE }, { titre: TITRE_SATISFACTION }],
    },
  });
  if (purge.count) console.log(`  – ${purge.count} atelier(s) précédent(s) supprimé(s)`);

  // 2) Reconstruit l'ordre : chaque quiz de module est suivi de son atelier de production ;
  //    l'évaluation sommative est suivie de la production finale puis du questionnaire.
  const existants = await prisma.moduleCours.findMany({
    where: { coursId: cours.id },
    orderBy: { ordre: "asc" },
    select: { id: true, titre: true, type: true },
  });

  type Nouveau = { titre: string; consigne: string; accepteFichier: boolean };
  const sequence: ({ existantId: string } | { nouveau: Nouveau })[] = [];
  for (const m of existants) {
    sequence.push({ existantId: m.id });
    if (m.type === "quiz") {
      const num = /Module (\d)/.exec(m.titre)?.[1];
      if (num && ATELIERS[Number(num)]) sequence.push({ nouveau: ATELIERS[Number(num)] });
      if (m.titre.startsWith("Évaluation sommative")) {
        sequence.push({ nouveau: FINALE });
        sequence.push({ nouveau: SATISFACTION });
      }
    }
  }

  // 3) Applique la séquence (ordres réécrits + créations) en une transaction.
  // Timeout élargi : ~21 requêtes séquentielles vers Neon dépassent les 5 s par défaut.
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
            devoir: { create: { consigne: s.nouveau.consigne, accepteTexte: true, accepteFichier: s.nouveau.accepteFichier, noteSur: 20 } },
          },
        });
        console.log(`  ✔ [${String(i).padStart(2)}] ${s.nouveau.titre}`);
      }
    }
  }, { timeout: 120_000, maxWait: 15_000 });

  // 4) Description du cours : mentionne la logique d'atelier de production.
  if (!cours.description?.includes("atelier de production")) {
    await prisma.cours.update({
      where: { id: cours.id },
      data: {
        description:
          `${cours.description ?? ""} Formation en atelier de production : chaque module aboutit à un livrable manifeste (fiche forces/faiblesses, grille de diagnostic, plan d'action, matrice documentaire, communiqué et mini-charte, tableau de bord), consolidé en fin de séminaire dans un document de référence.`.trim(),
      },
    });
  }

  const total = await prisma.moduleCours.count({ where: { coursId: cours.id } });
  console.log(`\nTerminé — le cours compte désormais ${total} leçons (ateliers de production inclus).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
