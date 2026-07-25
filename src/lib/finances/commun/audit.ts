import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

/**
 * Journal d'audit financier INVIOLABLE (RM-003/011/017).
 *
 * Chaque action financière d'écriture appelle `journaliserFinance` avec le client de
 * TRANSACTION Prisma de l'opération : l'écriture d'audit réussit ou fait échouer l'opération
 * entière — c'est voulu, pas d'opération financière sans trace d'audit.
 *
 * La capture des en-têtes (IP, navigateur) n'est en revanche JAMAIS bloquante : si `headers()`
 * échoue (contexte hors requête), on journalise sans IP ni navigateur.
 */

export interface ContexteRequete {
  ip: string | null;
  navigateur: string | null;
}

/** IP (premier élément de x-forwarded-for) et user-agent (tronqué à 300) de la requête courante. */
export async function contexteRequete(): Promise<ContexteRequete> {
  try {
    const h = await headers();
    const ipBrute = h.get("x-forwarded-for") ?? "";
    const ip = ipBrute.split(",")[0]?.trim() || null;
    const navigateur = (h.get("user-agent") ?? "").trim().slice(0, 300) || null;
    return { ip, navigateur };
  } catch {
    return { ip: null, navigateur: null };
  }
}

export interface EntreeAuditFinance {
  etablissementId: string;
  /** Libellé/identifiant d'exercice (ex : « 2025-2026 ») quand l'opération en porte un. */
  exerciceId?: string | null;
  utilisateurId?: string | null;
  /** Ex : « paiement.creation », « depense.annulation ». */
  action: string;
  /** Modèle concerné, ex : « PaiementScolarite ». */
  entite: string;
  entiteId: string;
  /** État AVANT modification — lu DANS la transaction, avant l'écriture. */
  ancienneValeur?: unknown;
  nouvelleValeur?: unknown;
  /** Contexte pré-capturé côté action (facultatif : capturé automatiquement sinon). */
  contexte?: ContexteRequete;
}

/** Sérialise n'importe quelle valeur en JSON Prisma (les Date deviennent des chaînes ISO). */
function versJson(valeur: unknown): Prisma.InputJsonValue | undefined {
  if (valeur === undefined || valeur === null) return undefined;
  return JSON.parse(JSON.stringify(valeur)) as Prisma.InputJsonValue;
}

/**
 * Écrit une entrée du journal d'audit financier DANS la transaction `tx` de l'opération.
 * Table append-only : aucune action d'update/delete n'est jamais écrite sur ce journal.
 */
export async function journaliserFinance(
  tx: Prisma.TransactionClient,
  entree: EntreeAuditFinance,
): Promise<void> {
  const ctx = entree.contexte ?? (await contexteRequete());
  await tx.journalAuditFinance.create({
    data: {
      etablissementId: entree.etablissementId,
      exerciceId: entree.exerciceId ?? null,
      utilisateurId: entree.utilisateurId ?? null,
      action: entree.action,
      entite: entree.entite,
      entiteId: entree.entiteId,
      ancienneValeur: versJson(entree.ancienneValeur),
      nouvelleValeur: versJson(entree.nouvelleValeur),
      ip: ctx.ip,
      navigateur: ctx.navigateur,
    },
  });
}
