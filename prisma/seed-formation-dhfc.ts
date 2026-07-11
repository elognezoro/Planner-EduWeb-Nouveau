/**
 * Consolide le programme DHFC-EBiS en UNE SEULE formation sur la page « Formations » :
 *  - supprime les 15 sessions fictives individuelles (une par cours dhfc-*) ;
 *  - crée une session unique « DHFC-EBiS - ANALYSE DE BESOINS » dont les 15 cours du
 *    programme (module maître + 14 syllabus) sont les MODULES, liés et cliquables.
 * Idempotent : réexécutable sans doublon.
 *
 *   npm run db:seed:formation-dhfc
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TITRE = "DHFC-EBiS - ANALYSE DE BESOINS";
const MARQUEUR = "Paramètres fictifs à personnaliser";

/** Ordre pédagogique des modules : module maître d'abord, puis EBiS, EP, CA, CE. */
const ORDRE_SLUGS = [
  "dhfc-module-maitre",
  "dhfc-ebis-01", "dhfc-ebis-02", "dhfc-ebis-03", "dhfc-ebis-04", "dhfc-ebis-05", "dhfc-ebis-06", "dhfc-ebis-07",
  "dhfc-ep-01", "dhfc-ep-02", "dhfc-ep-03", "dhfc-ep-04",
  "dhfc-ca-01", "dhfc-ca-02",
  "dhfc-ce-01",
];

async function main() {
  const cours = await prisma.cours.findMany({
    where: { slug: { startsWith: "dhfc-" }, statut: "publie" },
    select: { id: true, slug: true, titre: true },
  });
  const parSlug = new Map(cours.map((c) => [c.slug, c]));
  const ordonnes = ORDRE_SLUGS.map((s) => parSlug.get(s)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (ordonnes.length === 0) {
    console.log("Aucun cours DHFC publié : rien à consolider.");
    return;
  }

  // 1) Supprime les sessions individuelles fictives des cours DHFC + toute session unique précédente.
  const purge = await prisma.sessionFormation.deleteMany({
    where: {
      OR: [
        { description: { contains: MARQUEUR }, coursIds: { hasSome: ordonnes.map((c) => c.id) } },
        { titre: TITRE },
      ],
    },
  });
  console.log(`  – ${purge.count} session(s) individuelle(s) supprimée(s)`);

  // 2) Crée la formation unique, avec les 15 cours comme modules liés.
  await prisma.sessionFormation.create({
    data: {
      titre: TITRE,
      description:
        `Formation unique du programme DHFC-EBiS (MENA · DPFC · AUF · AFD), issue de l'Analyse des besoins de formation. ` +
        `Elle regroupe ${ordonnes.length} modules — le module maître et les 14 syllabus (EBiS, EP, Chefs d'APFC, Chef d'établissement) — listés ci-dessous en « Cours liés ». ` +
        `Dispositif hybride : présentiel + distanciel. ${MARQUEUR} : dates, animateur, lieu/lien visio, places et public cible sont à ajuster depuis « Gérer ».`,
      format: "webinaire",
      animateur: "DPFC · Équipe DHFC-EBiS (à désigner)",
      dateDebut: new Date("2026-09-09T09:00:00"),
      dateFin: new Date("2026-11-04T17:00:00"),
      dureeMinutes: null,
      lienVisio: "https://meet.google.com/a-definir",
      lieu: null,
      placesMax: 100,
      publicCible: [],
      pays: null,
      statut: "planifiee",
      coursIds: ordonnes.map((c) => c.id),
    },
  });
  console.log(`  ✔ « ${TITRE} » — ${ordonnes.length} modules liés :`);
  for (const c of ordonnes) console.log(`      · ${c.titre}`);

  console.log("\nConsolidation terminée — personnalisez la formation depuis Formations › Gérer.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
