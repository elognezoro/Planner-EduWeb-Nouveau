/**
 * Cours-miroirs des séminaires « figés » (pages interactives statiques) dans le LMS.
 *
 * POURQUOI : le contenu d'une formation n'est consultable que par un INSCRIT (règle métier).
 * Les séminaires statiques sont servis par la route authentifiée /seminaires/[...chemin],
 * qui vérifie l'inscription au cours-miroir portant le même slug. Ces cours-miroirs :
 *  - rendent l'inscription POSSIBLE (via « Inscriptions par rôle » et les liens directs) ;
 *  - portent un unique module « lien » ouvrant la page interactive ;
 *  - sont EXCLUS de la liste des séminaires LMS de la page « Formations » (cf. formations/page.tsx),
 *    donc pas de carte dupliquée : la carte-vitrine statique reste l'unique carte.
 *
 * IDEMPOTENT : upsert par slug ; garantit les drapeaux (estSeminaire / publié) et l'unique
 * module « lien ». Réversible : supprimer les cours de ces slugs (cascade).
 *
 *   npm run db:seed:seminaires-cours
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

const ORIGINE = "https://planning.eduweb.ci";

type SemCours = { slug: string; titre: string; description: string; entree: string; dureeMinutes: number; niveau: string };

const SEMINAIRES: SemCours[] = [
  {
    slug: "magnifica-humanitas",
    titre: "Magnifica Humanitas — Rester humains à l'ère de l'intelligence artificielle",
    description:
      "Séminaire des écoles catholiques : 8 modules (M0 → M7) avec diaporamas, activités et exercices auto-corrigés, synthèse « opportunités & alertes » et 7 questions de discernement, évaluation sommative chronométrée (attestation « Discernement IA & DSE »).",
    entree: "/seminaires/magnifica-humanitas.html",
    dureeMinutes: 600,
    niveau: "intermediaire",
  },
  {
    slug: "communication-pastorale",
    titre: "Le numérique au service de la communication éducative et pastorale",
    description:
      "Séminaire des communicateurs (SENEC) : présentation contextuelle de 14 diapositives à feuilleter, 7 ateliers interactifs (diagnostic, QCM, matrice des publics, check-list RAPIDE, scénario de crise, plan d'action, engagement personnel), livret académique et support PowerPoint.",
    entree: "/seminaires/communication-numerique-pastorale.html",
    dureeMinutes: 180,
    niveau: "intermediaire",
  },
  {
    slug: "ia-communication-pastorale",
    titre: "L'intelligence artificielle au service de la communication éducative et pastorale",
    description:
      "Séminaire des communicateurs (SENEC), suite du séminaire sur le numérique : diagnostic de maturité IA, 3 modules (usages, méthode de prompt P.A.S.T.O.R.A.L., éthique & règle des 5 V), ateliers de correction de contenus générés par IA, auto-évaluation finale et protocole d'usage responsable.",
    entree: "/seminaires/ia-communication/formation.html",
    dureeMinutes: 150,
    niveau: "intermediaire",
  },
  {
    slug: "fetrag-setrag",
    titre: "FETRAG-SETRAG — Droit du travail gabonais (Loi n°022/2021)",
    description:
      "Formation syndicale interactive sur le Code du travail gabonais (Loi n°022/2021) : statut syndical & protection des délégués, contrats & sécurité, discipline & licenciement, négociation collective & grève. 4 modules avec cours narratif, activités interactives, études de cas, exercices auto-corrigés et évaluation chronométrée.",
    entree: "/seminaires/fetrag-setrag.html",
    dureeMinutes: 1800,
    niveau: "intermediaire",
  },
];

async function main() {
  for (const s of SEMINAIRES) {
    const cours = await prisma.cours.upsert({
      where: { slug: s.slug },
      // Si le cours existe déjà : garantir seulement les drapeaux (sans écraser un titre/description édités).
      update: { estSeminaire: true, estGuide: false, statut: "publie" },
      create: {
        titre: s.titre,
        slug: s.slug,
        description: s.description,
        estSeminaire: true,
        estGuide: false,
        statut: "publie",
        niveau: s.niveau,
        dureeMinutes: s.dureeMinutes,
      },
      select: { id: true, slug: true, statut: true, estSeminaire: true },
    });

    const url = ORIGINE + s.entree;
    const titreModule = "Ouvrir le séminaire interactif";
    const lien = await prisma.moduleCours.findFirst({ where: { coursId: cours.id, type: "lien" }, select: { id: true } });
    if (!lien) {
      await prisma.moduleCours.create({ data: { coursId: cours.id, titre: titreModule, type: "lien", contenu: url, ordre: 0 } });
    } else {
      await prisma.moduleCours.update({ where: { id: lien.id }, data: { contenu: url, titre: titreModule } });
    }

    const modules = await prisma.moduleCours.count({ where: { coursId: cours.id } });
    console.log("✔", s.slug, "→", JSON.stringify({ ...cours, modules, lien: url }));
  }
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
