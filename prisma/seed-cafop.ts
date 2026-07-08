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

// Modules de formation des élèves-maîtres (évalués dans les bulletins) + coefficient.
const MODULES: { nom: string; coef: number }[] = [
  { nom: "Droits de l'Homme", coef: 2 },
  { nom: "Gestion des classes à profil spécifique", coef: 2 },
  { nom: "Environnement et vie scolaire", coef: 1 },
  { nom: "Éducation à la santé", coef: 1 },
  { nom: "Évaluation commune", coef: 2 },
  { nom: "Stage pratique", coef: 2 },
];

// Élèves-maîtres de démonstration : NOMS + prénoms ivoiriens (combinés de façon déterministe).
const NOMS = ["KONÉ", "AGUIE", "DIABATÉ", "TRAORÉ", "TANOH", "CISSÉ", "OUATTARA", "BAMBA", "BROU", "KOUADIO", "AKA", "YAO", "KOUASSI", "DOUMBIA", "GNAGNE", "ZADI", "N'GUESSAN", "KOFFI", "ASSI", "TOURÉ", "BAKAYOKO", "SORO", "GBAGBO", "DOSSO", "KONAN"];
const PRENOMS = ["Moussa Ibrahim", "Yao Serge", "Konan Éric", "Adjoua Esther", "Akissi Laure", "Fatou Bintou", "Souleymane", "Max-Urbain", "Koffi Jean", "Aya Clarisse", "Affoué Marie", "Aboubacar", "Mariam", "Kouamé Paul", "Djénéba", "Roland", "Amenan Grace", "Ismaël", "Rachelle", "Yacouba", "Awa", "Franck", "Nadège", "Ali", "Chantal"];
const TYPES_EVAL = ["Devoir surveillé", "Interrogation écrite", "Composition", "Exposé"];

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
  const nomsModules = MODULES.map((m) => m.nom);
  await prisma.moduleCafop.deleteMany({ where: { nom: { notIn: nomsModules } } }); // retire les anciens modules
  for (let m = 0; m < MODULES.length; m++) {
    const { nom, coef } = MODULES[m];
    const existant = await prisma.moduleCafop.findFirst({ where: { nom }, select: { id: true } });
    const data = { ordre: m, actif: true, coefficient: coef };
    if (existant) await prisma.moduleCafop.update({ where: { id: existant.id }, data });
    else await prisma.moduleCafop.create({ data: { nom, ...data } });
  }

  console.log("→ Élèves-maîtres & notes (démonstration, semestre 2)…");
  const modulesDb = await prisma.moduleCafop.findMany({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { id: true } });
  const cafopsDb = await prisma.cafop.findMany({ select: { id: true, nom: true } });
  let totalEleves = 0;
  for (let ci = 0; ci < cafopsDb.length; ci++) {
    const cf = cafopsDb[ci];
    let promo = await prisma.cohorte.findFirst({
      where: { cafopId: cf.id, libelle: "Promotion 2026-2028", type: "cafop_promotion" },
      select: { id: true },
    });
    if (!promo) {
      promo = await prisma.cohorte.create({
        data: {
          type: "cafop_promotion",
          cafopId: cf.id,
          libelle: "Promotion 2026-2028",
          anneeDebut: 2026,
          anneeFin: 2028,
          statut: "active",
          nbCohortes: 2,
          effectif: 24,
          progression: 20,
        },
        select: { id: true },
      });
    }
    // Idempotence : ne seeder les élèves-maîtres que si la promotion est vide.
    if ((await prisma.apprenant.count({ where: { cohorteId: promo.id } })) > 0) continue;

    const nbEleves = 24;
    const apprenants = Array.from({ length: nbEleves }, (_, e) => ({
      cohorteId: promo!.id,
      nom: NOMS[(ci * 5 + e) % NOMS.length],
      prenoms: PRENOMS[(ci * 7 + e * 3) % PRENOMS.length],
      matricule: `EM-${cf.id.slice(-4)}-${String(e + 1).padStart(3, "0")}`,
      groupe: e < 12 ? "F1" : "F2",
    }));
    await prisma.apprenant.createMany({ data: apprenants });
    const eleves = await prisma.apprenant.findMany({ where: { cohorteId: promo.id }, orderBy: { creeLe: "asc" }, select: { id: true } });
    totalEleves += eleves.length;

    const notes = eleves.flatMap((el, e) =>
      modulesDb.map((mod, m) => {
        const base = 9 + ((e * 3 + m * 5 + ci) % 10); // 9..18
        const valeur = Math.round((base + ((e + m) % 2 ? 0.5 : 0)) * 10) / 10;
        return {
          apprenantId: el.id,
          moduleId: mod.id,
          type: TYPES_EVAL[(e + m) % TYPES_EVAL.length],
          valeur,
          bareme: 20,
          coefficient: (e + m) % 3 === 0 ? 2 : 1,
          semestre: 2,
        };
      }),
    );
    await prisma.noteCafop.createMany({ data: notes });
  }
  console.log(`  ✓ ${totalEleves} élèves-maîtres + notes semestre 2`);

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
