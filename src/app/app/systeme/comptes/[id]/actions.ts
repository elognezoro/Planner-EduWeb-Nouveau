"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { hacherMotDePasse } from "@/lib/auth/password";
import { estRoleValide, ROLES } from "@/lib/rbac";

export interface EtatForm {
  ok: boolean;
  message?: string;
  /** Mot de passe temporaire, renvoyé UNE fois après réinitialisation (jamais persisté en clair). */
  motDePasseTemp?: string;
}

const ADMINS = ["admin", "etablissements_admin", "cafop_admin", "apfc_admin"];
const BASE = "/app/systeme/comptes";

type Cible = { id: string; email: string; etablissementId: string | null; cafopId: string | null; apfcId: string | null; regionId: string | null };

/** Vérifie que l'appelant est un administrateur habilité (hors mode aperçu). */
async function garde(): Promise<{ admin: UtilisateurCourant } | { erreur: string }> {
  const admin = await getUtilisateurCourant();
  if (!admin) return { erreur: "Session expirée." };
  if (admin.apercuActif) return { erreur: "Mode aperçu : action en lecture seule." };
  if (!ADMINS.includes(admin.roleReel)) return { erreur: "Action réservée à l'administration." };
  return { admin };
}

/** Un admin spécialisé ne peut agir que sur les comptes de son propre périmètre. */
function dansPerimetre(admin: UtilisateurCourant, cible: Cible): boolean {
  if (admin.roleReel === "admin") return true;
  if (admin.roleReel === "etablissements_admin") return cible.etablissementId === admin.portee.etablissementId;
  if (admin.roleReel === "cafop_admin") return cible.cafopId === admin.portee.cafopId;
  if (admin.roleReel === "apfc_admin") return cible.apfcId === admin.portee.apfcId;
  return false;
}

async function chargerCible(userId: string): Promise<Cible | null> {
  return prisma.utilisateur.findUnique({
    where: { id: userId },
    select: { id: true, email: true, etablissementId: true, cafopId: true, apfcId: true, regionId: true },
  });
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
  if (!estRoleValide(roleTech)) return { ok: false, message: "Rôle invalide." };
  if (userId === admin.id) return { ok: false, message: "Vous ne pouvez pas modifier votre propre rôle ici." };

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!dansPerimetre(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

  const portee = ROLES[roleTech].portee;
  const besoinPerimetre = portee === "etablissement" || portee === "region" || portee === "cafop" || portee === "apfc";

  // Un admin spécialisé ne peut affecter que DANS son propre périmètre.
  if (admin.roleReel === "etablissements_admin") {
    if (portee !== "etablissement") return { ok: false, message: "Vous ne pouvez attribuer que des rôles d'établissement." };
    perimetreId = admin.portee.etablissementId;
  } else if (admin.roleReel === "cafop_admin") {
    if (portee !== "cafop") return { ok: false, message: "Vous ne pouvez attribuer que des rôles CAFOP." };
    perimetreId = admin.portee.cafopId;
  } else if (admin.roleReel === "apfc_admin") {
    if (portee !== "apfc") return { ok: false, message: "Vous ne pouvez attribuer que des rôles APFC." };
    perimetreId = admin.portee.apfcId;
  }

  if (besoinPerimetre && !perimetreId) {
    return { ok: false, message: "Choisissez le périmètre d'affectation (structure de rattachement)." };
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

  try {
    const role = await prisma.role.findUnique({ where: { nomTechnique: roleTech }, select: { id: true } });
    if (!role) return { ok: false, message: "Rôle introuvable (seed manquant ?)." };

    await prisma.utilisateur.update({
      where: { id: userId },
      data: {
        roleActifId: role.id,
        // On réinitialise tous les périmètres puis on positionne celui du rôle (§4.3).
        etablissementId: portee === "etablissement" ? perimetreId : null,
        regionId: portee === "region" ? perimetreId : null,
        cafopId: portee === "cafop" ? perimetreId : null,
        apfcId: portee === "apfc" ? perimetreId : null,
      },
    });
    await journaliser(admin, "compte.role_affectation", userId, { role: roleTech, perimetreId, cibleEmail: cible.email });
    rafraichir(userId);
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
  if (!dansPerimetre(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

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
  if (!["actif", "suspendu", "en_attente_verification"].includes(statut)) return { ok: false, message: "Statut invalide." };
  if (userId === admin.id) return { ok: false, message: "Vous ne pouvez pas changer le statut de votre propre compte." };

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!dansPerimetre(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

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
  const libelle = statut === "actif" ? "activé" : statut === "suspendu" ? "suspendu" : "remis en attente";
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
  if (userId === admin.id) return { ok: false, message: "Utilisez « Mon Profil » pour votre propre mot de passe." };

  const cible = await chargerCible(userId);
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!dansPerimetre(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };

  try {
    const motDePasseTemp = `Edu-${randomBytes(6).toString("base64url")}`;
    await prisma.utilisateur.update({ where: { id: userId }, data: { motDePasseHash: await hacherMotDePasse(motDePasseTemp) } });
    await journaliser(admin, "compte.mot_de_passe_reinitialise", userId, { cibleEmail: cible.email });
    rafraichir(userId);
    return { ok: true, message: "Mot de passe temporaire généré. Communiquez-le à l'utilisateur ; il pourra le changer.", motDePasseTemp };
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

  const cible = await prisma.utilisateur.findUnique({ where: { id: userId }, include: { roleActif: true } });
  if (!cible) return { ok: false, message: "Utilisateur introuvable." };
  if (!dansPerimetre(admin, cible)) return { ok: false, message: "Cet utilisateur est hors de votre périmètre." };
  if (cible.roleActif.nomTechnique === "admin") return { ok: false, message: "Un compte administrateur ne peut pas être supprimé ici." };

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
