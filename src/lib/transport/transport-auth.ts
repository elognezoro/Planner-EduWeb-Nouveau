/* ============================================================================
   Modèle d'AUTORISATION du module Transport (remplace le RLS de Supabase).
   Sur Neon + Prisma, l'accès BD est côté serveur : les règles sont donc
   appliquées ICI, dans le service, à partir du `Caller` (identité résolue depuis
   ta session / Neon Auth).
   ========================================================================== */

/** Contexte de l'appelant, résolu côté serveur depuis ta session. */
export interface Caller {
  userId: string;
  /** Rôle applicatif (ex. 'admin', 'chef_etablissement', 'parent', 'transport_chauffeur'…). */
  role: string;
  /** Établissement de rattachement de l'appelant (null = aucun / « Général »). */
  etablissementId: string | null;
  /** Super-admin / administrateur global. */
  isAdmin: boolean;
}

/** Gestionnaire d'un périmètre : admin, ou chef DU MÊME établissement (refuse null). */
export function canManageTransport(caller: Caller, etab: string | null): boolean {
  return (
    caller.isAdmin ||
    (!!etab && caller.role === "chef_etablissement" && etab === caller.etablissementId)
  );
}

export class TransportError extends Error {}

/** Lève une erreur si l'appelant ne gère pas ce périmètre. */
export function assertCanManage(caller: Caller, etab: string | null): void {
  if (!canManageTransport(caller, etab)) {
    throw new TransportError("Accès refusé : réservé au gestionnaire de cet établissement.");
  }
}
