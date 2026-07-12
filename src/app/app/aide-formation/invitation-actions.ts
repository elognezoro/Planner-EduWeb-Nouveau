"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, requireUtilisateur } from "@/lib/auth/session";
import type { EtatLms } from "./actions";

const BASE = "/app/aide-formation";
const GESTION_INVIT = `${BASE}/gestion/invitations`;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOuNull = (fd: FormData, k: string): number | null => {
  const b = str(fd, k);
  if (b === "") return null;
  const v = Number(b);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
};

async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}

/** Inscrit un utilisateur aux cours PUBLIÉS liés à une session (accès réel au contenu). */
async function inscrireAuxCoursLies(utilisateurId: string, coursIds: string[]) {
  if (!coursIds.length) return;
  const publies = await prisma.cours.findMany({ where: { id: { in: coursIds }, statut: "publie" }, select: { id: true } });
  for (const c of publies) {
    await prisma.inscriptionCours.upsert({
      where: { utilisateurId_coursId: { utilisateurId, coursId: c.id } },
      create: { utilisateurId, coursId: c.id },
      update: { derniereActivite: new Date() },
    });
  }
}

// ── Console admin : création / gestion des liens d'invitation ─────────────────

export async function creerInvitation(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const sessionId = str(fd, "sessionId");
  if (!sessionId) return { ok: false, message: "Session introuvable." };
  const u = await getUtilisateurCourant();
  const code = str(fd, "code") || null;
  const placesMax = numOuNull(fd, "placesMax");
  const expRaw = str(fd, "expiration");
  const expiration = expRaw ? new Date(expRaw) : null;
  try {
    const session = await prisma.sessionFormation.findUnique({ where: { id: sessionId }, select: { id: true } });
    if (!session) return { ok: false, message: "Session introuvable." };
    await prisma.invitationFormation.create({
      data: {
        sessionId, code, placesMax,
        expiration: expiration && !isNaN(expiration.getTime()) ? expiration : null,
        creeParId: u?.id ?? null,
      },
    });
    revalidatePath(GESTION_INVIT);
  } catch (e) {
    console.error("[invitation] création :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Lien d'invitation créé." };
}

export async function basculerInvitation(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const inv = await prisma.invitationFormation.findUnique({ where: { id }, select: { actif: true } });
    if (!inv) return { ok: false, message: "Invitation introuvable." };
    await prisma.invitationFormation.update({ where: { id }, data: { actif: !inv.actif } });
    revalidatePath(GESTION_INVIT);
  } catch (e) {
    console.error("[invitation] bascule :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Lien mis à jour." };
}

export async function regenererTokenInvitation(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.invitationFormation.update({ where: { id }, data: { token: randomUUID() } });
    revalidatePath(GESTION_INVIT);
  } catch (e) {
    console.error("[invitation] régénération :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Nouveau lien généré (l'ancien ne fonctionne plus)." };
}

export async function supprimerInvitation(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.invitationFormation.delete({ where: { id } });
    revalidatePath(GESTION_INVIT);
  } catch (e) {
    console.error("[invitation] suppression :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Lien supprimé." };
}

// ── Console admin : validation des demandes d'inscription ─────────────────────

export async function validerInscriptionSession(inscriptionId: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const insc = await prisma.inscriptionSession.findUnique({
      where: { id: inscriptionId },
      select: { utilisateurId: true, session: { select: { coursIds: true } } },
    });
    if (!insc) return { ok: false, message: "Demande introuvable." };
    await prisma.inscriptionSession.update({ where: { id: inscriptionId }, data: { statut: "inscrit" } });
    await inscrireAuxCoursLies(insc.utilisateurId, insc.session.coursIds);
    revalidatePath(GESTION_INVIT);
  } catch (e) {
    console.error("[invitation] validation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Inscription validée — l'invité a accès à la formation." };
}

export async function refuserInscriptionSession(inscriptionId: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.inscriptionSession.delete({ where: { id: inscriptionId } });
    revalidatePath(GESTION_INVIT);
  } catch (e) {
    console.error("[invitation] refus :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Demande refusée." };
}

// ── Page publique : acceptation d'une invitation ──────────────────────────────

export type ResultatInvitation = { ok: boolean; message: string; statut?: "en_attente" | "inscrit" };

export async function accepterInvitation(token: string, codeSaisi: string): Promise<ResultatInvitation> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const inv = await prisma.invitationFormation.findUnique({
    where: { token },
    select: { actif: true, code: true, expiration: true, placesMax: true, session: { select: { id: true, statut: true, coursIds: true } } },
  });
  if (!inv || !inv.actif) return { ok: false, message: "Lien d'invitation invalide ou désactivé." };
  if (inv.expiration && inv.expiration < new Date()) return { ok: false, message: "Ce lien d'invitation a expiré." };
  if (inv.session.statut !== "planifiee") return { ok: false, message: "Cette formation n'accepte plus d'inscription." };

  const codeOk = !!inv.code && codeSaisi.trim() !== "" && codeSaisi.trim() === inv.code;

  const existante = await prisma.inscriptionSession.findUnique({
    where: { utilisateurId_sessionId: { utilisateurId: u.id, sessionId: inv.session.id } },
    select: { statut: true },
  });
  if (existante?.statut === "inscrit") return { ok: true, message: "Vous êtes déjà inscrit à cette formation.", statut: "inscrit" };

  // Plafond de places (compte des inscriptions déjà validées de la session).
  if (!existante && inv.placesMax != null && inv.placesMax > 0) {
    const nb = await prisma.inscriptionSession.count({ where: { sessionId: inv.session.id, statut: "inscrit" } });
    if (nb >= inv.placesMax) return { ok: false, message: "Le nombre de places de cette formation est atteint." };
  }

  const statut: "en_attente" | "inscrit" = codeOk ? "inscrit" : "en_attente";
  try {
    await prisma.inscriptionSession.upsert({
      where: { utilisateurId_sessionId: { utilisateurId: u.id, sessionId: inv.session.id } },
      create: { utilisateurId: u.id, sessionId: inv.session.id, statut },
      update: { statut },
    });
    if (codeOk) await inscrireAuxCoursLies(u.id, inv.session.coursIds);
    revalidatePath(`${BASE}/formations`);
  } catch (e) {
    console.error("[invitation] acceptation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return codeOk
    ? { ok: true, message: "Inscription validée : vous avez accès à la formation.", statut: "inscrit" }
    : { ok: true, message: "Demande envoyée — en attente de validation par l'administrateur.", statut: "en_attente" };
}
