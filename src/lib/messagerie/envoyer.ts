import "server-only";
import { prisma } from "@/lib/prisma";
import { creerNotification } from "@/lib/notifications/creer";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritMessageDirect } from "@/lib/email/templates";
import { peutContacter, type ExpediteurMessage } from "./permissions";

const CHEMIN_MESSAGERIE = "/app/vie-scolaire/communication";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

export interface ResultatEnvoi {
  ok: boolean;
  message?: string;
  destinataireId?: string;
}

/**
 * Envoi d'un MESSAGE DIRECT entre utilisateurs — point d'entrée unique de la messagerie.
 * Enchaîne : contrôle de permission (hiérarchie + périmètre, cf. peutContacter), création du
 * message in-app, notification au destinataire, et COPIE E-MAIL signée (tolérante à l'échec :
 * un e-mail qui échoue n'annule pas le message in-app). Répondre à l'e-mail écrit à l'expéditeur.
 */
export async function envoyerMessageDirect(
  exp: ExpediteurMessage & { nomComplet: string; email: string },
  destinataireId: string,
  contenu: string,
): Promise<ResultatEnvoi> {
  const texte = contenu.trim();
  if (!texte) return { ok: false, message: "Le message est vide." };
  if (texte.length > 5000) return { ok: false, message: "Message trop long (5000 caractères maximum)." };
  if (!destinataireId || destinataireId === exp.id) {
    return { ok: false, message: "Destinataire invalide." };
  }

  if (!(await peutContacter(exp, destinataireId))) {
    return { ok: false, message: "Vous n'êtes pas autorisé à écrire à ce destinataire." };
  }

  const dest = await prisma.utilisateur.findUnique({
    where: { id: destinataireId },
    select: { id: true, email: true, prenoms: true },
  });
  if (!dest) return { ok: false, message: "Destinataire introuvable." };

  try {
    await prisma.message.create({ data: { expediteurId: exp.id, destinataireId, contenu: texte } });
  } catch (e) {
    console.error("[messagerie] création message :", e);
    return { ok: false, message: "Erreur technique lors de l'envoi." };
  }

  const lienRelatif = `${CHEMIN_MESSAGERIE}?avec=${exp.id}`;
  await creerNotification({
    destinataireId,
    type: "info",
    titre: "Nouveau message",
    message: `${exp.nomComplet} vous a écrit.`,
    lien: lienRelatif,
  });

  // Copie e-mail signée — tolérante : ne fait jamais échouer le message in-app.
  try {
    const { subject, html } = gabaritMessageDirect({
      expediteurNom: exp.nomComplet,
      message: texte,
      lien: `${baseUrl()}${lienRelatif}`,
      prenomDest: dest.prenoms,
    });
    await envoyerEmail({ to: dest.email, subject, html, replyTo: exp.email });
  } catch (e) {
    console.error("[messagerie] copie e-mail (poursuite) :", e);
  }

  return { ok: true, message: "Message envoyé.", destinataireId };
}
