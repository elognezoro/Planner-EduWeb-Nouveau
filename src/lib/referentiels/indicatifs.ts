/**
 * Indicatifs téléphoniques internationaux (E.164) par code ISO 3166-1 alpha-2.
 * Afrique complète + pays fréquents de la diaspora ; repli "" si inconnu.
 */
const INDICATIFS: Record<string, string> = {
  // Afrique
  DZ: "+213", AO: "+244", BJ: "+229", BW: "+267", BF: "+226", BI: "+257", CV: "+238",
  CM: "+237", CF: "+236", TD: "+235", KM: "+269", CG: "+242", CD: "+243", CI: "+225",
  DJ: "+253", EG: "+20", GQ: "+240", ER: "+291", SZ: "+268", ET: "+251", GA: "+241",
  GM: "+220", GH: "+233", GN: "+224", GW: "+245", KE: "+254", LS: "+266", LR: "+231",
  LY: "+218", MG: "+261", MW: "+265", ML: "+223", MR: "+222", MU: "+230", MA: "+212",
  MZ: "+258", NA: "+264", NE: "+227", NG: "+234", RW: "+250", ST: "+239", SN: "+221",
  SC: "+248", SL: "+232", SO: "+252", ZA: "+27", SS: "+211", SD: "+249", TZ: "+255",
  TG: "+228", TN: "+216", UG: "+256", ZM: "+260", ZW: "+263",
  // Diaspora & partenaires fréquents
  FR: "+33", BE: "+32", CH: "+41", US: "+1", CA: "+1", GB: "+44", DE: "+49", IT: "+39",
  ES: "+34", PT: "+351", NL: "+31", LU: "+352", MC: "+377", CN: "+86", IN: "+91",
  JP: "+81", BR: "+55", AE: "+971", SA: "+966", QA: "+974", TR: "+90", RU: "+7",
  HT: "+509", AU: "+61",
};

/** Indicatif téléphonique du pays (code ISO2), ou chaîne vide si inconnu. */
export function indicatifDe(codeIso2: string | null | undefined): string {
  if (!codeIso2) return "";
  return INDICATIFS[codeIso2.toUpperCase()] ?? "";
}
