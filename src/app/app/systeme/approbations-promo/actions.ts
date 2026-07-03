"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { creerNotification } from "@/lib/notifications/creer";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/systeme/approbations-promo";

/** En V1, seul l'administrateur système instruit les demandes de codes promo. */
async function exigerAdmin() {
  const admin = await getUtilisateurCourant();
  if (!admin || admin.roleReel !== "admin") throw new Error("Action réservée à l'administrateur système.");
  if (admin.apercuActif) throw new Error("Mode aperçu : action en lecture seule.");
  return admin;
}

async function journaliser(acteurId: string, acteurEmail: string, action: string, cible: string, details: object) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: acteurId, acteurEmail, action, cible, details: details as never },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

export async function approuverDemandePromo(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  const demandeId = String(formData.get("demandeId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!demandeId || !code) return { ok: false, message: "Choisissez le code promo à attribuer." };

  try {
    const [demande, codePromo] = await Promise.all([
      prisma.demandeCodePromo.findUnique({ where: { id: demandeId }, include: { demandeur: true } }),
      prisma.codePromo.findUnique({ where: { code } }),
    ]);
    if (!demande || demande.statut !== "en_attente") return { ok: false, message: "Demande introuvable ou déjà traitée." };
    if (!codePromo || !codePromo.actif) return { ok: false, message: "Code promo introuvable ou inactif." };

    await prisma.demandeCodePromo.update({
      where: { id: demande.id },
      data: { statut: "approuvee", codeAttribue: codePromo.code, traiteLe: new Date() },
    });
    await journaliser(admin.id, admin.email, "demande_promo.approuvee", `DemandeCodePromo:${demande.id}`, {
      demandeur: demande.demandeur.email,
      code: codePromo.code,
      pourcentage: codePromo.pourcentage,
    });
    await creerNotification({
      destinataireId: demande.demandeurId,
      type: "info",
      titre: "Code promo attribué",
      message: `Votre demande de code promo a été approuvée : utilisez le code « ${codePromo.code} » (−${codePromo.pourcentage} %) lors de la souscription Académie Premium.`,
      lien: "/app/vie-scolaire/academie-premium",
    });
    revalidatePath(BASE);
    return { ok: true, message: `Demande approuvée — code « ${codePromo.code} » attribué.` };
  } catch (e) {
    console.error("[promo/approuver] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function refuserDemandePromo(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const admin = await exigerAdmin();
  const demandeId = String(formData.get("demandeId") ?? "");
  if (!demandeId) return { ok: false, message: "Demande manquante." };

  try {
    const demande = await prisma.demandeCodePromo.findUnique({ where: { id: demandeId }, include: { demandeur: true } });
    if (!demande || demande.statut !== "en_attente") return { ok: false, message: "Demande introuvable ou déjà traitée." };

    await prisma.demandeCodePromo.update({
      where: { id: demande.id },
      data: { statut: "refusee", traiteLe: new Date() },
    });
    await journaliser(admin.id, admin.email, "demande_promo.refusee", `DemandeCodePromo:${demande.id}`, {
      demandeur: demande.demandeur.email,
    });
    await creerNotification({
      destinataireId: demande.demandeurId,
      type: "alerte",
      titre: "Demande de code promo refusée",
      message: "Votre demande de code promo n'a pas été retenue. Vous pouvez soumettre une nouvelle demande depuis l'Académie Premium.",
      lien: "/app/vie-scolaire/academie-premium",
    });
    revalidatePath(BASE);
    return { ok: true, message: "Demande refusée." };
  } catch (e) {
    console.error("[promo/refuser] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
