/**
 * Seed du « Plan de formation — Formation Initiale des Maîtres » (Côte d'Ivoire, 2025-2026).
 * Idempotent : recrée le plan du pays + année (supprime l'existant en cascade puis réinsère).
 * Données issues du document officiel « PLAN DE FORMATION 2025-2026 ».
 *
 *   npm run db:seed:plan
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PAYS = "Côte d'Ivoire";
const ANNEE = "2025-2026";

type Ligne = { cellules?: string[]; texte?: string; ton?: string; type?: string };
type Section = { niveau: number | null; titre: string; intro?: string; note?: string; colonnes: string[]; lignes: Ligne[] };

const b = (texte: string, ton: string): Ligne => ({ type: "banniere", texte, ton });
const total = (cellules: string[]): Ligne => ({ type: "total", cellules });
const l = (...cellules: string[]): Ligne => ({ cellules });

// ── I. Volumes théoriques (module → disciplines) ──
const MODULES_THEORIQUES: { module: string; total: string; disc: [string, string][] }[] = [
  { module: "MAÎTRISE LINGUISTIQUE POUR UNE PRATIQUE DIDACTIQUE EFFICACE", total: "128 H", disc: [["AEC", "06H"], ["CAV", "19H"], ["EDHC", "06H"], ["EPS", "06H"], ["FORMATION SCIENTIFIQUE", "08H"], ["FRANCAIS", "64H"], ["HISTOIRE-GÉOGRAPHIE", "08H"], ["MATHÉMATIQUES", "14H"]] },
  { module: "DROITS DE L'HOMME, CITOYENNETÉ ET CULTURE DE LA PAIX", total: "32H", disc: [["EDHC", "32H"]] },
  { module: "ÉDUCATION À LA SANTÉ", total: "32H", disc: [["EPS", "5H"], ["FORMATION SCIENTIFIQUE", "20H"], ["PSYCHOPÉDAGOGIE", "4H"]] },
  { module: "ÉDUCATION INCLUSIVE", total: "32H", disc: [["AEC", "3H"], ["CAV", "2H"], ["EDHC", "4H"], ["EPS", "3H"], ["FRANCAIS", "3H"], ["MATHÉMATIQUES", "3H"], ["PSYCHOPÉDAGOGIE", "12H"]] },
  { module: "ENVIRONNEMENT ET VIE SCOLAIRES", total: "32H", disc: [["AEC", "4H"], ["CAV", "11H"], ["EDHC", "3H"], ["EPS", "3H"], ["FORMATION SCIENTIFIQUE", "5H"], ["FRANCAIS", "3H"], ["PSYCHOPÉDAGOGIE", "4H"]] },
  { module: "ÉVALUATION DES APPRENTISSAGES", total: "40H", disc: [["AEC", "2H"], ["CAV", "2H"], ["EPS", "2H"], ["FORMATION SCIENTIFIQUE", "2H"], ["FRANCAIS", "5H"], ["HISTOIRE-GÉOGRAPHIE", "2H"], ["MATHÉMATIQUES", "4H"], ["PSYCHOPÉDAGOGIE", "15H"]] },
  { module: "GESTION DES APPRENTISSAGES", total: "162H", disc: [["AEC", "08H"], ["CAV", "08H"], ["EDHC", "07H"], ["EPS", "13H"], ["FORMATION SCIENTIFIQUE", "07H"], ["FRANCAIS", "47H"], ["HISTOIRE-GÉOGRAPHIE", "07H"], ["MATHÉMATIQUES", "35H"], ["PSYCHOPÉDAGOGIE", "26H"]] },
  { module: "GESTION DES CLASSES À PROFILS SPÉCIFIQUES", total: "32H", disc: [["AEC", "3H"], ["CAV", "3H"], ["EPS", "3H"], ["FRANCAIS", "3H"], ["HISTOIRE-GÉOGRAPHIE", "3H"], ["MATHÉMATIQUES", "3H"], ["PSYCHOPÉDAGOGIE", "9H"]] },
  { module: "GESTION DES CLASSES DU PRÉSCOLAIRE", total: "64H", disc: [["AEC", "07H"], ["CAV", "03H"], ["EDHC", "05H"], ["EPS", "07H"], ["FORMATION SCIENTIFIQUE", "07H"], ["FRANCAIS", "08H"], ["HISTOIRE-GÉOGRAPHIE", "06H"], ["MATHÉMATIQUES", "07H"], ["PSYCHOPÉDAGOGIE", "10H"]] },
  { module: "PLANIFICATION DES APPRENTISSAGES", total: "72H", disc: [["AEC", "5H"], ["CAV", "5H"], ["EDHC", "5H"], ["EPS", "5H"], ["FORMATION SCIENTIFIQUE", "5H"], ["FRANCAIS", "8H"], ["HISTOIRE-GÉOGRAPHIE", "5H"], ["MATHÉMATIQUES", "8H"], ["PSYCHOPÉDAGOGIE", "22H"]] },
  { module: "TECHNOLOGIES DE L'INFORMATION ET DE LA COMMUNICATION", total: "32H", disc: [["CAV", "32H"]] },
  { module: "VALEURS, ÉTHIQUE ET DÉONTOLOGIE DU MÉTIER D'INSTITUTEUR", total: "64H", disc: [["EDHC", "64H"]] },
  { module: "LA RECHERCHE PÉDAGOGIQUE AU CAFOP", total: "32H", disc: [["TOUTES LES DISCIPLINES – PORTFOLIO", "32H"]] },
];

const lignesTheoriques: Ligne[] = MODULES_THEORIQUES.flatMap((m) =>
  m.disc.map(([d, h], i) => l(i === 0 ? `${m.module}\n(${m.total})` : "", d, h)),
);

// ── Sections ──
const SECTIONS: Section[] = [
  {
    niveau: null,
    titre: "I — Volume horaire des activités théoriques (754 heures)",
    colonnes: ["Modules", "Disciplines", "Volumétrie"],
    lignes: lignesTheoriques,
  },
  {
    niveau: null,
    titre: "Tableau récapitulatif de la volumétrie par discipline",
    colonnes: ["Disciplines", "Volume horaire par groupe-classe"],
    lignes: [
      l("AEC", "38 HEURES"),
      l("CAV", "85 HEURES"),
      l("EDHC", "126 HEURES"),
      l("EPS", "47 HEURES"),
      l("FORMATION SCIENTIFIQUE", "54 HEURES"),
      l("FRANCAIS", "141 HEURES"),
      l("HISTOIRE-GÉOGRAPHIE", "31 HEURES"),
      l("MATHÉMATIQUES", "74 HEURES"),
      l("PSYCHOPÉDAGOGIE", "102 HEURES"),
      l("TOUTE DISCIPLINE (LA RECHERCHE PÉDAGOGIQUE)", "32 HEURES"),
      total(["TOTAL DES ENSEIGNEMENTS THÉORIQUES", "730 HEURES"]),
      total(["ÉVALUATIONS MODULAIRES ET REMÉDIATION", "47 HEURES"]),
      total(["ÉVALUATIONS COMMUNES ET REMÉDIATION", "48 HEURES"]),
      total(["PRÉPARATION ET EXPLOITATION DES STAGES", "192 HEURES"]),
      total(["RÉVISION", "64 HEURES"]),
      total(["TOTAL", "1017 HEURES  soit : 33,26 %"]),
    ],
  },
  {
    niveau: null,
    titre: "II — Volume horaire des activités pratiques",
    colonnes: ["Activités", "Volume horaire"],
    lignes: [
      l("Activités de mise en application 1re année", "128 HEURES"),
      l("Stage d'observation de 1re année", "72 HEURES"),
      l("Stage en tutelle 1re année", "128 HEURES"),
      l("Activités de mise en application 2e année", "64 HEURES"),
      l("Stage en tutelle 2e année", "768 HEURES"),
      l("Encadrement des élèves-maîtres mis en stage en responsabilité 3e année", "48 HEURES"),
      l("Stage en responsabilité de classe 3e année", "832 HEURES"),
      total(["TOTAL DES ACTIVITÉS PRATIQUES", "2040 HEURES  soit : 66,73 %"]),
    ],
  },
  // ── Plan 1re année ──
  {
    niveau: 1,
    titre: "Plan de formation 1re année de CAFOP : 2025-2026",
    note: "Le module TIC sera programmé les mercredis de huit (08) heures à dix (10) heures, soit deux (2) heures de cours théorie/pratique (salle multimédia), tout au long de l'année scolaire.",
    colonnes: ["N°", "Modules", "Durée", "Nombre de semaine", "Période d'exécution"],
    lignes: [
      l("", "- Stage de découverte du fonctionnement d'une école préscolaire ou primaire ou stage d'immersion\n- Exploitation du stage d'immersion", "64 h", "2 semaines", "Du lundi 13 au vendredi 17 octobre 2025\nDu lundi 20 au vendredi 24 octobre 2025"),
      l("1", "- Pré-test\n- Maîtrise linguistique pour une pratique didactique efficace", "16 h", "02 jours", "Du lundi 27 au mardi 28 octobre 2025"),
      b("Du mardi 28 octobre 2025 après les cours de l'après-midi, au dimanche 02 novembre 2025 inclus : congés de Toussaint", "conges"),
      l("", "Maîtrise linguistique pour une pratique didactique efficace (Suite et fin)", "126 h", "04 semaines", "Du lundi 03 au vendredi 28 novembre 2025"),
      l("2", "- Pré-test\n- Recherche pédagogique", "32 h", "01 semaine", "Du lundi 01 au vendredi 05 décembre 2025"),
      l("3", "- Pré-test\n- Planification des apprentissages", "72 h", "02 semaines", "Du lundi 08 au vendredi 19 décembre 2025"),
      b("Du vendredi 19 décembre 2025 après les cours de l'après-midi au dimanche 04 janvier 2026 inclus : congés de Noël", "conges"),
      l("", "Activités de mise en application du module gestion des apprentissages (module 3)", "32 h", "01 semaine", "Du lundi 05 au vendredi 09 janvier 2026"),
      l("4", "Gestion des apprentissages", "160 h", "05 semaines", "Du lundi 12 janvier au vendredi 13 février 2026"),
      l("", "Activités de mise en application du module gestion des apprentissages (module 4)", "16 h", "02 jours", "Du lundi 16 au mardi 17 février 2026"),
      b("Du mardi 17 février après les cours de l'après-midi au dimanche 22 février 2026 inclus : congés de février", "conges"),
      l("5", "- Pré-test\n- Évaluation des apprentissages", "40 h", "01 semaine", "Du lundi 23 au vendredi 27 février 2026"),
      l("", "Évaluation commune N°1 :\n- Composition ;\n- Correction ;\n- Remédiation.", "32 h", "01 semaine", "Du lundi 02 au vendredi 06 mars 2026"),
      b("Vendredi 06 mars 2026 : fin de la 1re période", "jalon"),
      l("", "Préparation du stage pratique :\n- Rencontres avec les différents acteurs ;\n- Transmission des outils de rapportage ;\n- Communication des objectifs et des consignes de stage.", "32 h", "01 semaine", "Du lundi 09 au vendredi 13 mars 2026"),
      l("", "Stage pratique", "", "02 semaines, 2 jours", "Du lundi 16 au mardi 31 mars 2026"),
      b("Du mardi 31 mars après les cours de l'après-midi au dimanche 12 avril 2026 inclus : congés de Pâques", "conges"),
      l("", "Stage pratique (suite et fin)", "32 h", "01 semaine", "Du lundi 13 au mardi 17 avril 2026"),
      l("", "Exploitation de stage", "32 h", "01 semaine", "Du lundi 20 au vendredi 24 avril 2026"),
      l("6", "- Pré-test\n- Éducation inclusive", "32 h", "01 semaine", "Du lundi 27 avril au vendredi 01 mai 2026"),
      l("7", "- Pré-test\n- Gestion des classes du préscolaire", "64 h", "02 semaines", "Du lundi 04 au vendredi 15 mai 2026"),
      l("8", "- Pré-test\n- Valeurs, éthique et déontologie du métier", "64 h", "02 semaines", "Du lundi 18 au vendredi 29 mai 2026"),
      l("", "- Examen de passage en 2e année\n  • Épreuve orale : soutenance du portfolio\n  • Épreuves écrites\n- Correction", "32 h", "01 semaine", "- Du lundi 01 au vendredi 05 juin 2026\n  • du lundi 01 au mardi 02 juin 2026\n  • du mercredi 03 au jeudi 04 juin 2026\n- Vendredi 04 juin 2026"),
      l("", "Conseil de fin d'année", "32 h", "01 semaine", "Du lundi 08 au vendredi 12 juin 2026"),
    ],
  },
  // ── Plan 2e année ──
  {
    niveau: 2,
    titre: "Plan de formation 2e année de CAFOP 2025-2026",
    note: "Le module TIC sera programmé les mercredis de huit (08) heures à dix (10) heures, soit deux (2) heures de cours théorie/pratique (salle multimédia), pendant les périodes de cours théoriques au CAFOP.",
    colonnes: ["N°", "Modules", "Durée", "Nombre de semaine", "Période d'exécution"],
    lignes: [
      l("0", "Révision", "32 h", "01 semaine", "Du lundi 08 au vendredi 12 septembre 2025"),
      l("1", "- Pré-test\n- Droits de l'Homme, citoyenneté et Culture de la Paix", "32 h", "01 semaine", "Du lundi 15 au vendredi 19 septembre 2025"),
      l("2", "- Pré-test\n- Gestion des classes à profils spécifiques", "32 h", "01 semaine", "Du lundi 22 au vendredi 26 septembre 2025"),
      l("3", "- Pré-test\n- Environnement et vie scolaire", "32 h", "01 semaine", "Du lundi 29 septembre au vendredi 03 octobre 2025"),
      l("", "Évaluation commune N°1 :\n- Composition\n- Correction\n- Remédiations", "32 h", "01 semaine", "Du lundi 06 au vendredi 10 octobre 2025\n- Lundi 06 au mardi 07 octobre 2025\n- Mercredi 08 octobre 2025\n- Du jeudi 09 au vendredi 10 octobre 2025"),
      l("", "Préparation du stage en tutelle\n- Présentation et validation des outils de rapportage\n- Communication des objectifs et des consignes de travail aux élèves-maîtres", "32 h", "01 semaine", "Du lundi 13 au vendredi 17 octobre 2025"),
      l("", "1re partie du stage en tutelle", "48 h", "01 semaine 02 jours", "Du lundi 20 au vendredi 28 octobre 2025"),
      b("Du mardi 28 octobre après les cours, au dimanche 02 novembre 2025 inclus : congés de Toussaint", "conges"),
      l("", "- 1re partie du stage en tutelle\n- Bilan et régulation (fin de la 1re partie du stage)", "224 h", "07 semaines", "Du lundi 03 novembre au vendredi 19 décembre 2025"),
      b("Du vendredi 19 décembre 2025 au dimanche 04 janvier 2026 inclus : congés de Noël", "conges"),
      l("", "2e partie du stage en tutelle", "160 h", "05 semaines", "Du lundi 05 janvier au vendredi 06 février 2026"),
      b("Fin de la 1re période", "jalon"),
      l("", "2e partie du stage en tutelle (suite)", "48 h", "01 semaine, 02 jours", "Du lundi 09 au mardi 17 février 2026"),
      b("Du mardi 17 au dimanche 22 février 2026 inclus : congés de février", "conges"),
      l("", "2e partie du stage en tutelle (suite et fin)", "96 h", "03 semaines", "Du lundi 23 février au vendredi 13 mars 2026"),
      l("", "Exploitation du stage", "32 h", "01 semaine", "Du lundi 16 au vendredi 20 mars 2026"),
      l("4", "- Pré-test\n- Éducation à la santé", "32 h", "01 semaine", "Du lundi 23 au vendredi 27 mars 2026"),
      l("", "- Régulation\n- Renforcement", "16 h", "02 jours", "Du lundi 30 au mardi 31 mars 2026"),
      b("Du mardi 31 mars au dimanche 12 avril 2026 inclus : congés de Pâques", "conges"),
      l("", "Préparation de la 3e partie du stage en tutelle", "32 h", "01 semaine", "Du lundi 13 au vendredi 17 avril 2026"),
      l("", "3e partie du stage en tutelle", "256 h", "08 semaines", "Du lundi 20 avril au vendredi 12 juin 2026"),
      l("", "Exploitation du stage\nRemédiations / Révisions générales", "32 h", "01 semaine", "Du lundi 15 au vendredi 19 juin 2026"),
      l("", "Évaluation commune N°2 :\nDIAS blanc + Correction + remédiations", "32 h", "01 semaine", "Du lundi 22 au vendredi 26 juin 2026"),
      l("", "Révisions générales\nExamen du DIAS (oral et écrit) : voir calendrier DECO", "64 h", "02 semaines", "Du lundi 29 juin au vendredi 10 juillet 2026"),
      b("Du mercredi 15 juillet au dimanche 06 septembre 2026 : GRANDES VACANCES", "jalon"),
    ],
  },
  // ── Plan 3e année ──
  {
    niveau: 3,
    titre: "Plan de formation 3e année de CAFOP 2025-2026",
    intro:
      "Les élèves-maîtres de troisième année sont mis en responsabilité de classe dans les écoles préscolaires et primaires publiques des 41 Directions Régionales de l'Éducation Nationale et de l'Alphabétisation (DRENA) pour leur formation pratique.\nÀ cet effet, ils bénéficient d'un encadrement pédagogique du CAFOP de leur bassin pédagogique.\nChaque CAFOP organise deux (02) regroupements de formation en collaboration avec l'APFC et les IEPP.\nLe plan de formation ci-dessous précise les modalités de cet encadrement.",
    colonnes: ["N°", "Activités d'encadrement", "Durée", "Période d'exécution"],
    lignes: [
      l("1", "Missions de visite des sites de regroupements par l'équipe de direction\n- Repérer les sites de regroupement ;\n- Apprêter les sites de regroupement", "02 semaines", "Du lundi 06 au vendredi 17 octobre 2025"),
      l("2", "Recueil des besoins de formation des élèves-maîtres par les Conseillers Pédagogiques du Préscolaire et du Primaire (CPPP)", "08 semaines", "Du lundi 08 septembre au vendredi 31 octobre 2025"),
      l("3", "Dépôt des bulletins de visite au CAFOP", "01 semaine", "Du lundi 03 au vendredi 07 novembre 2025"),
      l("4", "- Analyse des besoins et traitement des difficultés recensées par l'équipe d'encadreurs ;\n- Confection de support de remédiation par l'équipe d'encadreurs (Professeurs de CAFOP, IPC).", "02 semaines", "Du lundi 10 au vendredi 21 novembre 2025"),
      l("5", "Exécution du 1er regroupement\n- Remédiations ;\n- Mise à disposition des supports de remédiation aux élèves-maîtres.", "01 semaine", "Du lundi 08 au vendredi 12 décembre 2025"),
      l("6", "Production des rapports de mission sous la responsabilité des IPC, chefs de mission.\nDépôt des rapports de mission au CAFOP et à l'APFC", "02 jours", "Du lundi 15 au mardi 16 décembre 2025"),
      l("7", "Atelier bilan des missions d'encadrement au CAFOP (Professeurs de CAFOP, IPC)", "02 jours", "Du mercredi 17 au jeudi 18 décembre 2025"),
      l("8", "Recueil des besoins de formation des élèves-maîtres par les Conseillers Pédagogiques du Préscolaire et du Primaire (CPPP)", "02 semaines", "Du lundi 05 au vendredi 16 janvier 2026"),
      l("9", "Dépôt des bulletins de visite au CAFOP", "02 jours", "Du lundi 19 au mardi 20 janvier 2026"),
      l("10", "- Analyse des besoins et traitement des difficultés recensées par l'équipe d'encadreurs ;\n- Confection de support de remédiation par l'équipe d'encadreurs (Professeurs de CAFOP, IPC).", "02 semaines", "À compléter"),
      l("11", "Exécution du 2e regroupement\n- Remédiations ;\n- Mise à disposition des supports de remédiation aux élèves-maîtres.", "01 semaine", "À compléter"),
      l("12", "Production des rapports de mission sous la responsabilité des IPC, chefs de mission.\nDépôt des rapports de mission au CAFOP et à l'APFC", "02 jours", "Du lundi 09 au mardi 10 février 2026"),
      l("13", "Atelier bilan des missions d'encadrement au CAFOP (Professeurs de CAFOP, IPC)", "02 jours", "Du mercredi 11 au jeudi 12 février 2026"),
      l("14", "EXAMEN DU CEAP", "", "Voir DECO"),
    ],
  },
];

const INTRO =
  "La formation initiale des maîtres s'appuie désormais sur douze (12) modules, tous adossés aux douze (12) compétences du référentiel métier de l'instituteur ivoirien.\n" +
  "Cette formation vise à développer des compétences professionnelles en lien avec le métier et met l'accent sur l'alternance entre la théorie et la pratique à travers les activités d'apprentissage suivantes : l'enseignement des contenus théoriques des modules ; les activités pratiques de mise en application ; le stage d'observation ou de découverte de l'environnement professionnel ; le stage en tutelle ou stage opérationnel ; le stage en responsabilité, essentiel à la validation du diplôme de fin de formation.\n" +
  "La conduite des activités d'apprentissage se fait à travers deux modalités : la formation en présentiel ; la formation en ligne à travers des plateformes (CAFOP en ligne, projet école numérique et autres).";

async function main() {
  const existant = await prisma.planFormation.findUnique({
    where: { pays_anneeScolaire: { pays: PAYS, anneeScolaire: ANNEE } },
    select: { id: true },
  });
  if (existant) {
    await prisma.planFormation.delete({ where: { id: existant.id } }); // cascade sections + lignes
  }

  await prisma.planFormation.create({
    data: {
      pays: PAYS,
      anneeScolaire: ANNEE,
      titre: "Plan de formation — Formation Initiale des Maîtres",
      intro: INTRO,
      signataireNom: "ZAMBLÉ",
      signatairePrenoms: "Bi Zamblé Germain",
      signataireFonction: "Le Directeur des Écoles, Lycées et Collèges (DELC)",
      sections: {
        create: SECTIONS.map((s, si) => ({
          ordre: si,
          niveau: s.niveau,
          titre: s.titre,
          intro: s.intro ?? null,
          note: s.note ?? null,
          colonnes: s.colonnes,
          lignes: {
            create: s.lignes.map((ln, li) => ({
              ordre: li,
              type: ln.type ?? "donnee",
              cellules: ln.cellules ?? [],
              texte: ln.texte ?? null,
              ton: ln.ton ?? null,
            })),
          },
        })),
      },
    },
  });

  const nbLignes = SECTIONS.reduce((n, s) => n + s.lignes.length, 0);
  console.log(`✔ Plan de formation ${PAYS} ${ANNEE} : ${SECTIONS.length} sections, ${nbLignes} lignes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
