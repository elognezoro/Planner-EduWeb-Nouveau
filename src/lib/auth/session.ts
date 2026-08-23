import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";
import { auth } from "./index";
import { lireApercu, lireApercuUtilisateur } from "./apercu";
import { prisma } from "@/lib/prisma";
import { definirContexteAudit } from "@/lib/audit/contexte";
import { estRoleValide, libelleRole, peutIncarnerUtilisateur, roleEffectifRBAC, ROLE_PAR_DEFAUT, type RoleId } from "@/lib/rbac";
import type { PorteeUtilisateur } from "@/lib/rbac";
import {
  accesEffectif,
  accesParDefaut,
  chargerSurcharges,
  resoudreItemParChemin,
} from "@/lib/rbac/permissions-dynamiques";

/** Demande de rôle en attente, telle qu'affichée dans le bandeau de statut. */
export interface DemandeEnAttente {
  id: string;
  roleDemande: RoleId;
  libelleRoleDemande: string;
  structureDeclaree: string | null;
  creeLe: Date;
}

/** Utilisateur courant enrichi, source de vérité pour le contrôle d'accès et l'affichage. */
export interface UtilisateurCourant {
  id: string;
  email: string;
  nom: string | null;
  prenoms: string | null;
  nomComplet: string;
  telephone: string | null;
  photoUrl: string | null;
  langue: string;
  statutCompte: string;
  /** Rôle EFFECTIF (= rôle prévisualisé si l'aperçu est actif, sinon rôle réel). */
  roleActif: RoleId;
  libelleRoleActif: string;
  portee: PorteeUtilisateur;
  demandeEnAttente: DemandeEnAttente | null;
  /** Accès restreint à Mon Identification / Mon Profil tant qu'une demande est en attente (§6.3). */
  accesRestreint: boolean;
  /** Rôle réel de l'utilisateur connecté (inchangé par l'aperçu). */
  roleReel: RoleId;
  libelleRoleReel: string;
  /**
   * VERROU D'ÉCRITURE de l'aperçu de RÔLE (§4.5) : interface d'un rôle fictif, lecture seule.
   *
   * ⚠️ N'est PAS vrai en mode ASSISTANCE : là, l'opérateur agit réellement pour le compte d'un
   * utilisateur, donc les écritures doivent passer. Pour AFFICHER un bandeau, utiliser `enApercu`,
   * jamais ce drapeau — sinon l'avertissement disparaîtrait précisément quand on écrit.
   */
  apercuActif: boolean;
  /**
   * MODE ASSISTANCE : l'opérateur (admin / Super Admin) agit EN LIEU ET PLACE de l'utilisateur
   * incarné, avec ses droits. Nul en fonctionnement normal. Toute écriture est journalisée au nom
   * de l'opérateur (cf. contexte d'audit) et filtrée par la liste noire (assistance-interdits).
   */
  assistance: { operateurEmail: string; cibleNom: string; cibleEmail: string } | null;
  /** Aperçu de rôle OU assistance — SIGNALÉTIQUE uniquement (bandeau permanent). */
  enApercu: boolean;
  /** Fin de la période d'essai (null = pas d'essai). Pendant l'essai, seul l'espace Emplois du
   *  temps est éditable ; le reste de la plateforme est en lecture seule. */
  essaiFinLe: Date | null;
}

/**
 * Relit l'utilisateur connecté depuis la base (jamais depuis le seul JWT), afin de refléter
 * immédiatement tout changement de rôle ou d'approbation. Renvoie null si non connecté.
 */
