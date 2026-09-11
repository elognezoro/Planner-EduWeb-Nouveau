/**
 * Répertoire scolaire d'HAÏTI (fondamental → secondaire) dans le périmètre du pays « Haïti »,
 * rattaché aux 10 RÉGIONS ACADÉMIQUES (= départements : Artibonite, Centre, Grand'Anse, Nippes,
 * Nord, Nord-Est, Nord-Ouest, Ouest, Sud, Sud-Est).
 * Source : prisma/etablissements-haiti.json — extrait des registres MENFP/DPCE 2024-2025 et
 * compléments régionaux (base consolidée et enrichissable, NON exhaustive selon le fichier source).
 *
 * - Crée/complète une RÉGION par région académique (pays = « Haïti », @@unique [pays, nom]).
 * - Établissements : `code` = Code CIE officiel du MENFP quand il existe (sinon null — aucun code
 *   inventé) ; rattachés à leur région (regionId), `ville` = commune, `adresse` = localité.
 * - IDEMPOTENT : une ligne déjà présente (même nom + même commune dans le pays, ou même code CIE)
 *   n'est pas réinsérée ; insertion par LOTS (createMany) — robuste aux coupures Neon.
 * - `type` / `categoriePedagogique` dérivés des niveaux MENFP (1 présco., 2 fondamental,
 *   3 secondaire) ; `statut` = public / privé (secteur « Non public »).
 *
 * Réversible : supprimer les établissements de pays « Haïti » (et, si voulu, leurs régions).
 *
 *   DRY_RUN=1 npm run db:seed:etablissements-haiti   # aperçu sans écriture
 *   npm run db:seed:etablissements-haiti
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

/** Nom EXACT du référentiel des pays (NFC) — sert au cloisonnement par pays et aux filtres. */
const PAYS = "Haïti";
const DRY_RUN = process.env.DRY_RUN === "1";

type LigneHaiti = {
  cie: string | null; nom: string; region: string; arrondissement: string | null; commune: string;
  secteur: string; niveau: string; fondamental: boolean; secondaire: boolean; adresse: string | null; source: string | null;
};

const niveaux = (l: LigneHaiti) => new Set(l.niveau.split(",").map((s) => s.trim()));
const aPresco = (l: LigneHaiti) => niveaux(l).has("1");
const aFond = (l: LigneHaiti) => niveaux(l).has("2") || l.fondamental;
const aSec = (l: LigneHaiti) => niveaux(l).has("3") || l.secondaire;

/** Type d'établissement : fondamental + secondaire = groupe scolaire ; secondaire seul = lycée/collège (d'après le nom). */
function deriverType(l: LigneHaiti): "prescolaire" | "primaire" | "college" | "lycee" | "groupe_scolaire" | "autre" {
  if (aFond(l) && aSec(l)) return "groupe_scolaire";
  if (aSec(l)) return /lyc/i.test(l.nom) ? "lycee" : "college";
  if (aFond(l)) return "primaire"; // école fondamentale (avec ou sans préscolaire)
  if (aPresco(l)) return "prescolaire";
  return "autre";
}

/** Catégorie pédagogique = cycle le plus élevé offert (pilote l'adaptation de la configuration). */
function deriverCategorie(l: LigneHaiti): "prescolaire" | "primaire" | "secondaire" {
  if (aSec(l)) return "secondaire";
  if (aFond(l)) return "primaire";
  return "prescolaire";
}

const cleLigne = (nom: string, ville: string | null) => `${nom.trim().toLowerCase()}|${(ville ?? "").trim().toLowerCase()}`;

async function main() {
  const lignes = JSON.parse(readFileSync(join(process.cwd(), "prisma", "etablissements-haiti.json"), "utf8")) as LigneHaiti[];

  // 1) Régions académiques (départements) d'Haïti.
  const regions = [...new Set(lignes.map((l) => l.region.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const regionParNom = new Map<string, string>();
  if (!DRY_RUN) {
    for (const nom of regions) {
      const r = await prisma.region.upsert({
        where: { pays_nom: { pays: PAYS, nom } },
        update: {},
        create: { nom, pays: PAYS },
        select: { id: true },
      });
      regionParNom.set(nom, r.id);
    }
  }
  console.log(`Régions académiques Haïti : ${regions.length} (${regions.join(", ")})`);

  // 2) Établissements — idempotence : (nom + commune) déjà présents dans le pays, ou code CIE déjà pris.
  const existants = await prisma.etablissement.findMany({ where: { pays: PAYS }, select: { nom: true, ville: true } });
  const dejaCles = new Set(existants.map((e) => cleLigne(e.nom, e.ville)));
  const cies = lignes.map((l) => l.cie).filter((c): c is string => Boolean(c));
  const dejaCodes = new Set(
    (await prisma.etablissement.findMany({ where: { code: { in: cies } }, select: { code: true } })).map((e) => e.code as string),
  );

  const aInserer = lignes
    .filter((l) => l.nom.trim() && !dejaCles.has(cleLigne(l.nom, l.commune)) && !(l.cie && dejaCodes.has(l.cie)))
    .map((l) => ({
      code: l.cie,
      nom: l.nom.trim(),
      pays: PAYS,
      ville: l.commune.trim() || null,
      adresse: l.adresse,
      type: deriverType(l),
      statut: /^public$/i.test(l.secteur.trim()) ? ("public" as const) : ("prive" as const),
      categoriePedagogique: deriverCategorie(l),
      regionId: regionParNom.get(l.region.trim()) ?? null,
    }));

  const parType = aInserer.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {});
  console.log(`À insérer : ${aInserer.length} / ${lignes.length} (déjà présents : ${lignes.length - aInserer.length}) · types ${JSON.stringify(parType)}`);
  if (DRY_RUN) {
    console.log("(DRY_RUN — aucune écriture)");
    return;
  }

  let crees = 0;
  const TAILLE = 100;
  for (let i = 0; i < aInserer.length; i += TAILLE) {
    const r = await prisma.etablissement.createMany({ data: aInserer.slice(i, i + TAILLE), skipDuplicates: true });
    crees += r.count;
    console.log(`  … lot ${i / TAILLE + 1} : ${r.count} insérés (${Math.min(i + TAILLE, aInserer.length)}/${aInserer.length})`);
  }
  const total = await prisma.etablissement.count({ where: { pays: PAYS } });
  console.log(`Bilan : ${crees} création(s). Total établissements Haïti en base : ${total}.`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
