"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, requireUtilisateur } from "@/lib/auth/session";
import { recalculerParcoursPourCours } from "@/lib/lms-parcours";
import { appliquerCompletionCours, moduleEstDebloque } from "@/lib/lms-completion";
import { suggererObservationDevoir } from "@/lib/ia/observation-devoir";
import { estHtmlRiche } from "@/lib/lms";
import { sanitiserHtmlRiche } from "@/lib/html-riche";

/** Sanitise une valeur d'éditeur riche (HTML) ; laisse le texte brut hérité intact. */
const richePropre = (v: string): string => (estHtmlRiche(v) ? sanitiserHtmlRiche(v) : v);
import type { EtatLms } from "./actions";

const BASE = "/app/aide-formation";
const TAILLE_MAX_FICHIER = 8 * 1024 * 1024; // 8 Mo
const TEXTE_MAX = 100_000; // borne des dépôts texte (chemins exposés aux apprenants)

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) != null;
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

/** Un utilisateur peut corriger les devoirs d'un cours s'il est admin OU tuteur désigné du cours. */
async function peutCorriger(utilisateurId: string, roleReel: string, coursId: string): Promise<boolean> {
  if (roleReel === "admin") return true;
  const t = await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId, utilisateurId } }, select: { id: true } });
  return !!t;
}

// ── Réglages du devoir (admin) ──────────────────────────────

export async function enregistrerReglagesDevoir(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const moduleId = str(fd, "moduleId");
  const coursId = str(fd, "coursId");
  if (!moduleId) return { ok: false, message: "Leçon introuvable." };
  let accepteTexte = bool(fd, "accepteTexte");
  const accepteFichier = bool(fd, "accepteFichier");
  if (!accepteTexte && !accepteFichier) accepteTexte = true; // au moins un mode de dépôt
  const dateLimiteRaw = str(fd, "dateLimite");
  const dateLimite = dateLimiteRaw ? new Date(dateLimiteRaw) : null;
  const data = {
    consigne: richePropre(str(fd, "consigne")) || null,
    accepteTexte,
    accepteFichier,
    noteSur: Math.max(1, numOuNull(fd, "noteSur") ?? 20),
    dateLimite: dateLimite && !isNaN(dateLimite.getTime()) ? dateLimite : null,
  };
  try {
    await prisma.devoir.upsert({ where: { moduleId }, create: { moduleId, ...data }, update: data });
    if (coursId) revalidatePath(`${BASE}/gestion/cours/${coursId}/devoir/${moduleId}`);
  } catch (e) {
    console.error("[lms] réglages devoir :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Devoir enregistré." };
}

// ── Tuteurs d'un cours (admin) ──────────────────────────────

export async function ajouterTuteur(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const coursId = str(fd, "coursId");
  const email = str(fd, "email").toLowerCase();
  if (!coursId || !email) return { ok: false, message: "E-mail requis." };
  try {
    const u = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
    if (!u) return { ok: false, message: "Aucun compte avec cet e-mail." };
    const deja = await prisma.tuteurCours.findUnique({ where: { coursId_utilisateurId: { coursId, utilisateurId: u.id } }, select: { id: true } });
    if (deja) return { ok: false, message: "Déjà tuteur de ce cours." };
    await prisma.tuteurCours.create({ data: { coursId, utilisateurId: u.id } });
    revalidatePath(`${BASE}/gestion/cours/${coursId}`);
  } catch (e) {
    console.error("[lms] ajout tuteur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Tuteur ajouté." };
}

export async function retirerTuteur(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const t = await prisma.tuteurCours.findUnique({ where: { id }, select: { coursId: true } });
    await prisma.tuteurCours.delete({ where: { id } });
    if (t) revalidatePath(`${BASE}/gestion/cours/${t.coursId}`);
  } catch (e) {
    console.error("[lms] retrait tuteur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Tuteur retiré." };
}

// ── Dépôt (apprenant) ───────────────────────────────────────

export async function soumettreDevoir(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu (lecture seule)." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const moduleId = str(fd, "moduleId");
  const devoir = await prisma.devoir.findUnique({ where: { moduleId }, select: { id: true, accepteTexte: true, accepteFichier: true, module: { select: { coursId: true, cours: { select: { statut: true } } } } } });
  if (!devoir) return { ok: false, message: "Devoir introuvable." };
  // Pas de dépôt / auto-inscription sur un cours non publié (sauf admin) — cohérent avec sinscrireCours.
  if (devoir.module.cours.statut !== "publie" && u.roleReel !== "admin") return { ok: false, message: "Cours indisponible." };
  if (!(await moduleEstDebloque(u.id, devoir.module.coursId, moduleId))) return { ok: false, message: "Terminez d'abord les leçons précédentes (progression séquentielle)." };
  const texteBrut = str(fd, "texte");
  if (texteBrut.length > TEXTE_MAX) return { ok: false, message: "Votre dépôt texte est trop long (max 100 000 caractères)." };
  const texte = devoir.accepteTexte ? (richePropre(texteBrut) || null) : null; // n'accepte le texte que si autorisé (sanitisé)

  let fichierUrl: string | undefined;
  let fichierNom: string | undefined;
  try {
    const existante = await prisma.soumissionDevoir.findUnique({ where: { devoirId_utilisateurId: { devoirId: devoir.id, utilisateurId: u.id } }, select: { fichierUrl: true } });

    const fichier = fd.get("fichier");
    if (devoir.accepteFichier && fichier instanceof File && fichier.size > 0) {
      if (fichier.size > TAILLE_MAX_FICHIER) return { ok: false, message: "Fichier trop volumineux (max 8 Mo)." };
      const blob = await put(`lms/devoirs/${devoir.id}/${u.id}-${fichier.name}`, fichier, { access: "public", addRandomSuffix: true });
      fichierUrl = blob.url;
      fichierNom = fichier.name;
    }
    // Refuse un dépôt vide (n'efface pas une correction existante sans nouveau contenu).
    if (!texte && !fichierUrl) return { ok: false, message: "Ajoutez un texte ou un fichier." };

    // Nouveau dépôt : réinitialise la correction (nouvelle version à corriger).
    await prisma.soumissionDevoir.upsert({
      where: { devoirId_utilisateurId: { devoirId: devoir.id, utilisateurId: u.id } },
      create: { devoirId: devoir.id, utilisateurId: u.id, texte, fichierUrl, fichierNom, statut: "soumis" },
      update: {
        texte,
        ...(fichierUrl ? { fichierUrl, fichierNom } : {}),
        statut: "soumis", note: null, appreciation: null, correcteurId: null, dateCorrection: null, dateSoumission: new Date(),
      },
    });

    // Nettoie l'ancien fichier remplacé (fuite de stockage Blob) — best-effort.
    if (fichierUrl && existante?.fichierUrl && existante.fichierUrl !== fichierUrl) {
      await del(existante.fichierUrl).catch(() => {});
    }

    // Le dépôt valide la leçon et fait avancer la progression du cours.
    const insc = await prisma.inscriptionCours.upsert({
      where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: devoir.module.coursId } },
      create: { utilisateurId: u.id, coursId: devoir.module.coursId },
      update: { derniereActivite: new Date() },
      select: { id: true },
    });
    await prisma.progressionModule.upsert({
      where: { inscriptionId_moduleId: { inscriptionId: insc.id, moduleId } },
      create: { inscriptionId: insc.id, moduleId, termine: true, dateCompletion: new Date() },
      update: { termine: true, dateCompletion: new Date() },
    });
    await appliquerCompletionCours(insc.id, devoir.module.coursId);
    await recalculerParcoursPourCours(u.id, devoir.module.coursId).catch((e) => console.error("[lms] recalcul parcours :", e));

    revalidatePath(`${BASE}/guides`);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] soumission devoir :", e);
    return { ok: false, message: "Erreur technique pendant le dépôt." };
  }
  return { ok: true, message: "Devoir déposé. Un tuteur le corrigera." };
}

