/**
 * Import multi-pays des établissements scolaires depuis les répertoires consolidés
 * (fichiers Excel fournis — Mali, Cameroun, Bénin, Sénégal, Niger, Burkina Faso).
 *
 * Usage : node scripts/import-etablissements-multi.mjs [dossier=C:/Users/HP/Downloads] [pays...]
 *   ex.  node scripts/import-etablissements-multi.mjs                → tous les pays
 *        node scripts/import-etablissements-multi.mjs . mali benin  → sélection
 *
 * - Régions upsert par (pays, nom) ; établissements identifiés par un code stable
 *   préfixé pays (idempotent, relançable sans doublons).
 * - Le Togo (pas de liste nominative) et la Mauritanie (lignes modèles) sont exclus.
 */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile(".env");

function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function titre(s) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((m) => (m.length > 2 ? m.charAt(0).toUpperCase() + m.slice(1) : m))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Type d'établissement déduit du cycle déclaré et du nom. */
function typeDe(cycle, nom) {
  const c = norm(cycle);
  const n = norm(nom);
  if (n.includes("lycee") || c.includes("lycee")) return "lycee";
  if (c.includes("prescolaire") || c.includes("maternelle") || n.includes("maternelle")) return "prescolaire";
  if (c.includes("fondamental") || c.includes("primaire") || c.includes("base")) return "primaire";
  if (c.includes("secondaire") || c.includes("moyen") || n.includes("college") || n.startsWith("ceg")) return "college";
  if (n.includes("groupe scolaire") || n.startsWith("gs ")) return "groupe_scolaire";
  if (n.includes("ecole") || n.includes("school")) return "primaire";
  return "autre";
}

/** Statut déduit du libellé source. */
function statutDe(statut) {
  const s = norm(statut);
  if (s.includes("prive")) {
    return s.includes("catholique") || s.includes("islamique") || s.includes("protestant") || s.includes("confessionnel")
      ? "confessionnel"
      : "prive";
  }
  if (s.includes("medersa") || s.includes("catholique") || s.includes("confessionnel")) return "confessionnel";
  if (s.includes("public")) return "public";
  return "autre";
}

function lignes(dossier, fichier, feuille) {
  const wb = XLSX.read(readFileSync(`${dossier}/${fichier}`));
  return XLSX.utils.sheet_to_json(wb.Sheets[feuille], { defval: "" });
}

/** Adaptateurs par pays : fichier, feuille et mapping de colonnes. */
const ADAPTATEURS = {
  mali: {
    pays: "Mali",
    fichier: "repertoire_riche_etablissements_scolaires_mali.xlsx",
    feuille: "Répertoire_Mali",
    ligne: (r) => ({
      code: String(r["ID"]).trim() || null, // ex : MLI-0001
      nom: String(r["Nom établissement"]).trim(),
      type: typeDe(r["Cycle/Niveau"], r["Nom établissement"]),
      statut: statutDe(r["Statut/Type"]),
      ville: titre(r["Commune/Arrondissement"]) || titre(r["Localité/Quartier"]) || null,
      region: titre(r["Région/District"]),
    }),
  },
  cameroun: {
    pays: "Cameroun",
    fichier: "repertoire_etablissements_cameroun.xlsx",
    feuille: "Établissements",
    ligne: (r) => ({
      code: r["ID"] !== "" ? `CM-${r["ID"]}` : null,
      nom: String(r["Nom de l’établissement"] ?? r["Nom de l'établissement"]).trim(),
      type: typeDe(`${r["Niveau"]} ${r["Cycle"]}`, r["Nom de l’établissement"] ?? ""),
      statut: statutDe(r["Statut"]),
      ville: titre(r["Commune / Ville"]) || null,
      region: titre(r["Région"]),
    }),
  },
  benin: {
    pays: "Bénin",
    fichier: "repertoire_etablissements_Benin.xlsx",
    feuille: "Repertoire_Benin",
    ligne: (r) => ({
      code: String(r["ID"]).trim() || null, // ex : BEN-0001
      nom: String(r["Nom_etablissement"]).trim(),
      type: typeDe(r["Cycle_harmonise"], r["Nom_etablissement"]),
      statut: statutDe(r["Statut"]),
      ville: titre(r["Commune"]) || titre(r["Localite_quartier"]) || null,
      region: titre(r["Departement"]),
    }),
  },
  senegal: {
    pays: "Sénégal",
    fichier: "repertoire_etablissements_primaires_secondaires_senegal.xlsx",
    feuille: "Repertoire_extraits",
    ligne: (r) => ({
      code: null,
      nom: String(r["Nom établissement"]).trim(),
      type: typeDe(r["Cycle probable"], r["Nom établissement"]),
      statut: statutDe(r["Statut"]),
      ville: titre(r["Arrondissement / ville"]) || null,
      region: titre(r["Région"]),
    }),
  },
  niger: {
    pays: "Niger",
    fichier: "repertoire_etablissements_Niger.xlsx",
    feuille: "Repertoire_Niger",
    ligne: (r) => ({
      code: String(r["Code administratif"]).trim() ? `NE-${String(r["Code administratif"]).trim()}` : null,
      nom: String(r["Nom établissement"]).trim(),
      type: typeDe(r["Cycle interprété"], r["Nom établissement"]),
      statut: statutDe(r["Statut"]),
      ville: titre(r["Commune"]) || null,
      region: titre(r["Région"]),
    }),
  },
  burkina: {
    pays: "Burkina Faso",
    fichier: "repertoire_etablissements_Burkina_Faso(1).xlsx",
    feuille: "Repertoire_BF",
    ligne: (r) => ({
      code: r["ID"] !== "" ? `BF-${r["ID"]}` : null,
      nom: String(r["Nom établissement"]).trim(),
      type: typeDe(r["Cycle"], r["Nom établissement"]),
      statut: statutDe(r["Statut"]),
      ville: titre(r["Commune"]) || null,
      region: titre(r["Région"]),
    }),
  },
};

