import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { estRoleValide, peutAttribuerRole, type RoleId } from "@/lib/rbac";

/**
 * SYNCHRONISATION Approbations ↔ Comptes/Habilitations : lorsqu'un rôle est attribué
 * DIRECTEMENT à un compte (fiche compte, modale d'habilitation, page Habilitations),
 * ses demandes de rôle EN ATTENTE sont soldées (statut « approuvee », traiteLe,
 * traiteParId) pour qu'elles ne restent pas dans la file des Approbations.
 *
 * Délégation respectée : un habilitateur de rang N ne solde que les demandes de rôles
 * qu'il aurait le droit d'attribuer (l'admin système solde tout) — une demande de rôle
 * SUPÉRIEUR reste en file pour l'admin, sans court-circuit du workflow.
 */
export async function solderDemandesEnAttente(
  db: Prisma.TransactionClient | PrismaClient,
  opts: { utilisateurId: string; acteurId: string; acteurRole: RoleId },
): Promise<number> {
  const enAttente = await db.demandeRole.findMany({
    where: { utilisateurId: opts.utilisateurId, statut: "en_attente" },
    select: { id: true, roleDemande: { select: { nomTechnique: true } } },
  });
  const aSolder = enAttente
    .filter((d) => estRoleValide(d.roleDemande.nomTechnique) && peutAttribuerRole(opts.acteurRole, d.roleDemande.nomTechnique))
    .map((d) => d.id);
  if (aSolder.length === 0) return 0;
  await db.demandeRole.updateMany({
    where: { id: { in: aSolder } },
    data: { statut: "approuvee", traiteLe: new Date(), traiteParId: opts.acteurId },
  });
  return aSolder.length;
}
