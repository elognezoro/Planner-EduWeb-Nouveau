/**
 * Sauvegarde PORTABLE de toutes les données (un seul fichier JSON), sans installer d'outil.
 * À lancer sur l'ANCIEN ordinateur, branché sur l'ANCIENNE base (DATABASE_URL / DIRECT_URL de `.env`).
 *
 *   node scripts/exporter-donnees.mjs [fichier-sortie]
 *   (défaut : sauvegarde-eduweb.json à la racine)
 *
 * Le fichier produit contient TOUTES les lignes de TOUTES les tables applicatives.
 * Il se restaure ensuite avec `scripts/restaurer-donnees.mjs` sur la nouvelle base.
 * ⚠️ Ce fichier contient des données (dont des empreintes de mots de passe) : garde-le privé,
 *    ne le committe jamais (il est déjà dans .gitignore).
 */
import { writeFileSync } from "node:fs";
import pg from "pg";

process.loadEnvFile(".env");
// Connexion DIRECTE de préférence (plus stable pour les gros transferts que l'endpoint « pooled »).
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL / DATABASE_URL manquant dans .env");

const sortie = process.argv[2] || "sauvegarde-eduweb.json";
const PAGE = 5000;

async function connecter() {
  const c = new pg.Client({ connectionString: url, keepAlive: true, statement_timeout: 0, query_timeout: 0 });
  c.on("error", () => {}); // évite un crash brutal ; on gère la reconnexion manuellement
  await c.connect();
  return c;
}

let client = await connecter();

// Tables applicatives (schéma public), hors table technique des migrations Prisma.
const { rows: tablesRows } = await client.query(`
  SELECT c.relname AS table_name,
         (SELECT a.attname FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          ORDER BY a.attnum LIMIT 1) AS premiere_colonne
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
  ORDER BY c.relname
`);

const donnees = {};
let totalLignes = 0;
for (const { table_name: t, premiere_colonne: cle } of tablesRows) {
  const lignes = [];
  let offset = 0;
  // Récupération par pages, avec reconnexion transparente si la connexion tombe.
  for (;;) {
    let page;
    try {
      const res = await client.query(`SELECT * FROM "${t}" ORDER BY "${cle}" LIMIT ${PAGE} OFFSET ${offset}`);
      page = res.rows;
    } catch (e) {
      console.log(`  … reconnexion (${t} @${offset}) après : ${e.message}`);
      try { await client.end(); } catch { /* ignore */ }
      client = await connecter();
      continue; // on rejoue la même page
    }
    lignes.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  donnees[t] = lignes;
  totalLignes += lignes.length;
  console.log(`  ${t} : ${lignes.length}`);
}

const paquet = {
  meta: {
    exporteLe: new Date().toISOString(),
    source: url.replace(/:\/\/[^@]+@/, "://***@"),
    nbTables: tablesRows.length,
    totalLignes,
  },
  tables: donnees,
};

writeFileSync(sortie, JSON.stringify(paquet));
console.log(`\n✓ Sauvegarde écrite : ${sortie}`);
console.log(`  ${tablesRows.length} tables, ${totalLignes} lignes au total.`);

await client.end();
