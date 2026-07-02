/**
 * Seed de base.
 * - 13 rôles (source de vérité = couche RBAC) + compte admin initial.
 * - Référentiels nationaux (Phase 2) : régions, niveaux, disciplines, grille horaire nationale,
 *   année scolaire et configuration globale.
 * Exécuter après avoir branché une vraie DATABASE_URL :  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { ROLES, ROLE_IDS } from "../src/lib/rbac/roles";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const REGIONS = [
  "Abidjan 1",
  "Abidjan 2",
  "Yamoussoukro",
  "Bouaké",
  "Korhogo",
  "Daloa",
  "San-Pédro",
  "Man",
  "Gagnoa",
  "Abengourou",
  "Bondoukou",
  "Odienné",
];

const NIVEAUX: { nom: string; ordre: number; cycle: "college" | "lycee" }[] = [
  { nom: "6ème", ordre: 1, cycle: "college" },
  { nom: "5ème", ordre: 2, cycle: "college" },
  { nom: "4ème", ordre: 3, cycle: "college" },
  { nom: "3ème", ordre: 4, cycle: "college" },
  { nom: "2nde A", ordre: 5, cycle: "lycee" },
  { nom: "2nde C", ordre: 6, cycle: "lycee" },
  { nom: "1ère A", ordre: 7, cycle: "lycee" },
  { nom: "1ère C", ordre: 8, cycle: "lycee" },
  { nom: "1ère D", ordre: 9, cycle: "lycee" },
  { nom: "Tle A", ordre: 10, cycle: "lycee" },
  { nom: "Tle C", ordre: 11, cycle: "lycee" },
  { nom: "Tle D", ordre: 12, cycle: "lycee" },
];

const DISCIPLINES: { nom: string; couleur: string }[] = [
  { nom: "Français", couleur: "#c0392b" },
  { nom: "Mathématiques", couleur: "#2f7d5e" },
  { nom: "Anglais", couleur: "#2980b9" },
  { nom: "Histoire-Géographie", couleur: "#8e6f1e" },
  { nom: "SVT", couleur: "#27ae60" },
  { nom: "Physique-Chimie", couleur: "#7d3c98" },
  { nom: "Philosophie", couleur: "#34495e" },
  { nom: "EPS", couleur: "#d35400" },
  { nom: "Espagnol", couleur: "#e67e22" },
  { nom: "Informatique", couleur: "#16a085" },
  { nom: "Arts & Musique", couleur: "#c2185b" },
  { nom: "Éducation civique et morale", couleur: "#607d8b" },
];

// Volume horaire hebdomadaire indicatif (modèle national par défaut, modifiable par établissement).
const HEURES_COLLEGE: Record<string, number> = {
  Français: 5,
  Mathématiques: 4,
  Anglais: 4,
  "Histoire-Géographie": 3,
  SVT: 3,
  "Physique-Chimie": 2,
  EPS: 2,
  Espagnol: 2,
  "Arts & Musique": 1,
  "Éducation civique et morale": 1,
};
const HEURES_LYCEE: Record<string, number> = {
  Français: 4,
  Mathématiques: 5,
  Anglais: 3,
  "Histoire-Géographie": 3,
  SVT: 3,
  "Physique-Chimie": 4,
  Philosophie: 3,
  EPS: 2,
  Espagnol: 2,
  Informatique: 1,
};

const ANNEE_SCOLAIRE = "2025-2026";

async function main() {
  console.log("→ Rôles (13)…");
  for (const id of ROLE_IDS) {
    const def = ROLES[id];
    await prisma.role.upsert({
      where: { nomTechnique: id },
      update: { libelle: def.libelle, description: def.description, rang: def.rang },
      create: { nomTechnique: id, libelle: def.libelle, description: def.description, rang: def.rang },
    });
  }

  const roleAdmin = await prisma.role.findUniqueOrThrow({ where: { nomTechnique: "admin" } });
  const emailAdmin = (process.env.ADMIN_EMAIL ?? "admin@eduweb.ci").toLowerCase();
  const motDePasseAdmin = process.env.ADMIN_PASSWORD ?? "ChangeMoi!2026";
  const hash = await bcrypt.hash(motDePasseAdmin, 12);
  const admin = await prisma.utilisateur.upsert({
    where: { email: emailAdmin },
    update: {},
    create: {
      email: emailAdmin,
      motDePasseHash: hash,
      nom: "Système",
      prenoms: "Administrateur",
      statutCompte: "actif",
      emailVerifieLe: new Date(),
      roleActifId: roleAdmin.id,
    },
  });
  console.log(`  ✓ admin : ${admin.email}`);

  console.log("→ Régions…");
  for (const nom of REGIONS) {
    await prisma.region.upsert({
      where: { pays_nom: { pays: "Côte d'Ivoire", nom } },
      update: {},
      create: { nom, pays: "Côte d'Ivoire" },
    });
  }

  console.log("→ Niveaux…");
  for (const n of NIVEAUX) {
    await prisma.niveau.upsert({
      where: { nom: n.nom },
      update: { ordre: n.ordre, cycle: n.cycle },
      create: { nom: n.nom, ordre: n.ordre, cycle: n.cycle },
    });
  }

  console.log("→ Disciplines…");
  for (const d of DISCIPLINES) {
    await prisma.discipline.upsert({
      where: { nom: d.nom },
      update: { couleur: d.couleur },
      create: { nom: d.nom, couleur: d.couleur },
    });
  }

  console.log("→ Grille horaire nationale…");
  const niveaux = await prisma.niveau.findMany();
  const disciplines = await prisma.discipline.findMany();
  const discParNom = new Map(disciplines.map((d) => [d.nom, d.id]));

  // On réinitialise les lignes nationales (etablissementId null) puis on les recrée.
  await prisma.grilleHoraire.deleteMany({ where: { etablissementId: null } });
  const lignes: {
    niveauId: string;
    disciplineId: string;
    heuresHebdo: number;
    coefficient: number;
  }[] = [];
  for (const niveau of niveaux) {
    const map = niveau.cycle === "lycee" ? HEURES_LYCEE : HEURES_COLLEGE;
    for (const [nomDisc, heures] of Object.entries(map)) {
      const disciplineId = discParNom.get(nomDisc);
      if (!disciplineId) continue;
      lignes.push({ niveauId: niveau.id, disciplineId, heuresHebdo: heures, coefficient: heures });
    }
  }
  await prisma.grilleHoraire.createMany({ data: lignes });
  console.log(`  ✓ ${lignes.length} lignes de grille`);

  console.log("→ Année scolaire & configuration…");
  await prisma.anneeScolaire.upsert({
    where: { libelle: ANNEE_SCOLAIRE },
    update: { active: true },
    create: { libelle: ANNEE_SCOLAIRE, active: true },
  });
  await prisma.configuration.upsert({
    where: { id: "global" },
    update: { anneeScolaireCourante: ANNEE_SCOLAIRE },
    create: { id: "global", anneeScolaireCourante: ANNEE_SCOLAIRE, regimeNotation: "trimestre" },
  });

  if (!process.env.ADMIN_PASSWORD) {
    console.log(`\n  (mot de passe admin par défaut : ${motDePasseAdmin} — à changer)`);
  }
  console.log("✓ Seed terminé.");
}

main()
  .catch((e) => {
    console.error("✗ Échec du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
