"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

/**
 * Enregistre la liste des FORMATEURS DÉSIGNÉS (e-mails) — seuls accès, avec l'admin
 * système, au manuel du formateur (document Word de formation générale, corrigés inclus).
 * Réservé à l'admin système.
 */
export async function enregistrerFormateurs(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur." };

  const brut = String(formData.get("emails") ?? "");
  const emails = [...new Set(
    brut.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")),
  )];

  try {
    await prisma.configuration.upsert({
      where: { id: "global" },
      update: { emailsFormateurs: emails.join("\n") || null },
      create: { id: "global", emailsFormateurs: emails.join("\n") || null },
    });
    revalidatePath("/app/aide-formation/guides");
    revalidatePath("/app/aide-formation/manuel");
  } catch (e) {
    console.error("[manuel] formateurs :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return {
    ok: true,
    message: emails.length > 0
      ? `${emails.length} formateur(s) désigné(s) — ils voient désormais le manuel du formateur.`
      : "Liste vidée — seul l'admin système accède au manuel du formateur.",
  };
}
