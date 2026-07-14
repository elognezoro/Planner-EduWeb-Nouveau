"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { estRoleValide, tousLesItems } from "@/lib/rbac";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import {
  accesParDefaut,
  ITEMS_VERROUILLES,
  ROLE_VERROUILLE,
} from "@/lib/rbac/permissions-dynamiques";

export interface EtatMatrice {
  ok: boolean;
  message?: string;
}

async function exigerAdmin() {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || u.roleReel !== "admin") return null;
  if (refusEssaiPour(u)) return null;
  return u;
}

async function journaliser(adminId: string, adminEmail: string, action: string, details: object) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: adminId, acteurEmail: adminEmail, action, cible: "PermissionRole", details },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

function rafraichir() {
  revalidatePath("/app/systeme/niveaux-acces");
  // La navigation et la garde centrale dépendent de la matrice : tout /app est concerné.
  revalidatePath("/app", "layout");
}

/**
 * Bascule une permission (item × rôle). La modification est appliquée immédiatement
 * à tous les utilisateurs du rôle. Si la nouvelle valeur rejoint le défaut de la carte
 * de navigation, la surcharge est supprimée (la table ne garde que les écarts).
 */
export async function basculerPermission(itemId: string, role: string): Promise<EtatMatrice> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur système (hors aperçu)." };

  if (!estRoleValide(role)) return { ok: false, message: "Rôle invalide." };
  const item = tousLesItems().find((i) => i.id === itemId);
  if (!item) return { ok: false, message: "Module inconnu." };
  if (ITEMS_VERROUILLES.has(itemId)) return { ok: false, message: "Ce module vital ne peut pas être restreint." };
  if (role === ROLE_VERROUILLE) return { ok: false, message: "Les droits de l'administrateur système ne sont pas modifiables." };

  try {
    const defaut = accesParDefaut(item, role);
    const existante = await prisma.permissionRole.findUnique({
      where: { itemId_role: { itemId, role } },
      select: { accorde: true },
    });
    const actuel = existante?.accorde ?? defaut;
    const nouveau = !actuel;

    if (nouveau === defaut) {
      await prisma.permissionRole.deleteMany({ where: { itemId, role } });
    } else {
      await prisma.permissionRole.upsert({
        where: { itemId_role: { itemId, role } },
        update: { accorde: nouveau },
        create: { itemId, role, accorde: nouveau },
      });
    }

    await journaliser(admin.id, admin.email, "permission.basculée", {
      module: item.libelle,
      itemId,
      role,
      accorde: nouveau,
    });
    rafraichir();
    return { ok: true, message: nouveau ? "Permission accordée." : "Permission retirée." };
  } catch (e) {
    console.error("[permissions] bascule :", e);
    return { ok: false, message: "Erreur technique lors de l'enregistrement." };
  }
}

/** Supprime toutes les surcharges : retour à la matrice par défaut. */
export async function reinitialiserPermissions(): Promise<EtatMatrice> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Action réservée à l'administrateur système (hors aperçu)." };

  try {
    const r = await prisma.permissionRole.deleteMany({});
    await journaliser(admin.id, admin.email, "permission.reinitialisation", { surchargesSupprimees: r.count });
    rafraichir();
    return { ok: true, message: `Matrice réinitialisée (${r.count} surcharge(s) supprimée(s)).` };
  } catch (e) {
    console.error("[permissions] réinitialisation :", e);
    return { ok: false, message: "Erreur technique lors de la réinitialisation." };
  }
}
