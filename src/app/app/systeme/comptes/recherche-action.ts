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
