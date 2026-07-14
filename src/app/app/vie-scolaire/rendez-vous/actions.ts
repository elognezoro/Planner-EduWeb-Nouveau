"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { creerNotification } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/vie-scolaire/rendez-vous";
const STATUTS = ["confirme", "refuse", "annule"] as const;

function normaliserDate(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(valeur)) return null;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function demanderRdv(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Action non autorisée en mode aperçu." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const dateStr = String(formData.get("date") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  const date = normaliserDate(dateStr);

  if (!email) return { ok: false, message: "Indiquez l'e-mail du destinataire." };
  if (!date) return { ok: false, message: "Date invalide." };
  if (!motif) return { ok: false, message: "Précisez le motif du rendez-vous." };

  const dest = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
  if (!dest) return { ok: false, message: "Aucun utilisateur avec cet e-mail." };
  if (dest.id === u.id) return { ok: false, message: "Vous ne pouvez pas prendre rendez-vous avec vous-même." };

  try {
    await prisma.rendezVous.create({ data: { demandeurId: u.id, destinataireId: dest.id, date, motif } });
    await creerNotification({
      destinataireId: dest.id,
      type: "info",
      titre: "Demande de rendez-vous",
      message: `${u.nomComplet} sollicite un rendez-vous.`,
      lien: BASE,
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[rendez-vous] demande :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Demande de rendez-vous envoyée." };
}

export async function repondreRdv(id: string, statut: (typeof STATUTS)[number]): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Action non autorisée en mode aperçu." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  if (!STATUTS.includes(statut)) return { ok: false, message: "Statut invalide." };

  const rdv = await prisma.rendezVous.findUnique({ where: { id }, select: { demandeurId: true, destinataireId: true } });
  if (!rdv) return { ok: false, message: "Rendez-vous introuvable." };

  // Le destinataire confirme/refuse ; le demandeur annule.
  const estDestinataire = rdv.destinataireId === u.id;
  const estDemandeur = rdv.demandeurId === u.id;
  if (statut === "annule" && !estDemandeur) return { ok: false, message: "Seul le demandeur peut annuler." };
  if ((statut === "confirme" || statut === "refuse") && !estDestinataire) {
    return { ok: false, message: "Action réservée au destinataire." };
  }

  try {
    await prisma.rendezVous.update({ where: { id }, data: { statut } });
    const cible = estDestinataire ? rdv.demandeurId : rdv.destinataireId;
    const libelle = statut === "confirme" ? "confirmé" : statut === "refuse" ? "refusé" : "annulé";
    await creerNotification({
      destinataireId: cible,
      type: statut === "refuse" ? "alerte" : "succes",
      titre: `Rendez-vous ${libelle}`,
      message: `Votre rendez-vous a été ${libelle}.`,
      lien: BASE,
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[rendez-vous] réponse :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}
