/**
 * COUVERTURE TERRITORIALE des APFC de Côte d'Ivoire : chaque APFC couvre les
 * établissements scolaires (préscolaire, primaire, secondaire général et technique)
 * de SA DRENA/DRENAET de rattachement, à partir du répertoire déjà en base.
 * Idempotent : un établissement déjà couvert (par cette APFC ou une autre) est ignoré
 * (contrainte : un établissement ne relève que d'UNE APFC).
 *   npm run db:seed:couverture-apfc-ci
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const apfcs = await prisma.apfc.findMany({
    where: { region: { pays: "Côte d'Ivoire" } },
    select: { id: true, nom: true, regionId: true, region: { select: { nom: true } } },
    orderBy: { nom: "asc" },
  });
  if (apfcs.length === 0) {
    console.log("Aucune APFC rattachée à une région de Côte d'Ivoire — rien à faire.");
    return;
  }

  let total = 0;
  for (const a of apfcs) {
    if (!a.regionId) continue;
    const etabs = await prisma.etablissement.findMany({
      where: { regionId: a.regionId, pays: "Côte d'Ivoire" },
      select: { id: true },
    });
    if (etabs.length === 0) {
      console.log(`— ${a.nom} (${a.region?.nom}) : aucun établissement au répertoire de cette DRENA.`);
      continue;
    }
    // skipDuplicates : respecte l'unicité par établissement (déjà couvert = ignoré, jamais volé).
    const r = await prisma.couvertureApfc.createMany({
      data: etabs.map((e) => ({ apfcId: a.id, etablissementId: e.id })),
      skipDuplicates: true,
    });
    total += r.count;
    console.log(`✓ ${a.nom} (${a.region?.nom}) : ${r.count} établissement(s) couvert(s) sur ${etabs.length} au répertoire.`);
  }

  const [couverts, repertoire] = await Promise.all([
    prisma.couvertureApfc.count(),
    prisma.etablissement.count({ where: { pays: "Côte d'Ivoire" } }),
  ]);
  console.log(`\nTerminé : ${total.toLocaleString("fr-FR")} rattachement(s) créé(s) — ${couverts.toLocaleString("fr-FR")} établissement(s) couvert(s) au total sur ${repertoire.toLocaleString("fr-FR")} au répertoire ivoirien.`);
  const sansApfc = repertoire - couverts;
  if (sansApfc > 0) {
    console.log(`(${sansApfc.toLocaleString("fr-FR")} établissement(s) sans APFC : leur DRENA n'a pas d'antenne au fichier officiel des 36 APFC.)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
