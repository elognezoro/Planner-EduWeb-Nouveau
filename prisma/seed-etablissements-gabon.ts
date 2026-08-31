/**
 * Répertoire scolaire du GABON (préscolaire → secondaire) dans le périmètre du pays « Gabon ».
 * Source : prisma/etablissements-gabon.json — répertoire consolidé (Journal Officiel gabonais
 * Décret n°0209/PR/MENFC du 04/08/2023, annuaires web, établissements homologués français).
 *
 * - Crée/complète une RÉGION par province gabonaise (pays = « Gabon », @@unique [pays, nom]).
 * - Upsert de chaque établissement par `code` (= l'ID source, ex. « JO-2023-001 ») — donc
 *   IDEMPOTENT et réexécutable ; rattaché à sa province (regionId) et au pays « Gabon ».
 * - `type` / `statut` / `categoriePedagogique` dérivés des cycles, du niveau et du nom.
 *
 * Réversible : supprimer les établissements de pays « Gabon » (et, si voulu, leurs régions).
 *
 *   npm run db:seed:etablissements-gabon
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PAYS = "Gabon";

type LigneGabon = {
  id: string; nom: string; cycles: string; niveau: string; statut: string;
  province: string; ville: string; quartier: string; tel: string; adresse: string; url: string;
};

const nn = (s: string): string | null => { const v = (s ?? "").trim(); return v || null; };
const bas = (s: string): string => (s ?? "").toLowerCase();

/** Type d'établissement dérivé des cycles + niveau + nom. */
function deriverType(l: LigneGabon): "prescolaire" | "primaire" | "college" | "lycee" | "technique_professionnel" | "groupe_scolaire" | "autre" {
  const c = bas(l.cycles + " " + l.niveau);
  const nom = bas(l.nom);
  const presco = /présco|presco|maternel|pré-prim|pre-prim/.test(c);
  const prim = /primaire|\bcp\b|\bce\d|\bcm\d|\bps\b|\bms\b|\bgs\b/.test(c);
  const sec = /secondaire|collège|college|lycée|lycee/.test(c);
  const tech = /technique|professionnel|professionnelle/.test(c);
  if (tech) return "technique_professionnel";
  const cycles = [presco, prim, sec].filter(Boolean).length;
  if (cycles >= 2) return "groupe_scolaire";
  if (sec) return /lyc/.test(nom) ? "lycee" : "college";
  if (prim) return "primaire";
  if (presco) return "prescolaire";
  return "autre";
}

/** Catégorie pédagogique déclarée (cycle le plus élevé présent) — pilote l'adaptation de la config. */
function deriverCategorie(l: LigneGabon): "prescolaire" | "primaire" | "secondaire" {
  const c = bas(l.cycles + " " + l.niveau);
  if (/secondaire|collège|college|lycée|lycee|technique|professionnel/.test(c)) return "secondaire";
  if (/primaire|\bcp\b|\bce\d|\bcm\d/.test(c)) return "primaire";
  return "prescolaire";
}

/** Statut administratif : public si nom/statut l'indiquent, sinon privé (répertoire à dominante privée). */
function deriverStatut(l: LigneGabon): "public" | "prive" {
  const t = bas(l.statut + " " + l.nom);
  if (/publi|convention|\bepc\b|\bepp\b|\bcep\b/.test(t)) return "public";
  return "prive";
}

async function main() {
  const chemin = join(process.cwd(), "prisma", "etablissements-gabon.json");
  const lignes = JSON.parse(readFileSync(chemin, "utf8")) as LigneGabon[];

  // 1) Régions (provinces) du Gabon — une par province non vide.
  const provinces = [...new Set(lignes.map((l) => (l.province ?? "").trim()).filter(Boolean))].sort();
  const regionParProvince = new Map<string, string>();
  for (const nom of provinces) {
    const r = await prisma.region.upsert({
      where: { pays_nom: { pays: PAYS, nom } },
      update: {},
      create: { nom, pays: PAYS },
      select: { id: true },
    });
    regionParProvince.set(nom, r.id);
  }
  console.log(`Régions Gabon : ${provinces.length} (${provinces.join(", ")})`);

  // 2) Établissements — insertion en LOT par paquets (createMany + skipDuplicates), idempotent
  //    sur le `code` unique : réexécutable, insère uniquement ceux qui manquent (robuste aux
  //    coupures de connexion Neon — bien moins d'allers-retours que 341 upserts unitaires).
  const dejaCodes = new Set(
    (await prisma.etablissement.findMany({ where: { code: { not: null } }, select: { code: true } }))
      .map((e) => e.code as string),
  );

  const aInserer = lignes
    .filter((l) => (l.nom ?? "").trim() && (l.id ?? "").trim() && !dejaCodes.has(l.id.trim()))
    .map((l) => ({
      code: l.id.trim(),
      nom: l.nom.trim(),
      pays: PAYS,
      ville: nn(l.ville),
      adresse: [nn(l.quartier), nn(l.adresse)].filter(Boolean).join(" — ") || null,
      telephone: nn(l.tel),
      type: deriverType(l),
      statut: deriverStatut(l),
      categoriePedagogique: deriverCategorie(l),
      regionId: l.province ? regionParProvince.get(l.province.trim()) ?? null : null,
    }));

  const ignores = lignes.length - aInserer.length - lignes.filter((l) => dejaCodes.has((l.id ?? "").trim())).length;
  let crees = 0;
  const TAILLE = 100;
  for (let i = 0; i < aInserer.length; i += TAILLE) {
    const lot = aInserer.slice(i, i + TAILLE);
    const r = await prisma.etablissement.createMany({ data: lot, skipDuplicates: true });
    crees += r.count;
    console.log(`  … lot ${i / TAILLE + 1} : ${r.count} insérés (${Math.min(i + TAILLE, aInserer.length)}/${aInserer.length})`);
  }

  const total = await prisma.etablissement.count({ where: { pays: { equals: PAYS, mode: "insensitive" } } });
  console.log(`Bilan : ${crees} création(s) · ${lignes.length - aInserer.length} déjà présent(s)/ignorée(s) (${ignores < 0 ? 0 : ignores} sans code). Total établissements Gabon en base : ${total}.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
