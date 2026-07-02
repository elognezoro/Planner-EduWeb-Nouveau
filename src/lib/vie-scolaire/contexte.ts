import "server-only";
import { prisma } from "@/lib/prisma";
import { etablissementsOperationnels } from "@/lib/etablissements/operationnels";
import type { UtilisateurCourant } from "@/lib/auth/session";

export interface ContexteEtablissement {
  etabId: string | null;
  /** Liste des établissements proposés à l'admin pour sélectionner un contexte. */
  etablissements: { id: string; nom: string }[];
  estAdmin: boolean;
}

/**
 * Résout l'établissement de travail pour les écrans de vie scolaire.
 * - chef_etablissement / educateur : leur établissement de rattachement.
 * - admin : choisi via le paramètre `etab` (sinon liste à sélectionner).
 */
export async function resoudreEtablissement(
  u: UtilisateurCourant,
  etabParam?: string,
): Promise<ContexteEtablissement> {
  if (u.roleReel === "admin") {
    // Sélecteur limité aux établissements opérationnels (le répertoire complet compte
    // 40 000+ entrées) ; un identifiant explicite passé en paramètre reste accepté.
    const etablissements = await etablissementsOperationnels();
    let etabId: string | null = null;
    if (etabParam) {
      if (etablissements.some((e) => e.id === etabParam)) {
        etabId = etabParam;
      } else {
        const existe = await prisma.etablissement.findUnique({ where: { id: etabParam }, select: { id: true, nom: true } });
        if (existe) {
          etabId = existe.id;
          etablissements.unshift(existe);
        }
      }
    }
    return { etabId, etablissements, estAdmin: true };
  }
  return { etabId: u.portee.etablissementId, etablissements: [], estAdmin: false };
}

/** Peut-on gérer la vie scolaire de cet établissement ? (admin global, ou chef/educateur du périmètre) */
export function peutGererEtablissement(u: UtilisateurCourant, etabId: string): boolean {
  if (u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  return (
    (u.roleReel === "chef_etablissement" || u.roleReel === "educateur") &&
    u.portee.etablissementId === etabId
  );
}
