/**
 * COMPTES TEST — un compte CONNECTABLE par type d'acteur APFC, pour l'exploitation
 * TEST d'EduWeb Planner. Idempotent : relançable à volonté ; chaque exécution
 * RÉINITIALISE le mot de passe de ces comptes au mot de passe de test (ce sont des
 * comptes d'essai assumés — ne jamais les utiliser en production réelle).
 *
 *   npm run db:seed:comptes-test
 *   TEST_PASSWORD=... npm run db:seed:comptes-test   (mot de passe personnalisé)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MOT_DE_PASSE = process.env.TEST_PASSWORD ?? "EduWebTest!2026";

async function main() {
  const [roles, apfc] = await Promise.all([
    prisma.role.findMany({
      where: { nomTechnique: { in: ["super_admin_apfc", "apfc_admin", "chef_antenne", "conseiller_pedagogique"] } },
      select: { id: true, nomTechnique: true },
    }),
    prisma.apfc.findFirst({ where: { nom: "APFC Abidjan 1" }, select: { id: true, nom: true } }),
  ]);
  const roleId = (t: string) => {
    const r = roles.find((x) => x.nomTechnique === t)?.id;
    if (!r) throw new Error(`Rôle introuvable : ${t}`);
    return r;
  };
  if (!apfc) throw new Error("« APFC Abidjan 1 » introuvable — lancez d'abord db:seed:apfc-ci.");

  const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
  const COMPTES = [
    {
      email: "test.superadmin.apfc@eduweb.ci", role: "super_admin_apfc",
      prenoms: "Test", nom: "SUPER ADMIN APFC", apfcId: null as string | null, specialites: undefined as string[] | undefined,
    },
    { email: "admin.apfc@eduweb.ci", role: "apfc_admin", prenoms: "Test", nom: "ADMIN APFC", apfcId: apfc.id, specialites: undefined },
    { email: "chef.antenne@eduweb.ci", role: "chef_antenne", prenoms: "Test", nom: "CHEF D'ANTENNE", apfcId: apfc.id, specialites: undefined },
    {
      email: "conseiller@eduweb.ci", role: "conseiller_pedagogique",
      prenoms: "Test", nom: "CONSEILLER PÉDAGOGIQUE", apfcId: apfc.id, specialites: ["Français"],
    },
  ];

  for (const c of COMPTES) {
    const donnees = {
      motDePasseHash: hash,
      roleActifId: roleId(c.role),
      apfcId: c.apfcId,
      pays: "Côte d'Ivoire",
      statutCompte: "actif" as const,
      emailVerifieLe: new Date(),
      ...(c.specialites ? { specialites: c.specialites } : {}),
    };
    await prisma.utilisateur.upsert({
      where: { email: c.email },
      update: donnees,
      create: { email: c.email, prenoms: c.prenoms, nom: c.nom, ...donnees },
    });
    console.log(`✓ ${c.email} — ${c.role}${c.apfcId ? ` (${apfc.nom})` : " (pays : Côte d'Ivoire)"}`);
  }

  console.log(`\nMot de passe de TEST (réinitialisé à chaque exécution) : ${MOT_DE_PASSE}`);
  console.log("⚠️ Comptes d'essai uniquement — à supprimer ou re-sécuriser avant l'exploitation réelle.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
