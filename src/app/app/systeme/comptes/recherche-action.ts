"use server";

import { getUtilisateurCourant } from "@/lib/auth/session";
import { rechercherEtablissements } from "@/lib/etablissements/operationnels";

export interface EtabResultat {
  id: string;
  nom: string;
  ville: string | null;
  pays: string | null;
}

const ADMINS = ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"];

/**
 * Recherche d'établissements dans le répertoire complet (41 000+), pour l'affectation
 * d'utilisateurs. Réservée à l'administration ; renvoie les 30 premières correspondances.
 */
export async function rechercherEtablissementsAction(q: string): Promise<EtabResultat[]> {
  const u = await getUtilisateurCourant();
  if (!u || !ADMINS.includes(u.roleReel)) return [];
  return rechercherEtablissements(q);
}

/**
 * Établissements opérationnels d'un pays donné, avec leur direction régionale
 * (modale d'habilitation : sélecteur en cascade DRENA / DRENAET, recherche rapide).
 * Réservée à l'administration.
 */
export async function etablissementsParPaysAction(
  pays: string,
): Promise<{ id: string; nom: string; ville: string | null; region: string | null }[]> {
  const u = await getUtilisateurCourant();
  if (!u || !ADMINS.includes(u.roleReel)) return [];
  const p = pays.trim();
  if (!p) return [];
  const { etablissementsOperationnelsAvecRegion } = await import("@/lib/etablissements/operationnels");
  return etablissementsOperationnelsAvecRegion({ pays: { equals: p, mode: "insensitive" } });
}
