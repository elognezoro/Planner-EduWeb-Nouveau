/**
 * Données du programme DHFC-EBiS (MENA · DPFC · AUF · AFD) pour EduWeb Planner.
 * Source : « Syllabus de formation DHFC-EBiS » (14 syllabus) + « Module maître interactif
 * — Analyse des besoins » (Dr Elogne ZORO, 2023-2026).
 *
 * Le seed (prisma/seed-dhfc.ts) transforme ces données en cours + quiz + devoirs,
 * regroupés en 4 parcours (par population) avec badges.
 */

export type QuestionData = {
  enonce: string;
  type: "choix_unique" | "choix_multiple" | "vrai_faux" | "association";
  explication?: string;
  choix: { texte: string; correct?: boolean; apparie?: string }[];
};

export type Syllabus = {
  code: string;
  slug: string;
  titre: string;
  population: "EBiS" | "EP" | "CA" | "CE";
  publicCible: string;
  besoins: string[];
  prerequis: string;
  duree: string;
  modalite: string;
  objectifGeneral: string;
  objectifs: string[];
  contenus: string[];
  activites: string[];
  evalModalites: string;
  evalCriteres: string;
  badge: string;
  quiz: QuestionData[];
  devoir: string;
};

export const POPULATIONS: Record<Syllabus["population"], { categorie: string; parcoursTitre: string; parcoursSlug: string; badge: string; badgeDesc: string }> = {
  EBiS: { categorie: "DHFC-EBiS · Enseignants bivalents", parcoursTitre: "DHFC-EBiS · Parcours Enseignant bivalent de sciences", parcoursSlug: "dhfc-parcours-ebis", badge: "Enseignant bivalent outillé", badgeDesc: "Décerné à l'achèvement du parcours des enseignants bivalents de sciences." },
  EP: { categorie: "DHFC-EBiS · Encadreurs pédagogiques", parcoursTitre: "DHFC-EBiS · Parcours Encadreur pédagogique", parcoursSlug: "dhfc-parcours-ep", badge: "Encadreur numérique", badgeDesc: "Décerné à l'achèvement du parcours des encadreurs pédagogiques." },
  CA: { categorie: "DHFC-EBiS · Chefs d'APFC", parcoursTitre: "DHFC-EBiS · Parcours Chef d'APFC", parcoursSlug: "dhfc-parcours-ca", badge: "Pilote d'APFC", badgeDesc: "Décerné à l'achèvement du parcours des chefs d'APFC." },
  CE: { categorie: "DHFC-EBiS · Chefs d'établissement", parcoursTitre: "DHFC-EBiS · Parcours Chef d'établissement", parcoursSlug: "dhfc-parcours-ce", badge: "Pilote de proximité", badgeDesc: "Décerné à l'achèvement du parcours du chef d'établissement." },
};

const vf = (bonne: "Vrai" | "Faux"): QuestionData["choix"] => [
  { texte: "Vrai", correct: bonne === "Vrai" },
  { texte: "Faux", correct: bonne === "Faux" },
];

