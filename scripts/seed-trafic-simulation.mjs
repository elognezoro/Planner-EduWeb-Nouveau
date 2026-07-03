/**
 * Simulation de trafic pour le widget « temps réel » de la page d'accueil :
 * visites et connexions des 7 derniers jours, avec un profil réaliste
 * (pics en journée scolaire, creux la nuit et le week-end).
 *
 * Usage : node scripts/seed-trafic-simulation.mjs
 * Idempotent : ne fait rien si la table contient déjà plus de 100 lignes.
 * Pour repartir de zéro : TRUNCATE TABLE visites_site;
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const deja = await prisma.visiteSite.count();
if (deja > 100) {
  console.log(`Trafic déjà présent (${deja} lignes) — rien à faire.`);
  await prisma.$disconnect();
  process.exit(0);
}

// Pseudo-aléatoire déterministe (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHEMINS = ["/", "/app/tableau-de-bord", "/app/vie-scolaire/registre-appel", "/connexion", "/app/emplois-du-temps"];
const lignes = [];
const maintenant = Date.now();

for (let h = 7 * 24 - 1; h >= 1; h--) {
  const debutHeure = maintenant - h * 3600 * 1000;
  const d = new Date(debutHeure);
  const heure = d.getHours();
  const jourSemaine = d.getDay(); // 0 = dim, 6 = sam

  // Profil : forte activité 7 h–19 h en semaine, modérée le samedi matin, faible sinon.
  let base;
  if (heure >= 7 && heure <= 19) base = jourSemaine === 0 ? 3 : jourSemaine === 6 ? 8 : 18;
  else if (heure >= 20 && heure <= 22) base = 6;
  else base = 1;

  const alea = rng(h * 2654435761);
  const visites = Math.max(0, Math.round(base + (alea() - 0.5) * base));
  const connexions = Math.round(visites * (0.35 + alea() * 0.2));

  for (let v = 0; v < visites; v++) {
    lignes.push({
      type: "visite",
      chemin: CHEMINS[Math.floor(alea() * CHEMINS.length)],
      creeLe: new Date(debutHeure + Math.floor(alea() * 3600 * 1000)),
    });
  }
  for (let c = 0; c < connexions; c++) {
    lignes.push({ type: "connexion", chemin: null, creeLe: new Date(debutHeure + Math.floor(alea() * 3600 * 1000)) });
  }
}

await prisma.visiteSite.createMany({ data: lignes });
console.log(`✓ Trafic simulé : ${lignes.length} événements sur 7 jours (${lignes.filter((l) => l.type === "visite").length} visites, ${lignes.filter((l) => l.type === "connexion").length} connexions).`);
await prisma.$disconnect();
