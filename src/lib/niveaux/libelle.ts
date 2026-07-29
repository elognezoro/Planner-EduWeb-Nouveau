import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Libellé d'un niveau TEL QU'AFFICHÉ pour un établissement donné.
 *
 * Renvoie le nom local (`NiveauEtablissement.nomAffiche`) s'il existe, sinon le nom canonique
 * national fourni en repli. La résolution est TOUJOURS bornée à l'établissement passé en argument :
 * un renommage fait par une école n'affecte jamais l'affichage d'une autre — c'est la garantie de
 * cloisonnement exigée. Sans établissement (contexte national), on renvoie le nom canonique.
 */
export async function libelleNiveauEtablissement(
  etablissementId: string | null | undefined,
  niveauId: string,
  nomCanonique: string,
): Promise<string> {
  if (!etablissementId) return nomCanonique;
  try {
    const c = await prisma.niveauEtablissement.findUnique({
      where: { etablissementId_niveauId: { etablissementId, niveauId } },
      select: { nomAffiche: true },
    });
    return c?.nomAffiche?.trim() || nomCanonique;
  } catch {
    // Un libellé n'est jamais critique : en cas d'erreur, on retombe sur le nom canonique.
    return nomCanonique;
  }
}

/**
 * Version par LOT : libellés locaux d'un ensemble de niveaux pour UN établissement.
 * Utile pour un document listant plusieurs niveaux (récapitulatifs, exports) sans multiplier les
 * requêtes. Renvoie une Map niveauId → libellé affiché (nom local sinon canonique).
 */
export async function libellesNiveauxEtablissement(
  etablissementId: string | null | undefined,
  niveaux: { id: string; nom: string }[],
): Promise<Map<string, string>> {
  const carte = new Map(niveaux.map((n) => [n.id, n.nom]));
  if (!etablissementId || niveaux.length === 0) return carte;
  try {
    const locaux = await prisma.niveauEtablissement.findMany({
      where: { etablissementId, niveauId: { in: niveaux.map((n) => n.id) }, nomAffiche: { not: null } },
      select: { niveauId: true, nomAffiche: true },
    });
    for (const l of locaux) if (l.nomAffiche?.trim()) carte.set(l.niveauId, l.nomAffiche.trim());
  } catch {
    /* repli silencieux sur les noms canoniques */
  }
  return carte;
}
