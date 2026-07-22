/*
 * Référentiel structuré d'après le document officiel du MENA (Côte d'Ivoire) :
 * « GRILLE DE SUPERVISION DES PROFESSEURS DU SECONDAIRE » (Antenne de la Pédagogie et de la
 * Formation Continue). Les intitulés des compétences, items, critères et indicateurs sont
 * repris à l'identique du document source.
 *
 * Module PUR (données + types + helpers, aucune dépendance serveur) : importable aussi bien
 * par les pages serveur (référentiel, fiche imprimable) que par les composants client
 * (formulaire de saisie de la grille depuis une visite).
 */

/** Code d'appréciation de l'échelle officielle : Très satisfaisant / Satisfaisant / Passable / Insuffisant. */
export type CodeAppreciation = "TS" | "S" | "P" | "I";

/** Les 4 codes de l'échelle, dans l'ordre des colonnes de la grille officielle. */
export const CODES_APPRECIATION: readonly CodeAppreciation[] = ["TS", "S", "P", "I"];

export const ECHELLE: { code: CodeAppreciation; libelle: string }[] = [
  { code: "TS", libelle: "Très satisfaisant" },
  { code: "S", libelle: "Satisfaisant" },
  { code: "P", libelle: "Passable" },
  { code: "I", libelle: "Insuffisant" },
];

/** Champs du volet « I - Identification de l'enseignant.e » du document officiel. */
export const IDENTIFICATION: { groupe: string; champs: string[] }[] = [
  {
    groupe: "Enseignant.e",
    champs: [
      "DRENA / DDENA",
      "Nom et prénom.s",
      "Matricule",
      "Établissement",
      "Emploi : P.L / P.C / Bivalent.e",
      "1ère prise (date)",
      "Discipline enseignée",
      "Contact",
      "E-mail",
      "Volume horaire hebdomadaire",
      "Classe.s tenue.s",
      "Autre responsabilité",
    ],
  },
  {
    groupe: "Séance observée",
    champs: [
      "Date de la visite",
      "Classe",
      "Effectif — Filles (présentes) / Garçons (présents)",
      "Nature de la séance",
      "Titre",
      "Durée",
    ],
  },
];

export interface ItemGrille {
  numero: string;
  enonce: string;
  critere: string;
  indicateurs: string[];
}

export interface CompetenceGrille {
  numero: number;
  titre: string;
  items: ItemGrille[];
}