// ── Correction (tuteur / admin) ─────────────────────────────

export async function corrigerSoumission(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu (lecture seule)." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const id = str(fd, "id");
  const soum = await prisma.soumissionDevoir.findUnique({ where: { id }, select: { devoir: { select: { noteSur: true, module: { select: { coursId: true } } } } } });
  if (!soum) return { ok: false, message: "Soumission introuvable." };
  if (!(await peutCorriger(u.id, u.roleReel, soum.devoir.module.coursId))) return { ok: false, message: "Vous n'êtes pas tuteur de ce cours." };

  const noteRaw = numOuNull(fd, "note");
  const note = noteRaw === null ? null : Math.min(soum.devoir.noteSur, noteRaw);
  const appreciation = richePropre(str(fd, "appreciation")) || null;
  try {
    await prisma.soumissionDevoir.update({
      where: { id },
      data: { note, appreciation, statut: "corrige", correcteurId: u.id, dateCorrection: new Date() },
    });
    revalidatePath(`${BASE}/corrections`);
    revalidatePath(`${BASE}/guides`);
  } catch (e) {
    console.error("[lms] correction devoir :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Correction enregistrée." };
}

/** Propose une observation IA (ou repli local) pour aider le tuteur — toujours éditable ensuite. */
export async function suggererObservation(soumissionId: string): Promise<{ ok: boolean; texte?: string; note?: number | null; source?: "ia" | "repli"; message?: string }> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  if (u.accesRestreint) return { ok: false, message: "Votre demande de rôle est en attente : accès limité." };
  const soum = await prisma.soumissionDevoir.findUnique({
    where: { id: soumissionId },
    select: { texte: true, note: true, devoir: { select: { consigne: true, noteSur: true, module: { select: { coursId: true } } } } },
  });
  if (!soum) return { ok: false, message: "Soumission introuvable." };
  if (!(await peutCorriger(u.id, u.roleReel, soum.devoir.module.coursId))) return { ok: false, message: "Non autorisé." };
  const { texte, note, source } = await suggererObservationDevoir({
    consigne: soum.devoir.consigne ?? "",
    texteApprenant: soum.texte ?? "",
    note: soum.note,
    noteSur: soum.devoir.noteSur,
  });
  return { ok: true, texte, note, source };
}
