/**
 * SIMULATION « ABSENCES DES ENSEIGNANTS » — EDUWEB ACADEMY 3 (académie de démonstration).
 * Peuple la page Absences de l'établissement et la heatmap consultée par le réseau
 * catholique (SEDEC/SENEC) avec ~10 semaines d'absences RÉALISTES :
 *  - profils variés (deux enseignants souvent absents = points chauds de la heatmap,
 *    les autres rarement) ; journée / matin / après-midi ; motifs du quotidien ivoirien ;
 *  - statuts mêlés : autorisée (majorité), justifiée (maladie), non autorisée (~8 %).
 *
 * Enseignants : ceux DÉJÀ rattachés à l'académie (jusqu'à 12) ; s'il y en a moins de 8,
 * le complément est créé (comptes marqués « .simabs@eduweb.ci », mdp EduWeb@2026).
 * Saisi par : le chef de test de l'académie (test.chef.etablissement@eduweb.ci).
 *
 *   npm run db:seed:simulation-absences            → purge la simulation puis la (re)crée
 *   RESET=1 npm run db:seed:simulation-absences    → SUPPRIME uniquement la simulation
 *
 * Idempotent : la purge supprime TOUTES les absences de l'académie de démonstration
 * (établissement entièrement fictif) et les comptes marqués « .simabs@eduweb.ci ».
 * Déterministe : générateur pseudo-aléatoire à graine fixe — relance = même simulation.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile();
} catch {
  /* .env déjà injecté */
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const ETAB = "cms1k4qbj000104l0nspex5n4"; // EDUWEB ACADEMY 3
const PAYS = "Côte d'Ivoire";
const MDP = "EduWeb@2026";
const MARQUE = ".simabs@eduweb.ci";
const SEMAINES = 10;

