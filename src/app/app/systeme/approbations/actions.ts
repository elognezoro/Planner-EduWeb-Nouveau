"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritDecisionRole, gabaritMessageApprobation } from "@/lib/email/templates";
import { creerNotification } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { finEssaiParDefaut } from "@/lib/premium/config-essai";

/** Adresse de l'administration recevant copie des échanges (et les réponses des demandeurs). */
const EMAIL_ADMIN = process.env.ADMIN_CONTACT_EMAIL ?? "elognezoro@gmail.com";
const MESSAGE_MAX = 4000;
import { estRoleValide, ROLES } from "@/lib/rbac";
import { rapprocherEtablissement } from "@/lib/etablissements/rapprochement";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** En V1, seul l'administrateur système traite les demandes (cahier §6.4). */
async function exigerAdmin() {
  const admin = await getUtilisateurCourant();
  if (!admin || admin.roleReel !== "admin") {
    throw new Error("Action réservée à l'administrateur système.");
  }
  if (admin.apercuActif) {
    throw new Error("Mode aperçu : action en lecture seule.");
  }
  const rEssai = refusEssaiPour(admin);
  if (rEssai) {
    throw new Error(rEssai);
  }
  return admin;
}

async function journaliser(
  acteurId: string,
  acteurEmail: string,
  action: string,
  cible: string,
  details: Prisma.InputJsonValue,
) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: acteurId, acteurEmail, action, cible, details },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

/** État renvoyé à l'interface pour donner un RETOUR VISIBLE à chaque approbation (succès ou blocage). */
export type EtatApprobation = { ok: boolean; message?: string } | null;

/** Libellé français du type de périmètre, pour les messages de blocage. */
const LABEL_PORTEE: Record<string, string> = {
  etablissement: "établissement",
  region: "région",
  cafop: "CAFOP",
  apfc: "APFC",
  diocese: "diocèse",
  pays: "pays",
};

/**
 * Approuve une demande de rôle. Signature `useActionState` : renvoie TOUJOURS un état
 * ({ ok, message }) — plus aucune sortie silencieuse, pour que l'interface RÉAGISSE à chaque
 * clic (le périmètre manquant/introuvable était auparavant un `return` muet : bouton figé,
 * aucune réaction — cf. rôles à portée établissement dont l'établissement n'est pas dans le
 * répertoire, ex. hors Côte d'Ivoire).
 */
