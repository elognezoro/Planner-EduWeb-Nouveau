import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./index";
import { lireApercu, lireApercuUtilisateur } from "./apercu";
import { prisma } from "@/lib/prisma";
import { estRoleValide, libelleRole, ROLE_PAR_DEFAUT, type RoleId } from "@/lib/rbac";
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
  /** Vrai si l'utilisateur visualise l'interface en tant qu'un autre rôle (lecture seule, §4.5). */
  apercuActif: boolean;
}

/**
 * Relit l'utilisateur connecté depuis la base (jamais depuis le seul JWT), afin de refléter
 * immédiatement tout changement de rôle ou d'approbation. Renvoie null si non connecté.
 */
export async function getUtilisateurCourant(): Promise<UtilisateurCourant | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const inclusions = {
    roleActif: true,
    demandes: {
      where: { statut: "en_attente" as const },
      orderBy: { creeLe: "desc" as const },
      take: 1,
      include: { roleDemande: true },
    },
  };

  let u = await prisma.utilisateur.findUnique({ where: { id }, include: inclusions });
  if (!u) return null;

  const roleConnecte: RoleId = estRoleValide(u.roleActif.nomTechnique)
    ? u.roleActif.nomTechnique
    : ROLE_PAR_DEFAUT;

  // Mode « Voir comme » (§4.5 étendu) : l'admin système incarne un utilisateur précis et
  // voit le site avec SES données (identité, périmètre, rôle). Lecture seule garantie par
  // `apercuActif`, que toutes les actions d'écriture vérifient.
  let apercuUtilisateur = false;
  const cibleId = await lireApercuUtilisateur(roleConnecte);
  if (cibleId && cibleId !== u.id) {
    const cible = await prisma.utilisateur.findUnique({ where: { id: cibleId }, include: inclusions });
    if (cible && cible.roleActif.nomTechnique !== "admin") {
      u = cible;
      apercuUtilisateur = true;
    }
  }

  const roleReel: RoleId = estRoleValide(u.roleActif.nomTechnique)
    ? u.roleActif.nomTechnique
    : ROLE_PAR_DEFAUT;

  // Mode Aperçu (§4.5) : un admin peut visualiser l'interface d'un autre rôle (lecture seule).
  const roleApercu = apercuUtilisateur ? null : await lireApercu(roleReel);
  const apercuActif = apercuUtilisateur || roleApercu !== null;
  const roleActif: RoleId = roleApercu ?? roleReel;

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
    libelleRoleActif: libelleRole(roleActif),
    portee: {
      utilisateurId: u.id,
      roleId: roleActif,
      etablissementId: u.etablissementId,
      cafopId: u.cafopId,
      apfcId: u.apfcId,
      regionId: u.regionId,
      pays: u.pays,
    },
    demandeEnAttente,
    accesRestreint: demandeEnAttente !== null,
    roleReel,
    libelleRoleReel: libelleRole(roleReel),
    apercuActif,
  };
}

/** Exige une session ; redirige vers /connexion sinon. */
export async function requireUtilisateur(): Promise<UtilisateurCourant> {
  const utilisateur = await getUtilisateurCourant();
  if (!utilisateur) redirect("/connexion");
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
