import "server-only";
import { prisma } from "@/lib/prisma";
import { estPrimaireOuPrescolaire, deriveCategoriePedagogique } from "@/lib/referentiels/etablissement";
import { paysGrille } from "./pays-grille";

/**
 * AVANCEMENT DE CONFIGURATION d'un établissement, mesuré vers la GÉNÉRATION D'EMPLOI DU TEMPS
 * (page « Établissements en cours de configuration »).
 *
 * Six critères BINAIRES, calqués sur les prérequis RÉELS du solveur (gardes de
 * genererEmploiDuTemps + pré-vérifications du solveur), tous agrégeables sans N+1 :
 * les compteurs viennent du findMany paginé (COMPTEURS_AVANCEMENT), plus quatre requêtes
 * groupées par page.
 *
 * Choix de mesure (pièges relevés en cartographie et revue adversariale) :
 * - Les champs à DÉFAUT NON NUL (horaires, creneauxParJour…) sont invérifiables (« saisi » vs
 *   « défaut ») — jamais utilisés comme critères.
 * - Volumes horaires : mesurés en COUVERTURE — chaque niveau AYANT DES CLASSES doit être couvert
 *   par une grille propre (séances non vides) OU par le modèle NATIONAL du pays (le repli
 *   national s'applique à TOUTES les catégories, exactement comme construireProbleme). Sans
 *   classes, on retombe sur l'existence d'une source de volumes.
 * - Ressources enseignantes : le solveur accepte les POOLS ANONYMES (EffectifEnseignant) OU les
 *   comptes réels — mais un compte sans COMPÉTENCES ou sans NIVEAUX D'INTERVENTION ne produit
 *   AUCUNE unité-enseignant (construireProbleme) : le comptage exige les deux. Au
 *   préscolaire/primaire (maîtres polyvalents), seuls les comptes réels comptent.
 * - Le jalon « classes » vise les lignes Classe GÉNÉRÉES (« Calculer les classes pédagogiques »),
 *   pas les paramètres NiveauEtablissement : c'est le premier refus du solveur.
 */

export interface ItemAvancement {
  cle: string;
  libelle: string;
  ok: boolean;
}

export interface AvancementConfiguration {
  /** 0–100, part des critères satisfaits. */
  pourcentage: number;
  items: ItemAvancement[];
}

/** Compteurs FILTRÉS à joindre au `_count.select` du findMany paginé des établissements. */
export const COMPTEURS_AVANCEMENT = {
  classes: true,
  salles: true,
  niveauxConfig: { where: { effectif: { gt: 0 } } },
  effectifsEnseignant: { where: { nombre: { gt: 0 } } },
  grilles: { where: { NOT: { seancesMinutes: { isEmpty: true } } } },
} as const;

/** Champs d'établissement requis par l'évaluation (structurel : le findMany de la page suffit). */
export interface EtabPourAvancement {
  id: string;
  type: string;
  pays: string | null;
  categoriePedagogique: string | null;
  nbSallesDisponibles: number;
  _count: {
    classes: number;
    salles: number;
    niveauxConfig: number;
    effectifsEnseignant: number;
    grilles: number;
  };
}

/**
 * Évalue l'avancement de configuration d'une PAGE d'établissements (≤ ~24) en 4 requêtes
 * groupées + logique en mémoire. Renvoie une Map etablissementId → avancement.
 */
