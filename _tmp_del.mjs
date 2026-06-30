import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
process.loadEnvFile();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const avant = await prisma.utilisateur.count();
// On supprime aussi les créneaux générés (références enseignants devenues caduques) sur ces établissements de test.
const r = await prisma.utilisateur.deleteMany({ where: { email: { not: "admin@eduweb.ci" } } });
const apres = await prisma.utilisateur.count();
console.log(`Utilisateurs avant : ${avant}`);
console.log(`Supprimés : ${r.count}`);
console.log(`Restants : ${apres}`);
const restants = await prisma.utilisateur.findMany({ select: { email: true, roleActif: { select: { nomTechnique: true } } } });
console.log("Comptes conservés :", restants.map((u) => `${u.email} (${u.roleActif.nomTechnique})`).join(", "));
await prisma.$disconnect();
