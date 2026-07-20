"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { hacherMotDePasse } from "@/lib/auth/password";
import { estRoleValide, ROLES, estRoleInferieur } from "@/lib/rbac";
import { solderDemandesEnAttente } from "@/lib/demandes/solder";
import { creerNotification } from "@/lib/notifications/creer";
import { termeCafopCourant } from "@/lib/cafop-terme-serveur";
import { appliquerTerme } from "@/lib/cafop-terme";
import { termeApfcCourant } from "@/lib/apfc-terme-serveur";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritMotDePasseTemporaire } from "@/lib/email/templates";
import { DUREE_ESSAI_MAX } from "@/lib/premium/essai";
import { finEssaiParDefaut } from "@/lib/premium/config-essai";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

/** URL publique de l'app (liens absolus dans les e-mails). */
function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

export interface EtatForm {
  ok: boolean;
  message?: string;
  /** Mot de passe temporaire, renvoyé UNE fois après réinitialisation (jamais persisté en clair). */
  motDePasseTemp?: string;
}

const ADMINS = ["admin", "etablissements_admin", "cafop_admin", "apfc_admin", "chef_etablissement"];
// Rôles qu'un gestionnaire d'établissement (non-admin) peut attribuer (anti-escalade).
const ROLES_ETABLISSEMENT = [
  "chef_etablissement",
  "adjoint_chef_etablissement",
  "inspecteur_orientation",
  "enseignant",
  "educateur",
  "parent",
  "eleve",
];
const BASE = "/app/systeme/comptes";

type Cible = { id: string; email: string; prenoms: string | null; roleTech: string; etablissementId: string | null; cafopId: string | null; apfcId: string | null; regionId: string | null; pays: string | null };

/** Vérifie que l'appelant est un administrateur habilité (hors mode aperçu). */
async function garde(): Promise<{ admin: UtilisateurCourant } | { erreur: string }> {
  const admin = await getUtilisateurCourant();
  if (!admin) return { erreur: "Session expirée." };
  if (admin.apercuActif) return { erreur: "Mode aperçu : action en lecture seule." };
  const rEssai = refusEssaiPour(admin);
  if (rEssai) return { erreur: rEssai };
  if (!ADMINS.includes(admin.roleReel)) return { erreur: "Action réservée à l'administration." };
  return { admin };
}

/** Un gestionnaire non-admin ne peut agir que sur les comptes de son propre périmètre. */
function dansPerimetre(admin: UtilisateurCourant, cible: Cible): boolean {
  if (admin.roleReel === "admin") return true;
  if (admin.roleReel === "etablissements_admin" || admin.roleReel === "chef_etablissement")
    return Boolean(admin.portee.etablissementId) && cible.etablissementId === admin.portee.etablissementId;
  if (admin.roleReel === "cafop_admin") return Boolean(admin.portee.cafopId) && cible.cafopId === admin.portee.cafopId;
  if (admin.roleReel === "apfc_admin") return Boolean(admin.portee.apfcId) && cible.apfcId === admin.portee.apfcId;
  return false;
}

async function chargerCible(userId: string): Promise<Cible | null> {
  const u = await prisma.utilisateur.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, prenoms: true, etablissementId: true, cafopId: true, apfcId: true, regionId: true, pays: true,
      roleActif: { select: { nomTechnique: true } },
    },
  });
  return u ? { ...u, roleTech: u.roleActif.nomTechnique } : null;
}

/**
 * L'appelant peut-il agir sur cette cible ? Cumule le périmètre ET l'anti-escalade :
 * un gestionnaire non-admin ne peut agir que sur des comptes de rôle « établissement »
 * (jamais sur un admin système ni un admin d'établissement plus privilégié).
 */
function peutAgirSur(admin: UtilisateurCourant, cible: Cible): boolean {
  if (!dansPerimetre(admin, cible)) return false;
  if (admin.roleReel === "admin") return true;
  return ROLES_ETABLISSEMENT.includes(cible.roleTech);
}

async function journaliser(admin: UtilisateurCourant, action: string, userId: string, details: Prisma.InputJsonValue) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: admin.id, acteurEmail: admin.email, action, cible: `Utilisateur:${userId}`, details },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

