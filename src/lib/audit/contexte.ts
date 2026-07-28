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
  /** Compte AFFECTÉ par l'écriture. En mode assistance, c'est la CIBLE incarnée, pas l'opérateur. */
  utilisateurId: string | null;
  acteurEmail: string | null;
  acteurRole: string | null;
  etablissementId: string | null;
  ip: string | null;
  navigateur: string | null;
  /**
   * MODE ASSISTANCE (« Voir comme » avec écriture) : administrateur RÉEL qui agit en lieu et
   * place de la cible. Nul en fonctionnement normal.
   *
   * ⚠️ Sans ces champs, une écriture d'assistance serait imputée au CLIENT : `utilisateurId`
   * ci-dessus vaut la cible, car l'objet de session est remplacé par elle. `operateurId` non nul
   * est donc le marqueur d'une action d'assistance dans le journal.
   */
  operateurId: string | null;
  operateurEmail: string | null;
  operateurRole: string | null;
  /** Vrai pendant une session d'assistance : lu par l'extension de refus (actions interdites). */
  assistance: boolean;
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
