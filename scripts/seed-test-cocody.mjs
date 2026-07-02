/**
 * Peuplement de TEST pour le parcours complet des rôles — Lycée moderne de Cocody.
 *
 * Usage : node scripts/seed-test-cocody.mjs
 *
 * Crée (idempotent, relançable) :
 *  - CAFOP d'Abidjan et APFC d'Abidjan (région Abidjan 1) s'ils n'existent pas ;
 *  - un compte par rôle (hors admin système) avec le périmètre adéquat ;
 *  - 20 élèves inscrits dans de vraies classes (12 en 6e A, 8 en 3ème A) ;
 *  - 8 parents liés à leurs enfants (liens père/mère).
 *
 * Tous les comptes de test partagent le mot de passe : Test-Cocody26
 * (les enseignants existent déjà — mot de passe à définir via « mot de passe oublié »
 *  ou via la fiche compte de l'admin).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MOT_DE_PASSE = "Test-Cocody26";
const DOMAINE = "@lycee-moderne-de-cocody.eduweb.ci";

// ── Contexte ──
const etab = await prisma.etablissement.findFirst({
  where: { nom: { contains: "cocody", mode: "insensitive" }, classes: { some: {} } },
  select: { id: true, nom: true, regionId: true },
});
if (!etab) throw new Error("Lycée moderne de Cocody introuvable.");
if (!etab.regionId) throw new Error("L'établissement n'est rattaché à aucune région.");

const annee = await prisma.anneeScolaire.findFirst({ where: { active: true } });
const roles = new Map(
  (await prisma.role.findMany({ select: { id: true, nomTechnique: true } })).map((r) => [r.nomTechnique, r.id]),
);
const hash = await bcrypt.hash(MOT_DE_PASSE, 12);

// ── Structures CAFOP / APFC ──
async function assurerStructure(modele, nom) {
  const table = modele === "cafop" ? prisma.cafop : prisma.apfc;
  const existant = await table.findFirst({ where: { nom } });
  if (existant) return existant.id;
  const cree = await table.create({ data: { nom, regionId: etab.regionId } });
  console.log(`+ ${modele.toUpperCase()} créé : ${nom}`);
  return cree.id;
}
const cafopId = await assurerStructure("cafop", "CAFOP d'Abidjan");
const apfcId = await assurerStructure("apfc", "APFC d'Abidjan");

// ── Création (upsert) d'un compte ──
async function compte({ email, prenoms, nom, role, perimetre = {} }) {
  const roleId = roles.get(role);
  if (!roleId) throw new Error(`Rôle inconnu : ${role}`);
  const u = await prisma.utilisateur.upsert({
    where: { email },
    update: { roleActifId: roleId, motDePasseHash: hash, statutCompte: "actif", emailVerifieLe: new Date(), prenoms, nom, ...perimetre },
    create: { email, prenoms, nom, motDePasseHash: hash, statutCompte: "actif", emailVerifieLe: new Date(), roleActifId: roleId, ...perimetre },
  });
  return u.id;
}

// ── 1) Encadrement & pilotage (un compte par rôle) ──
const comptesPilotage = [
  { email: `admin.etab${DOMAINE}`, prenoms: "Béatrice", nom: "Kouamé", role: "etablissements_admin", perimetre: { etablissementId: etab.id }, libelle: "Admin Établissements" },
  { email: `chef${DOMAINE}`, prenoms: "Ernest", nom: "N'Guessan", role: "chef_etablissement", perimetre: { etablissementId: etab.id }, libelle: "Chef d'établissement" },
  { email: `educateur1${DOMAINE}`, prenoms: "Mariam", nom: "Doumbia", role: "educateur", perimetre: { etablissementId: etab.id }, libelle: "Éducatrice" },
  { email: `educateur2${DOMAINE}`, prenoms: "Casimir", nom: "Aka", role: "educateur", perimetre: { etablissementId: etab.id }, libelle: "Éducateur" },
  { email: "drena.abidjan1@eduweb.ci", prenoms: "Henriette", nom: "Bamba", role: "drena", perimetre: { regionId: etab.regionId }, libelle: "DRENA Abidjan 1" },
  { email: "inspecteur.abidjan1@eduweb.ci", prenoms: "Gaston", nom: "Yao", role: "inspecteur", perimetre: { regionId: etab.regionId }, libelle: "Inspecteur Abidjan 1" },
  { email: "admin.cafop@eduweb.ci", prenoms: "Rosine", nom: "Koffi", role: "cafop_admin", perimetre: { cafopId }, libelle: "Admin CAFOP d'Abidjan" },
  { email: "admin.apfc@eduweb.ci", prenoms: "Firmin", nom: "Ouattara", role: "apfc_admin", perimetre: { apfcId }, libelle: "Admin APFC d'Abidjan" },
  { email: "chef.antenne@eduweb.ci", prenoms: "Solange", nom: "Kone", role: "chef_antenne", perimetre: { apfcId, regionId: etab.regionId }, libelle: "Chef d'antenne" },
  { email: "conseiller@eduweb.ci", prenoms: "Didier", nom: "Tanoh", role: "conseiller_pedagogique", perimetre: { apfcId, regionId: etab.regionId }, libelle: "Conseiller pédagogique" },
];
for (const c of comptesPilotage) await compte(c);
console.log(`✓ ${comptesPilotage.length} comptes d'encadrement/pilotage.`);

// ── 2) Élèves (12 en 6e A, 8 en 3ème A) + inscriptions ──
const PRENOMS_E = ["Aya", "Koffi", "Adjoua", "Yao", "Affoué", "Kouassi", "Akissi", "Konan", "Amenan", "Brou", "Fatou", "Ibrahim", "Grâce", "Moussa", "Rebecca", "Cédric", "Awa", "Landry", "Estelle", "Junior"];
const NOMS_E = ["Traoré", "Kouadio", "Coulibaly", "Assi", "N'Dri", "Séka", "Gnamien", "Touré", "Ehui", "Diabaté", "Kacou", "Soro", "Adou", "Yéo", "Loukou", "Cissé", "Kanga", "Djédjé", "Fofana", "Tanoh"];

const classe6e = await prisma.classe.findFirst({ where: { etablissementId: etab.id, nom: "6e A" } });
const classe3e = await prisma.classe.findFirst({ where: { etablissementId: etab.id, nom: "3ème A" } });
if (!classe6e || !classe3e) throw new Error("Classes 6e A / 3ème A introuvables.");

const eleveIds = [];
for (let i = 0; i < 20; i++) {
  const id = await compte({
    email: `eleve${i + 1}${DOMAINE}`,
    prenoms: PRENOMS_E[i],
    nom: NOMS_E[i],
    role: "eleve",
    perimetre: { etablissementId: etab.id },
  });
  eleveIds.push(id);
  const classeId = i < 12 ? classe6e.id : classe3e.id;
  await prisma.inscription.upsert({
    where: { eleveId_anneeScolaireId: { eleveId: id, anneeScolaireId: annee?.id ?? null } },
    update: { classeId },
    create: { eleveId: id, classeId, anneeScolaireId: annee?.id ?? null },
  }).catch(async () => {
    // Clé composite avec annee nulle impossible en upsert : repli create simple.
    const deja = await prisma.inscription.findFirst({ where: { eleveId: id } });
    if (!deja) await prisma.inscription.create({ data: { eleveId: id, classeId, anneeScolaireId: annee?.id ?? null } });
  });
}
console.log("✓ 20 élèves créés et inscrits (12 en 6e A, 8 en 3ème A).");

// ── 3) Parents (8) + liens parent-élève ──
const PARENTS = [
  ["Albertine", "Traoré"], ["Georges", "Kouadio"], ["Nadia", "Coulibaly"], ["Paul", "Assi"],
  ["Clarisse", "N'Dri"], ["Bernard", "Séka"], ["Odette", "Touré"], ["Michel", "Diabaté"],
];
// parents 1..6 → 2 enfants chacun (élèves 1..12) ; parents 7..8 → 4 enfants chacun (13..20)
const affectations = [
  [0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11],
  [12, 13, 14, 15], [16, 17, 18, 19],
];
for (let p = 0; p < PARENTS.length; p++) {
  const parentId = await compte({
    email: `parent${p + 1}${DOMAINE}`,
    prenoms: PARENTS[p][0],
    nom: PARENTS[p][1],
    role: "parent",
    perimetre: { etablissementId: etab.id },
  });
  for (const idx of affectations[p]) {
    await prisma.lienParentEleve.upsert({
      where: { parentId_eleveId: { parentId, eleveId: eleveIds[idx] } },
      update: {},
      create: { parentId, eleveId: eleveIds[idx], lien: p % 2 === 0 ? "mère" : "père" },
    });
  }
}
console.log("✓ 8 parents créés et liés à leurs enfants.");

// ── Récapitulatif ──
const total = await prisma.utilisateur.count({ where: { etablissementId: etab.id } });
console.log(`\nComptes rattachés à ${etab.nom} : ${total}`);
console.log(`Mot de passe commun de test : ${MOT_DE_PASSE}`);
await prisma.$disconnect();
