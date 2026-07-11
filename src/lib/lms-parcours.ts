import { prisma } from "@/lib/prisma";

/**
 * Recalcule la progression d'UNE inscription à un parcours à partir des cours terminés
 * par l'apprenant, et décerne le badge du parcours (idempotent) si le parcours est achevé.
 * Ne lève jamais : les appelants l'invoquent en effet de bord (« best-effort »).
 */
export async function recalculerInscriptionParcours(inscriptionId: string): Promise<void> {
  const insc = await prisma.inscriptionParcours.findUnique({
    where: { id: inscriptionId },
    select: { utilisateurId: true, statut: true, dateFin: true, parcours: { select: { badgeId: true, etapes: { select: { coursId: true } } } } },
  });
  if (!insc) return;

  const coursIds = insc.parcours.etapes.map((e) => e.coursId);
  const total = coursIds.length;
  const faits = total
    ? await prisma.inscriptionCours.count({ where: { utilisateurId: insc.utilisateurId, coursId: { in: coursIds }, statut: "termine" } })
    : 0;
  const pct = total ? Math.round((faits / total) * 100) : 0;
  const termine = total > 0 && faits >= total; // comparaison entière (évite l'arrondi 199/200 → 100)
  const dejaTermine = insc.statut === "termine";

  await prisma.inscriptionParcours.update({
    where: { id: inscriptionId },
    data: {
      progressionPct: pct,
      statut: termine ? "termine" : "en_cours",
      // Conserve la date de complétion d'origine (ne la repose qu'à la transition), null si le parcours redescend.
      dateFin: termine ? (dejaTermine ? insc.dateFin : new Date()) : null,
      derniereActivite: new Date(),
    },
  });

  if (termine && insc.parcours.badgeId) {
    await prisma.badgeObtenu.upsert({
      where: { utilisateurId_badgeId: { utilisateurId: insc.utilisateurId, badgeId: insc.parcours.badgeId } },
      create: { utilisateurId: insc.utilisateurId, badgeId: insc.parcours.badgeId },
      update: {},
    });
  }
}

/**
 * Après qu'un cours a changé d'état pour un apprenant, met à jour tous les parcours
 * AUXQUELS il est inscrit qui contiennent ce cours (décerne les badges le cas échéant).
 */
export async function recalculerParcoursPourCours(utilisateurId: string, coursId: string): Promise<void> {
  const inscriptions = await prisma.inscriptionParcours.findMany({
    where: { utilisateurId, parcours: { etapes: { some: { coursId } } } },
    select: { id: true },
  });
  for (const insc of inscriptions) await recalculerInscriptionParcours(insc.id);
}

/**
 * Recalcule TOUTES les inscriptions d'un parcours — à appeler après un changement de
 * composition (ajout/retrait d'un cours, suppression d'un cours). Best-effort par inscription.
 */
export async function recalculerInscriptionsDuParcours(parcoursId: string): Promise<void> {
  const inscriptions = await prisma.inscriptionParcours.findMany({ where: { parcoursId }, select: { id: true } });
  for (const i of inscriptions) {
    try { await recalculerInscriptionParcours(i.id); }
    catch (e) { console.error("[lms] resync parcours :", e); }
  }
}
