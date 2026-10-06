"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { estRoleValide, estHabilitateur, peutAttribuerRole, peutModifierRoleActuel, utilisateurDansPortee, ROLES, ROLE_PAR_DEFAUT } from "@/lib/rbac";
import { creerNotification } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { solderDemandesEnAttente } from "@/lib/demandes/solder";
import { colonnesPerimetre, resoudreRattachementDeclare } from "@/lib/demandes/perimetre-declare";
import {
  journaliserRattachementInterEtablissement,
  requetesPurgeTransfert,
} from "@/lib/etablissements/rattachement-inter-etablissements";

export interface EtatHabilitation {
  ok: boolean;
  message?: string;
}

async function journaliser(admin: UtilisateurCourant, action: string, utilisateurId: string, details: Prisma.InputJsonValue) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: admin.id, acteurEmail: admin.email, action, cible: `Utilisateur:${utilisateurId}`, details },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

/**
 * Change le rôle actif d'un utilisateur (cahier §5.2.4). Filtré par périmètre :
 * un admin spécialisé ne peut agir que sur les comptes de son périmètre.
 * Rattachement : la structure DÉCLARÉE par le compte dans sa demande de rôle en attente
 * (établissement / région / CAFOP / APFC), si elle est dans le périmètre de l'admin.
 */
