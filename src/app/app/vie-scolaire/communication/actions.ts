"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { envoyerMessageDirect } from "@/lib/messagerie/envoyer";

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

  const contenu = String(formData.get("contenu") ?? "");
  let destinataireId = String(formData.get("destinataireId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  // Résolution du destinataire : par identifiant (réponse) ou par e-mail (nouveau message).
  if (!destinataireId && email) {
    const dest = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
    if (!dest) return { ok: false, message: "Aucun utilisateur avec cet e-mail." };
    destinataireId = dest.id;
  }
  if (!destinataireId) return { ok: false, message: "Destinataire manquant." };

  // Envoi partagé : permission (hiérarchie + périmètre) + message in-app + notification + copie e-mail signée.
  const res = await envoyerMessageDirect(
    { id: u.id, roleReel: u.roleReel, portee: u.portee, apercuActif: u.apercuActif, nomComplet: u.nomComplet, email: u.email },
    destinataireId,
    contenu,
  );
  if (res.ok) revalidatePath(BASE);
  return { ok: res.ok, message: res.message, avec: res.destinataireId };
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