export const COMPETENCES: CompetenceGrille[] = [
  {
    numero: 1,
    titre: "Compétence liée au contenu et à la didactique de la discipline",
    items: [
      {
        numero: "1.1",
        enonce: "Le contenu enseigné est conforme au programme disciplinaire.",
        critere: "Concordance entre la leçon/séance et le programme éducatif prescrit",
        indicateurs: [
          "La leçon/séance existe dans le programme éducatif.",
          "Les habiletés visées au cours de la leçon/séance correspondent à celles décrites dans le programme éducatif prescrit.",
        ],
      },
      {
        numero: "1.2",
        enonce: "L'enseignant.e exécute la progression en vigueur dans la discipline.",
        critere: "Respect de la hiérarchisation des contenus prévue dans le programme",
        indicateurs: [
          "Toutes les leçons/séances antérieures à la leçon/séance du jour sont exécutées.",
          "La leçon/séance du jour est un prérequis à celle à venir.",
        ],
      },
      {
        numero: "1.3",
        enonce: "L'enseignant.e maîtrise le contenu académique enseigné.",
        critere: "Justesse du contenu enseigné",
        indicateurs: [
          "Aucune erreur n'est observée dans les savoirs dispensés par l'enseignant.e.",
          "Les erreurs commises par les élèves sont corrigées par l'enseignant.e.",
        ],
      },
      {
        numero: "1.4",
        enonce: "L'enseignant.e respecte la démarche de la discipline.",
        critere: "Conformité des processus didactiques et méthodologiques à la démarche de la discipline",
        indicateurs: [
          "Les moments didactiques spécifiques à l'enseignement de la discipline sont respectés.",
          "Les activités proposées par l'enseignant.e durant la leçon respectent la démarche de la discipline.",
        ],
      },
      {
        numero: "1.5",
        enonce: "L'enseignant.e a effectivement installé les habiletés visées.",
        critere: "Efficacité des activités d'application sur la réussite",
        indicateurs: [
          "L'enseignant.e administre aux élèves une ou des activités d'application relatives aux habiletés visées.",
          "L'enseignant.e enregistre un taux de réussite de 80 % de ses élèves aux activités d'application-fixation.",
        ],
      },
      {
        numero: "1.6",
        enonce: "L'enseignant.e utilise un matériel didactique approprié, incluant les TICE.",
        critere: "Pertinence du choix des supports didactiques et matériels par rapport à la discipline",
        indicateurs: [
          "Les choix des supports didactiques (feuilles, tableaux, documents, textes, manuel agréé, etc.) sont pertinents par rapport à la discipline.",
          "Le choix éventuel d'outils en TICE (vidéoprojecteur, logiciels adaptés, etc.) est pertinent par rapport à la discipline.",
        ],
      },
      {
        numero: "1.7",
        enonce: "L'enseignant.e a exécuté un plan de leçon/séance cohérent.",
        critere: "Structuration et agencement judicieux des étapes de la leçon/séance",
        indicateurs: [
          "Les étapes de la leçon/séance sont bien agencées.",
          "L'enseignant.e enregistre un taux de réussite de 80 % de ses élèves aux activités d'application-fixation.",
        ],
      },
    ],
  },
  {
    numero: 2,
    titre:
      "Compétence liée aux méthodes et aptitudes pédagogiques de l'enseignant.e dans la gestion de sa classe",
    items: [
      {
        numero: "2.1",
        enonce:
          "L'enseignant.e utilise la méthode active en veillant à faire participer autant les garçons, les filles, les élèves timides que les personnes à besoins spécifiques.",
        critere: "Emploi des méthodes actives et intégratrices",
        indicateurs: [
          "Des activités de découvertes sont utilisées.",
          "Le travail individuel et de groupe est promu en tenant compte du Genre et Inclusion Sociale (GIS).",
        ],
      },
      {
        numero: "2.2",
        enonce:
          "L'enseignant.e utilise des consignes et des questions claires au cours du processus enseignement / apprentissage / évaluation.",
        critere: "Qualité du questionnement de l'enseignant.e",
        indicateurs: [
          "Des consignes claires, précises et appropriées sont utilisées.",
          "Un questionnement varié et adapté est utilisé pour faire progresser le cours.",
        ],
      },
      {
        numero: "2.3",
        enonce: "L'enseignant.e effectue une évaluation en conformité avec les habiletés installées.",
        critere: "Qualité et conformité des évaluations au regard des habiletés visées",
        indicateurs: [
          "Les exercices administrés sont en congruence avec les habiletés visées.",
          "Le format des évaluations est respecté.",
        ],
      },
      {
        numero: "2.4",
        enonce:
          "L'enseignant.e apprécie et renforce de manière pertinente les réponses des filles, des garçons et des élèves à besoins spécifiques.",
        critere: "Équité et justesse des rétroactions faites aux élèves",
        indicateurs: [
          "Les réactions de l'enseignant.e aux réponses de tous les élèves sont encourageantes et motivantes.",
          "Les réponses des élèves sont exploitées pour les aider à mieux apprendre.",
        ],
      },
      {
        numero: "2.5",
        enonce: "L'enseignant.e gère rationnellement le temps imparti à la séance.",
        critere: "Gestion efficace du temps",
        indicateurs: [
          "Le temps imparti à chaque moment didactique est respecté.",
          "Toutes les activités sont exécutées dans le temps imparti.",
        ],
      },
      {
        numero: "2.6",
        enonce: "L'enseignant.e se déplace dans toute la classe tout en étant attentif.ve pendant la séance.",
        critere: "Mobilité spatiale de l'enseignant.e en classe",
        indicateurs: [
          "L'enseignant.e a une mobilité dans la classe pour s'assurer que tous les élèves suivent le cours.",
          "L'enseignant.e adopte une mobilité dans la classe pour vérifier ses propres traces écrites.",
        ],
      },
      {
        numero: "2.7",
        enonce:
          "L'enseignant.e utilise une expression orale et/ou une gestuelle et les stratégies qui facilitent les apprentissages.",
        critere: "Accessibilité communicationnelle multiforme",
        indicateurs: [
          "Le langage et la gestuelle de l'enseignant.e sont corrects et adaptés à la classe.",
          "Les techniques d'animation utilisées sont variées et favorables aux apprentissages.",
        ],
      },
      {
        numero: "2.8",
        enonce:
          "L'enseignant.e vérifie les traces écrites / productions dans le cahier des élèves au cours de la séance.",
        critere: "Régulation des apprentissages",
        indicateurs: [
          "La prise de notes ou les productions des élèves sont contrôlées par l'enseignant.e.",
          "Les notes prises par les élèves sont corrigées.",
        ],
      },
      {
        numero: "2.9",
        enonce:
          "L'enseignant.e utilise convenablement le matériel didactique et pédagogique, incluant les TICE et le tableau, en veillant à la prise en compte des garçons, des filles, des élèves timides et des personnes à besoins spécifiques.",
        critere: "Aptitude à se servir d'une variété de matériel didactique et pédagogique",
        indicateurs: [
          "L'utilisation du matériel didactique (manuels, TICE, etc.) et pédagogique est bien maîtrisée tout en tenant compte du GIS.",
          "L'usage du tableau est correct.",
        ],
      },
    ],
  },
  {
    numero: 3,
    titre: "Compétence liée à la tenue des documents pédagogiques et administratifs",
    items: [
      {
        numero: "3.1",
        enonce: "L'enseignant.e remplit régulièrement et correctement les colonnes du cahier de textes.",
        critere: "Soins et mise à jour du cahier de textes",
        indicateurs: [
          "Toutes les colonnes du cahier de textes sont correctement et soigneusement renseignées.",
          "Les ruptures de cours (missions, grèves, autorisations, etc.) sont indiquées.",
        ],
      },
      {
        numero: "3.2",
        enonce: "L'enseignant.e renseigne régulièrement le cahier d'appel.",
        critere: "Soins et mise à jour du cahier d'appel",
        indicateurs: [
          "Les absences et retards des élèves sont notés dans le cahier d'appel.",
          "La signature de l'enseignant.e est mentionnée dans le cahier d'appel.",
        ],
      },
      {
        numero: "3.3",
        enonce: "Le/La stagiaire renseigne régulièrement le registre de notes.",
        critere: "Soins et mise à jour du registre de notes",
        indicateurs: [
          "La nature des évaluations et de l'échelle est indiquée.",
          "Les moyennes et rangs sont indiqués par trimestre dans le cahier de notes.",
        ],
      },
    ],
  },
  {
    numero: 4,
    titre: "Compétence liée à l'éthique et à la déontologie du métier du (ou de la) stagiaire",
    items: [
      {
        numero: "4.1",
        enonce: "L'enseignant.e s'habille correctement.",
        critere: "Tenue vestimentaire",
        indicateurs: [
          "L'enseignant.e porte une tenue vestimentaire propre, décente et appropriée.",
          "L'enseignant.e porte une tenue qui respecte le caractère laïc de l'école.",
        ],
      },
      {
        numero: "4.2",
        enonce: "L'enseignant.e s'assure que la classe est propre.",
        critere: "Salubrité de la classe",
        indicateurs: [
          "L'enseignant.e a veillé à la salubrité de la classe ou du terrain (salle balayée, table-bancs bien disposés).",
          "L'enseignant.e a veillé à ce que le tableau soit nettoyé ou que le terrain soit sécurisé.",
        ],
      },
      {
        numero: "4.3",
        enonce: "L'enseignant.e a le sens du respect de la hiérarchie.",
        critere: "Qualités morales",
        indicateurs: [
          "L'enseignant.e respecte l'intégrité physique des élèves.",
          "L'enseignant.e tient un langage courtois.",
        ],
      },
      {
        numero: "4.4",
        enonce: "L'enseignant.e est ponctuel.le.",
        critere: "Ponctualité",
        indicateurs: [
          "L'enseignant.e arrive en classe à l'heure.",
          "L'enseignant.e débute le cours à l'heure indiquée.",
        ],
      },
      {
        numero: "4.5",
        enonce: "L'enseignant.e est assidu.e.",
        critere: "Assiduité",
        indicateurs: [
          "L'enseignant.e est régulièrement présent.e au poste.",
          "L'enseignant.e est régulièrement présent.e à l'école.",
        ],
      },
      {
        numero: "4.6",
        enonce:
          "L'enseignant.e entretient de bonnes relations avec tous les acteur.trice.s de la communauté éducative.",
        critere: "Qualité des relations interpersonnelles",
        indicateurs: [
          "L'enseignant.e participe aux activités pédagogiques.",
          "L'enseignant.e participe aux activités socioculturelles.",
        ],
      },
    ],
  },
];

