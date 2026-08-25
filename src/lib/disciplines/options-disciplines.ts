/**
 * Familles « discipline-parent → options ». SOURCE UNIQUE (client + serveur).
 *
 * Une discipline-parent (ex. « LV2 », « Arts (Plastiques & Musicale) ») est :
 *  - déclarée UNE fois dans « Effectifs des enseignants par cycle et spécialité » (un effectif
 *    partagé pour toute la famille) ;
 *  - déclinée en OPTIONS dans « Volumes horaires par niveau et par discipline » (chaque option
 *    porte son propre volume horaire).
 *
 * Au solveur, les blocs d'une option mutualisent le POOL d'enseignants du parent (« pool unique
 * partagé ») : un enseignant déclaré sur le parent peut couvrir n'importe quelle option de la
 * famille. La correspondance option ↔ parent se fait par NOM normalisé (pas de relation en base).
 */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const FAMILLES_OPTIONS: { parent: string; options: string[] }[] = [
  { parent: "LV2", options: ["LV2-Allemand", "LV2-Espagnol"] },
  { parent: "Arts (Plastiques & Musicale)", options: ["Arts Plastiques", "Éducation musicale"] },
];

// Index normalisés (Map, jamais objet littéral : évite l'exposition du prototype sur entrée libre).
const OPTIONS_PAR_PARENT = new Map<string, string[]>();
const PARENT_PAR_OPTION = new Map<string, string>();
const NOM_EXACT = new Map<string, string>();
for (const f of FAMILLES_OPTIONS) {
  OPTIONS_PAR_PARENT.set(norm(f.parent), f.options);
  NOM_EXACT.set(norm(f.parent), f.parent);
  for (const o of f.options) {
    PARENT_PAR_OPTION.set(norm(o), f.parent);
    NOM_EXACT.set(norm(o), o);
  }
}

/** La discipline (par son nom) est-elle un PARENT à options ? */
export function estParentAOptions(nom: string): boolean {
  return OPTIONS_PAR_PARENT.has(norm(nom));
}

/** Noms canoniques des options d'un parent (vide si le nom n'est pas un parent connu). */
export function optionsDe(nomParent: string): string[] {
  return OPTIONS_PAR_PARENT.get(norm(nomParent)) ?? [];
}

/** Nom canonique du parent d'une option, ou null si le nom n'est pas une option connue. */
export function parentDeOption(nomOption: string): string | null {
  return PARENT_PAR_OPTION.get(norm(nomOption)) ?? null;
}

/** La discipline (par son nom) est-elle une OPTION d'une famille ? */
export function estOption(nom: string): boolean {
  return PARENT_PAR_OPTION.has(norm(nom));
}

/**
 * Nom de regroupement pour le POOL d'enseignants du solveur : le PARENT si c'est une option,
 * sinon le nom lui-même. Deux options de la même famille partagent ainsi un pool unique.
 */
export function nomPourPoolDiscipline(nom: string): string {
  return parentDeOption(nom) ?? nom;
}
