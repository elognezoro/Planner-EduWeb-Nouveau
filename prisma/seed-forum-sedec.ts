/**
 * Ouvre des FILS DE DISCUSSION de départ dans le forum des deux formations SEDEC d'Agboville
 * (message d'accueil rédigé par le tuteur du cours), pour amorcer des échanges engageants
 * — reprend des questions vives du TDR. Idempotent : ne recrée pas un fil déjà présent.
 *
 *   npm run db:seed:forum-sedec
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  /* .env déjà injecté */
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const FILS: Record<string, { titre: string; description: string; message: string }[]> = {
  "management-administratif-d-un-etablissement-catholique": [
    {
      titre: "Vos plus grands défis de continuité administrative",
      description: "Partage d'expériences entre responsables et personnels administratifs.",
      message:
        "<p>Bienvenue sur le forum de la formation ! Pour lancer nos échanges : <strong>quel est, dans votre établissement, le principal risque de rupture de la continuité administrative</strong> (départ d'un responsable, dossiers non transmis, archives dispersées…) ?</p><p>Décrivez la situation en quelques lignes et, si vous le pouvez, une bonne pratique qui vous a aidé. Nous en tirerons une synthèse collective.</p>",
    },
    {
      titre: "Communication institutionnelle : vos canaux, vos réussites, vos difficultés",
      description: "Module 5 — choix des canaux et gestion des messages délicats.",
      message:
        "<p>Comment communiquez-vous avec les enseignants, les parents et le SEDEC ? <strong>Quel canal fonctionne le mieux</strong> chez vous, et quelle situation de communication délicate avez-vous eu à gérer ?</p><p>Partagez un exemple concret : nous construirons ensemble des repères pour une communication claire, cohérente et charitable.</p>",
    },
  ],
  "pedagogie-de-jesus-autonomie-de-l-eleve-et-suivi-scolaire-a-l-ere-du-digital": [
    {
      titre: "Une attitude de Jésus éducateur que vous voulez incarner davantage",
      description: "Séquence 1 — Jésus, éducateur différencié.",
      message:
        "<p>Bienvenue ! Pour ouvrir nos échanges : <strong>quelle attitude de Jésus éducateur</strong> (attention à la personne, compassion, relance, espérance, pédagogie de la parabole…) souhaitez-vous incarner davantage dans votre classe cette année, et pourquoi ?</p><p>Un court témoignage suffit. Vos réponses nourriront une synthèse commune.</p>",
    },
    {
      titre: "Un élève difficile à accompagner : partageons nos réponses",
      description: "Séquence 3 — profils d'élèves et accompagnement.",
      message:
        "<p>Décrivez (sans nommer l'élève) <strong>un profil d'élève qui vous met en difficulté</strong> : signes visibles, obstacle probable. Quelles réponses avez-vous essayées ? Qu'est-ce qui a (ou n'a pas) fonctionné ?</p><p>Objectif : constituer ensemble une base de réponses pédagogiques concrètes et bienveillantes.</p>",
    },
  ],
};

async function main() {
  for (const [slug, fils] of Object.entries(FILS)) {
    const cours = await prisma.cours.findUnique({
      where: { slug },
      select: { id: true, titre: true, tuteurs: { select: { utilisateurId: true }, take: 1 } },
    });
    if (!cours) {
      console.log(`⚠ Cours introuvable : ${slug}`);
      continue;
    }
    const auteurId = cours.tuteurs[0]?.utilisateurId ?? null; // tuteur du cours, sinon anonyme
    console.log(`\nCours : ${cours.titre} (auteur du fil : ${auteurId ?? "—"})`);
    for (const f of fils) {
      const existe = await prisma.sujetForum.findFirst({ where: { coursId: cours.id, titre: f.titre }, select: { id: true } });
      if (existe) {
        console.log(`  = déjà présent : ${f.titre}`);
        continue;
      }
      await prisma.sujetForum.create({
        data: {
          coursId: cours.id,
          titre: f.titre,
          description: f.description,
          creeParId: auteurId,
          epingle: true,
          messages: { create: { auteurId, contenu: f.message } },
        },
      });
      console.log(`  ✔ fil ouvert : ${f.titre}`);
    }
  }
  console.log("\nTerminé.");
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
