/**
 * Diocèses (subdivisions ecclésiastiques catholiques) par pays — sert au périmètre du rôle SEDEC
 * et au rattachement des établissements catholiques (réseau SEDEC). Liste indicative, extensible ;
 * pour les pays absents de la table, la saisie reste libre.
 */
export const DIOCESES_PAR_PAYS: Record<string, string[]> = {
  "Côte d'Ivoire": [
    "Abengourou",
    "Abidjan",
    "Agboville",
    "Bondoukou",
    "Bouaké",
    "Daloa",
    "Gagnoa",
    "Grand-Bassam",
    "Katiola",
    "Korhogo",
    "Man",
    "Odienné",
    "San-Pédro",
    "Yamoussoukro",
    "Yopougon",
  ],
};

/** Diocèses connus d'un pays (triés), ou liste vide si le pays n'est pas référencé. */
export function diocesesDuPays(pays: string | null | undefined): string[] {
  if (!pays) return [];
  return DIOCESES_PAR_PAYS[pays.trim()] ?? [];
}
