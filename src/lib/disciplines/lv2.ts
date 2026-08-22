/**
 * Règle client (LV2) : une spécialité « Espagnol » ou « Allemand » vaut « LV2-Espagnol » /
 * « LV2-Allemand ». Module PUR (utilisable côté client ET serveur) — SOURCE UNIQUE de la
 * correspondance, partagée par l'import Enseignants d'un établissement, le Convertisseur CSV
 * et l'annuaire du personnel des APFC.
 */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Map (jamais un objet littéral) : un lookup objet sur une entrée utilisateur exposerait les
// clés du prototype (« constructor », « __proto__ ») et renverrait autre chose qu'une chaîne.
const ALIAS_LV2 = new Map<string, string>([
  ["espagnol", "LV2-Espagnol"],
  ["lv2-espagnol", "LV2-Espagnol"],
  ["lv2 espagnol", "LV2-Espagnol"],
  ["allemand", "LV2-Allemand"],
  ["lv2-allemand", "LV2-Allemand"],
  ["lv2 allemand", "LV2-Allemand"],
]);

/** Nom canonique « LV2-x » si la valeur est une variante Espagnol/Allemand, sinon null. */
export function cibleLV2(brut: string): string | null {
  return ALIAS_LV2.get(norm(brut)) ?? null;
}

/** Normalise une spécialité : variante LV2 → nom canonique, sinon valeur d'origine (rognée). */
export function normaliserSpecialiteLV2(brut: string): string {
  return cibleLV2(brut) ?? brut.trim();
}
