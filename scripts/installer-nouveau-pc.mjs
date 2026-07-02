/**
 * Installation « tout-en-un » sur un nouvel ordinateur.
 * Prérequis : le projet est cloné, `sauvegarde-eduweb.json` est à la racine, et le fichier
 * `.env` existe avec les URLs de la NOUVELLE base Neon (DATABASE_URL + DIRECT_URL).
 *
 *   node scripts/installer-nouveau-pc.mjs
 *
 * Enchaîne automatiquement : dépendances → schéma → restauration des données → vérification.
 * Ne fait rien de destructif (la restauration refuse une base non vide).
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function etape(titre, commande) {
  console.log(`\n▶ ${titre}`);
  execSync(commande, { stdio: "inherit", shell: true });
}

// ── Vérifications préalables (messages clairs si un prérequis manque) ──
if (!existsSync(".env")) {
  console.error("✗ Le fichier .env est introuvable. Crée-le d'abord (voir MIGRATION.md, Phase C).");
  process.exit(1);
}
const env = readFileSync(".env", "utf8");
if (!/^\s*DATABASE_URL\s*=\s*["']?postgres/m.test(env)) {
  console.error("✗ DATABASE_URL (base Neon) n'est pas renseigné dans .env.");
  process.exit(1);
}
if (!existsSync("sauvegarde-eduweb.json")) {
  console.error("✗ Le fichier sauvegarde-eduweb.json est introuvable à la racine du projet.");
  console.error("  Copie-le depuis l'ancien ordinateur (clé USB) avant de relancer.");
  process.exit(1);
}

console.log("Installation d'EduWeb Planner sur ce nouvel ordinateur…");
etape("Installation des dépendances (npm install)", "npm install");
etape("Génération du client Prisma", "npx prisma generate");
etape("Création du schéma dans la base (migrations)", "npx prisma migrate deploy");
etape("Restauration de toutes les données", "node scripts/restaurer-donnees.mjs");

console.log("\n✅ Terminé. Lance l'application avec :  npm run dev");
console.log("   Puis ouvre http://localhost:3000 et connecte-toi avec ton compte admin habituel.");
