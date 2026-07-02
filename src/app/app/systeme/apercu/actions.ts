"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { COOKIE_APERCU, COOKIE_APERCU_UTILISATEUR } from "@/lib/auth/apercu";
import { estRoleValide, peutUtiliserApercu, rolesConsultablesEnApercu } from "@/lib/rbac";

export async function activerApercu(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u) return;
  // Autorisation fondée sur le rôle RÉEL (en aperçu, roleReel reste celui de l'admin).
  if (!peutUtiliserApercu(u.roleReel)) return;

  const role = String(formData.get("role") ?? "");
  if (!estRoleValide(role)) return;
  if (!rolesConsultablesEnApercu(u.roleReel).includes(role)) return;

  const store = await cookies();
  store.set(COOKIE_APERCU, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/app");
}

/**
 * « Voir comme » : l'administrateur système incarne un utilisateur précis et navigue avec
 * SES données (identité, rôle, périmètre). Lecture seule — aucune écriture possible.
 */
export async function voirCommeUtilisateur(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || u.roleReel !== "admin") return;

  const utilisateurId = String(formData.get("utilisateurId") ?? "");
  if (!utilisateurId || utilisateurId === u.id) return;

  const cible = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    include: { roleActif: true },
  });
  if (!cible || cible.roleActif.nomTechnique === "admin") return; // jamais un autre admin

  try {
    await prisma.journalActivite.create({
      data: {
        utilisateurId: u.id,
        acteurEmail: u.email,
        action: "apercu.voir_comme",
        cible: `Utilisateur:${utilisateurId}`,
        details: { cibleEmail: cible.email },
      },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }

  const store = await cookies();
  store.delete(COOKIE_APERCU);
  store.set(COOKIE_APERCU_UTILISATEUR, utilisateurId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  redirect("/app");
}

export async function quitterApercu() {
  const store = await cookies();
  store.delete(COOKIE_APERCU);
  store.delete(COOKIE_APERCU_UTILISATEUR);
  redirect("/app");
}
