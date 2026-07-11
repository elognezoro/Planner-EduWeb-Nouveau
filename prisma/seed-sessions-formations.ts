/**
 * Pré-installe une SESSION fictive par formation publiée du LMS « Aide et Formation »,
 * pour que l'administrateur les personnalise ensuite depuis « Gérer » (dates, animateur,
 * lieu/lien, places, public cible…).
 *
 * - Une session par cours publié (hors cours « Démo — … » qui ont déjà leurs sessions).
 * - Calendrier fictif : mercredis 10h-12h (webinaire) et samedis 9h-13h (atelier),
 *   en alternance à partir du mercredi 9 septembre 2026.
 * - Chaque session est liée à son cours (coursIds) et marquée « paramètres fictifs »
 *   dans la description — le nettoyage idempotent s'appuie sur ce marqueur.
 *
 *   npm run db:seed:sessions
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MARQUEUR = "Paramètres fictifs à personnaliser";

function plusJours(base: Date, jours: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + jours);
  return d;
}
function aHeure(d: Date, h: number): Date {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return x;
}

async function main() {
  // Nettoyage idempotent des sessions fictives générées précédemment.
  const purge = await prisma.sessionFormation.deleteMany({ where: { description: { contains: MARQUEUR } } });
  if (purge.count) console.log(`  – ${purge.count} session(s) fictive(s) précédente(s) supprimée(s)`);

  // Exclut la démo ET le programme DHFC (consolidé en une session unique par seed-formation-dhfc.ts).
  const cours = await prisma.cours.findMany({
    where: { statut: "publie", NOT: [{ slug: { startsWith: "demo-" } }, { slug: { startsWith: "dhfc-" } }] },
    orderBy: [{ categorie: { ordre: "asc" } }, { ordre: "asc" }, { titre: "asc" }],
    select: { id: true, titre: true },
  });
  if (cours.length === 0) {
    console.log("Aucun cours publié : rien à programmer.");
    return;
  }

  // Base : mercredi 9 septembre 2026. Alternance mercredi (webinaire) / samedi (atelier).
  const mercrediBase = new Date("2026-09-09T00:00:00");
  let crees = 0;
  for (let i = 0; i < cours.length; i++) {
    const c = cours[i];
    const semaine = Math.floor(i / 2);
    const estWebinaire = i % 2 === 0;
    const jour = plusJours(mercrediBase, semaine * 7 + (estWebinaire ? 0 : 3)); // mercredi ou samedi
    const debut = aHeure(jour, estWebinaire ? 10 : 9);
    const fin = aHeure(jour, estWebinaire ? 12 : 13);

    await prisma.sessionFormation.create({
      data: {
        titre: c.titre,
        description: `Session de formation « ${c.titre} ». ${MARQUEUR} : dates, animateur, lieu/lien visio, places et public cible sont à ajuster depuis « Gérer ».`,
        format: estWebinaire ? "webinaire" : "atelier",
        animateur: "Formateur à désigner",
        dateDebut: debut,
        dateFin: fin,
        dureeMinutes: estWebinaire ? 120 : 240,
        lienVisio: estWebinaire ? "https://meet.google.com/a-definir" : null,
        lieu: estWebinaire ? null : "Lieu à définir",
        placesMax: 50,
        publicCible: [],
        pays: null,
        statut: "planifiee",
        coursIds: [c.id],
      },
    });
    crees++;
    console.log(`  ✔ ${estWebinaire ? "Webinaire" : "Atelier "} ${debut.toLocaleDateString("fr-FR")} — ${c.titre}`);
  }

  console.log(`\n${crees} session(s) fictive(s) programmée(s) — personnalisez-les depuis Aide et Formation › Formations › Gérer.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
