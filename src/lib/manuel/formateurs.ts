import "server-only";
import { prisma } from "@/lib/prisma";
import type { UtilisateurCourant } from "@/lib/auth/session";

/**
 * FORMATEURS DÉSIGNÉS — seuls accès, avec l'admin système, au document de formation
 * générale (manuel du formateur : guides + formations interactives avec corrigés).
 * La liste (e-mails) est gérée par l'admin depuis l'espace « Guides d'utilisateurs ».
 */

/** Liste normalisée (minuscules) des e-mails des formateurs désignés. */
export async function lireFormateursDesignes(): Promise<string[]> {
  try {
    const cfg = await prisma.configuration.findUnique({
      where: { id: "global" },
      select: { emailsFormateurs: true },
    });
    return (cfg?.emailsFormateurs ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
  } catch (e) {
    console.error("[manuel] lecture formateurs :", e);
    return [];
  }
}

/** L'utilisateur peut-il consulter/télécharger le manuel du formateur ? */
export async function estFormateurDesigne(u: UtilisateurCourant | null): Promise<boolean> {
  if (!u || u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  const formateurs = await lireFormateursDesignes();
  return formateurs.includes(u.email.toLowerCase());
}
