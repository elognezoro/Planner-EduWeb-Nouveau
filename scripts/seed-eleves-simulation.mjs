/**
 * Liste fictive d'élèves pour la SIMULATION du registre d'appel — 6e A, Lycée moderne de Cocody.
 *
 * Usage : node scripts/seed-eleves-simulation.mjs
 *
 * Idempotent (relançable sans doublons) :
 *  - complète la 6e A jusqu'à 25 élèves (noms ivoiriens réalistes) ;
 *  - renseigne sexe + matricule (26-6A-0XX) des élèves qui n'en ont pas ;
 *  - garantit à CHAQUE élève un parent lié avec téléphone (simulation des SMS aux parents).
 *
 * Comptes créés avec le mot de passe de test commun : Test-Cocody26.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MOT_DE_PASSE = "Test-Cocody26";
const DOMAINE = "@lycee-moderne-de-cocody.eduweb.ci";
const CIBLE = 25;

// ── Contexte ──
const etab = await prisma.etablissement.findFirst({
  where: { nom: { contains: "cocody", mode: "insensitive" }, classes: { some: {} } },
  select: { id: true, nom: true },
});
if (!etab) throw new Error("Lycée moderne de Cocody introuvable.");
const classe = await prisma.classe.findFirst({
  where: { etablissementId: etab.id, nom: "6e A" },
  select: { id: true, nom: true },
});
if (!classe) throw new Error("Classe 6e A introuvable.");
const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });
const roleEleve = await prisma.role.findUnique({ where: { nomTechnique: "eleve" } });
const roleParent = await prisma.role.findUnique({ where: { nomTechnique: "parent" } });
if (!roleEleve || !roleParent) throw new Error("Rôles eleve/parent introuvables.");
const hash = await bcrypt.hash(MOT_DE_PASSE, 12);

// ── Sexe déduit du prénom usuel (élèves existants) ──
const PRENOMS_F = new Set(["awa", "adjoua", "amenan", "akissi", "fatou", "affoue", "affoué", "aya", "sarah", "mariam", "aminata", "fanta", "salimata", "estelle", "rokia", "akoua", "ahou", "grace", "gracia"]);
function sexeDe(prenoms) {
  const dernier = (prenoms ?? "").trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  return PRENOMS_F.has(dernier.normalize("NFD").replace(/[̀-ͯ]/g, "")) || PRENOMS_F.has(dernier) ? "F" : "M";
}

// ── 13 élèves supplémentaires (dont les noms de la maquette) ──
const NOUVEAUX = [
  { nom: "Kouamé", prenoms: "Awa", sexe: "F" },
  { nom: "Ouattara", prenoms: "Sarah", sexe: "F" },
  { nom: "N'Guessan", prenoms: "Fatou", sexe: "F" },
  { nom: "Koné", prenoms: "Moussa", sexe: "M" },
  { nom: "Diomandé", prenoms: "Mariam", sexe: "F" },
  { nom: "Bamba", prenoms: "Sékou", sexe: "M" },
  { nom: "Koffi", prenoms: "Affoué Clarisse", sexe: "F" },
  { nom: "Silué", prenoms: "Adama", sexe: "M" },
  { nom: "Tanoh", prenoms: "Franck", sexe: "M" },
  { nom: "Konan", prenoms: "Salimata", sexe: "F" },
  { nom: "Gnahoré", prenoms: "Serge", sexe: "M" },
  { nom: "Zadi", prenoms: "Grâce", sexe: "F" },
  { nom: "Diabaté", prenoms: "Lacina", sexe: "M" },
];

// ── 1) Compléter la classe à 25 élèves (emails dédiés « sim. » — jamais en collision) ──
function slug(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
const inscrits = await prisma.inscription.findMany({
  where: { classeId: classe.id },
  include: { eleve: true },
});
const manquants = Math.max(0, CIBLE - inscrits.length);
let crees = 0;
for (let k = 0; k < manquants && k < NOUVEAUX.length; k++) {
  const n = NOUVEAUX[k];
  const email = `sim.${slug(n.prenoms)}.${slug(n.nom)}${DOMAINE}`;
  const eleve = await prisma.utilisateur.upsert({
    where: { email },
    update: {},
    create: {
      email,
      motDePasseHash: hash,
      nom: n.nom,
      prenoms: n.prenoms,
      sexe: n.sexe,
      statutCompte: "actif",
      emailVerifieLe: new Date(),
      roleActifId: roleEleve.id,
      etablissementId: etab.id,
    },
  });
  // Un élève n'est inscrit qu'une fois par année scolaire : on saute s'il l'est déjà (où que ce soit).
  const dejaInscrit = await prisma.inscription.findFirst({ where: { eleveId: eleve.id } });
  if (!dejaInscrit) {
    await prisma.inscription.create({
      data: { eleveId: eleve.id, classeId: classe.id, anneeScolaireId: annee?.id ?? null },
    });
    crees += 1;
  }
}

// ── 2) Sexe + matricules (ordre alphabétique, 26-6A-001…) ──
const tous = (
  await prisma.inscription.findMany({
    where: { classeId: classe.id },
    include: { eleve: true },
  })
)
  .map((i) => i.eleve)
  .sort((a, b) => `${a.nom} ${a.prenoms}`.localeCompare(`${b.nom} ${b.prenoms}`));

let matriculesPoses = 0;
for (let idx = 0; idx < tous.length; idx++) {
  const e = tous[idx];
  const donnees = {};
  if (!e.sexe) donnees.sexe = sexeDe(e.prenoms);
  if (!e.matricule) {
    donnees.matricule = `26-6A-${String(idx + 1).padStart(3, "0")}`;
    matriculesPoses += 1;
  }
  if (!e.dateNaissance) {
    // Dates plausibles pour une 6e (11–13 ans), déterministes par position.
    const annee = 2013 + (idx % 3); // 2013..2015
    const mois = (idx % 12) + 1;
    const jour = ((idx * 7) % 27) + 1;
    donnees.dateNaissance = new Date(Date.UTC(annee, mois - 1, jour));
  }
  if (Object.keys(donnees).length > 0) {
    await prisma.utilisateur.update({ where: { id: e.id }, data: donnees });
  }
}

// ── 3) Un parent joignable (téléphone) pour chaque élève ──
const PRENOMS_PARENT_M = ["Bernard", "Ousmane", "Michel", "Souleymane", "Georges", "Mamadou", "Paul", "Issouf", "Ernest", "Daouda", "Casimir", "Fofana", "Norbert"];
const PRENOMS_PARENT_F = ["Chantal", "Rosine", "Mariame", "Georgette", "Clémence", "Assétou", "Véronique", "Henriette", "Joséphine", "Bintou", "Solange", "Odette", "Berthe"];
let parentsCrees = 0;
let telsPoses = 0;
let numTel = 100;

for (let idx = 0; idx < tous.length; idx++) {
  const e = tous[idx];
  numTel += 1;
  const liens = await prisma.lienParentEleve.findMany({
    where: { eleveId: e.id },
    include: { parent: true },
  });
  if (liens.length > 0) {
    // Parent existant : s'assurer qu'au moins un a un téléphone.
    if (!liens.some((l) => l.parent.telephone)) {
      await prisma.utilisateur.update({
        where: { id: liens[0].parentId },
        data: { telephone: `+225 07 000 ${String(numTel).padStart(4, "0")}` },
      });
      telsPoses += 1;
    }
    continue;
  }
  // Créer un parent (père ou mère en alternance) lié à l'élève.
  const estPere = idx % 2 === 0;
  const prenoms = estPere ? PRENOMS_PARENT_M[idx % PRENOMS_PARENT_M.length] : PRENOMS_PARENT_F[idx % PRENOMS_PARENT_F.length];
  const email = `parent.eleve-${e.matricule?.toLowerCase() ?? idx + 1}${DOMAINE}`;
  const parent = await prisma.utilisateur.upsert({
    where: { email },
    update: {},
    create: {
      email,
      motDePasseHash: hash,
      nom: e.nom,
      prenoms,
      sexe: estPere ? "M" : "F",
      telephone: `+225 07 000 ${String(numTel).padStart(4, "0")}`,
      statutCompte: "actif",
      emailVerifieLe: new Date(),
      roleActifId: roleParent.id,
    },
  });
  const dejaLie = await prisma.lienParentEleve.findFirst({
    where: { parentId: parent.id, eleveId: e.id },
  });
  if (!dejaLie) {
    await prisma.lienParentEleve.create({
      data: { parentId: parent.id, eleveId: e.id, lien: estPere ? "père" : "mère" },
    });
    parentsCrees += 1;
  }
}

const total = await prisma.inscription.count({ where: { classeId: classe.id } });
console.log(`✓ ${classe.nom} (${etab.nom}) : ${total} élèves inscrits (${crees} créés).`);
console.log(`  Matricules attribués : ${matriculesPoses} · Parents créés/liés : ${parentsCrees} · Téléphones complétés : ${telsPoses}.`);
console.log(`  Mot de passe des comptes de test : ${MOT_DE_PASSE}`);
await prisma.$disconnect();