/** Rubriques de synthèse figurant en fin de grille officielle. */
export const SYNTHESE = [
  { titre: "Points forts", detail: "Constats positifs relevés au cours de la séance observée." },
  { titre: "Points à améliorer", detail: "Insuffisances et difficultés relevées au cours de la séance." },
  {
    titre: "Propositions d'amélioration du (de la) superviseur.e",
    detail: "Conseils et pistes de remédiation formulés à l'issue de la supervision.",
  },
];

// ── Clés d'indicateurs & réponses (saisie en ligne de la grille) ──

const LETTRES_INDICATEUR = "abcdefghij";

/** Clé STABLE d'un indicateur de la grille : « 1.1-a », « 1.1-b »… (item + rang de l'indicateur). */
export function cleIndicateur(numeroItem: string, index: number): string {
  return `${numeroItem}-${LETTRES_INDICATEUR[index] ?? String(index)}`;
}

/** Les 50 clés d'indicateurs de la grille officielle (25 items × 2 indicateurs), dans l'ordre. */
export const TOUTES_CLES: readonly string[] = COMPETENCES.flatMap((comp) =>
  comp.items.flatMap((item) => item.indicateurs.map((_, i) => cleIndicateur(item.numero, i))),
);

/** Réponses saisies : clé d'indicateur → code d'appréciation coché (les non appréciés sont absents). */
export type ReponsesGrille = Record<string, CodeAppreciation>;

