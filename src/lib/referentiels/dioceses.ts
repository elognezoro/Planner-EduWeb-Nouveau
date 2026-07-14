/**
 * Diocèses (subdivisions ecclésiastiques catholiques) par pays, groupés par province — sert au
 * périmètre du rôle SEDEC et au rattachement des établissements catholiques (réseau SEDEC).
 * La valeur stockée (sur l'établissement et sur l'utilisateur) est le libellé complet du diocèse.
 * Extensible ; pour un pays absent de la table, la saisie reste libre.
 */
export interface ProvinceEcclesiastique {
  province: string;
  dioceses: string[];
}

export const PROVINCES_PAR_PAYS: Record<string, ProvinceEcclesiastique[]> = {
  "Côte d'Ivoire": [
    {
      province: "Province ecclésiastique d'Abidjan",
      dioceses: ["Archidiocèse d'Abidjan", "Diocèse d'Agboville", "Diocèse de Grand-Bassam", "Diocèse de Yopougon"],
    },
    {
      province: "Province ecclésiastique de Bouaké",
      dioceses: ["Archidiocèse de Bouaké", "Diocèse d'Abengourou", "Diocèse de Bondoukou", "Diocèse de Yamoussoukro"],
    },
    {
      province: "Province ecclésiastique de Gagnoa",
      dioceses: ["Archidiocèse de Gagnoa", "Diocèse de Daloa", "Diocèse de Man", "Diocèse de San-Pédro"],
    },
    {
      province: "Province ecclésiastique de Korhogo",
      dioceses: ["Archidiocèse de Korhogo", "Diocèse de Katiola", "Diocèse d'Odienné"],
    },
  ],
};

/** Provinces ecclésiastiques d'un pays (avec leurs diocèses), ou liste vide si non référencé. */
export function provincesDuPays(pays: string | null | undefined): ProvinceEcclesiastique[] {
  if (!pays) return [];
  return PROVINCES_PAR_PAYS[pays.trim()] ?? [];
}

/** Diocèses connus d'un pays (liste à plat des libellés), ou liste vide si non référencé. */
export function diocesesDuPays(pays: string | null | undefined): string[] {
  return provincesDuPays(pays).flatMap((p) => p.dioceses);
}
