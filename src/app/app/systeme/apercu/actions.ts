"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import {
  ASSISTANCE_DUREE_MS,
  COOKIE_APERCU,
  COOKIE_APERCU_UTILISATEUR,
  creerJetonAssistance,
} from "@/lib/auth/apercu";
import {
  estRoleValide,
  peutIncarnerUtilisateur,
  peutUtiliserApercu,
  roleEffectifRBAC,
  rolesConsultablesEnApercu,
} from "@/lib/rbac";

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
 * « Voir comme » (mode ASSISTANCE) : l'administrateur système ou un Super Admin incarne un
 * utilisateur précis et navigue avec SES données (identité, rôle, périmètre).
 *
 * Le droit d'incarner est décidé par `peutIncarnerUtilisateur` (couche RBAC, refus par défaut :
 * cibles protégées, pays, hiérarchie, famille de structure) — la MÊME fonction est rejouée à
 * chaque requête dans getUtilisateurCourant, donc un droit perdu interrompt l'incarnation.
 */
export async function voirCommeUtilisateur(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return;

  const utilisateurId = String(formData.get("utilisateurId") ?? "");
  if (!utilisateurId || utilisateurId === u.id) return;

  const cible = await prisma.utilisateur.findUnique({
    where: { id: utilisateurId },
    include: { roleActif: true },
  });
  if (!cible) return;
  const roleCible = estRoleValide(cible.roleActif.nomTechnique) ? cible.roleActif.nomTechnique : null;
  if (
    !roleCible ||
    !peutIncarnerUtilisateur(
      { id: u.id, roleReel: u.roleReel, apercuActif: u.apercuActif, portee: { pays: u.portee.pays } },
      {
        id: cible.id,
        role: roleEffectifRBAC(roleCible),
        pays: cible.pays,
        etablissementId: cible.etablissementId,
        cafopId: cible.cafopId,
        apfcId: cible.apfcId,
      },
    )
  ) {
    return;
  }

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
  // Jeton SIGNÉ liant la cible à SON opérateur, avec échéance : un cookie orphelin (déconnexion,
  // autre compte sur le même navigateur) ou périmé devient inerte. Le maxAge du cookie suit
  // exactement la durée du jeton, pour que les deux expirent ensemble.
  store.set(COOKIE_APERCU_UTILISATEUR, creerJetonAssistance(utilisateurId, u.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ASSISTANCE_DUREE_MS / 1000),
  });
  redirect("/app");
}

export async function quitterApercu() {
  const store = await cookies();
  store.delete(COOKIE_APERCU);
  store.delete(COOKIE_APERCU_UTILISATEUR);
  redirect("/app");
}
