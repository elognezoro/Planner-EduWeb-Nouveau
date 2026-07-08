// Calcul du libellé de l'année scolaire courante à partir de la date, afin qu'il se mette à jour
// AUTOMATIQUEMENT chaque année, sans intervention. Fonction pure et testable.

/**
 * Libellé de l'année scolaire courante (ex. « 2026-2027 »), déduit de la date.
 *
 * Convention : l'année scolaire Y-(Y+1) est en vigueur du 1er juillet de l'année Y (début des
 * grandes vacances / préparation de la rentrée de septembre) au 30 juin de l'année Y+1. Ainsi, en
 * juillet 2026 le libellé est déjà « 2026-2027 », et il bascule seul sur « 2027-2028 » en juillet 2027.
 *
 * @param date Date de référence (par défaut : maintenant). getMonth() : 0 = janvier … 11 = décembre.
 */
export function anneeScolaireCourante(date: Date = new Date()): string {
  const y = date.getFullYear();
  const debut = date.getMonth() >= 6 ? y : y - 1; // à partir de juillet (mois index 6) → année à venir
  return `${debut}-${debut + 1}`;
}