async function resoudreUtilisateurCourant(): Promise<UtilisateurCourant | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const inclusions = {
    roleActif: true,
    // Rattachements SECONDAIRES à d'autres établissements (groupes scolaires) : alimentent
    // portee.etablissementIds (même accès que l'établissement principal, cf. lib/rbac/scope).
    etablissementsSecondaires: { select: { etablissementId: true } },
    demandes: {
      where: { statut: "en_attente" as const },
      orderBy: { creeLe: "desc" as const },
      take: 1,
      include: { roleDemande: true },
    },
    // Nombre de demandes DÉJÀ approuvées : distingue un nouvel inscrit (jamais habilité) d'un
    // utilisateur déjà habilité qui dépose une nouvelle demande de changement de rôle.
    _count: { select: { demandes: { where: { statut: "approuvee" as const } } } },
  };

  let u = await prisma.utilisateur.findUnique({ where: { id }, include: inclusions });
  if (!u) return null;

  // Pouls de PRÉSENCE (« Utilisateurs connectés ») : dernierAccesLe rafraîchi au plus une
  // fois par minute, pour l'utilisateur RÉELLEMENT connecté (jamais la cible d'un aperçu ou
  // d'une assistance). Écriture BRUTE : hors extension d'audit — un battement par minute
  // n'est pas une « activité » et noierait le journal. Jamais bloquant pour la session.
  if (!u.dernierAccesLe || Date.now() - u.dernierAccesLe.getTime() > 60_000) {
    try {
      await prisma.$executeRaw`UPDATE "utilisateurs" SET "dernierAccesLe" = NOW() WHERE "id" = ${id}`;
    } catch {
      /* le pouls ne doit jamais faire échouer la résolution de session */
    }
  }

  const roleConnecte: RoleId = estRoleValide(u.roleActif.nomTechnique)
    ? u.roleActif.nomTechnique
    : ROLE_PAR_DEFAUT;

  // Mode « Voir comme » (§4.5 étendu) : l'admin système incarne un utilisateur précis et
  // voit le site avec SES données (identité, périmètre, rôle). Lecture seule garantie par
  // `apercuActif`, que toutes les actions d'écriture vérifient.
  let apercuUtilisateur = false;
  // OPÉRATEUR RÉEL, capturé AVANT toute substitution : `u` va être remplacé par la cible, donc
  // l'identité de l'administrateur serait définitivement perdue après la ligne `u = cible`.
  // C'est cette identité que la traçabilité doit porter (cf. definirContexteAudit plus bas).
  const operateur = { id: u.id, email: u.email, role: roleConnecte };
  const cibleId = await lireApercuUtilisateur(roleConnecte, u.id);
  if (cibleId && cibleId !== u.id) {
    const cible = await prisma.utilisateur.findUnique({ where: { id: cibleId }, include: inclusions });
    // Le PÉRIMÈTRE est rejoué à CHAQUE requête (jamais seulement à l'entrée dans le mode) : si les
    // droits de l'opérateur ou le rattachement de la cible changent, l'incarnation cesse aussitôt.
    const roleCible = cible && estRoleValide(cible.roleActif.nomTechnique) ? cible.roleActif.nomTechnique : null;
    if (
      cible &&
      roleCible &&
      peutIncarnerUtilisateur(
        // `false` : à ce point, l'opérateur n'a aucun aperçu actif — l'entrée dans le mode a déjà
        // refusé l'enchaînement (voirCommeUtilisateur teste `enApercu`), et `voirComme` supprime
        // le cookie d'aperçu de rôle. On revalide ici le PÉRIMÈTRE, pas l'état d'aperçu.
        { id: u.id, roleReel: roleConnecte, enApercu: false, portee: { pays: u.pays } },
        {
          id: cible.id,
          role: roleEffectifRBAC(roleCible),
          pays: cible.pays,
          etablissementId: cible.etablissementId,
          cafopId: cible.cafopId,
          apfcId: cible.apfcId,
        },
      )
    ) {
      u = cible;
      apercuUtilisateur = true;
    }
  }

  const roleReelTechnique: RoleId = estRoleValide(u.roleActif.nomTechnique)
    ? u.roleActif.nomTechnique
    : ROLE_PAR_DEFAUT;
  // Alias RBAC « directeur_etudes » → « chef_etablissement » (cf. roleEffectifRBAC) : POINT
  // UNIQUE de substitution des habilitations. `roleReel`/`roleActif` (consommés par toute la
  // couche RBAC : navigation, requireRole, gardes, mode Aperçu) portent le rôle EFFECTIF ;
  // le libellé AFFICHÉ reste réel, capturé ICI depuis le rôle technique AVANT substitution.
  const roleReel: RoleId = roleEffectifRBAC(roleReelTechnique);
  const libelleRoleReel = libelleRole(roleReelTechnique);

  // Mode Aperçu (§4.5) : un admin peut visualiser l'interface d'un autre rôle (lecture seule).
  const roleApercuTechnique = apercuUtilisateur ? null : await lireApercu(roleReel);
  // COMMUTATEUR DU MODE ASSISTANCE — le point unique qui ouvre l'écriture.
  //
  // `apercuActif` ne couvre plus QUE l'aperçu de rôle (interface fictive, lecture seule). En
  // assistance, il vaut donc `false` : les ~143 gardes « if (u.apercuActif) return refus »
  // s'ouvrent d'un coup, avec exactement les droits de la cible — « en lieu et place ».
  // Aucune de ces gardes n'est modifiée, ce qui évite 58 fichiers de retouches et autant
  // d'occasions d'en oublier une. Les garde-fous vivent ailleurs, à des points uniques eux aussi :
  // la liste noire (extension Prisma) et la traçabilité de l'opérateur.
  const apercuActif = roleApercuTechnique !== null;
  const roleActifTechnique: RoleId = roleApercuTechnique ?? roleReelTechnique;
  const roleActif: RoleId = roleEffectifRBAC(roleActifTechnique);
  const libelleRoleActif = libelleRole(roleActifTechnique);

  // SIGNALÉTIQUE : vraie dans les DEUX modes. Le bandeau permanent s'y branche, de sorte qu'il ne
  // peut pas disparaître par effet de bord le jour où l'on retouche le verrou d'écriture.
  const assistance = apercuUtilisateur
    ? {
        operateurEmail: operateur.email,
        cibleNom: [u.prenoms, u.nom].filter(Boolean).join(" ") || u.email,
        cibleEmail: u.email,
      }
    : null;
  const enApercu = apercuActif || assistance !== null;

  const demande = apercuActif ? undefined : u.demandes[0];
  const demandeEnAttente: DemandeEnAttente | null = demande
    ? {
        id: demande.id,
        roleDemande: estRoleValide(demande.roleDemande.nomTechnique)
          ? demande.roleDemande.nomTechnique
          : ROLE_PAR_DEFAUT,
        libelleRoleDemande: demande.roleDemande.libelle,
        structureDeclaree: demande.structureDeclaree,
        creeLe: demande.creeLe,
      }
    : null;

  const nomComplet = [u.prenoms, u.nom].filter(Boolean).join(" ") || u.email;

  // Contexte de TRAÇABILITÉ : posé UNE fois ici (point de passage de quasiment toute action
  // authentifiée) pour que l'extension Prisma attribue automatiquement à cet acteur toute
  // écriture ultérieure de la requête. Jamais bloquant.
  try {
    const h = await headers();
    definirContexteAudit({
      utilisateurId: u.id,
      acteurEmail: u.email,
      acteurRole: roleActif,
      etablissementId: u.etablissementId,
      ip: (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null,
      navigateur: (h.get("user-agent") ?? "").trim().slice(0, 300) || null,
      // MODE ASSISTANCE : en incarnation, les champs ci-dessus décrivent la CIBLE (l'objet `u` a
      // été remplacé). L'auteur véritable est l'opérateur — renseigné UNIQUEMENT dans ce cas, si
      // bien qu'un `operateurId` non nul dans le journal signe une action d'assistance.
      operateurId: apercuUtilisateur ? operateur.id : null,
      operateurEmail: apercuUtilisateur ? operateur.email : null,
      operateurRole: apercuUtilisateur ? operateur.role : null,
      assistance: apercuUtilisateur,
    });
  } catch {
    /* la traçabilité ne doit jamais empêcher la résolution de session */
  }

  return {
    id: u.id,
    email: u.email,
    nom: u.nom,
    prenoms: u.prenoms,
    nomComplet,
    telephone: u.telephone,
    photoUrl: u.photoUrl,
    langue: u.langue,
    statutCompte: u.statutCompte,
    roleActif,
    libelleRoleActif,
    portee: {
      utilisateurId: u.id,
      roleId: roleActif,
      etablissementId: u.etablissementId,
      // Principal + secondaires (groupes scolaires), dédoublonnés — même accès sur chacun.
      etablissementIds: [
        ...(u.etablissementId ? [u.etablissementId] : []),
        ...u.etablissementsSecondaires.map((a) => a.etablissementId),
      ].filter((id, i, tous) => tous.indexOf(id) === i),
      cafopId: u.cafopId,
      apfcId: u.apfcId,
      regionId: u.regionId,
      pays: u.pays,
      diocese: u.diocese,
    },
    demandeEnAttente,
    // Accès restreint UNIQUEMENT pour un nouvel inscrit pas encore habilité : une demande est en
    // attente ET l'utilisateur n'a aucun rôle accordé (rôle réel resté au défaut « eleve » ET aucune
    // demande déjà approuvée). Un utilisateur déjà habilité qui demande un changement de rôle garde
    // son accès complet — sinon il serait verrouillé à tort (cf. « Super Admin CAFOP » ci-dessus).
    accesRestreint: demandeEnAttente !== null && roleReel === ROLE_PAR_DEFAUT && u._count.demandes === 0,
    roleReel,
    libelleRoleReel,
    apercuActif,
    assistance,
    enApercu,
    essaiFinLe: u.essaiFinLe,
  };
}

