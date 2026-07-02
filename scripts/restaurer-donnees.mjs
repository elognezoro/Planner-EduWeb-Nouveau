/**
 * Restauration des données depuis la sauvegarde JSON, vers la NOUVELLE base.
 * À lancer sur le NOUVEAU ordinateur APRÈS avoir créé le schéma :
 *
 *   npx prisma migrate deploy         # crée les tables (base vide)
 *   node scripts/restaurer-donnees.mjs [fichier]   # défaut : sauvegarde-eduweb.json
 *
 * Insère les tables dans l'ORDRE DES DÉPENDANCES (calculé depuis les clés étrangères), afin de
 * respecter les contraintes sans droits superutilisateur (compatible Neon). Attendu : base vide.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant dans .env");

const fichier = process.argv[2] || "sauvegarde-eduweb.json";
const forcer = process.argv.includes("--force");
const paquet = JSON.parse(readFileSync(fichier, "utf8"));
const tablesData = paquet.tables ?? {};
console.log(`Sauvegarde : ${paquet.meta?.totalLignes ?? "?"} lignes, exportée le ${paquet.meta?.exporteLe ?? "?"}`);

const client = new pg.Client({ connectionString: url });
await client.connect();

// ── Ordre des dépendances (tri topologique sur les clés étrangères) ──
const toutesTables = Object.keys(tablesData);
const { rows: fks } = await client.query(`
  SELECT tc.table_name AS enfant, ccu.table_name AS parent
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
`);
const parents = new Map(toutesTables.map((t) => [t, new Set()]));
for (const { enfant, parent } of fks) {
  if (enfant !== parent && parents.has(enfant) && toutesTables.includes(parent)) {
    parents.get(enfant).add(parent);
  }
}
// Kahn : une table sort quand tous ses parents sont déjà sortis.
const ordre = [];
const restant = new Set(toutesTables);
while (restant.size) {
  const prete = [...restant].filter((t) => [...parents.get(t)].every((p) => !restant.has(p)));
  if (prete.length === 0) {
    console.warn("⚠️ Cycle de dépendances détecté, insertion des tables restantes en l'état :", [...restant]);
    ordre.push(...restant);
    break;
  }
  prete.sort();
  for (const t of prete) {
    ordre.push(t);
    restant.delete(t);
  }
}

// ── Garde : la base doit être vide (sauf --force) ──
if (!forcer) {
  for (const t of ordre) {
    const { rows } = await client.query(`SELECT 1 FROM "${t}" LIMIT 1`).catch(() => ({ rows: [] }));
    if (rows.length) {
      console.error(`\n✗ La table "${t}" contient déjà des données. Restauration annulée.`);
      console.error("  Utilise une base VIDE (juste après « prisma migrate deploy »), ou relance avec --force.");
      await client.end();
      process.exit(1);
    }
  }
}

// ── Types de colonnes de la cible (pour JSON / tableaux) ──
const { rows: cols } = await client.query(`
  SELECT table_name, column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'public'
`);
const typeCol = new Map(); // `${table}.${col}` -> data_type
for (const c of cols) typeCol.set(`${c.table_name}.${c.column_name}`, c.data_type);

function transformer(table, col, valeur) {
  if (valeur === null || valeur === undefined) return null;
  const type = typeCol.get(`${table}.${col}`);
  if (type === "json" || type === "jsonb") return JSON.stringify(valeur); // objet/array -> texte json
  return valeur; // tableaux -> passés tels quels ; dates ISO, enums (texte), nombres -> OK
}

// ── Insertion, table par table, par lots ──
let totalInsere = 0;
for (const table of ordre) {
  const lignes = tablesData[table] ?? [];
  if (lignes.length === 0) continue;
  const colonnesCible = new Set([...typeCol.keys()].filter((k) => k.startsWith(`${table}.`)).map((k) => k.split(".").slice(1).join(".")));
  const colonnes = Object.keys(lignes[0]).filter((c) => colonnesCible.has(c));
  const listeCols = colonnes.map((c) => `"${c}"`).join(", ");
  const lot = Math.max(1, Math.min(1000, Math.floor(60000 / colonnes.length)));

  await client.query("BEGIN");
  try {
    for (let i = 0; i < lignes.length; i += lot) {
      const tranche = lignes.slice(i, i + lot);
      const params = [];
      const groupes = tranche.map((ligne) => {
        const ph = colonnes.map((c) => {
          params.push(transformer(table, c, ligne[c]));
          return `$${params.length}`;
        });
        return `(${ph.join(", ")})`;
      });
      await client.query(`INSERT INTO "${table}" (${listeCols}) VALUES ${groupes.join(", ")}`, params);
    }
    await client.query("COMMIT");
    totalInsere += lignes.length;
    console.log(`  ${table} : ${lignes.length}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`\n✗ Échec sur la table "${table}" :`, e.message);
    await client.end();
    process.exit(1);
  }
}

console.log(`\n✓ Restauration terminée : ${totalInsere} lignes insérées dans ${ordre.length} tables.`);
console.log("  Vérifie ensuite la connexion admin dans l'application.");
await client.end();