function rafraichir(userId: string) {
  revalidatePath(`${BASE}/${userId}`);
  revalidatePath(BASE);
}

// ─────────────────────────────────────────────────────────────
//  Rôle & affectation au périmètre
// ─────────────────────────────────────────────────────────────
export async function affecterRoleEtPerimetre(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const admin = g.admin;

  const userId = String(formData.get("utilisateurId") ?? "");
  const roleTech = String(formData.get("role") ?? "");
  let perimetreId = String(formData.get("perimetreId") ?? "").trim() || null;
  // Pays de l'utilisateur (optionnel — modale d'habilitation) : mis à jour s'il est fourni.
  const paysHabilitation = String(formData.get("pays") ?? "").trim() || null;
  // Diocèse (rôle SEDEC — périmètre « diocese »).
  const dioceseHabilitation = String(formData.get("diocese") ?? "").trim() || null;
  if (!estRoleValide(roleTech)) return { ok: false, message: "Rôle invalide." };
  if (userId === admin.id) return { ok: false, message: "Vous ne pouvez pas modifier votre propre rôle ici." };

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!peutAgirSur(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

  // Anti-escalade STRICTE (cohérent avec la page Habilitations) : un gestionnaire non-admin ne
  // peut attribuer QU'UN rôle de rang strictement inférieur au sien, ni modifier un compte de rang
  // égal ou supérieur. (L'admin système domine tout.)
  if (!estRoleInferieur(admin.roleReel, roleTech)) {
    return { ok: false, message: "Vous ne pouvez attribuer qu'un rôle de niveau inférieur au vôtre." };
  }
  if (estRoleValide(cible.roleTech) && !estRoleInferieur(admin.roleReel, cible.roleTech)) {
    return { ok: false, message: "Vous ne pouvez pas modifier un compte de niveau égal ou supérieur au vôtre." };
  }

  const portee = ROLES[roleTech].portee;
  const besoinPerimetre = portee === "etablissement" || portee === "region" || portee === "cafop" || portee === "apfc";

  // Un gestionnaire non-admin ne peut affecter que DANS son propre périmètre, et ne peut
  // JAMAIS attribuer un rôle plus élevé que le sien (anti-escalade de privilège).
  if (admin.roleReel === "etablissements_admin" || admin.roleReel === "chef_etablissement") {
    if (!ROLES_ETABLISSEMENT.includes(roleTech)) {
      return { ok: false, message: "Vous ne pouvez attribuer que des rôles de votre établissement (chef, enseignant, éducateur, parent, élève)." };
    }
    // Rôles rattachés à l'établissement : périmètre imposé au sien. Rôles personnels
    // (parent, élève) : aucun périmètre administratif à positionner.
    if (portee === "etablissement") perimetreId = admin.portee.etablissementId;
  } else if (admin.roleReel === "cafop_admin") {
    if (portee !== "cafop") return { ok: false, message: appliquerTerme("Vous ne pouvez attribuer que des rôles CAFOP.", await termeCafopCourant()) };
    perimetreId = admin.portee.cafopId;
  } else if (admin.roleReel === "apfc_admin") {
    if (portee !== "apfc") return { ok: false, message: appliquerTermeApfc("Vous ne pouvez attribuer que des rôles APFC.", await termeApfcCourant()) };
    perimetreId = admin.portee.apfcId;
  }

  if (besoinPerimetre && !perimetreId) {
    return { ok: false, message: "Choisissez le périmètre d'affectation (structure de rattachement)." };
  }
  // Rôle SEDEC : un diocèse est obligatoire (le périmètre est le diocèse, dans le pays du compte).
  if (portee === "diocese" && !dioceseHabilitation) {
    return { ok: false, message: "Choisissez le diocèse de rattachement (rôle SEDEC)." };
  }
  // Rôle à portée « pays » (SENEC, représentant pays…) : un pays est OBLIGATOIRE, sinon le
  // périmètre est vide et l'utilisateur ne voit aucune donnée (repli : pays déjà au compte).
  if (portee === "pays" && !paysHabilitation && !cible.pays) {
    return { ok: false, message: "Choisissez le pays de rattachement (rôle à portée nationale)." };
  }

  // Vérifie que l'entité choisie existe bien (évite un rattachement fantôme).
  if (besoinPerimetre && perimetreId) {
    const existe =
      portee === "etablissement" ? await prisma.etablissement.count({ where: { id: perimetreId } })
      : portee === "region" ? await prisma.region.count({ where: { id: perimetreId } })
      : portee === "cafop" ? await prisma.cafop.count({ where: { id: perimetreId } })
      : await prisma.apfc.count({ where: { id: perimetreId } });
    if (existe === 0) return { ok: false, message: "La structure d'affectation choisie est introuvable." };
  }

  // MULTI-ÉTABLISSEMENTS (groupes scolaires) : rattachements SECONDAIRES donnant le même accès
  // que l'établissement principal. Réservés à l'ADMIN SYSTÈME (un gestionnaire local ne peut pas
  // étendre un compte au-delà de son propre périmètre) et à la seule portée « etablissement ».
  const remplaceSecondaires = admin.roleReel === "admin" && portee === "etablissement";
  let perimetresSecondaires: string[] = [];
  if (remplaceSecondaires) {
    perimetresSecondaires = [
      ...new Set(formData.getAll("perimetresSecondaires").map((v) => String(v).trim()).filter(Boolean)),
    ].filter((idEtab) => idEtab !== perimetreId); // le principal n'est jamais dupliqué en secondaire
    if (perimetresSecondaires.length > 0) {
      const nb = await prisma.etablissement.count({ where: { id: { in: perimetresSecondaires } } });
      if (nb !== perimetresSecondaires.length) {
        return { ok: false, message: "Un des établissements secondaires choisis est introuvable." };
      }
    }
  }

  try {
    const role = await prisma.role.findUnique({ where: { nomTechnique: roleTech }, select: { id: true } });
    if (!role) return { ok: false, message: "Rôle introuvable (seed manquant ?)." };

    // Période d'essai — réservée à l'ADMIN SYSTÈME, uniquement lors d'une affectation à un
    // établissement. Case cochée → fenêtre [maintenant ; maintenant + N jours] ; sinon aucune.
    let essaiData: { essaiDebutLe: Date | null; essaiFinLe: Date | null; essaiFinNotifieLe: Date | null } | null = null;
    if (admin.roleReel === "admin" && portee === "etablissement") {
      const mode = String(formData.get("essaiMode") ?? "");
      if (mode === "libre") {
        // Accès libre : aucune période d'essai (drapeau de notification remis à zéro).
        essaiData = { essaiDebutLe: null, essaiFinLe: null, essaiFinNotifieLe: null };
      } else if (mode === "essai") {
        const debut = new Date();
        const maxFin = debut.getTime() + DUREE_ESSAI_MAX * 86_400_000;
        // Date de fin choisie au calendrier (prioritaire), sinon durée PAR DÉFAUT de la plateforme.
        const dateStr = String(formData.get("essaiFinDate") ?? "").trim();
        const choisie = dateStr ? new Date(`${dateStr}T23:59:59`) : null;
        let fin =
          choisie && !Number.isNaN(choisie.getTime()) && choisie.getTime() > debut.getTime()
            ? choisie
            : await finEssaiParDefaut(debut);
        if (fin.getTime() <= debut.getTime()) fin = await finEssaiParDefaut(debut);
        if (fin.getTime() > maxFin) fin = new Date(maxFin);
        // Nouvel essai → réarme l'e-mail automatique de fin d'essai à la nouvelle échéance.
        essaiData = { essaiDebutLe: debut, essaiFinLe: fin, essaiFinNotifieLe: null };
      }
      // mode absent → on ne modifie pas la période d'essai existante.
    }

    // Attribution + SYNCHRONISATION : les demandes de rôle en attente du compte sont soldées
    // dans la même transaction (elles quittent la file des Approbations — cf. lib/demandes/solder).
    let demandesSoldees = 0;
    await prisma.$transaction(async (tx) => {
      await tx.utilisateur.update({
        where: { id: userId },
        data: {
          roleActifId: role.id,
          // On réinitialise tous les périmètres puis on positionne celui du rôle (§4.3).
          etablissementId: portee === "etablissement" ? perimetreId : null,
          regionId: portee === "region" ? perimetreId : null,
          cafopId: portee === "cafop" ? perimetreId : null,
          apfcId: portee === "apfc" ? perimetreId : null,
          // Diocèse : positionné pour le rôle SEDEC, réinitialisé sinon.
          diocese: portee === "diocese" ? dioceseHabilitation : null,
          ...(paysHabilitation ? { pays: paysHabilitation } : {}),
          ...(essaiData ?? {}),
        },
      });
      // Rattachements SECONDAIRES (groupes scolaires) : REMPLACÉS par la liste fournie quand
      // l'admin système affecte un rôle à portée « etablissement » ; PURGÉS pour toute autre
      // portée (réinitialisation du périmètre, comme les colonnes ci-dessus) ; conservés tels
      // quels quand un gestionnaire local ré-habilite un compte de son établissement.
      if (remplaceSecondaires) {
        await tx.affectationEtablissement.deleteMany({ where: { utilisateurId: userId } });
        if (perimetresSecondaires.length > 0) {
          await tx.affectationEtablissement.createMany({
            data: perimetresSecondaires.map((etabId) => ({ utilisateurId: userId, etablissementId: etabId })),
            skipDuplicates: true,
          });
        }
      } else if (portee !== "etablissement") {
        await tx.affectationEtablissement.deleteMany({ where: { utilisateurId: userId } });
      }
      demandesSoldees = await solderDemandesEnAttente(tx, { utilisateurId: userId, acteurId: admin.id, acteurRole: admin.roleReel });
    });
    await journaliser(admin, "compte.role_affectation", userId, {
      role: roleTech,
      perimetreId,
      ...(remplaceSecondaires ? { perimetresSecondaires } : {}),
      cibleEmail: cible.email,
      demandesSoldees,
      essaiFinLe: essaiData?.essaiFinLe ? essaiData.essaiFinLe.toISOString() : null,
    });
    await creerNotification({
      destinataireId: userId,
      type: "role",
      titre: "Rôle attribué",
      message: `Un administrateur vous a attribué le rôle « ${ROLES[roleTech].libelle} ».${demandesSoldees > 0 ? " Votre demande de rôle en attente a été traitée." : ""} Votre accès est mis à jour.`,
      lien: "/app",
    });
    rafraichir(userId);
    revalidatePath("/app/systeme/approbations");
  } catch (e) {
    console.error("[comptes/affectation] erreur :", e);
    return { ok: false, message: "Erreur technique lors de l'affectation." };
  }
  return { ok: true, message: "Rôle et affectation mis à jour." };
}

// ─────────────────────────────────────────────────────────────
//  Coordonnées
// ─────────────────────────────────────────────────────────────
export async function modifierCoordonnees(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const admin = g.admin;

  const userId = String(formData.get("utilisateurId") ?? "");
  const prenoms = String(formData.get("prenoms") ?? "").trim() || null;
  const nom = String(formData.get("nom") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telephone = String(formData.get("telephone") ?? "").trim() || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "E-mail invalide." };

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!peutAgirSur(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

  try {
    if (email !== cible.email) {
      const occupe = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
      if (occupe && occupe.id !== userId) return { ok: false, message: "Cet e-mail est déjà utilisé par un autre compte." };
    }
    await prisma.utilisateur.update({ where: { id: userId }, data: { prenoms, nom, email, telephone } });
    await journaliser(admin, "compte.coordonnees_modifiees", userId, { email });
    rafraichir(userId);
  } catch (e) {
    console.error("[comptes/coordonnees] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Coordonnées mises à jour." };
}

// ─────────────────────────────────────────────────────────────
//  Statut du compte
// ─────────────────────────────────────────────────────────────
export async function changerStatut(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const admin = g.admin;

  const userId = String(formData.get("utilisateurId") ?? "");
  const statut = String(formData.get("statut") ?? "");
  if (!["actif", "suspendu", "archive", "en_attente_verification"].includes(statut)) return { ok: false, message: "Statut invalide." };
  if (userId === admin.id) return { ok: false, message: "Vous ne pouvez pas changer le statut de votre propre compte." };

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!peutAgirSur(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

  try {
    await prisma.utilisateur.update({
      where: { id: userId },
      data: {
        statutCompte: statut as Prisma.UtilisateurUpdateInput["statutCompte"],
        // Confirmer l'e-mail si on active un compte encore non confirmé.
        ...(statut === "actif" ? { emailVerifieLe: new Date() } : {}),
      },
    });
    await journaliser(admin, "compte.statut_modifie", userId, { statut, cibleEmail: cible.email });
    rafraichir(userId);
  } catch (e) {
    console.error("[comptes/statut] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  const libelle =
    statut === "actif" ? "activé" : statut === "suspendu" ? "suspendu" : statut === "archive" ? "archivé" : "remis en attente";
  return { ok: true, message: `Compte ${libelle}.` };
}

// ─────────────────────────────────────────────────────────────
//  Réinitialisation du mot de passe (par l'admin)
// ─────────────────────────────────────────────────────────────
export async function reinitialiserMotDePasse(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const admin = g.admin;

  const userId = String(formData.get("utilisateurId") ?? "");
  // Mot de passe choisi par l'administrateur (facultatif) — sinon un mot de passe est généré.
  const motDePasseChoisi = String(formData.get("motDePasse") ?? "").trim();
  if (userId === admin.id) return { ok: false, message: "Utilisez « Mon Profil » pour votre propre mot de passe." };
  if (motDePasseChoisi && (motDePasseChoisi.length < 8 || motDePasseChoisi.length > 72)) {
    return { ok: false, message: "Le mot de passe doit contenir entre 8 et 72 caractères." };
  }

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!peutAgirSur(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

  try {
    const motDePasseTemp = motDePasseChoisi || `Edu-${randomBytes(6).toString("base64url")}`;
    await prisma.utilisateur.update({ where: { id: userId }, data: { motDePasseHash: await hacherMotDePasse(motDePasseTemp) } });
    await journaliser(admin, "compte.mot_de_passe_reinitialise", userId, {
      cibleEmail: cible.email,
      personnalise: Boolean(motDePasseChoisi),
    });

    // Envoi des identifiants temporaires à l'utilisateur (invitation à changer le mot de passe).
    let envoye = false;
    try {
      const lien = `${baseUrl()}/connexion`;
      const { subject, html } = gabaritMotDePasseTemporaire(cible.email, motDePasseTemp, lien, cible.prenoms);
      await envoyerEmail({ to: cible.email, subject, html, lienDebug: lien });
      envoye = true;
    } catch (e) {
      console.error("[comptes/reset] e-mail non envoyé :", e);
    }

    rafraichir(userId);
    const quoi = motDePasseChoisi ? "Nouveau mot de passe défini" : "Mot de passe temporaire généré";
    return {
      ok: true,
      message: envoye
        ? `${quoi} et envoyé par e-mail à ${cible.email} (avec invitation à le changer depuis son profil).`
        : `${quoi}, mais l'e-mail n'a pas pu être envoyé : communiquez-le à l'utilisateur manuellement.`,
      motDePasseTemp,
    };
  } catch (e) {
    console.error("[comptes/reset] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Suppression
// ─────────────────────────────────────────────────────────────
export async function supprimerCompte(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const admin = g.admin;

  const userId = String(formData.get("utilisateurId") ?? "");
  if (userId === admin.id) return { ok: false, message: "Vous ne pouvez pas supprimer votre propre compte." };

  const brute = await prisma.utilisateur.findUnique({ where: { id: userId }, include: { roleActif: true } });
  if (!brute) return { ok: false, message: "Utilisateur introuvable." };
  const cible: Cible = { ...brute, roleTech: brute.roleActif.nomTechnique };
  if (!peutAgirSur(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };
  if (cible.roleTech === "admin") return { ok: false, message: "Un compte administrateur ne peut pas être supprimé ici." };

  try {
    await prisma.utilisateur.delete({ where: { id: userId } });
    await journaliser(admin, "compte.supprime", userId, { cibleEmail: cible.email });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[comptes/suppression] erreur :", e);
    return { ok: false, message: "Erreur technique lors de la suppression." };
  }
  return { ok: true, message: "Compte supprimé." };
}