export function estCodeAppreciation(valeur: unknown): valeur is CodeAppreciation {
  return valeur === "TS" || valeur === "S" || valeur === "P" || valeur === "I";
}

/**
 * Relit les réponses d'une grille depuis un JSON NON FIABLE (base ou client) : seules les clés
 * du référentiel et les codes de l'échelle sont conservés — tout le reste est ignoré.
 */
export function lireReponsesGrille(json: unknown): ReponsesGrille {
  const reponses: ReponsesGrille = {};
  if (json == null || typeof json !== "object" || Array.isArray(json)) return reponses;
  const brut = json as Record<string, unknown>;
  for (const cle of TOUTES_CLES) {
    const valeur = brut[cle];
    if (estCodeAppreciation(valeur)) reponses[cle] = valeur;
  }
  return reponses;
}

/** Progression de la saisie : total d'indicateurs appréciés + répartition par code de l'échelle. */
export function compterReponses(reponses: ReponsesGrille): {
  total: number;
  parCode: Record<CodeAppreciation, number>;
} {
  const parCode: Record<CodeAppreciation, number> = { TS: 0, S: 0, P: 0, I: 0 };
  let total = 0;
  for (const cle of TOUTES_CLES) {
    const code = reponses[cle];
    if (code !== undefined && estCodeAppreciation(code)) {
      parCode[code] += 1;
      total += 1;
    }
  }
  return { total, parCode };
}

