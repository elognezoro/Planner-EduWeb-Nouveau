/**
 * Identification PAR DÉNOMINATION des établissements catholiques de Côte d'Ivoire
 * parmi les établissements existants (noms contenant « catholique », « Saint(e)… »,
 * « Notre-Dame », ordres et figures catholiques…), puis rattachement au diocèse
 * qui convient SELON LA LOCALITÉ (ville, à défaut région DRENAET).
 *
 *   npx tsx prisma/seed-catholiques-ci-denominations.ts          → SIMULATION (rapport)
 *   APPLY=1 npx tsx prisma/seed-catholiques-ci-denominations.ts  → application
 *
 * Garde-fous :
 *  - ne touche JAMAIS un établissement déjà au réseau SEDEC (ni un réseau confessionnel
 *    déjà renseigné différent) ;
 *  - exclut les dénominations chrétiennes non catholiques (méthodiste, protestant,
 *    adventiste, baptiste, évangélique…) et les faux positifs nommés (Saint-Exupéry,
 *    « Frères Unis/Jumeaux », « Le Saint des Saints ») ;
 *  - exclut les établissements PUBLICS (pas de gestion confessionnelle) ;
 *  - localité inconnue du référentiel ecclésiastique → réseau SEDEC SANS diocèse
 *    (visible via « Uniquement sans diocèse » de la page Diocèses, à compléter à la main).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { diocesesDuPays } from "../src/lib/referentiels/dioceses";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PAYS = "Côte d'Ivoire";
const APPLY = process.env.APPLY === "1";

function normaliser(s: string): string {
  return s
    .replace(/[’‘`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ── Détection par dénomination ──
const INDICATEURS = [
  "catholique", "notre dame", "don bosco", "dominique savio", "salesien", "seminaire", "paroiss",
  "monseigneur", "cardinal", "sacre coeur", "immaculee", "assomption", "la salle", "patronage",
  "carmes", "carmel", "franciscain", "dominicain", "jesuite", "loyola", "mariste", "champagnat",
  "jean paul ii", "jean paul 2", "pie xii", "pie xi", "fatima", "lourdes", "padre pio",
  "charles lwanga", "jeanne d arc", "sainte famille", "saint viateur", "freres", "soeurs",
];
const REGEX_SAINT = /(^|\s)saint(e|es|s)?\s/;
const REGEX_MGR = /(^|\s)mgr(\s|$)/;
const ANTI = [
  "methodiste", "protestant", "adventiste", "baptiste", "evangeli", "pentecot",
  "assemblee de dieu", "islam", "musulman", "franco arabe", "medersa", "madrassa",
  "harriste", "celeste",
];
/** Faux positifs nommés : « Saint(e) » d'apparat ou fraternités laïques, PAS l'Église catholique. */
const EXCLUSIONS_NOMS = [
  "COLLEGE PRIVE TECHNIQUE ANTOINE DE SAINT EXUPERY DJEBONOUA", // l'écrivain
  "COLLEGE SAINT EXUPERY PORT-BOUET", // l'écrivain
  "GROUPE SCOLAIRE LE SAINT DES SAINTS SOUBRE", // expression, pas un saint
  "COLLEGE PRIVE LES FRERES UNIS DE TAABO", // fraternité laïque
  "COLLEGE LES FRERES JUMEAUX", // laïc
].map(normaliser);

function estCatholiqueParNom(nom: string): boolean {
  const n = normaliser(nom);
  if (EXCLUSIONS_NOMS.includes(n)) return false;
  const espace = ` ${n} `;
  if (ANTI.some((a) => espace.includes(a))) return false;
  return INDICATEURS.some((c) => espace.includes(c)) || REGEX_SAINT.test(n) || REGEX_MGR.test(n);
}