export async function approuverDemande(_prev: EtatApprobation, formData: FormData): Promise<EtatApprobation> {
 try {
  const admin = await exigerAdmin();
  const demandeId = String(formData.get("demandeId") ?? "");
  if (!demandeId) return { ok: false, message: "Demande introuvable." };

  const demande = await prisma.demandeRole.findUnique({
    where: { id: demandeId },
    include: { roleDemande: true, utilisateur: true },
  });
  if (!demande || demande.statut !== "en_attente") return { ok: false, message: "Cette demande n'est plus en attente (déjà traitée ?)." };

  // À l'approbation, le rôle actif passe au rôle approuvé (cahier §6.2) ET on rattache
  // l'utilisateur au PÉRIMÈTRE réel choisi par l'admin, selon la nature du rôle (§4.3).
  const roleTech = demande.roleDemande.nomTechnique;
  const portee = estRoleValide(roleTech) ? ROLES[roleTech].portee : "personnel";
  const labelPortee = LABEL_PORTEE[portee] ?? "périmètre";
  let perimetreId = String(formData.get("perimetreId") ?? "").trim() || null;

  // Périmètre établissement non fourni explicitement : on le résout, en PRIORITÉ à partir de
  // l'établissement RÉELLEMENT choisi par le demandeur dans la cascade à l'inscription
  // (etablissementDeclareId, autoritaire) ; à défaut seulement, rapprochement flou du texte
  // libre vers l'établissement au nom le plus proche du pays (cahier §6.4). Sans cette priorité,
  // un compte pouvait être rattaché à un homonyme approximatif au lieu de son choix réel.
  let rapprochementAuto: string | null = null;
  if (!perimetreId && portee === "etablissement") {
    if (demande.etablissementDeclareId) {
      const declare = await prisma.etablissement.findUnique({
        where: { id: demande.etablissementDeclareId },
        select: { id: true },
      });
      if (declare) perimetreId = declare.id;
    }
    if (!perimetreId && demande.structureDeclaree) {
      const paysUtilisateur = demande.utilisateur.pays ?? PAYS_DEFAUT;
      const correspondance = await rapprocherEtablissement(demande.structureDeclaree, paysUtilisateur);
      if (correspondance) {
        perimetreId = correspondance.id;
        rapprochementAuto = `${correspondance.nom} (similarité ${Math.round(correspondance.score * 100)} %)`;
      }
    }
  }

  // Rôles à périmètre région / CAFOP / APFC / diocèse (SEDEC) : un périmètre est
  // OBLIGATOIRE (pas de repli). Validation SERVEUR (le champ caché du combobox
  // n'est pas validé nativement).
  if ((portee === "region" || portee === "cafop" || portee === "apfc" || portee === "diocese") && !perimetreId) {
    return { ok: false, message: `Sélectionnez le périmètre (${labelPortee}) avant d'approuver.` };
  }

  // Rôle à périmètre « établissement » : un établissement est OBLIGATOIRE et doit EXISTER
  // (parité avec affecterRoleEtPerimetre — jamais de rattachement fantôme, ni de compte doté
  // d'un rôle à portée établissement sans périmètre). Le champ de recherche caché n'est pas
  // validé nativement et le rapprochement peut ne rien trouver : c'est le serveur qui tranche.
  if (portee === "etablissement") {
    if (!perimetreId) {
      return { ok: false, message: "Sélectionnez l'établissement de rattachement avant d'approuver. S'il n'apparaît pas dans la recherche, créez-le d'abord dans « Établissements »." };
    }
    const existe = await prisma.etablissement.count({ where: { id: perimetreId } });
    if (existe === 0) return { ok: false, message: "L'établissement sélectionné est introuvable — reprenez la recherche." };
  }

  // Rôle à périmètre « pays » : un pays est OBLIGATOIRE (repli sur le pays du compte). Validation
  // côté serveur — ne pas se fier au seul attribut `required` du <select> (contournable).
  const paysScope = perimetreId ?? demande.utilisateur.pays;
  if (portee === "pays" && !paysScope) return { ok: false, message: "Aucun pays de rattachement — précisez le périmètre (pays) avant d'approuver." };

  // À la validation du rôle, l'utilisateur reçoit automatiquement une période d'essai liée à son
  // rôle, d'après le paramétrage par défaut de la plateforme (7 jours par défaut).
  const debutEssai = new Date();
  const finEssai = await finEssaiParDefaut(debutEssai);

  await prisma.$transaction([
    prisma.demandeRole.update({
      where: { id: demande.id },
      data: { statut: "approuvee", traiteLe: new Date(), traiteParId: admin.id },
    }),
    prisma.utilisateur.update({
      where: { id: demande.utilisateurId },
      data: {
        roleActifId: demande.roleDemandeId,
        // On (ré)initialise tous les périmètres puis on positionne celui qui correspond au rôle.
        etablissementId: portee === "etablissement" ? perimetreId : null,
        regionId: portee === "region" ? perimetreId : null,
        cafopId: portee === "cafop" ? perimetreId : null,
        apfcId: portee === "apfc" ? perimetreId : null,
        // Diocèse : positionné pour le rôle SEDEC (le périmètre EST le diocèse), réinitialisé sinon.
        diocese: portee === "diocese" ? perimetreId : null,
        // Rôle à périmètre « pays » : le pays choisi devient le périmètre (repli : pays du compte).
        ...(portee === "pays" ? { pays: paysScope } : {}),
        // Période d'essai automatique (durée par défaut de la plateforme).
        essaiDebutLe: debutEssai,
        essaiFinLe: finEssai,
        // Nouvel essai → l'e-mail de fin d'essai pourra être (r)envoyé à la nouvelle échéance.
        essaiFinNotifieLe: null,
      },
    }),
  ]);

  await journaliser(admin.id, admin.email, "demande_role.approuvee", `DemandeRole:${demande.id}`, {
    utilisateur: demande.utilisateur.email,
    roleApprouve: roleTech,
    perimetreId,
    ...(rapprochementAuto ? { rapprochementAuto } : {}),
  });

  await creerNotification({
    destinataireId: demande.utilisateurId,
    type: "role",
    titre: "Demande de rôle approuvée",
    message: `Votre rôle « ${demande.roleDemande.libelle} » a été approuvé. Votre accès complet est désormais ouvert.`,
    lien: "/app",
  });

  // Lien direct vers le guide d'utilisateur du rôle approuvé + sa formation interactive
  // (cours slugs « guide-<role> » / « formation-<role> »), pour accompagner la prise en main.
  const { subject, html } = gabaritDecisionRole(
    true,
    demande.roleDemande.libelle,
    `${baseUrl()}/connexion`,
    demande.utilisateur.prenoms,
    {
      guideUrl: `${baseUrl()}/app/aide-formation/cours/guide-${roleTech}`,
      formationUrl: `${baseUrl()}/app/aide-formation/cours/formation-${roleTech}`,
    },
  );
  try {
    await envoyerEmail({ to: demande.utilisateur.email, subject, html });
  } catch (e) {
    console.error("[email decision] échec :", e);
  }

  revalidatePath("/app/systeme/approbations");
  return { ok: true, message: `Rôle « ${demande.roleDemande.libelle} » approuvé.` };
 } catch (e) {
  // Toute erreur inattendue (auth, base, etc.) → retour VISIBLE, jamais de bouton figé sans réaction.
  console.error("[approuverDemande] échec :", e);
  return { ok: false, message: e instanceof Error ? e.message : "Une erreur est survenue lors de l'approbation." };
 }
}

