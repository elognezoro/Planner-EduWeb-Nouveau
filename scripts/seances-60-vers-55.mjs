/**
 * Convertit la durée unitaire des séances de 60 → 55 minutes dans les grilles horaires
 * ENREGISTRÉES par les établissements (le modèle national, stocké en heures, est dérivé
 * en séances de 55 min à l'affichage depuis le correctif applicatif).
 *
 * Usage : node scripts/seances-60-vers-55.mjs
 *
 * Idempotent : seules les valeurs exactement égales à 60 sont remplacées par 55 —
 * les durées personnalisées (90, 110…) sont conservées. heuresHebdo est recalculé.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const grilles = await prisma.grilleHoraire.findMany({
  where: { etablissementId: { not: null }, seancesMinutes: { has: 60 } },
  select: { id: true, seancesMinutes: true },
});

let converties = 0;
for (const g of grilles) {
  const seances = g.seancesMinutes.map((m) => (m === 60 ? 55 : m));
  await prisma.grilleHoraire.update({
    where: { id: g.id },
    data: { seancesMinutes: seances, heuresHebdo: seances.reduce((a, b) => a + b, 0) / 60 },
  });
  converties++;
}
console.log(`✔ ${converties} grille(s) d'établissement converties (séances 60 min → 55 min).`);
await prisma.$disconnect();
