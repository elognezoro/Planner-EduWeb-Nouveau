/**
 * Crée l'entrée LMS de la formation FETRAG-SETRAG (séminaire STATIQUE) afin qu'elle
 * apparaisse dans la page « Inscriptions par rôle » (liste déroulante des formations)
 * et puisse recevoir des inscrits + des liens d'inscription directe scoppés au statut.
 *
 * Le contenu réel du séminaire reste la page interactive autonome
 * public/seminaires/fetrag-setrag.html : le cours contient un unique module « lien »
 * qui l'ouvre. La carte riche de la page « Formations » (const SEMINAIRES) reste la
 * vitrine ; ce cours n'y est PAS dupliqué (formations/page.tsx exclut les slugs de
 * séminaires statiques de la liste LMS).
 *
 * IDEMPOTENT : upsert par slug ; garantit les drapeaux (estSeminaire/publié) et
 * l'existence du module « lien ». Réversible : supprimer le cours de slug
 * « fetrag-setrag » (cascade sur ses modules / inscriptions / invitations).
 *
 *   npm run db:seed:fetrag-cours
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  // .env absent — variables déjà injectées.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SLUG = "fetrag-setrag";
const TITRE = "FETRAG-SETRAG — Droit du travail gabonais (Loi n°022/2021)";
const DESCRIPTION =
  "Formation syndicale interactive sur le Code du travail gabonais (Loi n°022/2021) : statut syndical & protection des délégués, contrats & sécurité, discipline & licenciement, négociation collective & grève. 4 modules avec cours narratif, activités interactives, études de cas à réponses dévoilables, exercices auto-corrigés et évaluation chronométrée.";
const URL_SEMINAIRE = "https://planning.eduweb.ci/seminaires/fetrag-setrag.html";
const MODULE_TITRE = "Ouvrir le séminaire interactif FETRAG-SETRAG";

async function main() {
  const cours = await prisma.cours.upsert({
    where: { slug: SLUG },
    // Si le cours existe déjà, on garantit seulement ses drapeaux (sans écraser un titre/description édités).
    update: { estSeminaire: true, estGuide: false, statut: "publie" },
    create: {
      titre: TITRE,
      slug: SLUG,
      description: DESCRIPTION,
      estSeminaire: true,
      estGuide: false,
      statut: "publie",
      niveau: "intermediaire",
      dureeMinutes: 1800, // 4 modules × 7 h 30 ≈ 30 h (indicatif)
    },
    select: { id: true, titre: true, slug: true, statut: true, estSeminaire: true },
  });

  // Garantit un unique module « lien » pointant vers la page interactive statique.
  const lien = await prisma.moduleCours.findFirst({ where: { coursId: cours.id, type: "lien" }, select: { id: true } });
  if (!lien) {
    await prisma.moduleCours.create({
      data: { coursId: cours.id, titre: MODULE_TITRE, type: "lien", contenu: URL_SEMINAIRE, ordre: 0 },
    });
  } else {
    await prisma.moduleCours.update({ where: { id: lien.id }, data: { contenu: URL_SEMINAIRE, titre: MODULE_TITRE } });
  }

  const modules = await prisma.moduleCours.count({ where: { coursId: cours.id } });
  console.log("✔ Cours FETRAG-SETRAG prêt :", JSON.stringify({ ...cours, modules }));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
