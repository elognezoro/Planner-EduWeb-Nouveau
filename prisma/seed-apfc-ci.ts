/**
 * Répertoire officiel des 36 APFC de Côte d'Ivoire (source : DPFC — « Missions et
 * attributions de la DPFC », fichier client Fichier_APFC_CIV_complet.xlsx).
 * Idempotent : une APFC déjà présente (même nom, insensible casse/accents) est ignorée ;
 * la région (DRENA) est rapprochée du référentiel par nom normalisé (non bloquant).
 *   npm run db:seed:apfc-ci
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const APFC_CI: { nom: string; region: string }[] = [
  { nom: "APFC Abengourou", region: "Abengourou" },
  { nom: "APFC Abidjan 1", region: "Abidjan 1" },
  { nom: "APFC Abidjan 2", region: "Abidjan 2" },
  { nom: "APFC Abidjan 3", region: "Abidjan 3" },
  { nom: "APFC Abidjan 4", region: "Abidjan 4" },
  { nom: "APFC Aboisso", region: "Aboisso" },
  { nom: "APFC Adzopé", region: "Adzopé" },
  { nom: "APFC Agboville", region: "Agboville" },
  { nom: "APFC Bondoukou", region: "Bondoukou" },
  { nom: "APFC Bongouanou", region: "Bongouanou" },
  { nom: "APFC Bouaflé", region: "Bouaflé" },
  { nom: "APFC Bouaké 1", region: "Bouaké 1" },
  { nom: "APFC Bouaké 2", region: "Bouaké 2" },
  { nom: "APFC Bouna", region: "Bouna" },
  { nom: "APFC Boundiali", region: "Boundiali" },
  { nom: "APFC Dabou", region: "Dabou" },
  { nom: "APFC Daloa", region: "Daloa" },
  { nom: "APFC Daoukro", region: "Daoukro" },
  { nom: "APFC Dimbokro", region: "Dimbokro" },
  { nom: "APFC Divo", region: "Divo" },
  { nom: "APFC Duékoué", region: "Duékoué" },
  { nom: "APFC Ferké", region: "Ferké" },
  { nom: "APFC Gagnoa", region: "Gagnoa" },
  { nom: "APFC Guiglo", region: "Guiglo" },
  { nom: "APFC Katiola", region: "Katiola" },
  { nom: "APFC Korhogo", region: "Korhogo" },
  { nom: "APFC Man", region: "Man" },
  { nom: "APFC Mankono", region: "Mankono" },
  { nom: "APFC Minignan", region: "Minignan" },
  { nom: "APFC Odienné", region: "Odienné" },
  { nom: "APFC San-Pedro", region: "San-Pedro" },
  { nom: "APFC Sassandra", region: "Sassandra" },
  { nom: "APFC Séguéla", region: "Séguéla" },
  { nom: "APFC Soubré", region: "Soubré" },
  { nom: "APFC Touba", region: "Touba" },
  { nom: "APFC Yamoussoukro", region: "Yamoussoukro" },
];

/** Normalisation pour comparer noms et régions (casse, accents, tirets/espaces). */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-\s']+/g, " ").trim();

async function main() {
  const [regions, existantes] = await Promise.all([
    prisma.region.findMany({ where: { pays: "Côte d'Ivoire" }, select: { id: true, nom: true } }),
    prisma.apfc.findMany({ select: { nom: true } }),
  ]);
  const regionsNorm = regions.map((r) => ({ ...r, n: norm(r.nom) }));
  const dejaLa = new Set(existantes.map((a) => norm(a.nom)));

  let crees = 0, ignorees = 0;
  const sansRegion: string[] = [];
  for (const a of APFC_CI) {
    if (dejaLa.has(norm(a.nom))) {
      ignorees++;
      continue;
    }
    const cible = norm(a.region);
    const region =
      regionsNorm.find((r) => r.n === cible) ??
      regionsNorm.find((r) => r.n.startsWith(cible) || cible.startsWith(r.n));
    if (!region) sansRegion.push(`${a.nom} (DRENA « ${a.region} » introuvable)`);
    await prisma.apfc.create({ data: { nom: a.nom, regionId: region?.id ?? null } });
    crees++;
  }

  console.log(`APFC de Côte d'Ivoire : ${crees} créée(s), ${ignorees} déjà présente(s) (ignorée(s)).`);
  if (sansRegion.length > 0) {
    console.log(`Sans région rattachée (${sansRegion.length}) : ${sansRegion.join(" ; ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
