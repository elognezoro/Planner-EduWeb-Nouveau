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
  lireJetonAssistance,
} from "@/lib/auth/apercu";
import { creerNotification } from "@/lib/notifications/creer";
import { journaliserActivite } from "@/lib/audit/journal";
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

/**
 * BILAN DE FIN D'ASSISTANCE — l'utilisateur assisté est informé de ce qui a été fait sur son
 * compte, et par qui.
 *
 * Transparence voulue : elle protège autant l'opérateur (preuve de son intervention) que le
 * client (aucune modification silencieuse). Silencieux si la session n'a produit AUCUNE écriture,
 * pour ne pas inquiéter inutilement après une simple consultation.
 *
 * La source est le journal lui-même : `operateurId` non nul y signe une action d'assistance
 * (cf. étape 1/5). Le jeton — dont la signature reste vérifiée même périmé — fournit le couple
 * (opérateur, cible) et l'instant de début.
 */
async function notifierFinAssistance(jetonBrut: string): Promise<void> {
  try {
    const jeton = lireJetonAssistance(jetonBrut, { ignorerExpiration: true });
    if (!jeton) return;

    const ecritures = await prisma.journalActivite.findMany({
      where: {
        operateurId: jeton.operateurId,
        utilisateurId: jeton.cibleId,
        creeLe: { gte: new Date(jeton.debut) },
      },
      orderBy: { creeLe: "desc" },
      take: 50,
      select: { action: true, entite: true, operateurEmail: true, creeLe: true },
    });
    if (ecritures.length === 0) return; // consultation seule : rien à signaler

    const operateurEmail = ecritures[0].operateurEmail ?? "un administrateur";
    const quand = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(
      ecritures[ecritures.length - 1].creeLe,
    );
    // Résumé lisible : on cite les entités touchées, pas le détail technique de chaque écriture.
    const entites = [...new Set(ecritures.map((e) => e.entite).filter(Boolean))].slice(0, 6);
    const detail = entites.length > 0 ? ` Éléments concernés : ${entites.join(", ")}.` : "";
    const nb = ecritures.length;

    await creerNotification({
      destinataireId: jeton.cibleId,
      titre: "Assistance technique sur votre compte",
      message:
        `${nb} modification${nb > 1 ? "s ont" : " a"} été effectuée${nb > 1 ? "s" : ""} sur votre compte ` +
        `par ${operateurEmail} (assistance), à partir du ${quand}.${detail} ` +
        "Si cette intervention vous surprend, signalez-le à l'administration.",
      type: "info",
    });

    await journaliserActivite({
      action: "assistance.session_terminee",
      cible: `Utilisateur:${jeton.cibleId}`,
      details: { ecritures: nb, entites },
      utilisateurId: jeton.cibleId,
      operateurId: jeton.operateurId,
      operateurEmail: ecritures[0].operateurEmail,
      source: "securite",
    });
  } catch (e) {
    // Le bilan ne doit jamais empêcher la sortie du mode assistance.
    console.error("[assistance] bilan de fin non envoyé :", e);
  }
}

export async function quitterApercu() {
  const store = await cookies();
  // Lu AVANT suppression : c'est la seule trace du couple (opérateur, cible) et du début de session.
  const jetonBrut = store.get(COOKIE_APERCU_UTILISATEUR)?.value;
  store.delete(COOKIE_APERCU);
  store.delete(COOKIE_APERCU_UTILISATEUR);
  if (jetonBrut) await notifierFinAssistance(jetonBrut);
  redirect("/app");
}
