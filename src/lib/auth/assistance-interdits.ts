import "server-only";
import { Prisma } from "@prisma/client";
import { contexteAuditActuel } from "@/lib/audit/contexte";

/**
 * MODE ASSISTANCE — actions INTERDITES même en agissant pour le compte d'un utilisateur.
 *
 * Pourquoi ici, et pas action par action : le mode assistance lève d'un seul coup les ~143
 * gardes `apercuActif` de l'application. Une liste noire posée dans chaque action serait
 * fatalement incomplète (et le resterait à chaque nouvelle action écrite). On l'applique donc
 * au SEUL endroit que toute écriture traverse : le client Prisma.
 *
 * Principe : l'assistance sert à DÉPANNER un client, jamais à disposer de son compte. Sont donc
 * refusées les opérations qui (a) donnent le contrôle définitif du compte, (b) engagent le
 * client juridiquement ou financièrement, (c) parlent en son nom à des tiers, (d) sont
 * irréversibles. Ces refus valent aussi pour l'administrateur système : l'assistance n'est pas
 * un contournement des règles, c'est une délégation encadrée.
 *
 * L'opérateur garde évidemment ces droits sous SA propre identité, hors assistance.
 */

/** Écritures : toute opération qui modifie des données. */
const ECRITURES = new Set([
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

/**
 * Modèles dont TOUTE écriture est refusée en assistance.
 * — DemandeRole / EchangeApprobation : instruire sa propre demande de rôle ou répondre dans le
 *   fil contractuel d'approbation au nom du titulaire.
 * — AbonnementPremium / CodePromo / DemandeCodePromo : engagement financier pris pour le client.
 * — DelegationFinance : déléguer des pouvoirs financiers = élévation de privilèges différée.
 * — ClotureExercice : clôture comptable irréversible.
 * — Message / AlerteSMS / ParametrageAlertesSMS : communication sortante signée du nom du client
 *   vers des tiers (copie e-mail, SMS aux parents) — impossible à rattraper une fois partie.
 */
const MODELES_INTERDITS = new Set([
  "DemandeRole",
  "EchangeApprobation",
  "AbonnementPremium",
  "CodePromo",
  "DemandeCodePromo",
  "DelegationFinance",
  "ClotureExercice",
  "Message",
  "AlerteSMS",
  "ParametrageAlertesSMS",
]);

/**
 * Champs d'`Utilisateur` intouchables en assistance : ils donnent le contrôle DÉFINITIF du
 * compte (identifiants, second facteur, statut) ou élèvent les privilèges (rôle).
 * Les autres champs (nom, téléphone, photo…) restent modifiables : c'est le cœur du dépannage.
 */
const CHAMPS_UTILISATEUR_INTERDITS = new Set([
  "email",
  "motDePasseHash",
  "deuxFacteursActif",
  "deuxFacteursMethode",
  "roleActifId",
  "statutCompte",
]);

/** Message unique, explicite : l'opérateur doit comprendre POURQUOI et quoi faire à la place. */
function refus(detail: string): never {
  throw new Error(
    `Action impossible en mode assistance : ${detail}. ` +
      "Quittez l'assistance et agissez sous votre propre identité, ou demandez à l'utilisateur de le faire lui-même.",
  );
}

/** Les données écrites touchent-elles un champ interdit ? (couvre data, create et update d'upsert) */
function toucheChampInterdit(args: unknown): boolean {
  const a = args as { data?: unknown; create?: unknown; update?: unknown } | undefined;
  for (const bloc of [a?.data, a?.create, a?.update]) {
    if (!bloc || typeof bloc !== "object") continue;
    for (const cle of Object.keys(bloc as Record<string, unknown>)) {
      if (CHAMPS_UTILISATEUR_INTERDITS.has(cle)) return true;
    }
  }
  return false;
}

/**
 * Extension Prisma de REFUS. À placer AVANT l'extension d'audit dans la chaîne : une opération
 * refusée ne doit produire aucune trace d'écriture (elle n'a pas eu lieu).
 */
export const extensionAssistanceInterdits = Prisma.defineExtension({
  name: "assistance-interdits",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = contexteAuditActuel();
        // Hors assistance : aucun surcoût, on laisse passer.
        if (!ctx?.assistance || !ECRITURES.has(operation)) return query(args);

        if (MODELES_INTERDITS.has(model)) {
          refus(`« ${model} » ne peut pas être modifié en agissant pour le compte d'un utilisateur`);
        }
        if (model === "Utilisateur") {
          if (operation === "create" || operation.startsWith("delete")) {
            refus("créer ou supprimer un compte utilisateur");
          }
          if (toucheChampInterdit(args)) {
            refus(
              "modifier l'e-mail, le mot de passe, la double authentification, le statut ou le rôle du compte",
            );
          }
        }
        return query(args);
      },
    },
  },
});
