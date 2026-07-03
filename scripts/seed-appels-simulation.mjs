/**
 * Simulation d'appels HORODATÉS pour alimenter la heatmap de présence et les cumuls
 * du registre d'appel — classes 6e A et 3ème A du Lycée moderne de Cocody.
 *
 * Usage : node scripts/seed-appels-simulation.mjs
 *
 * Idempotent : une séance (classe + date + créneau) déjà existante n'est jamais recréée.
 * Génère les 15 derniers jours ouvrés (lun–ven, hors aujourd'hui) × 6 créneaux, avec des
 * statuts pseudo-aléatoires DÉTERMINISTES (mêmes données à chaque exécution) : ~92–97 % de
 * présence selon le créneau/jour, absences en partie justifiées avec motif, quelques retards.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const CLASSES = ["6e A", "3ème A"];
const CRENEAUX = ["07h30 - 08h30", "08h30 - 09h30", "09h30 - 10h30", "10h30 - 11h30", "15h00 - 16h00", "16h00 - 17h00"];
const NB_JOURS_OUVRES = 15;
const MOTIFS = ["Maladie", "Rendez-vous médical", "Raison familiale", "Convocation administrative"];

// Pseudo-aléatoire déterministe (mulberry32) — mêmes tirages à chaque exécution.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Contexte ──
const etab = await prisma.etablissement.findFirst({
  where: { nom: { contains: "cocody", mode: "insensitive" }, classes: { some: {} } },
  select: { id: true, nom: true },
});
if (!etab) throw new Error("Lycée moderne de Cocody introuvable.");

const admin = await prisma.utilisateur.findFirst({
  where: { roleActif: { nomTechnique: "admin" } },
  select: { id: true },
});
if (!admin) throw new Error("Aucun compte admin (saisiParId).");

const disciplines = await prisma.discipline.findMany({ orderBy: { nom: "asc" }, select: { id: true } });

// 15 derniers jours ouvrés (hors aujourd'hui), du plus ancien au plus récent.
const jours = [];
const curseur = new Date();
curseur.setUTCHours(0, 0, 0, 0);
while (jours.length < NB_JOURS_OUVRES) {
  curseur.setUTCDate(curseur.getUTCDate() - 1);
  const dow = curseur.getUTCDay(); // 1..5 = lun..ven
  if (dow >= 1 && dow <= 5) jours.unshift(new Date(curseur));
}

let appelsCrees = 0;
let presencesCreees = 0;

for (const nomClasse of CLASSES) {
  const classe = await prisma.classe.findFirst({
    where: { etablissementId: etab.id, nom: nomClasse },
    select: { id: true, nom: true },
  });
  if (!classe) {
    console.warn(`⚠️ Classe ${nomClasse} introuvable — ignorée.`);
    continue;
  }
  const eleves = (
    await prisma.inscription.findMany({ where: { classeId: classe.id }, select: { eleveId: true } })
  ).map((i) => i.eleveId);
  if (eleves.length === 0) continue;

  for (let j = 0; j < jours.length; j++) {
    const date = jours[j];
    const dow = date.getUTCDay();
    for (let s = 0; s < CRENEAUX.length; s++) {
      const heureSeance = CRENEAUX[s];

      // Idempotence : la séance existe déjà → on ne touche à rien.
      const existe = await prisma.appel.findFirst({
        where: { classeId: classe.id, date, heureSeance },
        select: { id: true },
      });
      if (existe) continue;

      // Taux d'absence variable : plus élevé en fin de journée et le vendredi (heatmap lisible).
      const base = 0.04 + (s >= 4 ? 0.04 : 0) + (dow === 5 ? 0.04 : 0);

      const appel = await prisma.appel.create({
        data: {
          classeId: classe.id,
          date,
          heureSeance,
          disciplineId: disciplines[(j * CRENEAUX.length + s) % disciplines.length]?.id ?? null,
          saisiParId: admin.id,
        },
      });
      appelsCrees += 1;

      const donnees = eleves.map((eleveId, e) => {
        const alea = rng(j * 100003 + s * 1009 + e * 7 + classe.id.length);
        const t = alea();
        let statut = "present";
        if (t < base) statut = "absent";
        else if (t < base + 0.02) statut = "retard";
        const justifie = statut !== "present" && alea() < 0.45;
        const motif = justifie && alea() < 0.8 ? MOTIFS[Math.floor(alea() * MOTIFS.length)] : null;
        return { appelId: appel.id, eleveId, statut, justifie, motif };
      });
      await prisma.presence.createMany({ data: donnees });
      presencesCreees += donnees.length;
    }
  }
  console.log(`✓ ${classe.nom} : séances simulées prêtes.`);
}

console.log(`Terminé : ${appelsCrees} appel(s) créé(s), ${presencesCreees} présence(s) — ${NB_JOURS_OUVRES} jours × ${CRENEAUX.length} créneaux.`);
await prisma.$disconnect();
