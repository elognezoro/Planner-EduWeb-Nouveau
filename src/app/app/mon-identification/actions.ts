"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUtilisateur } from "@/lib/auth/session";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritMessageApprobation } from "@/lib/email/templates";
import { limiteDebitOk } from "@/lib/ia/limite-debit";

const EMAIL_ADMIN = process.env.ADMIN_CONTACT_EMAIL ?? "elognezoro@gmail.com";
const MESSAGE_MAX = 4000;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Réponse d'un DEMANDEUR à l'administration au sujet de SA demande de rôle.
 * Sécurité : l'utilisateur ne peut répondre qu'à une demande dont il est le titulaire.
 * L'e-mail part vers l'administration (réponses adressées à l'e-mail du demandeur).
 */
export async function repondreEchangeDemande(demandeId: string, contenu: string): Promise<{ ok: boolean; message?: string }> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Mode aperçu : action indisponible." };
  // Garde-fou anti-abus (coût e-mail / spam) : au plus 15 réponses par 10 minutes et par utilisateur.
  if (!limiteDebitOk(`echange:${u.id}`, 15, 10 * 60_000)) {
    return { ok: false, message: "Vous avez envoyé trop de messages. Patientez quelques minutes." };
  }

  const texte = (contenu ?? "").trim().slice(0, MESSAGE_MAX);
  if (!texte) return { ok: false, message: "Message vide." };

  const demande = await prisma.demandeRole.findUnique({
    where: { id: demandeId },
    include: { roleDemande: true, utilisateur: true },
  });
  // Cloisonnement strict : la demande doit appartenir à l'utilisateur courant.
  if (!demande || demande.utilisateurId !== u.id) return { ok: false, message: "Demande introuvable." };

  // L'échange est TOUJOURS initié par l'administration : un demandeur ne peut répondre que si
  // un message de l'administration existe déjà (empêche l'ouverture non sollicitée d'un fil / le spam).
  const messagesAdmin = await prisma.echangeApprobation.count({
    where: { demandeId: demande.id, duDemandeur: false },
  });
  if (messagesAdmin === 0) {
    return { ok: false, message: "L'administration ne vous a pas encore contacté au sujet de cette demande." };
  }

  await prisma.echangeApprobation.create({
    data: { demandeId: demande.id, auteurId: u.id, duDemandeur: true, contenu: texte },
  });

  const { subject, html } = gabaritMessageApprobation({
    deLAdmin: false,
    roleLibelle: demande.roleDemande.libelle,
    message: texte,
    // « ?demande= » : la page Approbations défile directement jusqu'à la demande concernée.
    lien: `${baseUrl()}/app/systeme/approbations?demande=${demande.id}`,
    nomDemandeur: u.nomComplet,
  });
  try {
    // Vers l'administration ; les réponses reviennent au demandeur (replyTo).
    await envoyerEmail({ to: EMAIL_ADMIN, replyTo: u.email, subject, html });
  } catch (e) {
    console.error("[email echange demandeur] échec :", e);
  }

  revalidatePath("/app/mon-identification");
  revalidatePath("/app/systeme/approbations");
  return { ok: true };
}
