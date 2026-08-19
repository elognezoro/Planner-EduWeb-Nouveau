import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * CLOISONNEMENT DES NIVEAUX : un établissement voit le référentiel NATIONAL (etablissementId
 * nul, moins ses niveaux masqués localement — Etablissement.niveauxMasques) + ses NIVEAUX
 * PROPRES. Les niveaux créés par une autre école ne sont JAMAIS visibles ici.
 *
 * Couche UNIQUE : toutes les lectures « liste de niveaux » des consoles d'établissement
 * passent par ici (règle d'architecture : le cloisonnement n'est jamais réécrit page par page).
 */
export async function filtreNiveauxVisibles(etablissementId: string): Promise<Prisma.NiveauWhereInput> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { niveauxMasques: true },
  });
  const masques = etab?.niveauxMasques ?? [];
  return {
    OR: [
      { etablissementId: null, ...(masques.length ? { id: { notIn: masques } } : {}) },
      { etablissementId },
    ],
  };
}

/** Liste ordonnée des niveaux visibles par l'établissement (national non masqué + propres). */
export async function niveauxVisibles(etablissementId: string) {
  return prisma.niveau.findMany({
    where: await filtreNiveauxVisibles(etablissementId),
    orderBy: { ordre: "asc" },
  });
}

/** Un niveau précis est-il visible (donc utilisable) par cet établissement ? Un niveau
 *  national MASQUÉ localement n'est pas considéré visible. Un niveau d'une AUTRE école non plus. */
export async function niveauVisiblePour(niveauId: string, etablissementId: string): Promise<boolean> {
  const [niveau, etab] = await Promise.all([
    prisma.niveau.findUnique({ where: { id: niveauId }, select: { etablissementId: true } }),
    prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { niveauxMasques: true } }),
  ]);
  if (!niveau) return false;
  if (niveau.etablissementId === etablissementId) return true; // niveau propre
  if (niveau.etablissementId === null) return !(etab?.niveauxMasques ?? []).includes(niveauId); // national non masqué
  return false; // niveau d'une autre école
}
