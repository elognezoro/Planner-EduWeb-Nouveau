/**
 * Redistribution des établissements catholiques (réseau SEDEC) de Côte d'Ivoire
 * dans leur diocèse RESPECTIF, déduit de la LOCALITÉ (ville, à défaut région
 * DRENAET) via la carte ecclésiastique partagée (localites-dioceses-ci.ts).
 *
 *   npx tsx prisma/seed-redistribution-dioceses-ci.ts          → SIMULATION (rapport)
 *   APPLY=1 npx tsx prisma/seed-redistribution-dioceses-ci.ts  → application
 *
 * Corrige les rattachements contredits par la localité (ex. un établissement de
 * Dabou rattaché à l'Archidiocèse d'Abidjan → Diocèse de Yopougon). Un
 * établissement dont la localité est INCONNUE de la carte est CONSERVÉ tel quel
 * (jamais dégradé) et simplement signalé. Idempotent.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { diocesesDuPays } from "../src/lib/referentiels/dioceses";
import { D, dioceseDeLocalite } from "./localites-dioceses-ci";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PAYS = "Côte d'Ivoire";
const APPLY = process.env.APPLY === "1";

async function main() {
  console.log(APPLY ? "MODE APPLICATION (écritures en base)" : "MODE SIMULATION (aucune écriture)");
  const refs = new Set(diocesesDuPays(PAYS));
  for (const d of Object.values(D)) if (!refs.has(d)) throw new Error(`Diocèse hors référentiel : ${d}`);

  const etabs = await prisma.etablissement.findMany({
    where: { pays: { equals: PAYS, mode: "insensitive" }, statut: "confessionnel", reseauConfessionnel: "SEDEC" },
    orderBy: [{ nom: "asc" }],
    select: { id: true, nom: true, ville: true, diocese: true, region: { select: { nom: true } } },
  });
  console.log(`Établissements SEDEC (${PAYS}) : ${etabs.length}\n`);

  let nbCorriges = 0, nbConformes = 0, nbInconnus = 0, nbCompletes = 0;
  for (const e of etabs) {
    const attendu = dioceseDeLocalite(e.ville, e.region?.nom ?? null);
    if (!attendu) {
      nbInconnus++;
      console.log(`? LOCALITÉ INCONNUE — conservé « ${e.diocese ?? "sans diocèse"} » : ${e.nom} (${e.ville ?? "?"} · ${e.region?.nom ?? "?"})`);
      continue;
    }
    if (e.diocese === attendu) {
      nbConformes++;
      continue;
    }
    if (e.diocese) {
      nbCorriges++;
      console.log(`~ CORRIGÉ  ${e.nom} (${e.ville ?? "?"} · ${e.region?.nom ?? "?"}) : ${e.diocese} → ${attendu}`);
    } else {
      nbCompletes++;
      console.log(`+ COMPLÉTÉ ${e.nom} (${e.ville ?? "?"} · ${e.region?.nom ?? "?"}) : (sans diocèse) → ${attendu}`);
    }
    if (APPLY) {
      await prisma.etablissement.update({ where: { id: e.id }, data: { diocese: attendu } });
    }
  }

  console.log(`\nBilan : ${nbCorriges} corrigé(s) · ${nbCompletes} complété(s) · ${nbConformes} déjà conforme(s) · ${nbInconnus} localité(s) inconnue(s) (conservés)`);

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
