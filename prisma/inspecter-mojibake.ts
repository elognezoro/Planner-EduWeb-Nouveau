/**
 * INSPECTION (lecture seule) des caractères perdus « � » (U+FFFD) gravés en base par
 * d'anciens imports CSV mal décodés (fichiers Windows-1252 lus en UTF-8).
 * Liste les valeurs touchées, table par table, pour construire une réparation EXPLICITE.
 *   npx tsx prisma/inspecter-mojibake.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const FFFD = "�";

async function main() {
  // Personnel des APFC (cas signalé par le client).
  const personnel = await prisma.personnelApfc.findMany({
    where: {
      OR: [
        { nom: { contains: FFFD } },
        { prenoms: { contains: FFFD } },
        { fonction: { contains: FFFD } },
        { email: { contains: FFFD } },
      ],
    },
    select: { id: true, nom: true, prenoms: true, fonction: true, email: true, disciplines: true },
  });
  console.log(`\n== personnel_apfc : ${personnel.length} fiche(s) touchée(s)`);
  for (const p of personnel) {
    console.log(JSON.stringify({ id: p.id, nom: p.nom, prenoms: p.prenoms, fonction: p.fonction, email: p.email, disciplines: p.disciplines }));
  }
  // Disciplines (Json) contenant un U+FFFD sans que les champs texte soient touchés.
  const tous = await prisma.personnelApfc.findMany({ select: { id: true, disciplines: true } });
  const discAbimees = tous.filter((p) => Array.isArray(p.disciplines) && (p.disciplines as unknown[]).some((d) => typeof d === "string" && d.includes(FFFD)));
  console.log(`   (disciplines Json touchées : ${discAbimees.length} fiche(s))`);
  for (const p of discAbimees) console.log(JSON.stringify(p));

  // Autres tables alimentées par imports CSV.
  const [apfcs, enseignantsCafop, apprenants, utilisateurs, etabs, disciplines] = await Promise.all([
    prisma.apfc.count({ where: { nom: { contains: FFFD } } }),
    prisma.enseignantCafop.findMany({
      where: { OR: [{ nom: { contains: FFFD } }, { prenoms: { contains: FFFD } }, { discipline: { contains: FFFD } }] },
      select: { id: true, nom: true, prenoms: true, discipline: true },
    }),
    prisma.apprenant.findMany({
      where: { OR: [{ nom: { contains: FFFD } }, { prenoms: { contains: FFFD } }, { etablissementOrigine: { contains: FFFD } }] },
      select: { id: true, nom: true, prenoms: true, etablissementOrigine: true },
      take: 50,
    }),
    prisma.utilisateur.findMany({
      where: { OR: [{ nom: { contains: FFFD } }, { prenoms: { contains: FFFD } }] },
      select: { id: true, nom: true, prenoms: true, email: true },
      take: 50,
    }),
    prisma.etablissement.findMany({
      where: { OR: [{ nom: { contains: FFFD } }, { ville: { contains: FFFD } }] },
      select: { id: true, nom: true, ville: true },
      take: 50,
    }),
    prisma.discipline.findMany({ where: { nom: { contains: FFFD } }, select: { id: true, nom: true } }),
  ]);
  console.log(`\n== apfc (nom) : ${apfcs}`);
  console.log(`== enseignants_cafop : ${enseignantsCafop.length}`);
  for (const e of enseignantsCafop) console.log(JSON.stringify(e));
  console.log(`== apprenants (50 max) : ${apprenants.length}`);
  for (const a of apprenants) console.log(JSON.stringify(a));
  console.log(`== utilisateurs (50 max) : ${utilisateurs.length}`);
  for (const u of utilisateurs) console.log(JSON.stringify(u));
  console.log(`== etablissements (50 max) : ${etabs.length}`);
  for (const e of etabs) console.log(JSON.stringify(e));
  console.log(`== disciplines : ${disciplines.length}`);
  for (const d of disciplines) console.log(JSON.stringify(d));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
