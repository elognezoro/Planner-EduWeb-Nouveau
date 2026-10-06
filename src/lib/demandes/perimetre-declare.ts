import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ROLES, structureDansPortee, type PorteeUtilisateur, type RoleId, type TypePortee } from "@/lib/rbac";
import { ROLES_AUTORITE_RATTACHEMENT, ROLES_DIRECTION } from "@/lib/etablissements/rattachement-inter-etablissements";

/**
 * PÉRIMÈTRE DÉCLARÉ par le demandeur d'un rôle (cascade d'inscription → DemandeRole.*Declare*Id)
 * et colonnes de périmètre d'un compte — logique PARTAGÉE par toutes les voies qui attribuent un
 * rôle : Approbations (approbation d'une demande), Habilitations (attribution directe), Comptes.
 */

type Db = Prisma.TransactionClient | PrismaClient;

/** Portées dont le périmètre est une STRUCTURE identifiée (colonne dédiée sur le compte). */
export type PorteeStructure = "etablissement" | "region" | "cafop" | "apfc";

export function estPorteeStructure(portee: TypePortee): portee is PorteeStructure {
  return portee === "etablissement" || portee === "region" || portee === "cafop" || portee === "apfc";
}

/** Champs de périmètre déclarés d'une demande de rôle. */
export interface PerimetreDeclare {
  etablissementDeclareId: string | null;
  regionDeclareeId: string | null;
  cafopDeclareId: string | null;
  apfcDeclareId: string | null;
}

/** Identifiant DÉCLARÉ (choix réel du demandeur, autoritaire) correspondant à une portée. */
export function idDeclare(demande: PerimetreDeclare, portee: PorteeStructure): string | null {
  switch (portee) {
    case "etablissement":
      return demande.etablissementDeclareId;
    case "region":
      return demande.regionDeclareeId;
    case "cafop":
      return demande.cafopDeclareId;
    case "apfc":
      return demande.apfcDeclareId;
  }
}

/** Structure de rattachement + sa localisation (pour le contrôle de périmètre). */
export interface StructureRattachement {
  id: string;
  nom: string;
  pays: string | null;
  regionId: string | null;
  diocese: string | null;
}

/**
 * Charge une structure par portée + identifiant — null si elle n'existe pas (jamais de
 * rattachement fantôme). Une APFC porte son pays via sa région (orpheline → aucun pays).
 */
export async function chargerStructure(db: Db, portee: PorteeStructure, id: string): Promise<StructureRattachement | null> {
  switch (portee) {
    case "etablissement": {
      const e = await db.etablissement.findUnique({
        where: { id },
        select: { id: true, nom: true, pays: true, regionId: true, diocese: true },
      });
      return e;
    }
    case "region": {
      const r = await db.region.findUnique({ where: { id }, select: { id: true, nom: true, pays: true } });
      return r ? { ...r, regionId: r.id, diocese: null } : null;
    }
    case "cafop": {
      const c = await db.cafop.findUnique({ where: { id }, select: { id: true, nom: true, pays: true, regionId: true } });
      return c ? { ...c, diocese: null } : null;
    }
    case "apfc": {
      const a = await db.apfc.findUnique({
        where: { id },
        select: { id: true, nom: true, regionId: true, region: { select: { pays: true } } },
      });
      return a ? { id: a.id, nom: a.nom, pays: a.region?.pays ?? null, regionId: a.regionId, diocese: null } : null;
    }
  }
}

/**
 * Colonnes de périmètre d'un compte pour un rôle de portée donnée (§4.3) : TOUTES réinitialisées
 * (aucun rattachement obsolète ne survit — ex. structure d'un autre pays), sauf celle de la portée,
 * positionnée sur `perimetreId` (null = réinitialisée aussi).
 */
export function colonnesPerimetre(portee: TypePortee, perimetreId: string | null) {
  return {
    etablissementId: portee === "etablissement" ? perimetreId : null,
    regionId: portee === "region" ? perimetreId : null,
    cafopId: portee === "cafop" ? perimetreId : null,
    apfcId: portee === "apfc" ? perimetreId : null,
  };
}