export async function calculerAvancements(
  etabs: EtabPourAvancement[],
): Promise<Map<string, AvancementConfiguration>> {
  const resultat = new Map<string, AvancementConfiguration>();
  if (etabs.length === 0) return resultat;

  const ids = etabs.map((e) => e.id);
  const paysListe = [...new Set(etabs.map((e) => paysGrille(e.pays)))];

  const [grillesNationales, comptesEnseignants, classesParNiveau, grillesPropres] = await Promise.all([
    // Niveaux couverts par le modèle NATIONAL de chaque pays de la page.
    prisma.grilleHoraire.groupBy({
      by: ["pays", "niveauId"],
      where: { etablissementId: null, pays: { in: paysListe }, heuresHebdo: { gt: 0 } },
    }),
    // Comptes enseignants EXPLOITABLES par le solveur : sans compétences OU sans niveaux
    // d'intervention, un compte ne produit aucune unité-enseignant (construireProbleme).
    prisma.utilisateur.groupBy({
      by: ["etablissementId"],
      where: {
        etablissementId: { in: ids },
        roleActif: { nomTechnique: "enseignant" },
        competences: { some: {} },
        niveauxIntervention: { some: {} },
      },
    }),
    // Niveaux ayant des CLASSES, par établissement (cible de la couverture des volumes).
    prisma.classe.groupBy({
      by: ["etablissementId", "niveauId"],
      where: { etablissementId: { in: ids } },
    }),
    // Niveaux couverts par une grille PROPRE à séances non vides, par établissement.
    prisma.grilleHoraire.groupBy({
      by: ["etablissementId", "niveauId"],
      where: { etablissementId: { in: ids }, NOT: { seancesMinutes: { isEmpty: true } } },
    }),
  ]);

  const natParPays = new Map<string, Set<string>>();
  for (const g of grillesNationales) {
    const s = natParPays.get(g.pays) ?? new Set<string>();
    s.add(g.niveauId);
    natParPays.set(g.pays, s);
  }
  const etabsAvecEnseignants = new Set(comptesEnseignants.map((c) => c.etablissementId as string));
  const niveauxClassesParEtab = new Map<string, Set<string>>();
  for (const c of classesParNiveau) {
    const s = niveauxClassesParEtab.get(c.etablissementId) ?? new Set<string>();
    s.add(c.niveauId);
    niveauxClassesParEtab.set(c.etablissementId, s);
  }
  const propresParEtab = new Map<string, Set<string>>();
  for (const g of grillesPropres) {
    if (!g.etablissementId) continue;
    const s = propresParEtab.get(g.etablissementId) ?? new Set<string>();
    s.add(g.niveauId);
    propresParEtab.set(g.etablissementId, s);
  }

  for (const e of etabs) {
    const categorie = e.categoriePedagogique ?? deriveCategoriePedagogique(e.type);
    const primaire = estPrimaireOuPrescolaire(categorie);
    const enseignantsReels = etabsAvecEnseignants.has(e.id);
    const nat = natParPays.get(paysGrille(e.pays)) ?? new Set<string>();
    const propres = propresParEtab.get(e.id) ?? new Set<string>();
    const niveauxClasses = niveauxClassesParEtab.get(e.id) ?? new Set<string>();

    // COUVERTURE des volumes : chaque niveau ayant des classes doit être couvert (grille propre
    // OU nationale — le repli national s'applique à toutes les catégories, comme le solveur).
    // Sans classes, la couverture est inévaluable : on mesure l'existence d'une source.
    const volumesOk =
      niveauxClasses.size > 0
        ? [...niveauxClasses].every((n) => propres.has(n) || nat.has(n))
        : e._count.grilles > 0 || nat.size > 0;

    const items: ItemAvancement[] = [
      { cle: "categorie", libelle: "Catégorie pédagogique", ok: e.categoriePedagogique !== null },
      { cle: "effectifs", libelle: "Effectifs par niveau", ok: e._count.niveauxConfig > 0 },
      { cle: "classes", libelle: "Classes pédagogiques calculées", ok: e._count.classes > 0 },
      { cle: "volumes", libelle: "Volumes horaires", ok: volumesOk },
      {
        cle: "enseignants",
        libelle: "Ressources enseignantes",
        ok: primaire ? enseignantsReels : e._count.effectifsEnseignant > 0 || enseignantsReels,
      },
      { cle: "salles", libelle: "Salles déclarées", ok: e.nbSallesDisponibles > 0 || e._count.salles > 0 },
    ];

    const satisfaits = items.filter((i) => i.ok).length;
    resultat.set(e.id, {
      pourcentage: Math.round((satisfaits / items.length) * 100),
      items,
    });
  }
  return resultat;
}
