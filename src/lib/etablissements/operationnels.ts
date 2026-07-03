import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";

/**
 * Établissements « opérationnels » : réellement utilisés sur la plateforme (au moins des
 * classes, des salles ou des comptes rattachés). Les SÉLECTEURS d'interface se limitent à
 * eux : le répertoire national complet (40 000+ établissements importés) reste consultable
 * sur la page Établissements (recherche + pagination) et via la recherche d'affectation.
 *
 * Les listes sont FILTRÉES SUR LE PAYS CONSULTÉ (sélecteur de la barre supérieure) : les
 * écrans ne proposent que des établissements du pays sélectionné. Un appelant peut fixer
 * lui-même `where.pays` pour court-circuiter ce filtre.
 */
export async function etablissementsOperationnels(
  where: Prisma.EtablissementWhereInput = {},
): Promise<{ id: string; nom: string }[]> {
  const pays = where.pays === undefined ? await paysConsulte() : undefined;
  return prisma.etablissement.findMany({
    where: {
      ...(pays ? { pays } : {}),
      ...where,
      OR: [{ classes: { some: {} } }, { utilisateurs: { some: {} } }, { salles: { some: {} } }],
    },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
    take: 300,
  });
}

export interface EtabAvecRegion {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
}

/**
 * Variante avec la direction régionale (DRENA / DRENAET) : alimente les sélecteurs
 * « en cascade » qui regroupent les établissements par direction régionale.
 */
export async function etablissementsOperationnelsAvecRegion(
  where: Prisma.EtablissementWhereInput = {},
): Promise<EtabAvecRegion[]> {
  const pays = where.pays === undefined ? await paysConsulte() : undefined;
  const bruts = await prisma.etablissement.findMany({
    where: {
      ...(pays ? { pays } : {}),
      ...where,
      OR: [{ classes: { some: {} } }, { utilisateurs: { some: {} } }, { salles: { some: {} } }],
    },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, ville: true, region: { select: { nom: true } } },
    take: 300,
  });
  return bruts.map((e) => ({ id: e.id, nom: e.nom, ville: e.ville, region: e.region?.nom ?? null }));
}

/** Recherche plein-texte dans le répertoire complet (pour l'affectation d'utilisateurs). */
export async function rechercherEtablissements(
  q: string,
  limite = 30,
): Promise<{ id: string; nom: string; ville: string | null; pays: string | null }[]> {
  const termes = q.trim().split(/\s+/).filter((t) => t.length >= 2);
  if (termes.length === 0) return [];
  return prisma.etablissement.findMany({
    where: {
      // Chaque mot saisi doit apparaître (nom, ville ou code) : « lycee moderne oume »
      // trouve « LYCEE MODERNE 1 OUME » même si l'ordre ou des mots intermédiaires diffèrent.
      AND: termes.map((t) => ({
        OR: [
          { nom: { contains: t, mode: "insensitive" as const } },
          { ville: { contains: t, mode: "insensitive" as const } },
          { code: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: [{ nom: "asc" }],
    select: { id: true, nom: true, ville: true, pays: true },
    take: limite,
  });
}