// ── Localité → diocèse (zones du répertoire officiel + géographie ecclésiastique CI) ──
const D = {
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

const VILLE_DIOCESE: Record<string, string> = {
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
  gagnoa: D.gagnoa, oume: D.gagnoa, guiberoua: D.gagnoa, lakota: D.gagnoa, divo: D.gagnoa, ouragahio: D.gagnoa,
  // Diocèse de Daloa (Haut-Sassandra + Marahoué)
  daloa: D.daloa, issia: D.daloa, vavoua: D.daloa, zoukougbeu: D.daloa, saioua: D.daloa,
  bouafle: D.daloa, sinfra: D.daloa, zuenoula: D.daloa, "bozi satmaci": D.daloa,
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

/** Diocèse déduit de la ville (prioritaire) puis de la région DRENAET (« Abidjan 4 » → Abidjan). */
function dioceseDeLocalite(ville: string | null, regionNom: string | null): string | null {
  for (const brut of [ville, regionNom]) {
    if (!brut) continue;
    const n = normaliser(brut).replace(/\s+\d+$/, ""); // « abidjan 4 » → « abidjan »
    if (VILLE_DIOCESE[n]) return VILLE_DIOCESE[n];
    // tolérance : la localité contient une clé connue (« belleville bouake », « abobo pk 18 »)
    for (const [cle, dio] of Object.entries(VILLE_DIOCESE)) {
      if (n.includes(cle)) return dio;
    }
  }
  return null;
}

async function main() {
  console.log(APPLY ? "MODE APPLICATION (écritures en base)" : "MODE SIMULATION (aucune écriture)");

  // Sanity : chaque diocèse de la carte doit appartenir au référentiel.
  const refs = new Set(diocesesDuPays(PAYS));
  for (const d of Object.values(D)) if (!refs.has(d)) throw new Error(`Diocèse hors référentiel : ${d}`);

  const etabs = await prisma.etablissement.findMany({
    where: { pays: { equals: PAYS, mode: "insensitive" } },
    select: { id: true, nom: true, ville: true, statut: true, reseauConfessionnel: true, diocese: true, region: { select: { nom: true } } },
  });

  let nbMaj = 0, nbSansDiocese = 0, nbPublicsIgnores = 0, nbAutreReseau = 0;
  const parDiocese = new Map<string, number>();

  for (const e of etabs) {
    if (e.statut === "confessionnel" && e.reseauConfessionnel === "SEDEC") continue; // déjà au réseau
    if (!estCatholiqueParNom(e.nom)) continue;
    if (e.statut === "public") {
      nbPublicsIgnores++;
      console.log(`! PUBLIC ignoré : ${e.nom} (${e.ville ?? "?"})`);
      continue;
    }
    if (e.reseauConfessionnel && e.reseauConfessionnel !== "SEDEC") {
      nbAutreReseau++;
      console.log(`! Réseau « ${e.reseauConfessionnel} » conservé : ${e.nom} (${e.ville ?? "?"})`);
      continue;
    }
    const diocese = dioceseDeLocalite(e.ville, e.region?.nom ?? null);
    nbMaj++;
    if (diocese) parDiocese.set(diocese, (parDiocese.get(diocese) ?? 0) + 1);
    else nbSansDiocese++;
    console.log(`~ SEDEC ${diocese ? `[${diocese}]` : "[SANS diocèse — à compléter]"} ${e.nom} (${e.ville ?? "?"} · ${e.region?.nom ?? "?"})`);
    if (APPLY) {
      await prisma.etablissement.update({
        where: { id: e.id },
        data: { statut: "confessionnel", reseauConfessionnel: "SEDEC", ...(diocese ? { diocese } : {}) },
      });
    }
  }

  console.log(`\nBilan : ${nbMaj} rattaché(s) au réseau SEDEC (dont ${nbSansDiocese} sans diocèse, à compléter)`);
  console.log(`Ignorés : ${nbPublicsIgnores} public(s) · ${nbAutreReseau} autre(s) réseau(x) confessionnel(s)`);
  console.log("\nNouveaux rattachements par diocèse :");
  [...parDiocese.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .forEach(([d, n]) => console.log(`  ${d} : +${n}`));

  if (APPLY) {
    const total = await prisma.etablissement.groupBy({
      by: ["diocese"],
      where: { pays: { equals: PAYS, mode: "insensitive" }, statut: "confessionnel", reseauConfessionnel: "SEDEC" },
      _count: { _all: true },
    });
    console.log("\nÉtat final — établissements catholiques (SEDEC) par diocèse :");
    total
      .sort((a, b) => (a.diocese ?? "").localeCompare(b.diocese ?? "", "fr"))
      .forEach((d) => console.log(`  ${d.diocese ?? "(sans diocèse)"} : ${d._count._all}`));
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
