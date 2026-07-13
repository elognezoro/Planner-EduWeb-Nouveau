import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { SLUGS_SEMINAIRES } from "@/lib/seminaires";

/** Activités de sondage reconnues (extensible). */
export const ACTIVITES_SONDAGE = new Set(["sondage-entree"]);

export function parametresValides(seminaire: string, activite: string): boolean {
  return SLUGS_SEMINAIRES.has(seminaire) && ACTIVITES_SONDAGE.has(activite);
}

/**
 * Détermine si l'utilisateur courant est formateur (ou admin) pour un séminaire :
 * l'admin l'est toujours ; sinon son e-mail doit figurer dans ConfigSeminaire.formateurs.
 */
export async function contexteFormateur(
  seminaire: string,
): Promise<{ u: UtilisateurCourant | null; estFormateur: boolean }> {
  const u = await getUtilisateurCourant();
  if (!u) return { u: null, estFormateur: false };
  if (u.roleReel === "admin") return { u, estFormateur: true };
  const cfg = await prisma.configSeminaire.findUnique({ where: { slug: seminaire }, select: { formateurs: true } });
  const emails = (cfg?.formateurs ?? []).map((e) => e.trim().toLowerCase());
  return { u, estFormateur: emails.includes(u.email.trim().toLowerCase()) };
}

/** Agrégation du nuage de mots (mot → nombre), triée par fréquence décroissante. */
export async function nuageDeMots(seminaire: string, activite: string): Promise<{ mot: string; n: number }[]> {
  const groupes = await prisma.reponseSondage.groupBy({
    by: ["mot"],
    where: { seminaire, activite, mot: { not: null } },
    _count: { mot: true },
  });
  return groupes
    .filter((g): g is typeof g & { mot: string } => g.mot != null)
    .map((g) => ({ mot: g.mot, n: g._count.mot }))
    .sort((a, b) => b.n - a.n || a.mot.localeCompare(b.mot, "fr"));
}
