import "server-only";
import { prisma } from "@/lib/prisma";
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
    const etablissements = await prisma.etablissement.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    });
    const etabId =
      etabParam && etablissements.some((e) => e.id === etabParam) ? etabParam : null;
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
