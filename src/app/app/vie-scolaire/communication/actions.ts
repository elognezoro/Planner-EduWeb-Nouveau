"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { creerNotification } from "@/lib/notifications/creer";

export interface EtatForm {
  ok: boolean;
  message?: string;
  avec?: string;
}

const BASE = "/app/vie-scolaire/communication";

export async function envoyerMessage(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Action non autorisée en mode aperçu." };

  const contenu = String(formData.get("contenu") ?? "").trim();
  let destinataireId = String(formData.get("destinataireId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!contenu) return { ok: false, message: "Le message est vide." };

  // Résolution du destinataire : par identifiant (réponse) ou par e-mail (nouveau message).
  if (!destinataireId && email) {
    const dest = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
    if (!dest) return { ok: false, message: "Aucun utilisateur avec cet e-mail." };
    destinataireId = dest.id;
  }
  if (!destinataireId) return { ok: false, message: "Destinataire manquant." };
  if (destinataireId === u.id) return { ok: false, message: "Vous ne pouvez pas vous écrire à vous-même." };

  try {
    await prisma.message.create({ data: { expediteurId: u.id, destinataireId, contenu } });
    await creerNotification({
      destinataireId,
      type: "info",
      titre: "Nouveau message",
      message: `${u.nomComplet} vous a écrit.`,
      lien: `${BASE}?avec=${u.id}`,
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[communication] envoi :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Message envoyé.", avec: destinataireId };
}

export async function marquerConversationLue(autreId: string): Promise<void> {
  const u = await getUtilisateurCourant();
  if (!u) return;
  try {
    await prisma.message.updateMany({
      where: { expediteurId: autreId, destinataireId: u.id, lu: false },
      data: { lu: true },
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[communication] marquage lu :", e);
  }
}