/**
 * Utilisateur courant, MÉMOÏSÉ PAR REQUÊTE (React cache). Le layout, le centre de notifications
 * et la garde de page d'une même requête HTTP ne relisent plus l'utilisateur en base 3 fois :
 * une seule relecture par requête (tout changement de rôle/approbation reste reflété au prochain
 * chargement). Réduit fortement la charge base de données à l'échelle (cf. audit de scalabilité).
 */
export const getUtilisateurCourant = cache(resoudreUtilisateurCourant);

/**
 * Exige une session ; redirige vers /connexion sinon — en CONSERVANT la page demandée
 * (en-tête x-pathname posé par le proxy, validé anti open-redirect) : après reconnexion,
 * l'utilisateur revient directement dessus. Couvre la session expirée (favori, cookie
 * périmé), en complément du veilleur d'inactivité qui transmet lui-même sa page.
 */
export async function requireUtilisateur(): Promise<UtilisateurCourant> {
  const utilisateur = await getUtilisateurCourant();
  if (!utilisateur) {
    const chemin = cheminRetourSur((await headers()).get("x-pathname"));
    redirect(avecRetour("/connexion", chemin));
  }
  return utilisateur;
}

/**
 * Exige un accès COMPLET : redirige les utilisateurs en attente d'approbation vers
 * « Mon Identification » (accès restreint, cahier §6.3). À appeler en tête de toute page
 * /app autre que Mon Identification / Mon Profil.
 */