export async function refuserDemande(formData: FormData) {
  const admin = await exigerAdmin();
  const demandeId = String(formData.get("demandeId") ?? "");
  if (!demandeId) return;

  const demande = await prisma.demandeRole.findUnique({
    where: { id: demandeId },
    include: { roleDemande: true, utilisateur: true },
  });
  if (!demande || demande.statut !== "en_attente") return;

  // Le rôle actif reste `eleve` (cahier §6.2). On historise et on notifie.
  await prisma.demandeRole.update({
    where: { id: demande.id },
    data: { statut: "refusee", traiteLe: new Date(), traiteParId: admin.id },
  });

  await journaliser(admin.id, admin.email, "demande_role.refusee", `DemandeRole:${demande.id}`, {
    utilisateur: demande.utilisateur.email,
    roleRefuse: demande.roleDemande.nomTechnique,
  });

  await creerNotification({
    destinataireId: demande.utilisateurId,
    type: "alerte",
    titre: "Demande de rôle refusée",
    message: `Votre demande pour le rôle « ${demande.roleDemande.libelle} » n'a pas été retenue. Vous pouvez soumettre une nouvelle demande depuis « Mon Identification ».`,
    lien: "/app/mon-identification",
  });

  const { subject, html } = gabaritDecisionRole(
    false,
    demande.roleDemande.libelle,
    `${baseUrl()}/connexion`,
    demande.utilisateur.prenoms,
  );
  try {
    await envoyerEmail({ to: demande.utilisateur.email, subject, html });
  } catch (e) {
    console.error("[email decision] échec :", e);
  }

  revalidatePath("/app/systeme/approbations");
}

// ── Échanges avec le demandeur (avant approbation) ────────────────────────────

type DemandeAvecUtilisateur = {
  id: string;
  utilisateurId: string;
  roleDemande: { libelle: string };
  utilisateur: { email: string; prenoms: string | null };
};