// PRNG déterministe (mulberry32) — la simulation est REPRODUCTIBLE à l'identique.
function mulberry32(graine: number) {
  let a = graine >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const alea = mulberry32(20260805);

const ENSEIGNANTS_COMPLEMENT: [string, string][] = [
  ["Mariam", "KONAN"], ["Patrick", "N'DRI"], ["Affoué", "SILUÉ"], ["Éric", "DJÉDJÉ"],
  ["Solange", "SANGARÉ"], ["Landry", "KACOU"], ["Grâce", "SORO"], ["Kouadio", "YAO"],
  ["Rachelle", "AMANI"], ["Désiré", "MÉITÉ"], ["Fatou", "DIABY"], ["Serge", "KROA"],
];

/** Motifs pondérés : [motif, statut privilégié, poids]. */
const MOTIFS: [string, string, number][] = [
  ["Maladie (certificat médical fourni)", "justifiee", 30],
  ["Formation continue à l'APFC", "autorisee", 20],
  ["Convocation à la DRENA", "autorisee", 12],
  ["Événement familial", "autorisee", 14],
  ["Mission d'examen (surveillance BEPC blanc)", "autorisee", 10],
  ["Rendez-vous administratif", "autorisee", 8],
  ["Absence sans autorisation préalable", "non_autorisee", 6],
];

function tirerMotif(): { motif: string; statut: string } {
  const total = MOTIFS.reduce((s, m) => s + m[2], 0);
  let t = alea() * total;
  for (const [motif, statut, poids] of MOTIFS) {
    t -= poids;
    if (t <= 0) return { motif, statut };
  }
  return { motif: MOTIFS[0][0], statut: MOTIFS[0][1] };
}

function tirerDemiJournee(): string {
  const t = alea();
  return t < 0.5 ? "journee" : t < 0.75 ? "matin" : "apres_midi";
}

async function purge() {
  await prisma.absenceEnseignant.deleteMany({ where: { etablissementId: ETAB } });
  await prisma.utilisateur.deleteMany({ where: { email: { endsWith: MARQUE } } });
  console.log("Simulation d'absences purgée (académie de démonstration + comptes " + MARQUE + ").");
}

async function creer() {
  const etab = await prisma.etablissement.findUnique({ where: { id: ETAB }, select: { nom: true } });
  if (!etab) throw new Error("EDUWEB ACADEMY 3 introuvable.");

  // Saisi par : le chef de test de l'académie (repli : chef de la simulation Finances).
  const saisiPar =
    (await prisma.utilisateur.findFirst({ where: { email: "test.chef.etablissement@eduweb.ci" }, select: { id: true } })) ??
    (await prisma.utilisateur.findFirst({ where: { email: "chef.acad3@eduweb.ci" }, select: { id: true } }));
  if (!saisiPar) throw new Error("Aucun chef de test — lancez d'abord « npm run db:seed:comptes-test ».");

  // Enseignants existants de l'académie ; complément créé si moins de 8.
  const existants = await prisma.utilisateur.findMany({
    where: { etablissementId: ETAB, roleActif: { nomTechnique: "enseignant" } },
    select: { id: true, prenoms: true, nom: true },
    orderBy: { nom: "asc" },
    take: 12,
  });
  const enseignants = [...existants];
  if (enseignants.length < 8) {
    const roleEnseignant = await prisma.role.findFirst({ where: { nomTechnique: "enseignant" }, select: { id: true } });
    if (!roleEnseignant) throw new Error("Rôle enseignant introuvable.");
    const hash = await bcrypt.hash(MDP, 12);
    for (let i = enseignants.length; i < 8; i++) {
      const [prenoms, nom] = ENSEIGNANTS_COMPLEMENT[i % ENSEIGNANTS_COMPLEMENT.length];
      const e = await prisma.utilisateur.create({
        data: {
          email: `ens${i + 1}${MARQUE}`,
          motDePasseHash: hash,
          prenoms,
          nom,
          statutCompte: "actif",
          emailVerifieLe: new Date(),
          roleActifId: roleEnseignant.id,
          etablissementId: ETAB,
          pays: PAYS,
        },
        select: { id: true, prenoms: true, nom: true },
      });
      enseignants.push(e);
    }
  }

  // Profil d'assiduité (absences ATTENDUES par semaine) : deux « points chauds » bien
  // visibles sur la heatmap (~1,2 et ~0,9 absence/semaine), les autres sobres (~0,3).
  const probabilites = enseignants.map((_, i) => (i === 0 ? 1.2 : i === 1 ? 0.9 : 0.3));

  // Jours ouvrés (lundi→vendredi) des SEMAINES dernières semaines, à minuit UTC.
  const aujourdHui = new Date();
  const jours: Date[] = [];
  for (let r = SEMAINES * 7; r >= 1; r--) {
    const d = new Date(aujourdHui.getTime() - r * 86_400_000);
    const js = d.getUTCDay();
    if (js >= 1 && js <= 5) jours.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
  }

  let total = 0;
  const parStatut = new Map<string, number>();
  const parEnseignant = new Map<string, number>();
  for (const [index, ens] of enseignants.entries()) {
    // Probabilité PAR SEMAINE convertie par jour ouvré (÷5), sans double absence le même jour.
    const pJour = probabilites[index] / 5;
    for (const jour of jours) {
      if (alea() >= pJour) continue;
      const { motif, statut } = tirerMotif();
      await prisma.absenceEnseignant.create({
        data: {
          etablissementId: ETAB,
          enseignantId: ens.id,
          date: jour,
          demiJournee: tirerDemiJournee(),
          motif,
          statut,
          saisiParId: saisiPar.id,
        },
      });
      total++;
      parStatut.set(statut, (parStatut.get(statut) ?? 0) + 1);
      const nomComplet = `${ens.prenoms ?? ""} ${ens.nom ?? ""}`.trim();
      parEnseignant.set(nomComplet, (parEnseignant.get(nomComplet) ?? 0) + 1);
    }
  }

  console.log(`\nSimulation créée pour ${etab.nom} : ${total} absence(s) sur ${SEMAINES} semaines, ${enseignants.length} enseignant(s).`);
  console.log("Par statut : " + [...parStatut.entries()].map(([s, n]) => `${s}=${n}`).join(" · "));
  console.log("Par enseignant :");
  for (const [nom, n] of [...parEnseignant.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${nom} : ${n}`);
  }
}

async function main() {
  await purge();
  if (process.env.RESET === "1") return;
  await creer();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
