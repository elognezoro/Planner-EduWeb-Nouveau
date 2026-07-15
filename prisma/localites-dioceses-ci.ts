/**
 * Carte localité → diocèse (Côte d'Ivoire), partagée par les seeds du réseau
 * catholique (SEDEC). Sources : zones du répertoire officiel provisoire fourni
 * par l'utilisateur + découpage ecclésiastique des 15 circonscriptions.
 */

export function normaliser(s: string): string {
  return s
    .replace(/[’‘`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const D = {
  abidjan: "Archidiocèse d'Abidjan",
  agboville: "Diocèse d'Agboville",
  bassam: "Diocèse de Grand-Bassam",
  yopougon: "Diocèse de Yopougon",
  bouake: "Archidiocèse de Bouaké",
  abengourou: "Diocèse d'Abengourou",
  bondoukou: "Diocèse de Bondoukou",
  yamoussoukro: "Diocèse de Yamoussoukro",
  gagnoa: "Archidiocèse de Gagnoa",
  daloa: "Diocèse de Daloa",
  man: "Diocèse de Man",
  sanpedro: "Diocèse de San-Pédro",
  korhogo: "Archidiocèse de Korhogo",
  katiola: "Diocèse de Katiola",
  odienne: "Diocèse d'Odienné",
} as const;

export const VILLE_DIOCESE: Record<string, string> = {
  // Archidiocèse d'Abidjan (communes et environs)
  abidjan: D.abidjan, abobo: D.abidjan, adjame: D.abidjan, anyama: D.abidjan, bingerville: D.abidjan,
  cocody: D.abidjan, koumassi: D.abidjan, marcory: D.abidjan, plateau: D.abidjan, "port bouet": D.abidjan,
  treichville: D.abidjan,
  // Diocèse de Yopougon (Yopougon, Attécoubé/Abobo-Doumé, Dabou, Jacqueville, Songon)
  yopougon: D.yopougon, attecoube: D.yopougon, dabou: D.yopougon, jacqueville: D.yopougon, songon: D.yopougon,
  // Diocèse de Grand-Bassam (Sud-Comoé)
  "grand bassam": D.bassam, bonoua: D.bassam, aboisso: D.bassam, adiake: D.bassam, ayame: D.bassam,
  mafere: D.bassam, tiapoum: D.bassam, assinie: D.bassam,
  // Diocèse d'Agboville (Agnéby-Tiassa)
  agboville: D.agboville, azaguie: D.agboville, rubino: D.agboville, sikensi: D.agboville,
  "grand morie": D.agboville, tiassale: D.agboville, taabo: D.agboville,
  // Archidiocèse de Bouaké (Gbêkê + Iffou)
  bouake: D.bouake, beoumi: D.bouake, sakassou: D.bouake, botro: D.bouake, brobo: D.bouake,
  djebonoua: D.bouake, daoukro: D.bouake, "m bahiakro": D.bouake, prikro: D.bouake,
  // Diocèse de Yamoussoukro (Bélier + N'Zi ouest)
  yamoussoukro: D.yamoussoukro, toumodi: D.yamoussoukro, dimbokro: D.yamoussoukro,
  tiebissou: D.yamoussoukro, bocanda: D.yamoussoukro, didievi: D.yamoussoukro,
  // Diocèse d'Abengourou (Indénié-Djuablin)
  abengourou: D.abengourou, agnibilekrou: D.abengourou, bettie: D.abengourou, niable: D.abengourou,
  // Diocèse de Bondoukou (Gontougo + Bounkani)
  bondoukou: D.bondoukou, tanda: D.bondoukou, transua: D.bondoukou, "koun fao": D.bondoukou, bouna: D.bondoukou,
  // Archidiocèse de Gagnoa (Gôh + Lôh-Djiboua)
  gagnoa: D.gagnoa, oume: D.gagnoa, guiberoua: D.gagnoa, lakota: D.gagnoa, divo: D.gagnoa,
  ouragahio: D.gagnoa, yocoboue: D.gagnoa, guitry: D.gagnoa,
  // Diocèse de Daloa (Haut-Sassandra + Marahoué)
  daloa: D.daloa, issia: D.daloa, vavoua: D.daloa, zoukougbeu: D.daloa, saioua: D.daloa,
  bouafle: D.daloa, sinfra: D.daloa, zuenoula: D.daloa, "bozi satmaci": D.daloa, gboguhe: D.daloa,
  // Diocèse de Man (Tonkpi + Guémon + Cavally)
  man: D.man, danane: D.man, biankouma: D.man, "zouan hounien": D.man, kouibly: D.man, facobly: D.man,
  duekoue: D.man, bangolo: D.man, guiglo: D.man, blolequin: D.man, toulepleu: D.man, yapleu: D.man,
  // Diocèse de San-Pédro (Bas-Sassandra : San-Pédro, Nawa, Gbôklé)
  "san pedro": D.sanpedro, sassandra: D.sanpedro, soubre: D.sanpedro, tabou: D.sanpedro,
  "grand bereby": D.sanpedro, meagui: D.sanpedro, buyo: D.sanpedro, fresco: D.sanpedro, gueyo: D.sanpedro,
  // Archidiocèse de Korhogo (Poro + Tchologo + Bagoué)
  korhogo: D.korhogo, sinematiali: D.korhogo, dikodougou: D.korhogo, "m bengue": D.korhogo,
  boundiali: D.korhogo, ferkessedougou: D.korhogo, ouangolodougou: D.korhogo, tengrela: D.korhogo,
  // Diocèse de Katiola (Hambol)
  katiola: D.katiola, dabakala: D.katiola, niakaramandougou: D.katiola, niakara: D.katiola, tafire: D.katiola,
  // Diocèse d'Odienné (Kabadougou + Folon + Bafing)
  odienne: D.odienne, madinani: D.odienne, minignan: D.odienne, seguelon: D.odienne, touba: D.odienne,
  koro: D.odienne, borotou: D.odienne,
};

/**
 * Diocèse déduit de la ville (prioritaire) puis de la région DRENAET (« Abidjan 4 » → Abidjan).
 * La tolérance de contenance est bornée AUX MOTS (« belleville bouake » contient « bouake » ;
 * « mankono » ne contient PAS « man »), et null si la localité est inconnue.
 */
export function dioceseDeLocalite(ville: string | null | undefined, regionNom: string | null | undefined): string | null {
  for (const brut of [ville, regionNom]) {
    if (!brut) continue;
    const n = normaliser(brut).replace(/\s+\d+$/, ""); // « abidjan 4 » → « abidjan »
    if (VILLE_DIOCESE[n]) return VILLE_DIOCESE[n];
    const espace = ` ${n} `;
    for (const [cle, dio] of Object.entries(VILLE_DIOCESE)) {
      if (espace.includes(` ${cle} `)) return dio;
    }
  }
  return null;
}
