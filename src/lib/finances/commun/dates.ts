import "server-only";

/**
 * Dates COMPTABLES (RM-008) : une opération distingue date de création (`creeLe`), date
 * comptable (`dateComptable`) et éventuellement date de validation (`dateValidation`).
 *
 * Les enregistrements ANTÉRIEURS à la fondation transverse ont `dateComptable` NULL : les
 * lectures du domaine replient sur la date d'opération saisie (`date`) puis sur `creeLe`.
 */
export function dateComptableEffective(operation: {
  dateComptable?: Date | null;
  date?: Date | null;
  creeLe: Date;
}): Date {
  return operation.dateComptable ?? operation.date ?? operation.creeLe;
}
