/**
 * Ajoute des PAGES WIKI COLLABORATIVES aux deux formations du SEDEC d'Agboville, pour activer
 * la CORRECTION PAR LES PAIRS (chaque page est co-rédigée, historisée, puis évaluée par les
 * pairs ET le tuteur ; l'IA propose une évaluation). Reprend les activités collaboratives du TDR
 * (cartes/banques collaboratives, mutualisation). Idempotent : ne recrée pas une page existante.
 *
 *   npm run db:seed:wiki-sedec
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

try {
  process.loadEnvFile();
} catch {
  /* .env déjà injecté */
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PAGES: Record<string, { titre: string; contenu: string }[]> = {
  "management-administratif-d-un-etablissement-catholique": [
    {
      titre: "Atelier collaboratif — Carte des priorités administratives (SEDEC Agboville)",
      contenu:
        "<h2>Objectif</h2><p>Co-construire, entre pairs, une <strong>carte partagée des priorités administratives</strong> des établissements du SEDEC d'Agboville. Chacun enrichit le tableau, puis évalue la contribution d'un pair (bouton « Évaluer » ci-dessous).</p>" +
        "<h3>Consigne</h3><p>Ajoutez une ligne par priorité. Restez concret, contextualisé et bienveillant. Reliez chaque priorité à la continuité administrative et à la mission éducative catholique.</p>" +
        "<table><thead><tr><th>Domaine administratif</th><th>Problème / risque de rupture</th><th>Priorité (1–3)</th><th>Action proposée</th><th>Contributeur</th></tr></thead>" +
        "<tbody><tr><td>Dossiers des élèves</td><td>Ex. : archivage non centralisé</td><td>1</td><td>Ex. : registre numérique unique</td><td>(votre nom)</td></tr>" +
        "<tr><td> </td><td> </td><td> </td><td> </td><td> </td></tr><tr><td> </td><td> </td><td> </td><td> </td><td> </td></tr></tbody></table>" +
        "<h3>Correction par les pairs</h3><p>Après avoir contribué, ouvrez la page d'un binôme et proposez une évaluation (note /20 + commentaire). Le tuteur et EduWeb Planner peuvent aussi suggérer une appréciation.</p>",
    },
    {
      titre: "Banque collaborative — Communiqués institutionnels & charte de communication",
      contenu:
        "<h2>Objectif</h2><p>Constituer ensemble une <strong>banque de communiqués institutionnels</strong> réutilisables et une <strong>mini-charte de communication</strong> commune, dans une posture chrétienne (clarté, vérité, charité).</p>" +
        "<h3>Modèles de communiqués (à enrichir)</h3><ul><li>Annonce d'une réunion de parents — <em>(à rédiger collectivement)</em></li><li>Communication d'une décision difficile — <em>(à rédiger)</em></li><li>Note de service interne — <em>(à rédiger)</em></li></ul>" +
        "<h3>Mini-charte de communication (5 à 8 règles)</h3><ol><li>Clarté du message et du destinataire.</li><li>Cohérence des canaux (affichage, courrier, numérique).</li><li>Délai de réponse raisonnable.</li><li>… complétez ensemble.</li></ol>" +
        "<h3>Correction par les pairs</h3><p>Relisez et améliorez les contributions des collègues, puis évaluez une page (note + commentaire). Objectif : des modèles réellement utilisables dès la rentrée.</p>",
    },
  ],
  "pedagogie-de-jesus-autonomie-de-l-eleve-et-suivi-scolaire-a-l-ere-du-digital": [
    {
      titre: "Banque collaborative — Profils d'élèves & réponses pédagogiques (à la manière de Jésus)",
      contenu:
        "<h2>Objectif</h2><p>Mutualiser, entre enseignants et éducateurs, une <strong>banque de profils d'élèves</strong> et de <strong>réponses pédagogiques adaptées</strong>, inspirées de la pédagogie de Jésus (attention à la personne, compassion, relance, espérance).</p>" +
        "<table><thead><tr><th>Profil (signes visibles)</th><th>Obstacle probable</th><th>Réponse immédiate</th><th>Suivi à prévoir</th><th>Attitude de Jésus mobilisée</th></tr></thead>" +
        "<tbody><tr><td>Élève découragé</td><td>Peur de l'échec, affectif</td><td>Valoriser un progrès concret</td><td>Entretien individuel</td><td>Relance et espérance</td></tr>" +
        "<tr><td>Élève « invisible »</td><td> </td><td> </td><td> </td><td>Attention à l'individu</td></tr><tr><td> </td><td> </td><td> </td><td> </td><td> </td></tr></tbody></table>" +
        "<h3>Correction par les pairs</h3><p>Enrichissez la banque, puis évaluez la contribution d'un collègue (note /20 + commentaire). EduWeb Planner peut proposer une évaluation détaillée en appui.</p>",
    },
    {
      titre: "Atelier collaboratif — Tâches guidées vers l'autonomie de l'élève",
      contenu:
        "<h2>Objectif</h2><p>Concevoir ensemble des <strong>tâches guidées vers l'autonomie</strong> (cognitive, méthodologique, comportementale, éthique et spirituelle), transformables dès demain en classe.</p>" +
        "<h3>Gabarit d'une tâche (à dupliquer et remplir)</h3><ul><li><strong>Discipline / niveau :</strong> …</li><li><strong>Compétence visée :</strong> …</li><li><strong>Étayage (départ) :</strong> consignes, modèle, aide.</li><li><strong>Retrait progressif de l'aide :</strong> …</li><li><strong>Auto-évaluation de l'élève :</strong> question(s) miroir.</li></ul>" +
        "<h3>Correction par les pairs</h3><p>Testez mentalement la tâche d'un collègue, améliorez-la, puis évaluez la page (note + commentaire). Visez des tâches réalistes et motivantes.</p>",
    },
  ],
};

async function main() {
  for (const [slug, pages] of Object.entries(PAGES)) {
    const cours = await prisma.cours.findUnique({ where: { slug }, select: { id: true, titre: true } });
    if (!cours) {
      console.log(`⚠ Cours introuvable : ${slug}`);
      continue;
    }
    console.log(`\nCours : ${cours.titre}`);
    for (const p of pages) {
      const existe = await prisma.pageWiki.findFirst({ where: { coursId: cours.id, titre: p.titre }, select: { id: true } });
      if (existe) {
        console.log(`  = déjà présente : ${p.titre}`);
        continue;
      }
      const page = await prisma.pageWiki.create({
        data: { coursId: cours.id, titre: p.titre, contenu: p.contenu },
        select: { id: true },
      });
      await prisma.revisionWiki.create({ data: { pageId: page.id, contenu: p.contenu } });
      console.log(`  ✔ créée : ${p.titre}`);
    }
  }
  console.log("\nTerminé.");
}
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