export async function changerRole(
  _prev: EtatHabilitation,
  formData: FormData,
): Promise<EtatHabilitation> {
  const admin = await getUtilisateurCourant();
  if (!admin) return { ok: false, message: "Session expirée." };
  if (admin.apercuActif) return { ok: false, message: "Mode aperçu : lecture seule." };
  const rEssai = refusEssaiPour(admin);
  if (rEssai) return { ok: false, message: rEssai };
  if (!estHabilitateur(admin.roleReel)) return { ok: false, message: "Action non autorisée." };

  const utilisateurId = String(formData.get("utilisateurId") ?? "");
  const nouveauRole = String(formData.get("role") ?? "");
  if (!utilisateurId || !estRoleValide(nouveauRole)) {
    return { ok: false, message: "Données invalides." };
  }
  if (utilisateurId === admin.id) {
    return { ok: false, message: "Vous ne pouvez pas modifier votre propre rôle ici." };
  }

  // Hiérarchie : on ne peut attribuer qu'un rôle STRICTEMENT inférieur au sien (l'admin système excepté).
  if (!peutAttribuerRole(admin.roleReel, nouveauRole)) {
    return { ok: false, message: "Vous ne pouvez attribuer qu'un rôle de niveau inférieur au vôtre." };
  }

  let complement = "";
  try {
    const cible = await prisma.utilisateur.findUnique({ where: { id: utilisateurId }, include: { roleActif: true } });
    if (!cible) return { ok: false, message: "Utilisateur introuvable." };

    // Périmètre : la cible doit être dans le périmètre de l'admin (refusé par défaut ; gère
    // global / pays / établissement / CAFOP / APFC).
    if (!utilisateurDansPortee(admin.portee, cible)) {
      return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };
    }

    // On ne peut pas modifier un compte de rang égal ou supérieur au sien (hors admin système).
    const roleActuel = estRoleValide(cible.roleActif.nomTechnique) ? cible.roleActif.nomTechnique : ROLE_PAR_DEFAUT;
    if (!peutModifierRoleActuel(admin.roleReel, roleActuel)) {
      return { ok: false, message: "Vous ne pouvez pas modifier un compte de niveau égal ou supérieur au vôtre." };
    }

    const role = await prisma.role.findUnique({ where: { nomTechnique: nouveauRole } });
    if (!role) return { ok: false, message: "Rôle introuvable (le seed a-t-il été exécuté ?)." };

    // Rattachement : la structure DÉCLARÉE par le compte (demande en attente) — seulement si elle
    // existe, est dans le périmètre de l'admin et respecte le cloisonnement inter-établissements
    // (cf. lib/demandes/perimetre-declare). Résolu AVANT de solder les demandes qui la portent.
    const rattachement = await resoudreRattachementDeclare(prisma, {
      cible,
      roleTech: nouveauRole,
      acteur: { roleReel: admin.roleReel, portee: admin.portee },
    });
    const applique = rattachement.statut === "applique" ? rattachement : null;

    // Attribution = ACTIVATION IMMÉDIATE. La session étant relue depuis la base à chaque requête,
    // le rôle prend effet au prochain écran.
    await prisma.$transaction(async (tx) => {
      // Pose le rôle ET RÉINITIALISE le périmètre d'entité, sauf le rattachement déclaré validé
      // ci-dessus : aucun rattachement obsolète (établissement / CAFOP / APFC / région d'un AUTRE
      // pays) ne survit pour rouvrir un accès hors périmètre. Le `pays` du compte n'est pas
      // touché ici (identité pays ; non auto-éditable pour les rôles à périmètre pays).
      await tx.utilisateur.update({
        where: { id: utilisateurId },
        data: { roleActifId: role.id, ...colonnesPerimetre(ROLES[nouveauRole].portee, applique?.structure.id ?? null) },
      });
      // Transfert inter-établissements (autorité chef vérifiée) : coupe les liens résiduels.
      if (applique?.transfertDepuis) {
        const purge = requetesPurgeTransfert(tx, {
          utilisateurId,
          origineId: applique.transfertDepuis,
          accueilId: applique.structure.id,
        });
        for (const requete of purge) await requete;
      }
      // Synchronisation Approbations ↔ Habilitations : solde les demandes en attente que cet
      // habilitateur est autorisé à accorder (logique centralisée — cf. lib/demandes/solder).
      await solderDemandesEnAttente(tx, { utilisateurId, acteurId: admin.id, acteurRole: admin.roleReel });
    });

    await creerNotification({
      destinataireId: utilisateurId,
      type: "role",
      titre: "Rôle attribué",
      message: applique
        ? `Un administrateur vous a attribué le rôle « ${role.libelle} » et vous a rattaché à « ${applique.structure.nom} ». Votre accès est mis à jour.`
        : `Un administrateur vous a attribué le rôle « ${role.libelle} ». Votre accès est mis à jour.`,
      lien: "/app",
    }).catch((e) => console.error("[habilitations] notification :", e));

    await journaliser(admin, "habilitation.role_modifie", utilisateurId, { nouveauRole, cibleEmail: cible.email });
    if (rattachement.statut !== "aucun") {
      await journaliser(admin, "habilitation.rattachement_declare", utilisateurId, {
        statut: rattachement.statut,
        portee: rattachement.portee,
        demandeId: rattachement.demandeId,
        cibleEmail: cible.email,
        ...(applique
          ? { perimetreId: applique.structure.id, structure: applique.structure.nom, transfertDepuis: applique.transfertDepuis }
          : {}),
        ...(rattachement.statut === "ignore" ? { perimetreId: rattachement.perimetreId, motif: rattachement.motif } : {}),
      });
    }
    if (applique?.transfertDepuis) {
      // Décision d'accueil inter-établissements : tracée au journal de sécurité.
      await journaliserRattachementInterEtablissement(admin, {
        utilisateurId,
        email: cible.email,
        de: applique.transfertDepuis,
        vers: applique.structure.id,
      });
    }

    complement = applique
      ? ` Rattaché à « ${applique.structure.nom} » (choix déclaré du demandeur${applique.transfertDepuis ? ", transfert depuis un autre établissement" : ""}).`
      : rattachement.statut === "ignore"
        ? ` Rattachement déclaré non appliqué : ${rattachement.motif}.`
        : "";

    revalidatePath("/app/systeme/habilitations");
    // Les demandes soldées disparaissent immédiatement de la file des Approbations.
    revalidatePath("/app/systeme/approbations");
    revalidatePath("/app/systeme/comptes");
  } catch (e) {
    console.error("[habilitations] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }

  return { ok: true, message: `Rôle mis à jour.${complement}` };
}
