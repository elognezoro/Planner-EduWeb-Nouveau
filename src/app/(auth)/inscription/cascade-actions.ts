"use server";

import { prisma } from "@/lib/prisma";

/** Établissement du répertoire PUBLIC d'un pays (nom, ville, direction régionale, code). */
export interface EtabInscription {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
  code: string | null;
}

/**
 * Données de rattachement pour le formulaire d'INSCRIPTION — accès PUBLIC (visiteur non
 * authentifié). Ne renvoie que le répertoire de référence public (noms d'établissements,
 * villes, codes, directions régionales) — AUCUNE donnée personnelle. Résultats strictement
 * bornés (500 pour une liste, 60 pour une recherche ; termes ≥ 2 caractères).
 *
 * Équivalents publics des actions admin de `systeme/comptes/recherche-action.ts`, sans la
 * garde `estAdmin()` (impossible à l'inscription) mais avec le même bornage.
 */

/** Régions académiques (DRENA/DRENAET) d'un pays + total d'établissements du pays. */
export async function regionsPaysInscription(
  pays: string,
): Promise<{ total: number; regions: { id: string; nom: string; nb: number }[] }> {
  const p = pays.trim();
  if (!p) return { total: 0, regions: [] };

  const groupes = await prisma.etablissement.groupBy({
    by: ["regionId"],
    where: { pays: { equals: p, mode: "insensitive" } },
    _count: { _all: true },
  });
  const ids = groupes.map((g) => g.regionId).filter((r): r is string => Boolean(r));
  const noms = ids.length
    ? await prisma.region.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true } })
    : [];
  const nomPar = new Map(noms.map((r) => [r.id, r.nom]));

  return {
    total: groupes.reduce((n, g) => n + g._count._all, 0),
    regions: groupes
      .filter((g) => g.regionId && nomPar.has(g.regionId))
      .map((g) => ({ id: g.regionId as string, nom: nomPar.get(g.regionId as string) as string, nb: g._count._all }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  };
}

/** Établissements d'un pays, restreints à une direction régionale si `regionId`. */
export async function listerEtablissementsInscription(
  pays: string,
  regionId?: string,
): Promise<EtabInscription[]> {
  const p = pays.trim();
  if (!p) return [];
  const bruts = await prisma.etablissement.findMany({
    where: { pays: { equals: p, mode: "insensitive" }, ...(regionId ? { regionId } : {}) },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, ville: true, code: true, region: { select: { nom: true } } },
    take: 500,
  });
  return bruts.map((e) => ({ id: e.id, nom: e.nom, ville: e.ville, code: e.code, region: e.region?.nom ?? null }));
}

/** Recherche rapide (nom, ville, code) dans le répertoire d'un pays, éventuellement d'une région. */
export async function rechercherEtablissementsInscription(
  pays: string,
  q: string,
  regionId?: string,
): Promise<EtabInscription[]> {
  const p = pays.trim();
  const termes = q.trim().split(/\s+/).filter((t) => t.length >= 2);
  if (!p || termes.length === 0) return [];
  const bruts = await prisma.etablissement.findMany({
    where: {
      pays: { equals: p, mode: "insensitive" },
      ...(regionId ? { regionId } : {}),
      AND: termes.map((t) => ({
        OR: [
          { nom: { contains: t, mode: "insensitive" as const } },
          { ville: { contains: t, mode: "insensitive" as const } },
          { code: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, ville: true, code: true, region: { select: { nom: true } } },
    take: 60,
  });
  return bruts.map((e) => ({ id: e.id, nom: e.nom, ville: e.ville, code: e.code, region: e.region?.nom ?? null }));
}
