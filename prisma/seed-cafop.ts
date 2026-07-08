/**
 * Seed dédié aux CAFOP (tableau de bord « Gestion des CAFOP »).
 * Idempotent : upsert des 16 centres par nom + création des promotions manquantes.
 * N'affecte AUCUNE autre donnée (ni année scolaire, ni admin, ni référentiels).
 *
 *   npm run db:seed:cafop
 *
 * Données de démonstration (directeurs, téléphones, effectifs fictifs) pour la simulation.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Directeurs (cycle de 8) — M./Mme selon le prénom.
const DIRECTEURS = [
  "M. KOUASSI Jean",
  "Mme BROU Hélène",
  "M. YAO Daniel",
  "Mme TANOH Grâce",
  "M. DOUMBIA Moussa",
  "Mme CISSÉ Awa",
  "M. AKA Jules",
  "Mme KONÉ Mariam",
];
// Effectifs (cycle de 7) — somme sur 16 centres = 6420 élèves-maîtres.
const EFFECTIFS = [240, 300, 360, 420, 480, 540, 600];

const pad2 = (n: number) => String(Math.abs(n) % 100).padStart(2, "0");
function telephone(i: number): string {
  return `+225 07 ${pad2(i * 7 + 11)} ${pad2(i * 13 + 5)} ${pad2(i * 17 + 3)} ${pad2(i * 23 + 9)}`;
}

// 16 CAFOP : nom, code, DRENA (direction régionale), localité.
const CENTRES: { nom: string; code: string; drena: string; localite: string }[] = [
  { nom: "CAFOP d'Abengourou", code: "CAF-ABG-001", drena: "Abengourou", localite: "Abengourou" },
  { nom: "CAFOP d'Abidjan", code: "CAF-ABJ-002", drena: "Abidjan", localite: "Abidjan" },
  { nom: "CAFOP d'Aboisso", code: "CAF-ABO-003", drena: "Aboisso", localite: "Aboisso" },
  { nom: "CAFOP de Bondoukou", code: "CAF-BDK-004", drena: "Bondoukou", localite: "Bondoukou" },
  { nom: "CAFOP de Bouaké 1", code: "CAF-BK1-005", drena: "Bouaké", localite: "Bouaké 1" },
  { nom: "CAFOP de Bouaké 2", code: "CAF-BK2-006", drena: "Bouaké", localite: "Bouaké 2" },
  { nom: "CAFOP de Gagnoa", code: "CAF-GAG-007", drena: "Gagnoa", localite: "Gagnoa" },
  { nom: "CAFOP de Dabou", code: "CAF-DAB-008", drena: "Dabou", localite: "Dabou" },
  { nom: "CAFOP de Daloa", code: "CAF-DAL-009", drena: "Daloa", localite: "Daloa" },
  { nom: "CAFOP de Grand-Bassam", code: "CAF-GBA-010", drena: "Grand-Bassam", localite: "Grand-Bassam" },
  { nom: "CAFOP de Katiola", code: "CAF-KAT-011", drena: "Katiola", localite: "Katiola" },
  { nom: "CAFOP de Korhogo", code: "CAF-KOR-012", drena: "Korhogo", localite: "Korhogo" },
  { nom: "CAFOP de Man", code: "CAF-MAN-013", drena: "Man", localite: "Man" },
  { nom: "CAFOP d'Odienné", code: "CAF-ODI-014", drena: "Odienné", localite: "Odienné" },
  { nom: "CAFOP de San-Pédro", code: "CAF-SAN-015", drena: "San-Pédro", localite: "San-Pedro" },
  { nom: "CAFOP de Yamoussoukro", code: "CAF-YAM-016", drena: "Yamoussoukro", localite: "Yamoussoukro" },
];

// Modules de formation des élèves-maîtres (évalués dans les bulletins).
const MODULES = [
  "Psychopédagogie",
  "Didactique des disciplines",
  "Législation et déontologie scolaires",
  "Français et communication",
  "Mathématiques et sciences",
  "Pratique professionnelle (stage)",
];

// Promotions par centre (vue « Promotions »).
const PROMOS: { libelle: string; anneeDebut: number; anneeFin: number; statut: "active" | "cloturee"; nbCohortes: number; baseProg: number }[] = [
  { libelle: "Promotion 2023-2025", anneeDebut: 2023, anneeFin: 2025, statut: "cloturee", nbCohortes: 2, baseProg: 100 },
  { libelle: "Promotion 2024-2026", anneeDebut: 2024, anneeFin: 2026, statut: "active", nbCohortes: 3, baseProg: 68 },
  { libelle: "Promotion 2025-2027", anneeDebut: 2025, anneeFin: 2027, statut: "active", nbCohortes: 2, baseProg: 34 },
];

async function main() {
  console.log("→ CAFOP (16 centres)…");
  for (let i = 0; i < CENTRES.length; i++) {
    const c = CENTRES[i];
    const data = {
      code: c.code,
      pays: "Côte d'Ivoire",
      drena: c.drena,
      localite: c.localite,
      directeur: DIRECTEURS[i % DIRECTEURS.length],
      directeurTel: telephone(i),
      effectif: EFFECTIFS[i % EFFECTIFS.length],
    };
    const existant = await prisma.cafop.findFirst({ where: { nom: c.nom }, select: { id: true } });
    const cafop = existant
      ? await prisma.cafop.update({ where: { id: existant.id }, data })
      : await prisma.cafop.create({ data: { nom: c.nom, ...data } });

    // Promotions (idempotent : on ne recrée pas celles déjà présentes).
    for (let p = 0; p < PROMOS.length; p++) {
      const pr = PROMOS[p];
      const deja = await prisma.cohorte.findFirst({
        where: { cafopId: cafop.id, libelle: pr.libelle, type: "cafop_promotion" },
        select: { id: true },
      });
      if (deja) continue;
      await prisma.cohorte.create({
        data: {
          type: "cafop_promotion",
          cafopId: cafop.id,
          libelle: pr.libelle,
          anneeDebut: pr.anneeDebut,
          anneeFin: pr.anneeFin,
          statut: pr.statut,
          nbCohortes: pr.nbCohortes,
          effectif: 168 + ((i * 3 + p * 6) % 7) * 3, // ~168–186
          progression: Math.min(100, pr.baseProg + (pr.statut === "cloturee" ? 0 : i % 6)),
        },
      });
    }
  }

  console.log("→ Modules de formation…");
  for (let m = 0; m < MODULES.length; m++) {
    const nom = MODULES[m];
    const existant = await prisma.moduleCafop.findFirst({ where: { nom }, select: { id: true } });
    if (existant) await prisma.moduleCafop.update({ where: { id: existant.id }, data: { ordre: m, actif: true } });
    else await prisma.moduleCafop.create({ data: { nom, ordre: m, actif: true } });
  }

  const [nbCafop, nbPromos, agg, effAgg, nbModules] = await Promise.all([
    prisma.cafop.count(),
    prisma.cohorte.count({ where: { type: "cafop_promotion" } }),
    prisma.cohorte.aggregate({ where: { type: "cafop_promotion" }, _sum: { nbCohortes: true } }),
    prisma.cafop.aggregate({ _sum: { effectif: true } }),
    prisma.moduleCafop.count({ where: { actif: true } }),
  ]);
  console.log(
    `✓ CAFOP : ${nbCafop} centres · ${nbPromos} promotions · ${agg._sum.nbCohortes ?? 0} cohortes · ${effAgg._sum.effectif ?? 0} élèves-maîtres · ${nbModules} modules`,
  );
}

main()
  .catch((e) => {
    console.error("✗ Échec du seed CAFOP :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
