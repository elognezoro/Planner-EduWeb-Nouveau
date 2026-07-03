/**
 * Remplace « Espagnol » (et « Allemand » si présente) par « LV2 » dans le référentiel
 * des disciplines — demande métier : les langues vivantes 2 sont regroupées sous LV2.
 *
 * Usage : node scripts/renommer-espagnol-lv2.mjs
 *
 * Idempotent :
 *  - si LV2 existe déjà : rien à faire pour Espagnol (déjà migrée) ;
 *  - sinon « Espagnol » est RENOMMÉE en LV2 (toutes les références — grilles, compétences,
 *    affectations, notes… — sont préservées puisque l'id ne change pas) ;
 *  - « Allemand », si elle existe, est fusionnée : ses références basculent vers LV2
 *    puis elle est supprimée (ou simplement renommée s'il n'y a pas encore de LV2).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const lv2 = await prisma.discipline.findFirst({ where: { nom: { equals: "LV2", mode: "insensitive" } } });
const espagnol = await prisma.discipline.findFirst({ where: { nom: { equals: "Espagnol", mode: "insensitive" } } });
const allemand = await prisma.discipline.findFirst({ where: { nom: { equals: "Allemand", mode: "insensitive" } } });

let idLv2 = lv2?.id ?? null;

if (!idLv2 && espagnol) {
  await prisma.discipline.update({ where: { id: espagnol.id }, data: { nom: "LV2" } });
  idLv2 = espagnol.id;
  console.log("✔ « Espagnol » renommée en « LV2 » (références préservées).");
} else if (idLv2 && espagnol && espagnol.id !== idLv2) {
  console.log("• LV2 existe déjà : fusion d'« Espagnol » nécessaire — non automatique, vérifiez manuellement.");
} else if (!espagnol) {
  console.log("• « Espagnol » absente (déjà migrée ?).");
}

if (allemand) {
  if (!idLv2) {
    await prisma.discipline.update({ where: { id: allemand.id }, data: { nom: "LV2" } });
    console.log("✔ « Allemand » renommée en « LV2 ».");
  } else {
    // Bascule des références vers LV2 puis suppression d'Allemand.
    await prisma.$transaction([
      prisma.grilleHoraire.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.competenceEnseignant.deleteMany({
        where: { disciplineId: allemand.id, enseignant: { competences: { some: { disciplineId: idLv2 } } } },
      }),
      prisma.competenceEnseignant.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.affectationEnseignant.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.note.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.cahierTexte.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.appel.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.effectifEnseignant.updateMany({ where: { disciplineId: allemand.id }, data: { disciplineId: idLv2 } }),
      prisma.discipline.delete({ where: { id: allemand.id } }),
    ]);
    console.log("✔ « Allemand » fusionnée dans « LV2 » puis supprimée.");
  }
} else {
  console.log("• « Allemand » absente : rien à fusionner.");
}

const finales = await prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { nom: true } });
console.log("Disciplines finales :", finales.map((d) => d.nom).join(", "));
await prisma.$disconnect();
