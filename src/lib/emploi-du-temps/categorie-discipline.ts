/**
 * Catégorisation LITTÉRAIRE / SCIENTIFIQUE des disciplines, par leur nom (le référentiel
 * n'a pas de champ de catégorie : la classification se fait sur le libellé normalisé,
 * accents ignorés). Sert aux contraintes optionnelles « deux disciplines littéraires /
 * scientifiques ne doivent pas se suivre immédiatement » du générateur d'emplois du temps.
 *
 * Une discipline hors des deux listes est « autre » (EPS, arts, musique, SES, conduite…) :
 * elle n'est concernée par aucune de ces deux contraintes.
 */

export type CategorieDiscipline = "litteraire" | "scientifique" | "autre";

const LITTERAIRES = [
  "francais", "philosophie", "histoire", "geographie", "anglais", "espagnol", "allemand",
  "litterature", "latin", "grec", "arabe", "portugais", "italien", "russe", "chinois",
  "lecture", "expression ecrite", "expression orale", "langue",
  // Le référentiel national nomme les langues vivantes par leur sigle (« LV2 »…).
  "lv1", "lv2", "lv3",
];

const SCIENTIFIQUES = [
  "mathematique", "maths", "physique", "chimie", "svt", "sciences de la vie",
  "sciences physiques", "biologie", "geologie", "sciences naturelles", "informatique",
  "sciences de l'ingenieur", "technologie",
];

/** Minuscules + accents retirés (diacritiques U+0300-U+036F), robuste aux libellés locaux. */
function normaliser(nom: string): string {
  return nom.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function categoriserDiscipline(nom: string): CategorieDiscipline {
  const n = normaliser(nom);
  // EPS d'abord : « Éducation Physique et Sportive » contient « physique » mais n'est
  // JAMAIS une discipline scientifique au sens de ces contraintes.
  if (n.includes("education physique") || n.includes("sportive") || /\beps\b/.test(n)) return "autre";
  if (LITTERAIRES.some((m) => n.includes(m))) return "litteraire";
  if (SCIENTIFIQUES.some((m) => n.includes(m))) return "scientifique";
  return "autre";
}
