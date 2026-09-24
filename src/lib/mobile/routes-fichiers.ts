/**
 * ROUTES QUI PRODUISENT UN FICHIER (ou un document à imprimer), et non une page.
 *
 * Ce sont les gestionnaires de route (`route.ts`) de l'espace connecté : un lien vers eux
 * déclenche un téléchargement (ou ouvre un document) SANS changer de page. Le suivi de
 * navigation du téléphone ne doit donc pas afficher de zones grisées pour eux — elles
 * resteraient affichées indéfiniment, faute de nouvelle page.
 *
 * À TENIR À JOUR : tout nouveau `src/app/app/**\/route.ts` doit figurer ici
 * (commande de contrôle : find src/app/app -name route.ts).
 */
const MOTIFS = [
  "/app/aide-formation/cours/[slug]/livret/pdf",
  "/app/aide-formation/cours/[slug]/livret/word",
  "/app/aide-formation/inscriptions/imprimer",
  "/app/aide-formation/inscriptions/telecharger",
  "/app/aide-formation/manuel/apercu",
  "/app/aide-formation/manuel/word",
  "/app/inspection/rapports-antennes/rapport-word",
  "/app/inspection/rapports-disciplinaires/rapport-word",
  "/app/systeme/etablissements/[id]/emploi-du-temps/export-zip",
  "/app/systeme/etablissements/[id]/enseignants/modele",
  "/app/systeme/etablissements/[id]/export",
  "/app/systeme/etablissements/[id]/rapport-word",
  "/app/systeme/etablissements/reseau/rapport-sedec",
  "/app/systeme/etablissements/reseau/rapport-senec",
  "/app/systeme/journal-activite/export",
];

const EXPRESSIONS = MOTIFS.map(
  (m) => new RegExp("^" + m.replace(/[.*+?^${}()|\]/g, "\$&").replace(/\\[[^\]]+\\]|\[[^\]]+\]/g, "[^/]+") + "/?$"),
);

export function estRouteFichier(chemin: string): boolean {
  return EXPRESSIONS.some((e) => e.test(chemin));
}
