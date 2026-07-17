"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { estRoleValide, estHabilitateur, peutAttribuerRole, peutModifierRoleActuel, utilisateurDansPortee, ROLE_PAR_DEFAUT } from "@/lib/rbac";
import { creerNotification } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { solderDemandesEnAttente } from "@/lib/demandes/solder";

export interface EtatHabilitation {
  ok: boolean;
  message?: string;
}

/**
 * Change le rôle actif d'un utilisateur (cahier §5.2.4). Filtré par périmètre :
 * un admin spécialisé ne peut agir que sur les comptes de son périmètre.
 * Le rattachement au périmètre réel sera affiné en Phase 2 (entités établissement/structure).
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

    // Attribution = ACTIVATION IMMÉDIATE. La session étant relue depuis la base à chaque requête,
    // le rôle prend effet au prochain écran.
    await prisma.$transaction(async (tx) => {
      // Pose le rôle ET RÉINITIALISE le périmètre d'entité : évite qu'un rattachement obsolète
      // (établissement / CAFOP / APFC / région d'un AUTRE pays) survive et rouvre un accès hors
      // périmètre. Le rattachement détaillé se règle séparément (Phase 2). Le `pays` du compte
      // n'est pas touché ici (identité pays ; non auto-éditable pour les rôles à périmètre pays).
      await tx.utilisateur.update({
        where: { id: utilisateurId },
        data: { roleActifId: role.id, etablissementId: null, cafopId: null, apfcId: null, regionId: null },
      });
      // Synchronisation Approbations ↔ Habilitations : solde les demandes en attente que cet
      // habilitateur est autorisé à accorder (logique centralisée — cf. lib/demandes/solder).
      await solderDemandesEnAttente(tx, { utilisateurId, acteurId: admin.id, acteurRole: admin.roleReel });
    });

    await creerNotification({
      destinataireId: utilisateurId,
      type: "role",
      titre: "Rôle attribué",
      message: `Un administrateur vous a attribué le rôle « ${role.libelle} ». Votre accès est mis à jour.`,
      lien: "/app",
    }).catch((e) => console.error("[habilitations] notification :", e));

    try {
      await prisma.journalActivite.create({
        data: {
          utilisateurId: admin.id,
          acteurEmail: admin.email,
          action: "habilitation.role_modifie",
          cible: `Utilisateur:${utilisateurId}`,
          details: { nouveauRole, cibleEmail: cible.email },
        },
      });
    } catch (e) {
      console.error("[journal] non écrit :", e);
    }

    revalidatePath("/app/systeme/habilitations");
    // Les demandes soldées disparaissent immédiatement de la file des Approbations.
    revalidatePath("/app/systeme/approbations");
    revalidatePath("/app/systeme/comptes");
  } catch (e) {
    console.error("[habilitations] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }

  return { ok: true, message: "Rôle mis à jour." };
}
