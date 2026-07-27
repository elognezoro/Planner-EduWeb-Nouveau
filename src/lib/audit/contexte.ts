import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexte d'audit par requête (« qui agit »), propagé via AsyncLocalStorage.
 *
 * Il est peuplé UNE fois par requête dans `getUtilisateurCourant()` (le point de passage de
 * quasiment toute action authentifiée), puis lu automatiquement par l'extension Prisma de
 * traçabilité au moment de chaque écriture — sans avoir à passer l'acteur d'action en action.
 *
 * Runtime Node uniquement (serverless Vercel). En cas de contexte absent (écriture hors requête,
 * ou avant résolution de session), l'extension journalise tout de même l'évènement, acteur = null.
 */
export interface ContexteAudit {
  utilisateurId: string | null;
  acteurEmail: string | null;
  acteurRole: string | null;
  etablissementId: string | null;
  ip: string | null;
  navigateur: string | null;
}

const stockage = new AsyncLocalStorage<ContexteAudit>();

/**
 * Fixe le contexte d'audit pour la suite de l'exécution asynchrone courante (et ses
 * descendants). `enterWith` permet de le poser depuis un helper (getUtilisateurCourant) sans
 * envelopper tout le reste dans un callback — les écritures Prisma ultérieures le verront.
 */
export function definirContexteAudit(ctx: ContexteAudit): void {
  try {
    stockage.enterWith(ctx);
  } catch {
    // enterWith peut échouer dans de rares contextes ; l'audit ne doit jamais casser la requête.
  }
}

/** Contexte d'audit courant, ou null s'il n'a pas (encore) été fixé pour cette requête. */
export function contexteAuditActuel(): ContexteAudit | null {
  return stockage.getStore() ?? null;
}
