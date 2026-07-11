import { prisma } from "@/lib/prisma";
import { recalculerInscriptionsDuParcours } from "@/lib/lms-parcours";

/**
 * Recalcule la progression d'une inscription à un cours et met à jour son statut.
 *
 * Règles de validation du cours :
 *  - le pourcentage de leçons terminées doit atteindre le **seuil de complétion** du
 *    cours (`Cours.seuilCompletion`, défaut 100 %) ;
 *  - **tous les quiz « sommatifs »** du cours doivent être réussis (obligatoires quel
 *    que soit le seuil — un quiz est « terminé » uniquement lorsqu'il est réussi).
 *
 * Retourne le pourcentage courant et l'état de complétion.
 */
export async function appliquerCompletionCours(
  inscriptionId: string,
  coursId: string,
): Promise<{ pct: number; termine: boolean }> {
  const [cours, total, faits, inscription, sommatifs] = await Promise.all([
    prisma.cours.findUnique({ where: { id: coursId }, select: { seuilCompletion: true } }),
    prisma.moduleCours.count({ where: { coursId } }),
    prisma.progressionModule.count({ where: { inscriptionId, termine: true } }),
    prisma.inscriptionCours.findUnique({ where: { id: inscriptionId }, select: { dateFin: true } }),
    prisma.moduleCours.findMany({ where: { coursId, type: "quiz", quiz: { mode: "sommatif" } }, select: { id: true } }),
  ]);

  const seuil = Math.min(100, Math.max(1, cours?.seuilCompletion ?? 100));
  const pct = total > 0 ? Math.round((faits / total) * 100) : 0;

  // Les quiz sommatifs sont obligatoires : ils doivent tous être réussis (donc « terminés »).
  let sommatifsOk = true;
  if (sommatifs.length > 0) {
    const reussis = await prisma.progressionModule.count({
      where: { inscriptionId, termine: true, moduleId: { in: sommatifs.map((m) => m.id) } },
    });
    sommatifsOk = reussis >= sommatifs.length;
  }

  // Comparaison ENTIÈRE (jamais sur le pct arrondi) : évite qu'un 199/200 arrondi à 100 %
  // valide le cours avant terme — cohérent avec recalculerInscriptionParcours.
  const termine = total > 0 && faits * 100 >= seuil * total && sommatifsOk;
  await prisma.inscriptionCours.update({
    where: { id: inscriptionId },
    data: {
      progressionPct: pct,
      statut: termine ? "termine" : "en_cours",
      // Conserve la première date de fin décernée ; ne pose une date que lors de la première complétion.
      dateFin: termine ? (inscription?.dateFin ?? new Date()) : null,
    },
  });
  return { pct, termine };
}

/**
 * Recalcule TOUTES les inscriptions d'un cours puis resynchronise les parcours qui le
 * contiennent. À appeler après un changement de règle de validation (seuil de complétion,
 * bascule d'un quiz en « sommatif ») pour ne pas laisser d'inscriptions au statut périmé.
 */
export async function recalculerInscriptionsDuCours(coursId: string): Promise<void> {
  const inscriptions = await prisma.inscriptionCours.findMany({ where: { coursId }, select: { id: true } });
  for (const i of inscriptions) await appliquerCompletionCours(i.id, coursId);
  const etapes = await prisma.etapeParcours.findMany({ where: { coursId }, select: { parcoursId: true } });
  for (const pid of [...new Set(etapes.map((e) => e.parcoursId))]) {
    await recalculerInscriptionsDuParcours(pid).catch((e) => console.error("[lms] resync parcours :", e));
  }
}

/**
 * Progression séquentielle : un module n'est « débloqué » que si TOUS les modules d'ordre
 * inférieur du cours sont terminés pour cet utilisateur. Toujours vrai si le cours n'a pas
 * activé la progression séquentielle, ou pour le tout premier module (aucun préalable).
 */
export async function moduleEstDebloque(utilisateurId: string, coursId: string, moduleId: string): Promise<boolean> {
  const cours = await prisma.cours.findUnique({ where: { id: coursId }, select: { progressionSequentielle: true } });
  if (!cours?.progressionSequentielle) return true;
  const lecon = await prisma.moduleCours.findUnique({ where: { id: moduleId }, select: { ordre: true } });
  if (!lecon) return true;
  const prealables = await prisma.moduleCours.findMany({ where: { coursId, ordre: { lt: lecon.ordre } }, select: { id: true } });
  if (prealables.length === 0) return true;
  const insc = await prisma.inscriptionCours.findUnique({ where: { utilisateurId_coursId: { utilisateurId, coursId } }, select: { id: true } });
  if (!insc) return false;
  const faits = await prisma.progressionModule.count({
    where: { inscriptionId: insc.id, termine: true, moduleId: { in: prealables.map((m) => m.id) } },
  });
  return faits >= prealables.length;
}

/** Barème de mention à partir du score moyen (%) obtenu aux évaluations. */
export function mentionAttestation(pct: number): string {
  if (pct >= 90) return "Excellent";
  if (pct >= 80) return "Très bien";
  if (pct >= 70) return "Bien";
  if (pct >= 60) return "Assez bien";
  return "Passable";
}
