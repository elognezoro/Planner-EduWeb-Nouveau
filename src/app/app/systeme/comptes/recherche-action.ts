"use server";

import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { rechercherEtablissements } from "@/lib/etablissements/operationnels";

export interface EtabResultat {
  id: string;
  nom: string;
  ville: string | null;
  pays: string | null;
}

/** Établissement avec sa direction régionale (sélecteur en cascade DRENA / DRENAET). */
export interface EtabRegion {
  id: string;
  nom: string;
  ville: string | null;
  region: string | null;
}

const ADMINS = ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"];

async function estAdmin(): Promise<boolean> {
  const u = await getUtilisateurCourant();
  return Boolean(u && ADMINS.includes(u.roleReel));
}

/**
 * Recherche d'établissements dans le répertoire complet (41 000+), pour l'affectation
 * d'utilisateurs. Réservée à l'administration ; renvoie les 30 premières correspondances.
 */
export async function rechercherEtablissementsAction(q: string): Promise<EtabResultat[]> {
  if (!(await estAdmin())) return [];
  return rechercherEtablissements(q);
}

/**
 * Contexte du pays pour la modale d'habilitation : nombre total d'établissements du
 * RÉPERTOIRE COMPLET et liste des directions régionales (DRENA / DRENAET) avec leurs
 * effectifs — alimente le champ « Direction régionale » du sélecteur en cascade.
 */
export async function contexteEtablissementsPaysAction(
  pays: string,
): Promise<{ total: number; regions: { id: string; nom: string; nb: number }[] }> {
  if (!(await estAdmin())) return { total: 0, regions: [] };
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

/**
 * Établissements du RÉPERTOIRE COMPLET d'un pays — restreints à une direction régionale
 * si `regionId` est fourni (cascade DRENAET → établissements). Réservé à l'administration.
 */
export async function listerEtablissementsAction(pays: string, regionId?: string): Promise<EtabRegion[]> {
  if (!(await estAdmin())) return [];
  const p = pays.trim();
  if (!p) return [];
  const bruts = await prisma.etablissement.findMany({
    where: { pays: { equals: p, mode: "insensitive" }, ...(regionId ? { regionId } : {}) },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, ville: true, region: { select: { nom: true } } },
    take: 500,
  });
  return bruts.map((e) => ({ id: e.id, nom: e.nom, ville: e.ville, region: e.region?.nom ?? null }));
}

/** CAFOP d'un pays — sélecteur de rattachement pour le rôle « Admin CAFOP ». Réservé à l'administration. */
export async function listerCafopsPaysAction(pays: string): Promise<{ id: string; nom: string }[]> {
  if (!(await estAdmin())) return [];
  const p = pays.trim();
  if (!p) return [];
  return prisma.cafop.findMany({
    where: { pays: { equals: p, mode: "insensitive" } },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
}

/** APFC d'un pays (rattachées via leur direction régionale) — sélecteur pour le rôle « Admin APFC ». */
export async function listerApfcsPaysAction(pays: string): Promise<{ id: string; nom: string }[]> {
  if (!(await estAdmin())) return [];
  const p = pays.trim();
  if (!p) return [];
  return prisma.apfc.findMany({
    where: { region: { pays: { equals: p, mode: "insensitive" } } },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
}

/**
 * Recherche rapide dans le répertoire complet d'un pays — restreinte à une direction
 * régionale si `regionId` est fourni (directions trop vastes pour une liste intégrale) :
 * chaque mot saisi doit apparaître dans le nom, la ville ou le code de l'établissement.
 */
export async function rechercherEtablissementsPaysAction(
  pays: string,
  q: string,
  regionId?: string,
): Promise<EtabRegion[]> {
  if (!(await estAdmin())) return [];
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
    select: { id: true, nom: true, ville: true, region: { select: { nom: true } } },
    take: 60,
  });
  return bruts.map((e) => ({ id: e.id, nom: e.nom, ville: e.ville, region: e.region?.nom ?? null }));
}