/** Enregistre un message de l'administration + e-mail au demandeur (copie à l'administration). */
async function ecrireMessageAdmin(adminId: string, demande: DemandeAvecUtilisateur, contenu: string) {
  await prisma.echangeApprobation.create({
    data: { demandeId: demande.id, auteurId: adminId, duDemandeur: false, contenu },
  });
  await creerNotification({
    destinataireId: demande.utilisateurId,
    type: "role",
    titre: "Message de l'administration",
    message: "Vous avez un message au sujet de votre demande de rôle. Répondez depuis « Mon Identification ».",
    lien: "/app/mon-identification",
  });
  const { subject, html } = gabaritMessageApprobation({
    deLAdmin: true,
    roleLibelle: demande.roleDemande.libelle,
    message: contenu,
    lien: `${baseUrl()}/app/mon-identification`,
    prenom: demande.utilisateur.prenoms,
  });
  try {
    // Copie à l'administration ; les réponses par e-mail lui reviennent (replyTo).
    await envoyerEmail({ to: demande.utilisateur.email, cc: EMAIL_ADMIN, replyTo: EMAIL_ADMIN, subject, html });
  } catch (e) {
    console.error("[email echange] échec :", e);
  }
}

/** Envoie un message au demandeur d'une demande (échange avant approbation). */
export async function envoyerMessageDemande(demandeId: string, contenu: string): Promise<{ ok: boolean; message?: string }> {
  const admin = await getUtilisateurCourant();
  if (!admin || admin.roleReel !== "admin") return { ok: false, message: "Réservé à l'administrateur système." };
  if (admin.apercuActif) return { ok: false, message: "Mode aperçu : action indisponible." };
  const rEssai = refusEssaiPour(admin);
  if (rEssai) return { ok: false, message: rEssai };
  const texte = (contenu ?? "").trim().slice(0, MESSAGE_MAX);
  if (!texte) return { ok: false, message: "Message vide." };

  const demande = await prisma.demandeRole.findUnique({
    where: { id: demandeId },
    include: { roleDemande: true, utilisateur: true },
  });
  if (!demande) return { ok: false, message: "Demande introuvable." };

  await ecrireMessageAdmin(admin.id, demande, texte);
  await journaliser(admin.id, admin.email, "demande_role.message", `DemandeRole:${demande.id}`, {
    utilisateur: demande.utilisateur.email,
  });
  revalidatePath("/app/systeme/approbations");
  return { ok: true };
}

/** Envoie un même message à plusieurs demandeurs (sélection multiple). */
export async function envoyerMessageGroupe(demandeIds: string[], contenu: string): Promise<{ ok: boolean; message?: string; envoyes?: number }> {
  const admin = await getUtilisateurCourant();
  if (!admin || admin.roleReel !== "admin") return { ok: false, message: "Réservé à l'administrateur système." };
  if (admin.apercuActif) return { ok: false, message: "Mode aperçu : action indisponible." };
  const rEssai = refusEssaiPour(admin);
  if (rEssai) return { ok: false, message: rEssai };
  const texte = (contenu ?? "").trim().slice(0, MESSAGE_MAX);
  if (!texte) return { ok: false, message: "Message vide." };
  const ids = Array.isArray(demandeIds) ? [...new Set(demandeIds.filter((v) => typeof v === "string"))].slice(0, 200) : [];
  if (ids.length === 0) return { ok: false, message: "Aucun destinataire sélectionné." };

  const demandes = await prisma.demandeRole.findMany({
    where: { id: { in: ids } },
    include: { roleDemande: true, utilisateur: true },
  });
  let envoyes = 0;
  for (const d of demandes) {
    await ecrireMessageAdmin(admin.id, d, texte);
    envoyes++;
  }
  await journaliser(admin.id, admin.email, "demande_role.message_groupe", `DemandeRole:${ids.join(",")}`, { envoyes });
  revalidatePath("/app/systeme/approbations");
  return { ok: true, envoyes };
}