const dossier = process.argv[2] && process.argv[2] !== "." ? process.argv[2] : "C:/Users/HP/Downloads";
const selection = process.argv.slice(3).map(norm);
const cibles = Object.entries(ADAPTATEURS).filter(([cle]) => selection.length === 0 || selection.includes(cle));

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

for (const [cle, cfg] of cibles) {
  let rows;
  try {
    rows = lignes(dossier, cfg.fichier, cfg.feuille);
  } catch (e) {
    console.log(`✗ ${cfg.pays} : fichier illisible (${e.message})`);
    continue;
  }

  // 1) Régions du pays.
  const regionsExistantes = await prisma.region.findMany({ where: { pays: cfg.pays }, select: { id: true, nom: true } });
  const regionParNorm = new Map(regionsExistantes.map((r) => [norm(r.nom), r.id]));
  const nomsRegions = [...new Set(rows.map((r) => titre(cfg.ligne(r).region)).filter(Boolean))];
  let regionsCreees = 0;
  for (const nomRegion of nomsRegions) {
    if (regionParNorm.has(norm(nomRegion))) continue;
    const reg = await prisma.region.create({ data: { nom: nomRegion, pays: cfg.pays } });
    regionParNorm.set(norm(nomRegion), reg.id);
    regionsCreees += 1;
  }

  // 2) Établissements (idempotence par code, sinon par pays+nom+ville).
  const existants = await prisma.etablissement.findMany({
    where: { pays: cfg.pays },
    select: { code: true, nom: true, ville: true },
  });
  const codesPris = new Set(
    (await prisma.etablissement.findMany({ where: { code: { not: null } }, select: { code: true } })).map((e) => e.code),
  );
  const clesPrises = new Set(existants.map((e) => `${norm(e.nom)}|${norm(e.ville)}`));

  const aInserer = [];
  let ignores = 0;
  const clesLot = new Set();
  for (const r of rows) {
    const l = cfg.ligne(r);
    if (!l.nom) continue;
    const cleNom = `${norm(l.nom)}|${norm(l.ville)}`;
    if ((l.code && codesPris.has(l.code)) || clesPrises.has(cleNom) || clesLot.has(l.code ?? cleNom)) {
      ignores += 1;
      continue;
    }
    clesLot.add(l.code ?? cleNom);
    aInserer.push({
      nom: l.nom,
      code: l.code,
      type: l.type,
      statut: l.statut,
      ville: l.ville,
      pays: cfg.pays,
      regionId: regionParNorm.get(norm(l.region)) ?? null,
    });
  }

  let crees = 0;
  const LOT = 1000;
  for (let i = 0; i < aInserer.length; i += LOT) {
    const res = await prisma.etablissement.createMany({ data: aInserer.slice(i, i + LOT), skipDuplicates: true });
    crees += res.count;
  }
  console.log(`✓ ${cfg.pays} (${cle}) : ${rows.length} lignes lues, ${crees} créés, ${ignores} déjà présents, ${regionsCreees} région(s) créée(s).`);
}

const parPays = await prisma.etablissement.groupBy({ by: ["pays"], _count: true });
console.log("\nTotal par pays :", parPays.map((p) => `${p.pays}=${p._count}`).join("  "));
await prisma.$disconnect();
