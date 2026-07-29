"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export interface EtatVersement {
  ok: boolean;
  message?: string;
}

/**
 * Marque une commission de parrainage comme VERSÉE (règlement hors plateforme : Mobile Money,
 * espèces…). Réservé à l'administrateur système, hors mode assistance (un acte financier engageant
 * ne se fait pas au nom d'autrui). `reference` = n° de transaction, pour la traçabilité.
 *
 * Ne verse QUE des commissions « acquise » : on ne peut ni re-verser une commission déjà réglée,
 * ni verser une commission convertie en crédit ou annulée.
 */
export async function marquerVersee(commissionId: string, reference: string): Promise<EtatVersement> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") {
    return { ok: false, message: "Action réservée à l'administrateur système." };
  }
  try {
    const maj = await prisma.commissionParrainage.updateMany({
      where: { id: commissionId, statut: "acquise" },
      data: { statut: "versee", regleLe: new Date(), regleParEmail: u.email, reference: reference.trim() || null },
    });
    if (maj.count === 0) {
      return { ok: false, message: "Commission introuvable ou déjà réglée." };
    }
    revalidatePath("/app/mon-parrainage");
  } catch (e) {
    console.error("[parrainage] versement :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Commission marquée comme versée." };
}