export const SYLLABI: Syllabus[] = [
  {
    code: "EBiS-01", slug: "dhfc-ebis-01", titre: "Pédagogie et planification de l'enseignement", population: "EBiS",
    publicCible: "Enseignants bivalents (Maths-TICE, PC-SVT) des collèges de proximité.",
    besoins: ["Exploitation des programmes et guides d'exécution (écart +18,86 ; 1ᵉʳ)", "Renforcement des connaissances disciplinaires (+12,99)", "Choix des méthodes et stratégies d'enseignement (+9,61)", "Préparation d'un cours (« Très fort » 15,12 % — n°1 EBiS et EP)", "Gestion et maîtrise du temps d'enseignement", "Utilisation du manuel scolaire"],
    prerequis: "Être en poste comme EBiS ; disposer des programmes officiels et guides d'exécution de ses disciplines.",
    duree: "24 h (10 h présentiel + 14 h distanciel autoportant)",
    modalite: "Hybride : capsules vidéo + lecture guidée en distanciel, ateliers de préparation de cours en présentiel.",
    objectifGeneral: "Planifier et conduire une séquence d'enseignement conforme aux programmes et à l'APC, en optimisant la gestion du temps didactique.",
    objectifs: ["Identifier les composantes d'un programme éducatif et d'un guide d'exécution (se rappeler).", "Expliquer l'articulation entre compétences, objectifs et contenus dans l'APC (comprendre).", "Élaborer une fiche de préparation de cours complète et minutée (appliquer).", "Choisir des méthodes et stratégies adaptées à l'objectif et au profil de la classe (analyser).", "Concevoir une séquence de 2 à 3 séances exploitant le manuel scolaire (créer)."],
    contenus: ["Structure des programmes et guides d'exécution ; lecture d'un référentiel de compétences", "De la PPO à l'APC : logique et implications pour la planification", "Anatomie d'une fiche de préparation : objectifs, prérequis, matériel, déroulement, traces", "Méthodes et stratégies (expositive, active, coopérative, résolution de problème) et critères de choix", "Gestion et minutage du temps ; place et exploitation du manuel scolaire"],
    activites: ["Capsule vidéo : « Lire un guide d'exécution » + quiz d'auto-positionnement", "Atelier présentiel : rédaction et co-évaluation d'une fiche de préparation", "Étude de cas : choisir la stratégie pour une leçon donnée", "Forum en ligne : partage de fiches entre pairs tuteurs"],
    evalModalites: "Production d'une fiche de préparation notée sur grille critériée + QCM en ligne (seuil 70 %).",
    evalCriteres: "Fiche conforme au programme, objectifs formulés selon Bloom, minutage réaliste, stratégie justifiée.",
    badge: "Concepteur de séquence",
    quiz: [
      { enonce: "Dans une fiche de préparation, les objectifs pédagogiques doivent être formulés selon…", type: "choix_unique", explication: "La taxonomie de Bloom hiérarchise les objectifs (se rappeler → créer).", choix: [{ texte: "la taxonomie de Bloom", correct: true }, { texte: "l'ordre alphabétique", }, { texte: "le nombre d'élèves", }, { texte: "la durée de la récréation", }] },
      { enonce: "Le document officiel qui précise la progression et l'exploitation des contenus est…", type: "choix_unique", choix: [{ texte: "le guide d'exécution", correct: true }, { texte: "le règlement intérieur", }, { texte: "le carnet de correspondance", }] },
      { enonce: "L'approche par compétences (APC) articule compétences, objectifs et contenus.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez une fiche de préparation de cours complète et minutée pour une leçon de votre discipline : objectifs (formulés selon Bloom), prérequis, matériel, déroulement, traces écrites et stratégie justifiée.",
  },
  {
    code: "EBiS-02", slug: "dhfc-ebis-02", titre: "Gestion de la classe en effectifs pléthoriques", population: "EBiS",
    publicCible: "Enseignants bivalents exerçant en classes à grands effectifs (51 à 80 élèves, voire +100).",
    besoins: ["Gestion de la trace écrite (31,49 %)", "Posture physique et voix (30,96 %)", "Gestion et maintien de la discipline (30,78 %)", "Gestion des documents administratifs (27,05 %)", "Pédagogie inclusive et différenciée (20,45 % — avis EP)"],
    prerequis: "Avoir la charge effective d'au moins une classe.",
    duree: "20 h (8 h présentiel + 12 h distanciel)",
    modalite: "Hybride : mises en situation filmées, micro-enseignement en présentiel, capsules et grilles en ligne.",
    objectifGeneral: "Maintenir un climat de classe propice à l'apprentissage et gérer efficacement une classe à grand effectif, dans une visée inclusive.",
    objectifs: ["Décrire les principes d'une posture professionnelle (voix, corps, déplacement) (comprendre).", "Appliquer des techniques de gestion de la discipline et de la trace écrite en grand groupe (appliquer).", "Différencier les tâches pour intégrer l'hétérogénéité des apprenants (analyser).", "Tenir à jour les documents administratifs de classe (cahier de textes, notes, appels) (appliquer).", "Évaluer et réguler son propre climat de classe à partir d'une grille (évaluer)."],
    contenus: ["Posture, voix et occupation spatio-temporelle de la classe", "Techniques de gestion de la discipline et des transitions en grand groupe", "Trace écrite efficace : structuration, lisibilité, gain de temps", "Pédagogie inclusive et différenciée : dyslexie, dyscalculie, rythmes", "Documents administratifs : rôle, tenue et conformité"],
    activites: ["Capsule : « Poser sa voix et occuper l'espace »", "Micro-enseignement présentiel avec feedback vidéo", "Atelier : concevoir une trace écrite pour une leçon dense", "Grille d'auto-observation du climat de classe (distanciel)"],
    evalModalites: "Séquence de micro-enseignement évaluée par les pairs + dépôt d'un plan de gestion de classe.",
    evalCriteres: "Posture maîtrisée, consignes claires, trace écrite structurée, dispositif de différenciation présent.",
    badge: "Climat de classe",
    quiz: [
      { enonce: "Une posture professionnelle en grand groupe mobilise principalement…", type: "choix_unique", choix: [{ texte: "la voix, le corps et le déplacement", correct: true }, { texte: "uniquement le tableau", }, { texte: "le silence permanent de l'enseignant", }] },
      { enonce: "La pédagogie différenciée aide à prendre en compte l'hétérogénéité des apprenants.", type: "vrai_faux", choix: vf("Vrai") },
      { enonce: "Quels documents administratifs de classe l'enseignant tient-il à jour ? (plusieurs réponses)", type: "choix_multiple", choix: [{ texte: "Le cahier de textes", correct: true }, { texte: "Le registre d'appel", correct: true }, { texte: "Le relevé de notes", correct: true }, { texte: "Le journal télévisé", }] },
    ],
    devoir: "Déposez un plan de gestion d'une classe à grand effectif : organisation de l'espace et de la trace écrite, règles de discipline, transitions, et dispositif de différenciation pour au moins deux profils d'élèves.",
  },
  {
    code: "EBiS-03", slug: "dhfc-ebis-03", titre: "Évaluation des apprentissages", population: "EBiS",
    publicCible: "Enseignants bivalents chargés de l'évaluation en collège.",
    besoins: ["Corrections et comptes rendus de devoirs (37,19 % ; EP 30,28 %)", "Conception de la situation d'évaluation (34,70 % ; EP 28,41 %)", "Format des examens à grand tirage — BEPC (37,54 %)"],
    prerequis: "Avoir suivi ou suivre en parallèle le syllabus EBiS-01 (planification).",
    duree: "20 h (8 h présentiel + 12 h distanciel)",
    modalite: "Hybride : conception guidée en ligne, ateliers de calibrage et de correction en présentiel.",
    objectifGeneral: "Concevoir des situations d'évaluation valides et exploiter les productions des élèves pour réguler les apprentissages.",
    objectifs: ["Distinguer évaluation diagnostique, formative et sommative (comprendre).", "Concevoir une situation d'évaluation alignée sur les objectifs et l'APC (créer).", "Élaborer un barème et une grille de correction critériée (appliquer).", "Rédiger un compte rendu de devoir orienté remédiation (créer).", "Analyser le format des épreuves du BEPC pour préparer les élèves (analyser)."],
    contenus: ["Fonctions et types d'évaluation ; validité et fiabilité", "Conception d'une situation d'évaluation (contexte, consignes, critères)", "Barèmes, grilles critériées et harmonisation", "Corrections et comptes rendus : de la note à la remédiation", "Format et exigences des examens à grand tirage (BEPC)"],
    activites: ["Atelier : concevoir une situation d'évaluation par discipline", "Capsule : « Construire une grille critériée »", "Exercice en ligne : analyser des sujets BEPC", "Simulation de correction croisée et harmonisation"],
    evalModalites: "Dossier d'évaluation (situation + barème + compte rendu type) noté sur grille.",
    evalCriteres: "Situation alignée sur les objectifs, barème cohérent, compte rendu proposant une remédiation.",
    badge: "Évaluateur",
    quiz: [
      { enonce: "Reliez chaque type d'évaluation à sa fonction principale.", type: "association", choix: [{ texte: "Diagnostique", apparie: "Situer les acquis avant d'enseigner", correct: true }, { texte: "Formative", apparie: "Réguler pendant l'apprentissage", correct: true }, { texte: "Sommative", apparie: "Certifier les acquis en fin de séquence", correct: true }] },
      { enonce: "Un compte rendu de devoir efficace se limite à donner la note.", type: "vrai_faux", explication: "Il doit orienter la remédiation, au-delà de la note.", choix: vf("Faux") },
      { enonce: "Une grille de correction critériée sert à…", type: "choix_unique", choix: [{ texte: "harmoniser et objectiver la correction", correct: true }, { texte: "accélérer l'appel", }, { texte: "remplacer le programme", }] },
    ],
    devoir: "Déposez un dossier d'évaluation pour une leçon : une situation d'évaluation alignée sur les objectifs, son barème, une grille critériée et un compte rendu type orienté remédiation.",
  },
  {
    code: "EBiS-04", slug: "dhfc-ebis-04", titre: "Renforcement disciplinaire et didactique des sciences", population: "EBiS",
    publicCible: "Enseignants bivalents PC-SVT et Maths-TICE, en priorité les titulaires de BAC+2 à Licence.",
    besoins: ["Renforcement des connaissances disciplinaires (chute mesurée compétence initiale → aisance)", "Didactique de leçons ciblées explicitement demandées", "Corrélation du vécu avec les apprentissages ; activités expérimentales"],
    prerequis: "Enseigner effectivement la ou les disciplines concernées.",
    duree: "30 h (12 h présentiel + 18 h distanciel), déclinable par discipline",
    modalite: "Hybride : capsules disciplinaires par leçon, laboratoires (réels ou simulés) en présentiel/regroupement.",
    objectifGeneral: "Renforcer la maîtrise disciplinaire et didactique sur les leçons réputées difficiles, en reliant les concepts au vécu des élèves.",
    objectifs: ["Se réapproprier les contenus scientifiques des leçons ciblées (se rappeler/comprendre).", "Analyser les obstacles didactiques propres à chaque leçon (analyser).", "Concevoir une transposition didactique reliant le concept au vécu (créer).", "Mettre en œuvre une activité expérimentale, réelle ou simulée (appliquer).", "Évaluer la compréhension conceptuelle des élèves (évaluer)."],
    contenus: ["Leçons ciblées SVT : croissance chez les insectes (5ᵉ), dégradation des roches endogènes (4ᵉ), caractéristiques des sols, relations sol-plante, digestion des aliments (3ᵉ), reproduction des oiseaux (6ᵉ)", "Leçons ciblées PC : phases de la lune et éclipses (4ᵉ), atome et ion (4ᵉ/3ᵉ)", "Obstacles didactiques et conceptions initiales des élèves", "Démarche d'investigation et activités expérimentales", "Corrélation vécu-apprentissage et exemples de proximité"],
    activites: ["Capsules « une leçon, un obstacle » par thème", "Atelier laboratoire (matériel réel ou simulation numérique)", "Conception d'une fiche didactique reliant concept et vécu", "Analyse de productions d'élèves"],
    evalModalites: "Fiche didactique d'une leçon ciblée + mise en œuvre d'une activité expérimentale (présentiel ou vidéo).",
    evalCriteres: "Exactitude scientifique, prise en compte des conceptions initiales, activité expérimentale opérationnelle.",
    badge: "Didacticien des sciences",
    quiz: [
      { enonce: "La démarche d'investigation en sciences part généralement…", type: "choix_unique", choix: [{ texte: "d'un questionnement ou d'un problème", correct: true }, { texte: "de la note finale", }, { texte: "de la liste d'appel", }] },
      { enonce: "Prendre en compte les conceptions initiales des élèves aide à lever les obstacles didactiques.", type: "vrai_faux", choix: vf("Vrai") },
      { enonce: "En l'absence de laboratoire, une activité expérimentale peut être…", type: "choix_unique", choix: [{ texte: "simulée numériquement", correct: true }, { texte: "purement théorique et jamais réalisée", }, { texte: "remplacée par une dictée", }] },
    ],
    devoir: "Déposez une fiche didactique pour une leçon ciblée de votre discipline : contenu scientifique exact, obstacles et conceptions initiales, transposition reliant le concept au vécu, et une activité expérimentale (réelle ou simulée).",
  },
  {
    code: "EBiS-05", slug: "dhfc-ebis-05", titre: "Intégration des TICE et simulation d'expériences", population: "EBiS",
    publicCible: "Enseignants bivalents, en particulier ceux de la bivalence Maths-TICE.",
    besoins: ["Renforcement de l'aisance en TICE (32,88 % « aucune » aisance)", "Bureautique appliquée (traitement de texte, tableur/Excel)", "Simulation numérique d'activités expérimentales (à défaut de laboratoire)"],
    prerequis: "Accès occasionnel à un ordinateur/smartphone ; aucune expertise préalable requise.",
    duree: "26 h (10 h présentiel/regroupement + 16 h distanciel)",
    modalite: "Hybride avec ressources téléchargeables hors-ligne ; regroupements dans un établissement équipé (ex. Dimbokro).",
    objectifGeneral: "Intégrer les outils numériques dans sa pratique, y compris pour simuler des expériences scientifiques et produire des notes de TICE.",
    objectifs: ["Utiliser les fonctions de base de la bureautique (texte, tableur) (appliquer).", "Exploiter un logiciel/simulateur d'expériences scientifiques (appliquer).", "Concevoir une activité TICE évaluable pour les élèves (créer).", "Adapter l'usage des TICE aux contraintes de connectivité (analyser).", "Évaluer un travail d'élève réalisé avec un outil numérique (évaluer)."],
    contenus: ["Prise en main : traitement de texte et tableur (Excel) pour l'enseignant", "Ressources et simulateurs d'expériences (PhET-like, applications hors-ligne)", "Conception d'une séance TICE et d'une évaluation associée", "Stratégies « low-tech / hors-ligne » en zone peu connectée", "Sécurité, sobriété et bon usage du numérique"],
    activites: ["Tutoriels pas-à-pas téléchargeables", "Atelier : créer un tableur de suivi des notes", "TP simulé : reproduire une expérience via un simulateur", "Production d'une mini-séquence TICE"],
    evalModalites: "Réalisation d'un support numérique (tableur de notes OU séance de simulation) évalué sur grille.",
    evalCriteres: "Support fonctionnel, pertinence pédagogique, prise en compte de la contrainte de connectivité.",
    badge: "Enseignant augmenté",
    quiz: [
      { enonce: "Un tableur (ex. Excel) est particulièrement adapté pour…", type: "choix_unique", choix: [{ texte: "calculer et suivre les notes des élèves", correct: true }, { texte: "diffuser un film", }, { texte: "remplacer le tableau noir", }] },
      { enonce: "Un simulateur numérique permet de reproduire une expérience à défaut de laboratoire.", type: "vrai_faux", choix: vf("Vrai") },
      { enonce: "En zone à faible connectivité, on privilégie…", type: "choix_unique", choix: [{ texte: "des ressources téléchargeables hors-ligne", correct: true }, { texte: "uniquement le streaming en ligne", }, { texte: "l'abandon des TICE", }] },
    ],
    devoir: "Déposez un support numérique fonctionnel : soit un tableur de suivi des notes (avec formules), soit une séance de simulation d'expérience, en tenant compte de la contrainte de connectivité de votre établissement.",
  },
  {
    code: "EBiS-06", slug: "dhfc-ebis-06", titre: "Maîtrise linguistique pour une pratique didactique efficace", population: "EBiS",
    publicCible: "Enseignants bivalents ; transférable à l'accompagnement linguistique des élèves.",
    besoins: ["Renforcement en français, langue d'enseignement (33,53 % F+TF pour l'EBiS)", "Qualité de formulation des concepts pour la compréhension des élèves"],
    prerequis: "Aucun.",
    duree: "18 h (6 h présentiel + 12 h distanciel)",
    modalite: "Hybride : capsules de langue, exercices auto-correctifs en ligne, ateliers d'oral en présentiel.",
    objectifGeneral: "Améliorer la maîtrise du français pour formuler clairement les concepts scientifiques et soutenir la compréhension des élèves.",
    objectifs: ["Corriger les principales erreurs de langue à l'écrit et à l'oral (appliquer).", "Reformuler un concept scientifique en langage clair et correct (créer).", "Analyser un énoncé pour en lever les ambiguïtés (analyser).", "Produire des consignes précises et sans équivoque (créer)."],
    contenus: ["Règles de fonctionnement de la langue (grammaire, syntaxe utiles à l'enseignant)", "Lexique scientifique et vulgarisation", "Rédaction de consignes et d'énoncés non ambigus", "Communication orale : clarté, articulation, reformulation"],
    activites: ["Exercices auto-correctifs en ligne", "Atelier d'oralisation et de reformulation", "Analyse critique de consignes d'évaluation"],
    evalModalites: "Réécriture d'un jeu de consignes/énoncés + court exposé oral évalué.",
    evalCriteres: "Langue correcte, consignes claires, concepts reformulés de façon accessible.",
    badge: "Communication claire",
    quiz: [
      { enonce: "Une consigne d'évaluation efficace doit être…", type: "choix_unique", choix: [{ texte: "précise et sans ambiguïté", correct: true }, { texte: "la plus longue possible", }, { texte: "rédigée en langage familier", }] },
      { enonce: "Reformuler un concept en langage clair soutient la compréhension des élèves.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez la réécriture d'un jeu de trois consignes ou énoncés de votre discipline, en corrigeant la langue et en levant les ambiguïtés, puis expliquez brièvement chaque amélioration.",
  },
  {
    code: "EBiS-07", slug: "dhfc-ebis-07", titre: "Compétences de vie (Life skills)", population: "EBiS",
    publicCible: "Enseignants bivalents ; certains modules transférables aux élèves via des clubs.",
    besoins: ["Entrepreneuriat (48,93 %)", "Éducation financière (42,17 %)", "Développement durable (41,10 %) & protection de l'environnement (38,26 %)", "Intelligence émotionnelle (41,10 %)", "Éthique et déontologie du métier (39,32 %)", "Diction et prise de parole en public (35,05 %)"],
    prerequis: "Aucun ; modules capitalisables indépendamment.",
    duree: "24 h modulaires (6 modules de 4 h ; 8 h présentiel + 16 h distanciel)",
    modalite: "Hybride, à la carte : capsules courtes, défis en ligne, ateliers présentiels.",
    objectifGeneral: "Développer des compétences sociales et professionnelles transférables à la pratique enseignante et à la vie de l'établissement.",
    objectifs: ["Expliquer les principes de gestion financière personnelle et d'entrepreneuriat (comprendre).", "Appliquer des techniques de régulation émotionnelle et de prise de parole (appliquer).", "Analyser une situation au regard de l'éthique et de la déontologie enseignante (analyser).", "Concevoir une action d'éducation au développement durable pour sa classe/son club (créer)."],
    contenus: ["Entrepreneuriat et posture de projet", "Éducation financière : budget, épargne, gestion", "Développement durable et protection de l'environnement à l'école", "Intelligence émotionnelle et gestion du stress", "Éthique et déontologie du métier d'enseignant", "Diction et prise de parole en public"],
    activites: ["Capsules courtes par thème + défis hebdomadaires", "Atelier « pitch » et prise de parole", "Étude de cas éthiques", "Projet « club vert » ou « club sciences »"],
    evalModalites: "Réalisation d'un projet applicatif au choix (action DD, plan financier, prise de parole filmée).",
    evalCriteres: "Projet concret, faisable et transférable au contexte de l'établissement.",
    badge: "Compétences de vie",
    quiz: [
      { enonce: "L'éducation financière personnelle repose notamment sur…", type: "choix_unique", choix: [{ texte: "le budget, l'épargne et la gestion", correct: true }, { texte: "les dépenses sans suivi", }, { texte: "l'absence de planification", }] },
      { enonce: "Un « club vert » relève d'une action d'éducation au développement durable.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un projet applicatif au choix (action de développement durable, plan d'éducation financière, ou prise de parole filmée) réalisable dans votre établissement, en précisant objectifs, étapes et transférabilité.",
  },
  {
    code: "EP-01", slug: "dhfc-ep-01", titre: "Culture numérique éducative (priorité)", population: "EP",
    publicCible: "Encadreurs pédagogiques des APFC.",
    besoins: ["Animation de classe virtuelle (52,27 % ; 100 % chefs d'APFC)", "Tutorat en ligne (51,14 % ; 83,33 %)", "Réalisation de ressources multimédia (46,59 % ; 100 %)", "Conception de ressources pédagogiques numériques (31,82 % ; 100 %)", "Animation d'une communauté d'apprentissage via les réseaux sociaux (44,32 %)"],
    prerequis: "Aucun prérequis avancé ; équipement numérique de base.",
    duree: "30 h (10 h présentiel + 20 h distanciel)",
    modalite: "Hybride, largement en ligne, pour incarner les pratiques enseignées.",
    objectifGeneral: "Concevoir, animer et tutorer des dispositifs de formation à distance pour accompagner les EBiS.",
    objectifs: ["Concevoir des ressources pédagogiques numériques et multimédia (créer).", "Animer une classe virtuelle et un webinaire (appliquer).", "Assurer un tutorat en ligne et un suivi à distance des enseignants (appliquer).", "Animer une communauté d'apprentissage en ligne (créer).", "Évaluer la qualité d'une ressource ou d'une animation à distance (évaluer)."],
    contenus: ["Conception de ressources : capsules vidéo, infographies, quiz", "Outils de classe virtuelle et de webinaire", "Scénarisation et animation d'un tutorat en ligne", "Communautés d'apprentissage et réseaux sociaux éducatifs", "Netiquette, droits d'usage et accessibilité"],
    activites: ["Production d'une capsule vidéo pédagogique", "Animation simulée d'une classe virtuelle", "Mise en place d'un espace communautaire en ligne"],
    evalModalites: "Portfolio numérique : une ressource multimédia + une animation de classe virtuelle enregistrée.",
    evalCriteres: "Ressource exploitable, animation interactive, tutorat structuré.",
    badge: "e-Tuteur",
    quiz: [
      { enonce: "Le tutorat en ligne des enseignants suppose surtout…", type: "choix_unique", choix: [{ texte: "un suivi et un accompagnement à distance structurés", correct: true }, { texte: "l'envoi d'une seule note en fin d'année", }, { texte: "aucune interaction", }] },
      { enonce: "La netiquette et le respect des droits d'usage font partie de la culture numérique.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un mini-portfolio numérique : une ressource multimédia (capsule ou infographie) que vous avez conçue, accompagnée du scénario d'une animation de classe virtuelle.",
  },
  {
    code: "EP-02", slug: "dhfc-ep-02", titre: "Animation pédagogique", population: "EP",
    publicCible: "Encadreurs pédagogiques des APFC.",
    besoins: ["Conduite d'activités de remédiation des évaluations (20,45 % ; 66,67 % chefs)", "Atelier de formation (18,18 % ; 66,67 %)", "Conduite d'un entretien post-visite (66,67 % chefs)", "Formation aux formats et outils d'évaluation (13,64 %)", "Classe ouverte et visite de classe (13,64 %)"],
    prerequis: "Exercer une fonction d'encadrement.",
    duree: "24 h (12 h présentiel + 12 h distanciel)",
    modalite: "Hybride : apports en ligne, mises en situation d'encadrement en présentiel.",
    objectifGeneral: "Concevoir et conduire des dispositifs d'animation pédagogique qui font progresser les enseignants.",
    objectifs: ["Planifier et animer un atelier de formation (créer).", "Conduire un entretien post-visite constructif (appliquer).", "Concevoir une activité de remédiation à partir de résultats d'évaluation (créer).", "Organiser une classe ouverte et en exploiter les observations (appliquer).", "Évaluer l'impact d'une action d'animation (évaluer)."],
    contenus: ["Ingénierie d'un atelier de formation", "Observation de classe et entretien post-visite", "Analyse des évaluations et conception de remédiations", "Classe ouverte : préparation, conduite, débriefing", "Restitution et dissémination des formations reçues"],
    activites: ["Simulation d'un entretien post-visite", "Conception d'un atelier de formation", "Analyse d'un jeu de copies pour bâtir une remédiation"],
    evalModalites: "Scénario d'atelier + jeu de rôle d'entretien post-visite évalués sur grille.",
    evalCriteres: "Atelier structuré, entretien bienveillant et orienté progrès, remédiation ciblée.",
    badge: "Animateur",
    quiz: [
      { enonce: "Un entretien post-visite constructif est avant tout…", type: "choix_unique", choix: [{ texte: "bienveillant et orienté vers le progrès", correct: true }, { texte: "un simple jugement de sanction", }, { texte: "une formalité sans suite", }] },
      { enonce: "Une remédiation se conçoit à partir de l'analyse des résultats d'évaluation.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez le scénario d'un atelier de formation destiné à des EBiS (objectifs, déroulé, supports) et la trame d'un entretien post-visite constructif.",
  },
  {
    code: "EP-03", slug: "dhfc-ep-03", titre: "Posture et leadership d'accompagnement", population: "EP",
    publicCible: "Encadreurs pédagogiques des APFC.",
    besoins: ["Accompagnement (66,67 % chefs)", "Constitution et animation d'une communauté d'apprentissage (50 %)", "Adaptation du type de leadership selon le contexte", "Relationnel et communication"],
    prerequis: "Aucun.",
    duree: "18 h (8 h présentiel + 10 h distanciel)",
    modalite: "Hybride : apports théoriques en ligne, ateliers relationnels en présentiel.",
    objectifGeneral: "Adopter une posture d'accompagnement et un leadership adaptés pour soutenir le développement professionnel des enseignants.",
    objectifs: ["Distinguer les styles de leadership et leurs contextes d'usage (comprendre).", "Appliquer les techniques d'écoute active et de feedback (appliquer).", "Animer une communauté d'apprentissage entre pairs (créer).", "Adapter sa posture à la maturité professionnelle de l'enseignant (analyser)."],
    contenus: ["Styles de leadership et leadership situationnel", "Posture d'accompagnement : écoute active, questionnement, feedback", "Constitution et animation d'une communauté d'apprentissage", "Communication interpersonnelle et gestion des tensions"],
    activites: ["Auto-diagnostic de son style de leadership", "Jeux de rôle d'accompagnement", "Lancement d'une communauté d'apprentissage locale"],
    evalModalites: "Plan d'accompagnement d'un enseignant + mise en situation d'entretien.",
    evalCriteres: "Posture d'écoute, feedback constructif, adaptation au contexte.",
    badge: "Accompagnateur",
    quiz: [
      { enonce: "Le leadership situationnel consiste à…", type: "choix_unique", choix: [{ texte: "adapter son style au contexte et à la maturité de l'enseignant", correct: true }, { texte: "appliquer toujours le même style", }, { texte: "éviter tout accompagnement", }] },
      { enonce: "L'écoute active et le feedback sont au cœur de la posture d'accompagnement.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un plan d'accompagnement d'un enseignant : diagnostic de départ, objectifs de progrès, modalités d'écoute et de feedback, et jalons de suivi adaptés à son contexte.",
  },
  {
    code: "EP-04", slug: "dhfc-ep-04", titre: "Langue de travail : discours et rédaction administrative", population: "EP",
    publicCible: "Encadreurs pédagogiques des APFC.",
    besoins: ["Discours (36,33 % ; 83,34 % chefs)", "Rédaction administrative — comptes rendus, PV de réunion (27,70 % ; 83,33 %)"],
    prerequis: "Aucun.",
    duree: "16 h (6 h présentiel + 10 h distanciel)",
    modalite: "Hybride : modèles et exercices en ligne, ateliers d'écriture en présentiel.",
    objectifGeneral: "Produire des écrits professionnels normés et tenir un discours clair dans l'exercice de la fonction d'encadrement.",
    objectifs: ["Rédiger un compte rendu de mission et un PV de réunion conformes (appliquer).", "Structurer un discours ou une intervention professionnelle (créer).", "Analyser et corriger un écrit administratif (analyser/évaluer)."],
    contenus: ["Genres administratifs : compte rendu, rapport, PV, note", "Normes de rédaction et registre professionnel", "Construction et prise de parole d'un discours"],
    activites: ["Modèles annotés à réutiliser", "Atelier de rédaction et de relecture croisée", "Exercice de prise de parole"],
    evalModalites: "Dossier : un compte rendu de mission + un PV de réunion évalués sur grille.",
    evalCriteres: "Écrits conformes, clairs, structurés ; discours cohérent.",
    badge: "Rédacteur pro",
    quiz: [
      { enonce: "Un PV de réunion relève des genres…", type: "choix_unique", choix: [{ texte: "administratifs", correct: true }, { texte: "poétiques", }, { texte: "publicitaires", }] },
      { enonce: "Un écrit administratif professionnel doit être clair, conforme et structuré.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un dossier de deux écrits professionnels : un compte rendu de mission et un procès-verbal de réunion, conformes aux normes de rédaction administrative.",
  },
  {
    code: "CA-01", slug: "dhfc-ca-01", titre: "Culture numérique de pilotage", population: "CA",
    publicCible: "Chefs d'Antenne de la Pédagogie et de la Formation Continue (APFC).",
    besoins: ["Conception et réalisation de ressources numériques (100 % « Très fort »)", "Animation de classe virtuelle (100 %)", "Tutorat et gestion/suivi à distance des enseignants (83,33 %)", "Enseignement via plateforme et animation de communauté (66,67 %)"],
    prerequis: "Aucun prérequis avancé.",
    duree: "22 h (8 h présentiel + 14 h distanciel)",
    modalite: "Hybride, majoritairement en ligne.",
    objectifGeneral: "Piloter à distance l'activité des encadreurs et le déploiement des ressources numériques de formation.",
    objectifs: ["Superviser la production de ressources numériques (évaluer).", "Animer et modérer des espaces de formation en ligne (appliquer).", "Assurer le suivi à distance des équipes d'encadrement (appliquer).", "Piloter des indicateurs d'usage de la plateforme (analyser)."],
    contenus: ["Écosystème numérique éducatif et rôle du chef d'APFC", "Supervision de la production de ressources", "Animation et modération de communautés", "Suivi à distance et tableaux de bord d'usage"],
    activites: ["Étude de tableaux de bord d'activité", "Mise en place d'un espace de pilotage en ligne", "Revue de ressources produites par les EP"],
    evalModalites: "Plan de pilotage numérique de l'APFC + revue critique de ressources.",
    evalCriteres: "Plan opérationnel, indicateurs pertinents, supervision effective.",
    badge: "Pilote numérique",
    quiz: [
      { enonce: "Piloter l'usage de la plateforme suppose de suivre…", type: "choix_unique", choix: [{ texte: "des indicateurs d'usage (tableaux de bord)", correct: true }, { texte: "uniquement la météo", }, { texte: "aucune donnée", }] },
      { enonce: "Le chef d'APFC supervise la production de ressources numériques des encadreurs.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un plan de pilotage numérique de votre APFC : objectifs, indicateurs d'usage à suivre, modalités de supervision de la production de ressources et de suivi à distance des encadreurs.",
  },
  {
    code: "CA-02", slug: "dhfc-ca-02", titre: "Gestion optimale des ressources (Systèmes éducatifs)", population: "CA",
    publicCible: "Chefs d'APFC.",
    besoins: ["Gestion de la ressource humaine (100 %)", "Gestion de la ressource financière (100 %)", "Gestion des ressources matérielles / équipements (83,33 %)", "Gestion des ressources intangibles / compétences (66,67 %)"],
    prerequis: "Exercer une fonction de responsabilité (APFC).",
    duree: "24 h (10 h présentiel + 14 h distanciel)",
    modalite: "Hybride : études de cas de gestion, apports en ligne.",
    objectifGeneral: "Optimiser la gestion des ressources humaines, financières, matérielles et immatérielles d'une antenne de formation.",
    objectifs: ["Expliquer les principes de gestion des systèmes éducatifs (comprendre).", "Élaborer un plan de gestion des ressources humaines de l'APFC (créer).", "Construire et suivre un budget d'activité (appliquer).", "Analyser et prioriser les besoins en équipements (analyser).", "Évaluer le capital de compétences et planifier son développement (évaluer)."],
    contenus: ["Introduction à la gestion des systèmes éducatifs (GSE)", "Gestion des ressources humaines et animation d'équipe", "Gestion financière et budgétaire", "Gestion du parc matériel et des équipements", "Gestion des compétences (ressources intangibles)"],
    activites: ["Étude de cas budgétaire", "Élaboration d'un plan RH d'antenne", "Cartographie des compétences de l'équipe"],
    evalModalites: "Plan de gestion des ressources de l'APFC (RH + budget + équipements).",
    evalCriteres: "Plan réaliste, cohérent avec les moyens, priorisation justifiée.",
    badge: "Gestionnaire",
    quiz: [
      { enonce: "La GSE désigne…", type: "choix_unique", choix: [{ texte: "la Gestion des Systèmes Éducatifs", correct: true }, { texte: "la Grille Scolaire d'Évaluation", }, { texte: "le Guide des Sciences Expérimentales", }] },
      { enonce: "Un budget d'activité se construit puis se suit dans le temps.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un plan de gestion des ressources de votre APFC couvrant les ressources humaines, un budget d'activité et une priorisation des besoins en équipements.",
  },
  {
    code: "CE-01", slug: "dhfc-ce-01", titre: "Pilotage pédagogique de proximité et accompagnement des EBiS", population: "CE",
    publicCible: "Chefs d'établissement des collèges de proximité.",
    besoins: ["Accompagnement de l'intégration des TICE des EBiS (48,08 %)", "Supervision pédagogique et de l'évaluation (48,08 % / 42,31 %)", "Appui à la gestion des classes à grands effectifs (40,39 %)"],
    prerequis: "Diriger un collège de proximité accueillant des EBiS.",
    duree: "16 h (8 h présentiel + 8 h distanciel)",
    modalite: "Hybride : apports en ligne, ateliers de pilotage en présentiel/regroupement.",
    objectifGeneral: "Créer les conditions institutionnelles favorables à l'intégration des TICE, à une pédagogie et une évaluation de qualité, et à la gestion des grands effectifs.",
    objectifs: ["Identifier les leviers de soutien à l'intégration des TICE dans l'établissement (comprendre).", "Organiser la supervision pédagogique interne (appliquer).", "Analyser les résultats d'évaluation pour piloter la remédiation (analyser).", "Concevoir un plan d'appui à la gestion des classes pléthoriques (créer)."],
    contenus: ["Rôle du chef d'établissement dans l'intégration du numérique", "Supervision pédagogique et accompagnement des enseignants", "Exploitation des résultats d'évaluation au niveau établissement", "Organisation face aux effectifs pléthoriques"],
    activites: ["Diagnostic TICE de l'établissement", "Plan de supervision pédagogique", "Tableau de bord des résultats d'évaluation"],
    evalModalites: "Plan d'amélioration de l'établissement (volets TICE, pédagogie, évaluation, effectifs).",
    evalCriteres: "Plan réaliste, priorisé, assorti d'indicateurs de suivi.",
    badge: "Pilote de proximité",
    quiz: [
      { enonce: "Le chef d'établissement pilote la remédiation en s'appuyant sur…", type: "choix_unique", choix: [{ texte: "l'analyse des résultats d'évaluation", correct: true }, { texte: "le hasard", }, { texte: "la seule ancienneté des enseignants", }] },
      { enonce: "Le chef d'établissement est un levier de l'intégration des TICE dans son collège.", type: "vrai_faux", choix: vf("Vrai") },
    ],
    devoir: "Déposez un plan d'amélioration de votre établissement couvrant quatre volets — TICE, pédagogie, évaluation et gestion des grands effectifs — priorisé et assorti d'indicateurs de suivi.",
  },
];

// ── Module maître (analyse des besoins) ─────────────────────

export const MODULE_MAITRE = {
  slug: "dhfc-module-maitre",
  titre: "DHFC-EBiS · Module maître — Analyse des besoins de formation",
  description: "Rapport d'analyse des besoins de formation du programme DHFC-EBiS (Dr Elogne ZORO) : contexte, critères objectifs, besoins par population et synthèse. Se conclut par un quiz de maîtrise.",
  categorie: "DHFC-EBiS · Analyse des besoins",
  lecons: [
    { titre: "Accueil & guide de lecture", contenu: "## Analyse des besoins de formation — DHFC-EBiS\n\nCe module restitue l'**Analyse des besoins de formation** des bénéficiaires du programme DHFC-EBiS (Dr Elogne ZORO). Il n'énumère pas les préférences : il applique des **critères objectifs** pour distinguer les besoins réellement pertinents, population par population.\n\n**Périmètre de l'enquête** : 562 enseignants bivalents, 88 encadreurs, 6 chefs d'APFC, 52 chefs d'établissement, 6 DRENA — 4 populations croisées par triangulation, 5 critères objectifs, 7 domaines de compétences.\n\n**Repère de lecture** : un besoin est *réel* lorsque la somme « Fort + Très fort » (F+TF) l'emporte sur le « Moyen » (M) et le refus." },
    { titre: "Chapitre 1 — Contexte & démarche", contenu: "## Le dispositif DHFC-EBiS\n\nLe **Dispositif Hybride de Formation Continue des Enseignants Bivalents de Sciences** est un programme pilote de 4 ans, financé par un prêt souverain de l'**AFD**, coordonné par la **DPFC** du **MENA** avec l'assistance à maîtrise d'ouvrage de l'**AUF**. Il opérationnalise la Stratégie nationale de formation continue et la réforme des collèges de proximité (2023).\n\n**Cible** : les enseignants bivalents (Maths-TICE et PC-SVT) des collèges de proximité, souvent en zones rurales enclavées. Modalité **hybride** (présentiel + distanciel).\n\n**Un terrain qui pèse sur les besoins** : 67,67 % des classes comptent 51 à 80 élèves ; 32,88 % des EBiS n'ont « aucune » aisance en TICE ; électricité, eau, réseau et internet manquent dans de nombreux collèges. Ces contraintes filtrent ce qui est réellement *formable*." },
    { titre: "Chapitre 2 — Cinq critères objectifs", contenu: "## Séparer le besoin réel de la simple préférence\n\n- **C1 · Prépondérance statistique** — (Fort + Très fort) − Moyen > 0 ⇒ besoin réel ; classement par écart décroissant.\n- **C2 · Convergence inter-acteurs** — besoin confirmé par au moins deux des quatre populations (triangulation).\n- **C3 · Écart de compétence objectivé** — baisse mesurable entre compétence initiale et aisance à enseigner.\n- **C4 · Faisabilité contextuelle** — compatible avec effectifs pléthoriques, faible connectivité, absence de laboratoire ; certains « besoins » relèvent de l'équipement, pas de la formation.\n- **C5 · Alignement stratégique** — soutien aux cadres nationaux (RFIM, stratégie de formation continue, réforme des collèges, décret bivalence)." },
    { titre: "Chapitre 3 — Les besoins des enseignants bivalents", contenu: "## Sept domaines analysés\n\nPédagogie, gestion de classe, évaluation, compétences de vie, langue d'enseignement, renforcement disciplinaire/didactique, TICE.\n\n- **Pédagogie** : en tête, l'exploitation des programmes et guides ; « Préparation d'un cours » est le n°1 des « Très fort » (15,12 %).\n- **Gestion de classe** : trace écrite, posture/voix, discipline, documents administratifs — dans un contexte d'effectifs pléthoriques.\n- **Évaluation** : corrections et comptes rendus (37,19 %), conception de situations (34,70 %), format BEPC.\n- **Renforcement didactique** (critère 3, objectivé) : l'aisance à enseigner chute par rapport à la compétence initiale ; des leçons précises sont nommées.\n- **TICE** : 32,88 % sans aisance ; bureautique et simulation d'expériences.\n- **Langue** : français langue d'enseignement (33,53 %).\n- **Life skills** : entrepreneuriat, éducation financière, éthique, etc." },
    { titre: "Chapitre 4 & 5 — Encadreurs et chefs d'APFC", contenu: "## Encadreurs pédagogiques (EP)\n\nBesoins propres dominés par la **culture numérique éducative** (classe virtuelle 52,27 %, tutorat en ligne 51,14 %, ressources multimédia 46,59 %), l'**animation pédagogique**, la **posture & le leadership** et la **langue de travail** (discours 36,33 %, rédaction administrative 27,70 %).\n\n## Chefs d'APFC\n\nDeux priorités éclatantes : la **culture numérique de pilotage** (100 % « Très fort » pour trois modules) et la **gestion optimale des ressources — GSE** (RH et finances à 100 %), alignée sur le Master GSE (AUF / Université Senghor)." },
    { titre: "Chapitre 6 & 7 — Chefs d'établissement et synthèse", contenu: "## Le regard des chefs d'établissement\n\nTémoins quotidiens, ils confirment la hiérarchie : **TICE (48,08 %)**, **pédagogie (48,08 %)**, **évaluation (42,31 %)**, **gestion des classes (40,39 %)**. Cette concordance à trois voix (EBiS, EP, chefs) donne aux besoins **TICE, évaluation et gestion de classe** le plus haut niveau de robustesse.\n\n## Synthèse\n\nLes cinq critères retiennent les besoins réels et écartent, en toute transparence, les besoins non fondés (ex. « choix du matériel didactique », requalifié en besoin d'**équipement**). **Recommandations** : privilégier le distanciel, garder les présentiels courts, s'appuyer sur des tuteurs pairs, **gamifier** (badges, certificats) et prévoir une récurrence — principes qui cadrent l'implémentation sur EduWeb Planner." },
  ],
  quiz: [
    { enonce: "Selon le critère C1, un besoin est « réel » lorsque…", type: "choix_unique", explication: "C1 : (Fort + Très fort) − Moyen > 0.", choix: [{ texte: "« Fort + Très fort » l'emporte sur « Moyen »", correct: true }, { texte: "un seul enquêté le cite", }, { texte: "il coûte le moins cher", }] },
    { enonce: "La triangulation (critère C2) consiste à…", type: "choix_unique", choix: [{ texte: "confirmer un besoin par au moins deux populations", correct: true }, { texte: "poser trois fois la même question", }, { texte: "trianguler une salle de classe", }] },
    { enonce: "Que signifie le sigle DHFC-EBiS ?", type: "choix_unique", choix: [{ texte: "Dispositif Hybride de Formation Continue des Enseignants Bivalents de Sciences", correct: true }, { texte: "Direction des Hautes Formations Continues", }, { texte: "Diplôme Hybride de Formation des Chefs", }] },
    { enonce: "Le critère C3 objective un besoin en mesurant…", type: "choix_unique", explication: "C3 : la baisse entre compétence initiale et aisance à enseigner.", choix: [{ texte: "la chute entre compétence initiale et aisance à enseigner", correct: true }, { texte: "le nombre d'élèves par classe", }, { texte: "la distance domicile-école", }] },
    { enonce: "Le « choix du matériel didactique » a été…", type: "choix_unique", explication: "Requalifié en besoin d'équipement (critère C4), pas de formation.", choix: [{ texte: "requalifié en besoin d'équipement", correct: true }, { texte: "retenu comme besoin n°1", }, { texte: "transformé en examen", }] },
    { enonce: "Trois domaines obtiennent la plus haute robustesse (concordance EBiS + EP + chefs). Lesquels ? (plusieurs réponses)", type: "choix_multiple", choix: [{ texte: "TICE", correct: true }, { texte: "Évaluation des apprentissages", correct: true }, { texte: "Gestion de classe", correct: true }, { texte: "Choix du matériel didactique", }] },
    { enonce: "Parmi les recommandations de mise en œuvre figure la gamification (badges, certificats).", type: "vrai_faux", choix: vf("Vrai") },
    { enonce: "Reliez chaque sigle à sa signification.", type: "association", choix: [{ texte: "APFC", apparie: "Antenne de la Pédagogie et de la Formation Continue", correct: true }, { texte: "DPFC", apparie: "Direction de la Pédagogie et de la Formation Continue", correct: true }, { texte: "GSE", apparie: "Gestion des Systèmes Éducatifs", correct: true }, { texte: "APC", apparie: "Approche Par Compétences", correct: true }] },
  ] as QuestionData[],
};
