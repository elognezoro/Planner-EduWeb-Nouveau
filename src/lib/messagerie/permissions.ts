import "server-only";
import { prisma } from "@/lib/prisma";
import { ROLES, estRoleValide, ROLE_PAR_DEFAUT, type RoleId } from "@/lib/rbac";
import { utilisateurDansPortee, type PorteeUtilisateur } from "@/lib/rbac/scope";

/** Contexte minimal de l'expéditeur d'un message (dérivé de la session). */
export interface ExpediteurMessage {
  id: string;
  roleReel: RoleId;
  portee: PorteeUtilisateur;
  apercuActif: boolean;
}

/**
 * Un expéditeur peut-il envoyer un message direct à un destinataire ?
 *
 * Règle métier (communication interne) :
 *  - l'ADMIN SYSTÈME ↔ TOUS les utilisateurs (les deux sens) ;
 *  - un rôle HIÉRARCHIQUEMENT SUPÉRIEUR → un rôle inférieur, mais uniquement DANS SON PÉRIMÈTRE
 *    (même établissement / CAFOP / APFC / région / pays selon la portée de l'expéditeur) ;
 *  - une RÉPONSE est toujours possible si le destinataire a déjà écrit à l'expéditeur.
 *
 * Refusé en mode aperçu (lecture seule) et vers soi-même. Contrôle CÔTÉ SERVEUR — la couche
 * UI ne fait que masquer les boutons.
 */
export async function peutContacter(exp: ExpediteurMessage, destinataireId: string): Promise<boolean> {
  if (exp.apercuActif) return false;
  if (!destinataireId || destinataireId === exp.id) return false;

  const dest = await prisma.utilisateur.findUnique({
    where: { id: destinataireId },
    select: {
      id: true,
      etablissementId: true,
      cafopId: true,
      apfcId: true,
      regionId: true,
      pays: true,
      etablissement: { select: { regionId: true } },
      roleActif: { select: { nomTechnique: true } },
    },
  });
  if (!dest) return false;

  const roleDest: RoleId = estRoleValide(dest.roleActif.nomTechnique)
    ? dest.roleActif.nomTechnique
    : ROLE_PAR_DEFAUT;
  const roleExp = exp.roleReel;

  // 1. Admin système ↔ tous les utilisateurs.
  if (roleExp === "admin" || roleDest === "admin") return true;

  // 2. Réponse à une conversation déjà entamée par le destinataire.
  const dejaEcrit = await prisma.message.findFirst({
    where: { expediteurId: destinataireId, destinataireId: exp.id },
    select: { id: true },
  });
  if (dejaEcrit) return true;

  // 3. Rôle supérieur → inférieur, DANS le périmètre de l'expéditeur.
  const dansPortee = utilisateurDansPortee(exp.portee, {
    etablissementId: dest.etablissementId,
    cafopId: dest.cafopId,
    apfcId: dest.apfcId,
    regionId: dest.regionId ?? dest.etablissement?.regionId ?? null,
    pays: dest.pays,
  });
  return dansPortee && ROLES[roleExp].rang > ROLES[roleDest].rang;
}
