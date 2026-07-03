/**
 * Normalisation d'identité (utilisable côté client ET serveur) :
 * - Prénoms : première lettre de chaque mot en majuscule, le reste en minuscules
 *   (gère les composés « Jean-Marc » et les particules « N'Guessan »).
 * - Nom : tout en MAJUSCULES.
 */

export function capitaliserPrenoms(valeur: string): string {
  return valeur
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s\-'’])\p{L}/gu, (lettre) => lettre.toLocaleUpperCase("fr-FR"));
}

export function majusculesNom(valeur: string): string {
  return valeur.toLocaleUpperCase("fr-FR");
}
