import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { journaliserSecurite } from "@/lib/audit/journal";

/**
 * CLOISONNEMENT des comptes par établissement (règle client) — règles PARTAGÉES par toutes les
 * consoles qui rattachent un compte à un établissement (console Enseignants, Habilitations…).
 */

/**
 * Rôles pouvant AUTORISER l'arrivée d'un utilisateur d'un AUTRE établissement, ou toucher un
 * compte de direction existant (règle client : seul le CHEF de l'établissement d'accueil — et
 * sa parité documentée admin d'établissements / hiérarchie — jamais l'ACE seul). `roleReel`
 * est déjà normalisé par la session : « directeur_etudes » compte comme chef.
 */
export const ROLES_AUTORITE_RATTACHEMENT = new Set<string>([
  "chef_etablissement",
  "etablissements_admin",
  "super_admin_etablissements",
  "superviseur_international",
  "admin",
]);

/** Comptes de DIRECTION : jamais réécrits ni attribués avec un rattachement sans autorité chef. */
export const ROLES_DIRECTION = new Set<string>(["chef_etablissement", "adjoint_chef_etablissement", "directeur_etudes"]);

/**
 * Un transfert inter-établissements COUPE tout lien résiduel hors établissement d'accueil :
 * - affectations de classes (sinon l'enseignant garderait notes / cahier de texte / registre
 *   d'appel de ses anciennes classes) ;
 * - compétences et niveaux d'intervention (l'unicité (enseignant, discipline/niveau) rendrait
 *   sinon toute re-déclaration à destination silencieusement impossible) ;
 * - rattachement secondaire visant l'établissement d'origine (portée multi-établissements).
 * Requêtes PARESSEUSES : à passer à `$transaction([...])` ou à attendre une à une dans `tx`.
 */
export function requetesPurgeTransfert(
  db: Prisma.TransactionClient | PrismaClient,
  t: { utilisateurId: string; origineId: string; accueilId: string },
): Prisma.PrismaPromise<Prisma.BatchPayload>[] {
  return [
    db.affectationEnseignant.deleteMany({
      where: { enseignantId: t.utilisateurId, classe: { etablissementId: { not: t.accueilId } } },
    }),
    db.competenceEnseignant.deleteMany({
      where: { enseignantId: t.utilisateurId, etablissementId: { not: t.accueilId } },
    }),
    db.niveauEnseignant.deleteMany({
      where: { enseignantId: t.utilisateurId, etablissementId: { not: t.accueilId } },
    }),
    db.affectationEtablissement.deleteMany({
      where: { utilisateurId: t.utilisateurId, etablissementId: t.origineId },
    }),
  ];
}

/** Décision d'accueil inter-établissements : tracée au journal de SÉCURITÉ. */
export async function journaliserRattachementInterEtablissement(
  appelant: { id: string; email: string; roleActif: string },
  t: { utilisateurId: string; email: string; de: string; vers: string },
): Promise<void> {
  await journaliserSecurite("rattachement_inter_etablissement", {
    utilisateurId: appelant.id,
    acteurEmail: appelant.email,
    acteurRole: appelant.roleActif,
    cible: `Utilisateur:${t.utilisateurId}`,
    details: { email: t.email, de: t.de, vers: t.vers },
  });
}