// ── Score global & profil par compétence (rapports d'inspection) ──

/** Barème de conversion d'un code d'appréciation de la grille en note sur 20. */
export const POINTS_PAR_CODE: Record<CodeAppreciation, number> = { TS: 20, S: 15, P: 10, I: 5 };

/**
 * Note /20 DÉRIVÉE de la grille : moyenne des indicateurs appréciés (TS=20, S=15, P=10, I=5),
 * arrondie au dixième — `null` si aucun indicateur n'est apprécié.
 */
export function noteDeriveeGrille(reponses: ReponsesGrille): number | null {
  let somme = 0;
  let nb = 0;
  for (const cle of TOUTES_CLES) {
    const code = reponses[cle];
    if (code !== undefined) {
      somme += POINTS_PAR_CODE[code];
      nb += 1;
    }
  }
  return nb === 0 ? null : Math.round((somme / nb) * 10) / 10;
}

/** Libellés COURTS des 4 compétences du référentiel (axes du radar « Profil d'évaluation »). */
const LIBELLES_COURTS_COMPETENCES: Record<number, string> = {
  1: "Contenu & didactique",
  2: "Méthodes & classe",
  3: "Documents",
  4: "Éthique",
};

/**
 * Score /20 par COMPÉTENCE du référentiel : moyenne (TS=20, S=15, P=10, I=5) des indicateurs
 * appréciés de SES items, arrondie au dixième — une compétence sans réponse vaut 0.
 */
export function scoresParCompetence(
  reponses: ReponsesGrille,
): { numero: number; libelleCourt: string; valeur: number }[] {
  return COMPETENCES.map((comp) => {
    let somme = 0;
    let nb = 0;
    for (const item of comp.items) {
      item.indicateurs.forEach((_, i) => {
        const code = reponses[cleIndicateur(item.numero, i)];
        if (code !== undefined) {
          somme += POINTS_PAR_CODE[code];
          nb += 1;
        }
      });
    }
    return {
      numero: comp.numero,
      libelleCourt: LIBELLES_COURTS_COMPETENCES[comp.numero] ?? comp.titre,
      valeur: nb === 0 ? 0 : Math.round((somme / nb) * 10) / 10,
    };
  });
}

/** Appréciation qualitative d'une note /20 (badge du score global du rapport). */
export function libelleAppreciation(note: number): {
  texte: string;
  ton: "vert" | "vert-clair" | "dore" | "rouge";
} {
  if (note >= 16) return { texte: "Très satisfaisant", ton: "vert" };
  if (note >= 12) return { texte: "Satisfaisant", ton: "vert-clair" };
  if (note >= 8) return { texte: "Passable", ton: "dore" };
  return { texte: "Insuffisant", ton: "rouge" };
}

// ── Volet « Séance observée » (champs non portés par le modèle Visite) ──

/** Champs libres du volet « séance observée » de la grille (stockés en JSON sur la grille). */
export interface SeanceObservee {
  nature: string;
  titre: string;
  duree: string;
  effectifFilles: string;
  effectifFillesPresentes: string;
  effectifGarcons: string;
  effectifGarconsPresents: string;
}

export const SEANCE_VIDE: SeanceObservee = {
  nature: "",
  titre: "",
  duree: "",
  effectifFilles: "",
  effectifFillesPresentes: "",
  effectifGarcons: "",
  effectifGarconsPresents: "",
};

/** Relit le volet « séance observée » depuis un JSON non fiable (chaînes uniquement, bornées). */
export function lireSeanceObservee(json: unknown): SeanceObservee {
  const seance = { ...SEANCE_VIDE };
  if (json == null || typeof json !== "object" || Array.isArray(json)) return seance;
  const brut = json as Record<string, unknown>;
  for (const champ of Object.keys(SEANCE_VIDE) as (keyof SeanceObservee)[]) {
    const valeur = brut[champ];
    if (typeof valeur === "string") seance[champ] = valeur.slice(0, 200);
  }
  return seance;
}