/** Issue de la résolution du périmètre déclaré lors d'une attribution directe de rôle. */
export type RattachementDeclare =
  /** Rôle sans structure, ou aucune demande en attente ne déclare de structure de cette portée. */
  | { statut: "aucun" }
  | {
      statut: "applique";
      portee: PorteeStructure;
      demandeId: string;
      structure: StructureRattachement;
      /** Établissement d'origine quand le rattachement est un TRANSFERT inter-établissements. */
      transfertDepuis: string | null;
    }
  | { statut: "ignore"; portee: PorteeStructure; demandeId: string; perimetreId: string; motif: string };

/**
 * Attribution DIRECTE d'un rôle (Habilitations) : résout la structure DÉCLARÉE par le compte dans
 * sa demande de rôle EN ATTENTE (celle du rôle attribué en priorité, sinon la plus récente qui
 * déclare une structure de la même portée). Seul l'identifiant déclaré fait foi — aucun
 * rapprochement flou : sans écran pour valider la suggestion, un homonyme serait rattaché à tort.
 *
 * Le rattachement n'est retenu que si (refus par défaut) :
 * - la structure EXISTE ;
 * - elle est dans le PÉRIMÈTRE de l'acteur (structureDansPortee — jamais un autre pays, une
 *   autre structure que la sienne…) ;
 * - pour un établissement, la règle de CLOISONNEMENT des comptes est respectée : venir d'un AUTRE
 *   établissement (transfert) ou y recevoir un rôle de direction / d'autorité de rattachement
 *   exige l'autorité chef de l'établissement d'accueil (jamais l'ACE, ni un admin CAFOP/APFC).
 * Sinon : « ignore » avec le motif — l'appelant réinitialise alors le périmètre comme avant.
 */
export async function resoudreRattachementDeclare(
  db: Db,
  opts: {
    cible: { id: string; etablissementId: string | null };
    roleTech: RoleId;
    acteur: { roleReel: RoleId; portee: PorteeUtilisateur };
  },
): Promise<RattachementDeclare> {
  const portee = ROLES[opts.roleTech].portee;
  if (!estPorteeStructure(portee)) return { statut: "aucun" };

  const enAttente = await db.demandeRole.findMany({
    where: { utilisateurId: opts.cible.id, statut: "en_attente" },
    orderBy: { creeLe: "desc" },
    select: {
      id: true,
      etablissementDeclareId: true,
      regionDeclareeId: true,
      cafopDeclareId: true,
      apfcDeclareId: true,
      roleDemande: { select: { nomTechnique: true } },
    },
  });
  const declarantes = enAttente.filter((d) => idDeclare(d, portee));
  const demande = declarantes.find((d) => d.roleDemande.nomTechnique === opts.roleTech) ?? declarantes[0];
  if (!demande) return { statut: "aucun" };
  const perimetreId = idDeclare(demande, portee) as string;
  const ignore = (motif: string): RattachementDeclare => ({ statut: "ignore", portee, demandeId: demande.id, perimetreId, motif });

  const structure = await chargerStructure(db, portee, perimetreId);
  if (!structure) return ignore("la structure déclarée est introuvable");
  if (!structureDansPortee(opts.acteur.portee, portee, structure)) {
    return ignore(`« ${structure.nom} » est hors de votre périmètre`);
  }

  let transfertDepuis: string | null = null;
  if (portee === "etablissement") {
    const autoriteChef = ROLES_AUTORITE_RATTACHEMENT.has(opts.acteur.roleReel);
    if (!autoriteChef && (ROLES_DIRECTION.has(opts.roleTech) || ROLES_AUTORITE_RATTACHEMENT.has(opts.roleTech))) {
      return ignore(`rattacher un rôle de direction à « ${structure.nom} » est réservé au chef d'établissement (ou à l'admin de l'établissement)`);
    }
    if (opts.cible.etablissementId && opts.cible.etablissementId !== structure.id) {
      if (!autoriteChef) {
        return ignore(`le compte appartient à un autre établissement — seul le chef d'établissement (ou l'admin de l'établissement) d'accueil peut autoriser son rattachement à « ${structure.nom} »`);
      }
      transfertDepuis = opts.cible.etablissementId;
    }
  }

  return { statut: "applique", portee, demandeId: demande.id, structure, transfertDepuis };
}
