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
