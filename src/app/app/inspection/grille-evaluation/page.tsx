import type { Metadata } from "next";
import { ListChecks, UserRound, FileSignature } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/app/ui";

export const metadata: Metadata = { title: "Grille d'évaluation" };
export const dynamic = "force-dynamic";

/*
 * Référentiel structuré d'après le document officiel du MENA (Côte d'Ivoire) :
 * « GRILLE DE SUPERVISION DES PROFESSEURS DU SECONDAIRE » (Antenne de la Pédagogie et de la
 * Formation Continue). Les intitulés des compétences, items, critères et indicateurs sont
 * repris à l'identique du document source.
 */

const ECHELLE = [
  { code: "TS", libelle: "Très satisfaisant" },
  { code: "S", libelle: "Satisfaisant" },
  { code: "P", libelle: "Passable" },
  { code: "I", libelle: "Insuffisant" },
];

/** Champs du volet « I - Identification de l'enseignant.e » du document officiel. */
const IDENTIFICATION: { groupe: string; champs: string[] }[] = [
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

interface ItemGrille {
  numero: string;
  enonce: string;
  critere: string;
  indicateurs: string[];
}

const COMPETENCES: { numero: number; titre: string; items: ItemGrille[] }[] = [
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
const SYNTHESE = [
  { titre: "Points forts", detail: "Constats positifs relevés au cours de la séance observée." },
  { titre: "Points à améliorer", detail: "Insuffisances et difficultés relevées au cours de la séance." },
  {
    titre: "Propositions d'amélioration du (de la) superviseur.e",
    detail: "Conseils et pistes de remédiation formulés à l'issue de la supervision.",
  },
];

export default async function GrilleEvaluationPage() {
  await requireRole(["admin", "inspecteur", "adjoint_chef_etablissement"]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Grille d'évaluation"
        description="Grille de supervision des professeurs du secondaire — référentiel officiel des visites (Antenne de la Pédagogie et de la Formation Continue)."
      />

      {/* Échelle d'appréciation officielle (consigne de la grille). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <ListChecks size={18} /> Échelle d&apos;appréciation
        </h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {ECHELLE.map((e) => (
            <div key={e.code} className="rounded-xl border border-cream-200 bg-cream-50/50 p-3 text-center">
              <p className="font-display text-xl font-bold text-forest-800">{e.code}</p>
              <p className="text-xs text-ink-700/65">{e.libelle}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-700/55">
          Consigne : indiquez votre appréciation pour chacun des énoncés de la grille en cochant la case
          appropriée. L&apos;appréciation globale /20 est saisie dans le compte-rendu de chaque visite
          (Inspection → Visites), avec les recommandations associées.
        </p>
      </Card>

      {/* I - Identification de l'enseignant.e (volet d'en-tête de la grille officielle). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <UserRound size={18} /> I — Identification de l&apos;enseignant.e
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {IDENTIFICATION.map((g) => (
            <div key={g.groupe}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700/55">{g.groupe}</p>
              <ul className="space-y-1.5">
                {g.champs.map((c) => (
                  <li key={c} className="rounded-lg border border-cream-200 bg-cream-50/40 px-3 py-1.5 text-sm text-ink-900">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {/* Les 4 compétences de la grille officielle : items, critères et indicateurs à apprécier. */}
      {COMPETENCES.map((comp) => (
        <Card key={comp.numero}>
          <h2 className="mb-3 font-display text-base font-bold text-forest-900">
            {comp.numero} — {comp.titre}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-cream-50 text-left text-xs uppercase tracking-wide text-forest-800">
                  <th className="border border-cream-200 p-2 font-semibold">Élément d&apos;appréciation</th>
                  <th className="border border-cream-200 p-2 font-semibold">Critère</th>
                  <th className="border border-cream-200 p-2 font-semibold">Indicateurs</th>
                  {ECHELLE.map((e) => (
                    <th key={e.code} title={e.libelle} className="w-10 border border-cream-200 p-2 text-center font-semibold">
                      {e.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comp.items.map((item) =>
                  item.indicateurs.map((indicateur, i) => (
                    <tr key={`${item.numero}-${i}`} className="align-top">
                      {i === 0 && (
                        <td rowSpan={item.indicateurs.length} className="border border-cream-200 p-2 text-ink-900">
                          <span className="font-semibold text-forest-900">{item.numero}</span> {item.enonce}
                        </td>
                      )}
                      {i === 0 && (
                        <td rowSpan={item.indicateurs.length} className="border border-cream-200 p-2 text-ink-700/80">
                          {item.critere}
                        </td>
                      )}
                      <td className="border border-cream-200 p-2 text-ink-900">{indicateur}</td>
                      {ECHELLE.map((e) => (
                        <td key={e.code} className="border border-cream-200 p-2 text-center text-ink-700/30">
                          <span className="inline-block h-4 w-4 rounded border border-cream-300 bg-white align-middle" aria-hidden />
                        </td>
                      ))}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Rubriques de synthèse et signatures (fin de la grille officielle). */}
      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-forest-900">
          <FileSignature size={18} /> Synthèse de la supervision
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SYNTHESE.map((s) => (
            <div key={s.titre} className="rounded-xl border border-cream-200 bg-cream-50/40 p-3">
              <p className="text-sm font-semibold text-forest-900">{s.titre}</p>
              <p className="mt-1 text-xs text-ink-700/65">{s.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-700/55">
          La grille officielle se conclut par la date et le lieu (« Fait à …, le … »), puis les noms,
          prénoms et signatures de l&apos;enseignant.e et du (de la) superviseur.e.
        </p>
      </Card>
    </div>
  );
}
