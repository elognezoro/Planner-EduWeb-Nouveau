"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { estRoleValide } from "@/lib/rbac";
import { creerNotification } from "@/lib/notifications/creer";

export interface EtatHabilitation {
  ok: boolean;
  message?: string;
}

const ADMINS = ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"];

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
  if (!ADMINS.includes(admin.roleReel)) return { ok: false, message: "Action non autorisée." };

  const utilisateurId = String(formData.get("utilisateurId") ?? "");
  const nouveauRole = String(formData.get("role") ?? "");
  if (!utilisateurId || !estRoleValide(nouveauRole)) {
    return { ok: false, message: "Données invalides." };
  }
  if (utilisateurId === admin.id) {
    return { ok: false, message: "Vous ne pouvez pas modifier votre propre rôle ici." };
  }

  try {
    const cible = await prisma.utilisateur.findUnique({ where: { id: utilisateurId } });
    if (!cible) return { ok: false, message: "Utilisateur introuvable." };

    // Contrôle de périmètre pour les admins spécialisés.
    if (
      (admin.roleReel === "etablissements_admin" &&
        cible.etablissementId !== admin.portee.etablissementId) ||
      (admin.roleReel === "cafop_admin" && cible.cafopId !== admin.portee.cafopId) ||
      (admin.roleReel === "apfc_admin" && cible.apfcId !== admin.portee.apfcId)
    ) {
      return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };
    }

    const role = await prisma.role.findUnique({ where: { nomTechnique: nouveauRole } });
    if (!role) return { ok: false, message: "Rôle introuvable (le seed a-t-il été exécuté ?)." };

    // Attribution = ACTIVATION IMMÉDIATE : on pose le rôle actif ET on solde toute demande de
    // rôle en attente (sinon le compte resterait affiché « en attente / accès limité »).
    // La session étant relue depuis la base à chaque requête, le rôle prend effet au prochain écran.
    await prisma.$transaction([
      prisma.utilisateur.update({ where: { id: utilisateurId }, data: { roleActifId: role.id } }),
      prisma.demandeRole.updateMany({
        where: { utilisateurId, statut: "en_attente" },
        data: { statut: "approuvee", traiteLe: new Date(), traiteParId: admin.id },
      }),
    ]);

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
  } catch (e) {
    console.error("[habilitations] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }

  return { ok: true, message: "Rôle mis à jour." };
}