export async function requireAccesComplet(): Promise<UtilisateurCourant> {
  const utilisateur = await requireUtilisateur();
  if (utilisateur.accesRestreint) redirect("/app/mon-identification");
  return utilisateur;
}

/**
 * Exige un rôle précis ; redirige vers le tableau de bord sinon.
 *
 * La liste `roles` est le socle STATIQUE de la page. La matrice des droits dynamique
 * (« Niveaux d'accès ») peut ACCORDER l'accès à un rôle hors socle : si le module courant
 * (résolu via l'en-tête x-pathname posé par le proxy) a une surcharge accordée pour le
 * rôle de l'utilisateur, l'accès passe. Les refus dynamiques sont appliqués par la garde
 * centrale du layout /app.
 */
export async function requireRole(roles: RoleId[]): Promise<UtilisateurCourant> {
  const utilisateur = await requireAccesComplet();
  if (roles.includes(utilisateur.roleActif)) return utilisateur;

  try {
    const chemin = (await headers()).get("x-pathname");
    const item = chemin ? resoudreItemParChemin(chemin) : null;
    if (item && !accesParDefaut(item, utilisateur.roleActif)) {
      const surcharges = await chargerSurcharges();
      if (accesEffectif(item, utilisateur.roleActif, surcharges)) return utilisateur;
    }
  } catch (e) {
    console.error("[requireRole] résolution dynamique impossible :", e);
  }

  redirect("/app");
}
