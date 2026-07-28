import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { after } from "next/server";
import { contexteAuditActuel, type ContexteAudit } from "./contexte";
import { nomsChamps } from "./caviardage";

/**
 * Extension Prisma de TRAÇABILITÉ — la GARANTIE de couverture.
 *
 * Elle enveloppe chaque opération de tous les modèles et, pour toute ÉCRITURE réussie
 * (create/update/delete…), écrit une entrée dans `journal_activite` (source = "auto"). Aucune
 * action métier ne peut donc « oublier » de tracer : la trace est posée au niveau du client
 * Prisma, sous toutes les actions.
 *
 * Choix de conception (revue de sécurité) :
 *  - VIE PRIVÉE : la capture auto ne conserve QUE les NOMS des champs modifiés (`details.champs`),
 *    jamais les valeurs → aucun secret ni donnée personnelle recopiés dans le journal (RGPD),
 *    et pas de gonflement par les payloads. Les évènements riches (avant/après) passent par les
 *    appels EXPLICITES journaliserActivite() / journaliserFinance().
 *  - ROBUSTESSE : écriture via le client de BASE (non étendu) → aucune récursion ; jamais bloquant
 *    (try/catch total) ; rattachée à `after()` pour être vidée AVANT le gel de l'instance serverless.
 *
 * Limites connues (assumées, suivi phase 2) :
 *  - Écritures faites DANS une transaction interactive : le log auto est écrit hors transaction ;
 *    en cas de ROLLBACK, l'entrée auto subsiste (« fantôme »). La trace faisant FOI pour les
 *    opérations transactionnelles sensibles (Finance) reste le journal transactionnel dédié
 *    (JournalAuditFinance via journaliserFinance), écrit DANS la transaction.
 *  - RÉTENTION : la table croît au rythme de toutes les écritures — prévoir un partitionnement
 *    mensuel + purge (auto : quelques mois ; sécurité/métier : conservation longue).
 */

/** Opérations d'écriture à tracer (les lectures sont ignorées : coût nul). */
const OPERATIONS_ECRITURE = new Set<string>([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/** Modèles NON tracés automatiquement : journaux (append-only déjà tracés) et tables techniques. */
const MODELES_EXCLUS = new Set<string>([
  "JournalActivite", // le journal lui-même (défense en profondeur — évite toute boucle)
  "JournalAuditFinance", // journal d'audit financier dédié (déjà transactionnel et riche)
  "JournalComptable", // écritures comptables (pièces générées, pas une activité utilisateur)
  "VisiteSite", // compteur de trafic anonyme
  "Jeton", // jetons d'auth / 2FA (les évènements de sécurité sont tracés explicitement)
  "SequenceNumerotation", // compteur technique de numérotation
]);

/** Slug d'action lisible : « Note » → « note.create ». */
function slugModele(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function texteCourt(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, 200) : null;
}

/**
 * Écrit l'entrée d'audit d'une écriture (via le client de BASE, jamais bloquant).
 * Le contexte (acteur) est CAPTURÉ à la planification et passé ici : le callback différé par
 * `after()` s'exécute hors de la portée AsyncLocalStorage de la requête.
 */
async function journaliserEcritureAuto(
  base: PrismaClient,
  ctx: ContexteAudit | null,
  model: string,
  operation: string,
  args: unknown,
  resultat: unknown,
): Promise<void> {
  try {
    const a = (args ?? {}) as {
      data?: unknown;
      create?: unknown;
      update?: unknown;
      where?: { id?: unknown };
    };
    const r = resultat as { id?: unknown; count?: number } | null;

    const estLot =
      operation === "createMany" ||
      operation === "updateMany" ||
      operation === "updateManyAndReturn" ||
      operation === "deleteMany";

    const entiteId = estLot ? null : texteCourt(r?.id) ?? texteCourt(a.where?.id);
    const nombre = estLot && typeof r?.count === "number" ? r.count : null;
    const cible = estLot
      ? `${model} (${nombre ?? "?"})`
      : entiteId
        ? `${model}:${entiteId}`
        : model;

    // NOMS des champs touchés uniquement (pas de valeurs). `upsert` porte create + update.
    const champs = operation.startsWith("delete")
      ? []
      : operation === "upsert"
        ? nomsChamps(a.create, a.update)
        : nomsChamps(a.data);

    // Périmètre : contexte de session, sinon établissement porté par la donnée (id, non sensible).
    const dataObj = (a.data ?? a.create) as { etablissementId?: unknown } | undefined;
    const etablissementId = ctx?.etablissementId ?? texteCourt(dataObj?.etablissementId) ?? null;

    await base.journalActivite.create({
      data: {
        utilisateurId: ctx?.utilisateurId ?? null,
        acteurEmail: ctx?.acteurEmail ?? null,
        acteurRole: ctx?.acteurRole ?? null,
        etablissementId,
        action: `${slugModele(model)}.${operation}`,
        operation,
        entite: model,
        entiteId,
        cible,
        details: {
          ...(champs.length ? { champs } : {}),
          ...(nombre !== null ? { nombre } : {}),
        },
        ip: ctx?.ip ?? null,
        navigateur: ctx?.navigateur ?? null,
        source: "auto",
        // Mode assistance : l'administrateur RÉEL. Sans cela, l'écriture serait imputée à la
        // cible incarnée (ctx.utilisateurId), qui n'en est pas l'auteur.
        operateurId: ctx?.operateurId ?? null,
        operateurEmail: ctx?.operateurEmail ?? null,
        operateurRole: ctx?.operateurRole ?? null,
      },
    });
  } catch {
    // La traçabilité ne doit JAMAIS casser une opération métier ni la requête.
  }
}

/**
 * Planifie l'écriture d'audit pour qu'elle survive au retour de la requête serverless.
 * `after()` garantit l'exécution après la réponse ; hors contexte de requête, on retombe sur un
 * envoi détaché (jamais bloquant, jamais de rejet non géré).
 */
function planifierAudit(
  base: PrismaClient,
  model: string,
  operation: string,
  args: unknown,
  resultat: unknown,
): void {
  // Capture SYNCHRONE du contexte (encore dans la portée ALS de la requête).
  const ctx = contexteAuditActuel();
  try {
    after(() => journaliserEcritureAuto(base, ctx, model, operation, args, resultat));
  } catch {
    void journaliserEcritureAuto(base, ctx, model, operation, args, resultat);
  }
}

/** Construit l'extension d'audit branchée sur le client de base fourni (utilisé pour les logs). */
export function creerExtensionAudit(base: PrismaClient) {
  return Prisma.defineExtension({
    name: "tracabilite-activite",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const resultat = await query(args);
          if (OPERATIONS_ECRITURE.has(operation) && !MODELES_EXCLUS.has(model)) {
            planifierAudit(base, model, operation, args, resultat);
          }
          return resultat;
        },
      },
    },
  });
}
