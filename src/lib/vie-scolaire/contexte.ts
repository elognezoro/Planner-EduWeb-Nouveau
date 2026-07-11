import "server-only";
import { prisma } from "@/lib/prisma";
import { etablissementsOperationnels } from "@/lib/etablissements/operationnels";
import { paysConsulte } from "@/lib/pays-consulte";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
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
    // Sélecteur limité aux établissements opérationnels DU PAYS CONSULTÉ (barre supérieure).
    // Un identifiant explicite (?etab=) d'un AUTRE pays est refusé : la page revient au
    // sélecteur, pour que l'affichage (en-tête officiel inclus) reste cohérent avec le pays.
    const etablissements = await etablissementsOperationnels();
    let etabId: string | null = null;
    if (etabParam) {
      if (etablissements.some((e) => e.id === etabParam)) {
        etabId = etabParam;
      } else {
        const [existe, pays] = await Promise.all([
          prisma.etablissement.findUnique({ where: { id: etabParam }, select: { id: true, nom: true, pays: true } }),
          paysConsulte(),
        ]);
        if (existe && existe.pays === pays) {
          etabId = existe.id;
          etablissements.unshift({ id: existe.id, nom: existe.nom });
        }
      }
    }
    return { etabId, etablissements, estAdmin: true };
  }
  return { etabId: u.portee.etablissementId, etablissements: [], estAdmin: false };
}

/** Peut-on gérer la vie scolaire de cet établissement ? (admin global, chef/educateur du périmètre, ou Super Admin Établissements de son pays) */
export async function peutGererEtablissement(u: UtilisateurCourant, etabId: string): Promise<boolean> {
  if (u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  if ((u.roleReel === "chef_etablissement" || u.roleReel === "educateur") && u.portee.etablissementId === etabId) return true;
  // Super Admin Établissements : vie scolaire de tout établissement de SON pays (cloisonnement strict).
  if (u.roleReel === "super_admin_etablissements") {
    const e = await prisma.etablissement.findUnique({ where: { id: etabId }, select: { pays: true } });
    return ecritureNationaleAutorisee(u, "super_admin_etablissements", e?.pays);
  }
  return false;
}
