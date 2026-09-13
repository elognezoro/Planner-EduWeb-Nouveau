/**
 * Référentiel partagé des établissements : types, familles d'enseignement (pour le
 * filtre du répertoire) et réseaux confessionnels. Source unique pour éviter la
 * divergence des libellés entre le formulaire, la configuration et les filtres.
 */

/** Toutes les valeurs de l'enum Prisma TypeEtablissement, avec leur libellé. */
export const TYPES_ETABLISSEMENT = [
  { v: "prescolaire", l: "Préscolaire" },
  { v: "primaire", l: "Primaire" },
  { v: "college", l: "Collège" },
  { v: "lycee", l: "Lycée" },
  { v: "technique", l: "Enseignement technique" },
  { v: "formation_professionnelle", l: "Formation professionnelle" },
  { v: "technique_professionnel", l: "Technique et professionnel" },
  { v: "groupe_scolaire", l: "Groupe scolaire" },
  { v: "autre", l: "Autre" },
] as const;

export type TypeEtablissementValeur = (typeof TYPES_ETABLISSEMENT)[number]["v"];

export const TYPES_ETABLISSEMENT_VALEURS = TYPES_ETABLISSEMENT.map((t) => t.v) as TypeEtablissementValeur[];

export const LIBELLE_TYPE: Record<string, string> = Object.fromEntries(
  TYPES_ETABLISSEMENT.map((t) => [t.v, t.l]),
);

/**
 * Familles d'enseignement du filtre du répertoire → ensemble de types Prisma.
 * Un établissement « technique et professionnel » (EETFP mixte) apparaît à la fois
 * sous « Enseignement technique » et sous « Formation professionnelle ».
 */
export const FAMILLES_ENSEIGNEMENT = [
  { v: "prescolaire", l: "Préscolaire", types: ["prescolaire"] },
  { v: "primaire", l: "Enseignement primaire", types: ["primaire"] },
  { v: "secondaire", l: "Enseignement secondaire", types: ["college", "lycee"] },
  { v: "technique", l: "Enseignement technique", types: ["technique", "technique_professionnel"] },
  { v: "formation_professionnelle", l: "Formation professionnelle", types: ["formation_professionnelle", "technique_professionnel"] },
  { v: "groupe_scolaire", l: "Groupe scolaire", types: ["groupe_scolaire"] },
  { v: "autre", l: "Autre", types: ["autre"] },
] as const satisfies readonly { v: string; l: string; types: readonly TypeEtablissementValeur[] }[];

export type FamilleValeur = (typeof FAMILLES_ENSEIGNEMENT)[number]["v"];

/** Types couverts par une famille (null si la famille est inconnue). */
export function typesDeFamille(famille: string | null | undefined): TypeEtablissementValeur[] | null {
  const f = FAMILLES_ENSEIGNEMENT.find((x) => x.v === famille);
  return f ? [...f.types] : null;
}

/**
 * Réseaux confessionnels (cascade quand statut = « confessionnel »).
 * Liste extensible : ajouter ici les obédiences d'autres pays au besoin.
 */
export const RESEAUX_CONFESSIONNELS = ["SEDEC", "Méthodiste", "Protestants", "Islamique", "Autre"] as const;

export type ReseauConfessionnel = (typeof RESEAUX_CONFESSIONNELS)[number];

export function estReseauValide(v: string): v is ReseauConfessionnel {
  return (RESEAUX_CONFESSIONNELS as readonly string[]).includes(v);
}

/**
 * Catégorie pédagogique déclarée par l'établissement (sélecteur en tête de la configuration) :
 * pilote l'adaptation de toute la console (effectifs enseignants par spécialité, ajout de
 * disciplines dans les grilles, source des compétences enseignants) — au préscolaire/primaire,
 * pas de distinction 1er/2nd cycle (maîtres polyvalents).
 */
export const CATEGORIES_PEDAGOGIQUES = [
  { v: "prescolaire", l: "Préscolaire" },
  { v: "primaire", l: "Primaire" },
  { v: "secondaire", l: "Secondaire" },
  { v: "superieur", l: "Supérieur" },
] as const;

export type CategoriePedagogique = (typeof CATEGORIES_PEDAGOGIQUES)[number]["v"];

export function estCategoriePedagogiqueValide(v: string): v is CategoriePedagogique {
  return (CATEGORIES_PEDAGOGIQUES as readonly { v: string }[]).some((c) => c.v === v);
}

/** Un établissement de cette catégorie n'a pas de distinction 1er/2nd cycle (maîtres polyvalents). */
export function estPrimaireOuPrescolaire(categorie: string | null | undefined): boolean {
  return categorie === "prescolaire" || categorie === "primaire";
}

/**
 * Catégorie pédagogique dérivée du `type` Prisma de l'établissement — utilisée tant que
 * l'utilisateur n'a pas choisi lui-même sa catégorie (champ `categoriePedagogique` encore
 * null, établissements créés avant cette fonctionnalité). « Supérieur » n'est JAMAIS dérivé
 * automatiquement : uniquement sélectionnable à la main dans le sélecteur.
 */
export function deriveCategoriePedagogique(type: string): CategoriePedagogique {
  if (type === "prescolaire") return "prescolaire";
  if (type === "primaire") return "primaire";
  return "secondaire";
}

export function libelleCategoriePedagogique(v: string | null | undefined): string {
  return CATEGORIES_PEDAGOGIQUES.find((c) => c.v === v)?.l ?? String(v ?? "");
}

/** Types du secondaire (général, technique, professionnel) : jamais « Préscolaire » ni « Primaire ». */
const TYPES_SECONDAIRE: readonly string[] = ["college", "lycee", "technique", "formation_professionnelle", "technique_professionnel"];

/**
 * COHÉRENCE type ↔ catégorie pédagogique. La catégorie pilote toute la console (liste d'ajout des
 * volumes horaires, effectifs par spécialité, compétences, solveur) : un Collège resté classé
 * « Primaire » voyait sa liste d'ajout restreinte et ses effectifs par spécialité ignorés par le
 * générateur. Groupe scolaire et « Autre » : toutes les catégories restent possibles.
 */
export function categorieCoherenteAvecType(type: string, categorie: string | null | undefined): boolean {
  if (!categorie) return true; // non choisie : dérivée du type, donc cohérente par construction
  if (TYPES_SECONDAIRE.includes(type)) return !estPrimaireOuPrescolaire(categorie);
  if (type === "primaire" || type === "prescolaire") return estPrimaireOuPrescolaire(categorie);
  return true;
}

/**
 * Catégorie à retenir quand le TYPE change : l'actuelle tant qu'elle reste cohérente, sinon celle
 * qui découle du nouveau type (ex. Primaire → Collège ⇒ Secondaire). `null` reste `null` (la
 * catégorie continue alors d'être dérivée du type).
 */
export function categorieApresChangementDeType(
  type: string,
  categorie: string | null | undefined,
): CategoriePedagogique | null {
  if (!categorie) return null;
  if (estCategoriePedagogiqueValide(categorie) && categorieCoherenteAvecType(type, categorie)) return categorie;
  return deriveCategoriePedagogique(type);
}
