/**
 * Import des établissements secondaires de Côte d'Ivoire depuis le fichier officiel consolidé
 * (liste_etablissements_secondaires_cote_ivoire.xlsx, feuille « Etablissements »).
 *
 * Usage : node scripts/import-etablissements-ci.mjs <chemin-du-fichier.xlsx>
 *
 * - Crée (upsert) les régions DRENA manquantes (pays « Côte d'Ivoire », noms accentués propres).
 * - Insère les établissements manquants, identifiés par leur Code_DSPS (unique dans le fichier).
 * - Idempotent : relançable sans doublons (les codes déjà présents sont ignorés).
 */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");

const PAYS = "Côte d'Ivoire";

// DRENA du fichier (majuscules sans accents) → nom d'affichage propre.
const DRENA_PROPRE = {
  "ABENGOUROU": "Abengourou", "ABIDJAN 1": "Abidjan 1", "ABIDJAN 2": "Abidjan 2",
  "ABIDJAN 3": "Abidjan 3", "ABIDJAN 4": "Abidjan 4", "ABOISSO": "Aboisso",
  "ADZOPE": "Adzopé", "AGBOVILLE": "Agboville", "BONDOUKOU": "Bondoukou",
  "BONGOUANOU": "Bongouanou", "BOUAFLE": "Bouaflé", "BOUAKE 1": "Bouaké 1",
  "BOUAKE 2": "Bouaké 2", "BOUNA": "Bouna", "BOUNDIALI": "Boundiali",
  "DABOU": "Dabou", "DALOA": "Daloa", "DANANE": "Danané", "DAOUKRO": "Daoukro",
  "DIMBOKRO": "Dimbokro", "DIVO": "Divo", "DUEKOUE": "Duékoué",
  "FERKESSEDOUGOU": "Ferkessédougou", "GAGNOA": "Gagnoa", "GRAND-BASSAM": "Grand-Bassam",
  "GUIGLO": "Guiglo", "ISSIA": "Issia", "KATIOLA": "Katiola", "KORHOGO": "Korhogo",
  "MAN": "Man", "MANKONO": "Mankono", "MINIGNAN": "Minignan", "ODIENNE": "Odienné",
  "SAN-PEDRO": "San-Pédro", "SASSANDRA": "Sassandra", "SEGUELA": "Séguéla",
  "SINFRA": "Sinfra", "SOUBRE": "Soubré", "TIASSALE": "Tiassalé", "TOUBA": "Touba",
  "YAMOUSSOUKRO": "Yamoussoukro",
};

function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Type d'établissement : catégorie source pour le public, déduction par le nom pour le privé. */
function typeDe(categorie, nom) {
  if (categorie === "Collèges publics") return "college";
  if (categorie === "Lycées publics") return "lycee";
  const n = norm(nom);
  if (n.startsWith("lycee") || n.includes(" lycee")) return "lycee";
  if (n.startsWith("groupe scolaire") || n.startsWith("gs ")) return "groupe_scolaire";
  if (n.startsWith("college") || n.includes("college")) return "college";
  if (n.startsWith("institut") || n.startsWith("cours ")) return "college";
  return "autre";
}

const chemin = process.argv[2] ?? "C:/Users/HP/Downloads/liste_etablissements_secondaires_cote_ivoire.xlsx";
const wb = XLSX.read(readFileSync(chemin));
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Etablissements"], { defval: "" });
console.log(`Fichier lu : ${rows.length} lignes.`);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── 1) Régions (DRENA) ──
const regionsExistantes = await prisma.region.findMany({ select: { id: true, nom: true, pays: true } });
const regionParNorm = new Map(regionsExistantes.filter((r) => r.pays === PAYS).map((r) => [norm(r.nom), r.id]));

const drenasFichier = [...new Set(rows.map((r) => String(r["DRENA"]).trim()).filter(Boolean))];
let regionsCreees = 0;
for (const brut of drenasFichier) {
  const propre = DRENA_PROPRE[brut] ?? brut.charAt(0) + brut.slice(1).toLowerCase();
  if (regionParNorm.has(norm(propre))) continue;
  const r = await prisma.region.create({ data: { nom: propre, pays: PAYS } });
  regionParNorm.set(norm(propre), r.id);
  regionsCreees += 1;
}
console.log(`Régions : ${drenasFichier.length} DRENA dans le fichier, ${regionsCreees} créée(s).`);

// ── 2) Établissements ──
const codesExistants = new Set(
  (await prisma.etablissement.findMany({ where: { code: { not: null } }, select: { code: true } })).map((e) => e.code),
);

const aInserer = [];
let ignores = 0;
for (const r of rows) {
  const code = String(r["Code_DSPS"]).trim();
  const nom = String(r["Nom de l'établissement"]).trim();
  if (!nom) continue;
  if (code && codesExistants.has(code)) {
    ignores += 1;
    continue;
  }
  const drena = DRENA_PROPRE[String(r["DRENA"]).trim()] ?? String(r["DRENA"]).trim();
  aInserer.push({
    nom,
    code: code || null,
    type: typeDe(String(r["Catégorie de fichier source"]).trim(), nom),
    statut: norm(r["Statut"]) === "prive" ? "prive" : "public",
    ville: String(r["Commune"]).trim() || String(r["Localité"]).trim() || null,
    pays: PAYS,
    regionId: regionParNorm.get(norm(drena)) ?? null,
  });
}

let crees = 0;
const LOT = 500;
for (let i = 0; i < aInserer.length; i += LOT) {
  const res = await prisma.etablissement.createMany({ data: aInserer.slice(i, i + LOT), skipDuplicates: true });
  crees += res.count;
}

const parType = aInserer.reduce((a, e) => ((a[e.type] = (a[e.type] ?? 0) + 1), a), {});
console.log(`Établissements : ${crees} créé(s), ${ignores} déjà présent(s) (code connu).`);
console.log("Répartition par type :", JSON.stringify(parType));

await prisma.$disconnect();
