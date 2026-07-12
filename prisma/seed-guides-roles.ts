/**
 * Publie UN « Guide d'utilisateur » détaillé PAR RÔLE dans « Aide et Formation › Guides
 * d'utilisateurs ». Chaque guide est un Cours `estGuide: true`, ciblé sur son rôle
 * (`publicCible: [roleId]`), regroupé dans la catégorie « Guides d'utilisation ».
 * Ses leçons (type « texte », Markdown) proviennent de prisma/guides-roles.json
 * (généré et vérifié par le workflow guides-utilisateurs-par-role, versionné & réversible).
 *
 * Idempotent : réexécutable. Chaque cours est identifié par le slug `guide-<roleId>` :
 * il est supprimé (cascade sur ses leçons) puis recréé. Supprimer une entrée du JSON
 * ne supprime pas le cours déjà publié — utiliser la console d'admin pour le retirer.
 *
 *   npm run db:seed:guides
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const CATEGORIE = "Guides d'utilisation";

type Lecon = { titre: string; contenu: string };
type Guide = {
  roleId: string;
  titre: string;
  description?: string;
  niveau?: string;
  dureeMinutes?: number;
  lecons: Lecon[];
};

function chargerGuides(): Guide[] {
  const brut = JSON.parse(readFileSync("prisma/guides-roles.json", "utf8"));
  const arr: Guide[] = Array.isArray(brut) ? brut : brut.guides;
  if (!Array.isArray(arr)) throw new Error("guides-roles.json : format inattendu (attendu un tableau ou { guides: [] }).");
  return arr;
}

async function main() {
  const guides = chargerGuides();

  // Catégorie « Guides d'utilisation » (créée si absente).
  let categorie = await prisma.categorieFormation.findFirst({ where: { nom: CATEGORIE }, select: { id: true } });
  if (!categorie) {
    categorie = await prisma.categorieFormation.create({ data: { nom: CATEGORIE, description: "Prise en main d'EduWeb Planner, un guide par rôle.", icone: "BookOpen", ordre: 0 }, select: { id: true } });
    console.log(`Catégorie créée : « ${CATEGORIE} ».`);
  }

  let ok = 0;
  let ignores = 0;
  for (let i = 0; i < guides.length; i++) {
    const g = guides[i];
    const lecons = (g.lecons || []).filter((l) => l && l.titre && l.contenu);
    if (!g.roleId || lecons.length === 0) {
      console.warn(`⚠ Guide ignoré (roleId=${g.roleId ?? "?"}) : aucune leçon exploitable.`);
      ignores++;
      continue;
    }
    const slug = `guide-${g.roleId}`;
    const niveau = ["debutant", "intermediaire", "avance"].includes(g.niveau ?? "") ? g.niveau : "debutant";
    const dureeMinutes = g.dureeMinutes && g.dureeMinutes > 0 ? Math.round(g.dureeMinutes) : lecons.length * 6;

    // Idempotence : on repart d'une fiche propre (cascade supprime les anciennes leçons).
    await prisma.cours.deleteMany({ where: { slug } });
    await prisma.cours.create({
      data: {
        titre: g.titre,
        slug,
        description: g.description ?? null,
        categorieId: categorie.id,
        niveau,
        publicCible: [g.roleId],
        statut: "publie",
        estGuide: true,
        ordre: i,
        dureeMinutes,
        seuilCompletion: 100,
        modules: {
          create: lecons.map((l, j) => ({ titre: l.titre, type: "texte", contenu: l.contenu, ordre: j })),
        },
      },
    });
    console.log(`✓ ${slug} — « ${g.titre} » (${lecons.length} leçons, ${niveau}, ${dureeMinutes} min).`);
    ok++;
  }

  console.log(`\nTerminé : ${ok} guide(s) publié(s), ${ignores} ignoré(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
