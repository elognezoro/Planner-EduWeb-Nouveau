"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, requireUtilisateur } from "@/lib/auth/session";
import { slugifier, estHtmlRiche } from "@/lib/lms";
import { sanitiserHtmlRiche } from "@/lib/html-riche";
import { recalculerParcoursPourCours, recalculerInscriptionsDuParcours } from "@/lib/lms-parcours";
import { appliquerCompletionCours, recalculerInscriptionsDuCours } from "@/lib/lms-completion";

export type EtatLms = { ok: boolean; message?: string };

const BASE = "/app/aide-formation";
const GESTION = `${BASE}/gestion`;

/** Garde : admin système, hors mode aperçu. */
async function gardeAdmin(): Promise<{ ok: true } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true };
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string): number | null => {
  // Un champ laissé vide vaut « non renseigné » (null), pas 0 — car Number("") === 0.
  const brut = String(fd.get(k) ?? "").trim();
  if (brut === "") return null;
  const v = Number(brut);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
};
const roles = (fd: FormData): string[] => fd.getAll("publicCible").map((v) => String(v)).filter(Boolean);

// ── Catégories ──────────────────────────────────────────────

export async function enregistrerCategorie(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const id = str(fd, "id") || null;
  const nom = str(fd, "nom");
  if (!nom) return { ok: false, message: "Le nom de la catégorie est obligatoire." };
  const data = { nom, description: str(fd, "description") || null, icone: str(fd, "icone") || null, ordre: num(fd, "ordre") ?? 0 };
  try {
    if (id) await prisma.categorieFormation.update({ where: { id }, data });
    else await prisma.categorieFormation.create({ data });
    revalidatePath(GESTION);
  } catch (e) {
    console.error("[lms] catégorie :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Catégorie enregistrée." };
}

export async function supprimerCategorie(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.categorieFormation.delete({ where: { id } });
    revalidatePath(GESTION);
  } catch (e) {
    console.error("[lms] suppr catégorie :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Catégorie supprimée." };
}

// ── Cours ───────────────────────────────────────────────────

async function slugUnique(base: string, exclureId: string | null): Promise<string> {
  const racine = base || "cours";
  let slug = racine;
  let i = 2;
  // Évite les collisions de slug (unique en base).
  while (true) {
    const existe = await prisma.cours.findFirst({ where: { slug, ...(exclureId ? { id: { not: exclureId } } : {}) }, select: { id: true } });
    if (!existe) return slug;
    slug = `${racine}-${i++}`;
  }
}

export async function enregistrerCours(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const id = str(fd, "id") || null;
  const titre = str(fd, "titre");
  if (!titre) return { ok: false, message: "Le titre du cours est obligatoire." };
  const data = {
    titre,
    description: str(fd, "description") || null,
    categorieId: str(fd, "categorieId") || null,
    niveau: str(fd, "niveau") || null,
    publicCible: roles(fd),
    dureeMinutes: num(fd, "dureeMinutes"),
    ordre: num(fd, "ordre") ?? 0,
    seuilCompletion: Math.min(100, Math.max(1, num(fd, "seuilCompletion") ?? 100)),
    attestationSignataire: str(fd, "attestationSignataire") || null,
    attestationFonction: str(fd, "attestationFonction") || null,
    attestationMention: str(fd, "attestationMention") || null,
  };
  try {
    if (id) {
      await prisma.cours.update({ where: { id }, data });
      // Le seuil de complétion a pu changer : resynchronise les inscriptions et parcours existants.
      await recalculerInscriptionsDuCours(id);
    } else {
      const slug = await slugUnique(slugifier(titre), null);
      await prisma.cours.create({ data: { ...data, slug } });
    }
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/guides`);
  } catch (e) {
    console.error("[lms] cours :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Cours enregistré." };
}

/** Publie ou repasse en brouillon un cours. */
export async function basculerPublicationCours(id: string, publier: boolean): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.cours.update({ where: { id }, data: { statut: publier ? "publie" : "brouillon" } });
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/guides`);
  } catch (e) {
    console.error("[lms] publication :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: publier ? "Cours publié." : "Cours repassé en brouillon." };
}

export async function supprimerCours(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    // Nettoyage des fichiers déposés (Vercel Blob) des leçons de ce cours.
    const mods = await prisma.moduleCours.findMany({ where: { coursId: id, fichierUrl: { not: null } }, select: { fichierUrl: true } });
    await Promise.allSettled(mods.map((m) => (m.fichierUrl ? del(m.fichierUrl) : Promise.resolve())));
    // Parcours contenant ce cours (à resynchroniser après suppression : l'étape part en cascade).
    const parcoursAffectes = await prisma.etapeParcours.findMany({ where: { coursId: id }, select: { parcoursId: true } });
    await prisma.cours.delete({ where: { id } });
    for (const p of parcoursAffectes) await recalculerInscriptionsDuParcours(p.parcoursId).catch((e) => console.error("[lms] resync parcours :", e));
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/guides`);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] suppr cours :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Cours supprimé." };
}

// ── Leçons (modules) ────────────────────────────────────────

const TAILLE_MAX_FICHIER = 8 * 1024 * 1024; // 8 Mo

export async function enregistrerModule(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const id = str(fd, "id") || null;
  const coursId = str(fd, "coursId");
  const titre = str(fd, "titre");
  const type = str(fd, "type") || "texte";
  if (!coursId || !titre) return { ok: false, message: "Titre et cours obligatoires." };

  let fichierUrl: string | null | undefined = undefined; // undefined = ne pas toucher
  let fichierNom: string | null | undefined = undefined;
  const fichier = fd.get("fichier");
  if (type === "fichier" && fichier instanceof File && fichier.size > 0) {
    if (fichier.size > TAILLE_MAX_FICHIER) return { ok: false, message: "Fichier trop volumineux (max 8 Mo)." };
    try {
      const blob = await put(`lms/${coursId}/${Date.now()}-${fichier.name}`, fichier, { access: "public" });
      fichierUrl = blob.url;
      fichierNom = fichier.name;
    } catch (e) {
      console.error("[lms] upload fichier :", e);
      return { ok: false, message: "Échec du téléversement du fichier." };
    }
  }

  // Contenu texte issu de l'éditeur riche : sanitisé côté serveur (jamais confiance au client).
  const contenuBrut = str(fd, "contenu");
  const contenu = type === "texte" && estHtmlRiche(contenuBrut) ? sanitiserHtmlRiche(contenuBrut) : contenuBrut;
  const data = {
    coursId,
    titre,
    type,
    contenu: contenu || null,
    ordre: num(fd, "ordre") ?? 0,
    dureeMinutes: num(fd, "dureeMinutes"),
    ...(fichierUrl !== undefined ? { fichierUrl, fichierNom } : {}),
  };
  try {
    let moduleId = id;
    if (id) await prisma.moduleCours.update({ where: { id }, data });
    else {
      const dernier = await prisma.moduleCours.aggregate({ where: { coursId }, _max: { ordre: true } });
      const cree = await prisma.moduleCours.create({ data: { ...data, ordre: (dernier._max.ordre ?? -1) + 1 } });
      moduleId = cree.id;
    }
    // Leçon de type « quiz » : garantit l'existence d'un Quiz rattaché (questions gérées à part).
    if (type === "quiz" && moduleId) {
      await prisma.quiz.upsert({ where: { moduleId }, create: { moduleId }, update: {} });
    }
    // Leçon de type « devoir » : garantit l'existence d'un Devoir rattaché (réglages gérés à part).
    if (type === "devoir" && moduleId) {
      await prisma.devoir.upsert({ where: { moduleId }, create: { moduleId }, update: {} });
    }
    revalidatePath(`${GESTION}/cours/${coursId}`);
    revalidatePath(`${BASE}/guides`);
  } catch (e) {
    console.error("[lms] module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Leçon enregistrée." };
}

export async function supprimerModule(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const m = await prisma.moduleCours.findUnique({ where: { id }, select: { coursId: true, fichierUrl: true } });
    if (m?.fichierUrl) await del(m.fichierUrl).catch(() => {});
    await prisma.moduleCours.delete({ where: { id } });
    if (m) revalidatePath(`${GESTION}/cours/${m.coursId}`);
  } catch (e) {
    console.error("[lms] suppr module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Leçon supprimée." };
}

/** Déplace une leçon vers le haut / bas (échange l'ordre avec sa voisine). */
export async function deplacerModule(id: string, sens: "haut" | "bas"): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    const m = await prisma.moduleCours.findUnique({ where: { id }, select: { id: true, coursId: true, ordre: true } });
    if (!m) return { ok: false, message: "Leçon introuvable." };
    const voisine = await prisma.moduleCours.findFirst({
      where: { coursId: m.coursId, ordre: sens === "haut" ? { lt: m.ordre } : { gt: m.ordre } },
      orderBy: { ordre: sens === "haut" ? "desc" : "asc" },
      select: { id: true, ordre: true },
    });
    if (!voisine) return { ok: true };
    await prisma.$transaction([
      prisma.moduleCours.update({ where: { id: m.id }, data: { ordre: voisine.ordre } }),
      prisma.moduleCours.update({ where: { id: voisine.id }, data: { ordre: m.ordre } }),
    ]);
    revalidatePath(`${GESTION}/cours/${m.coursId}`);
  } catch (e) {
    console.error("[lms] déplacer module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

// ── Sessions de formation ───────────────────────────────────

export async function enregistrerSession(_prev: EtatLms, fd: FormData): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  const id = str(fd, "id") || null;
  const titre = str(fd, "titre");
  const dateStr = str(fd, "dateDebut");
  if (!titre) return { ok: false, message: "Le titre de la session est obligatoire." };
  if (!dateStr) return { ok: false, message: "La date de la session est obligatoire." };
  const dateDebut = new Date(dateStr);
  if (Number.isNaN(dateDebut.getTime())) return { ok: false, message: "Date invalide." };
  const finStr = str(fd, "dateFin");
  let dateFin: Date | null = null;
  if (finStr) {
    dateFin = new Date(finStr);
    if (Number.isNaN(dateFin.getTime())) return { ok: false, message: "Date de fin invalide." };
    if (dateFin < dateDebut) return { ok: false, message: "La date de fin doit être postérieure au début." };
  }
  const data = {
    titre,
    description: str(fd, "description") || null,
    coursIds: fd.getAll("coursIds").map((v) => String(v)).filter(Boolean),
    format: str(fd, "format") || "webinaire",
    animateur: str(fd, "animateur") || null,
    dateDebut,
    dateFin,
    dureeMinutes: num(fd, "dureeMinutes"),
    lienVisio: str(fd, "lienVisio") || null,
    lieu: str(fd, "lieu") || null,
    placesMax: num(fd, "placesMax"),
    publicCible: roles(fd),
    pays: str(fd, "pays") || null,
    statut: str(fd, "statut") || "planifiee",
  };
  try {
    if (id) await prisma.sessionFormation.update({ where: { id }, data });
    else await prisma.sessionFormation.create({ data });
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/formations`);
  } catch (e) {
    console.error("[lms] session :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Session enregistrée." };
}

export async function supprimerSession(id: string): Promise<EtatLms> {
  const g = await gardeAdmin();
  if (!g.ok) return g;
  try {
    await prisma.sessionFormation.delete({ where: { id } });
    revalidatePath(GESTION);
    revalidatePath(`${BASE}/formations`);
  } catch (e) {
    console.error("[lms] suppr session :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Session supprimée." };
}

// ── Apprenant : inscription, progression, sessions ──────────

/** Inscrit l'utilisateur courant à un cours publié (idempotent). */
export async function sinscrireCours(coursId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const cours = await prisma.cours.findFirst({ where: { id: coursId, statut: "publie" }, select: { id: true } });
  if (!cours) return { ok: false, message: "Cours indisponible." };
  try {
    await prisma.inscriptionCours.upsert({
      where: { utilisateurId_coursId: { utilisateurId: u.id, coursId } },
      create: { utilisateurId: u.id, coursId },
      update: { derniereActivite: new Date() },
    });
    revalidatePath(`${BASE}/guides`);
  } catch (e) {
    console.error("[lms] inscription cours :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Inscription enregistrée." };
}

/** Marque une leçon comme terminée / à reprendre et recalcule la progression du cours. */
export async function marquerModule(moduleId: string, termine: boolean): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  const lecon = await prisma.moduleCours.findUnique({ where: { id: moduleId }, select: { coursId: true, type: true } });
  if (!lecon) return { ok: false, message: "Leçon introuvable." };
  // Un quiz / devoir ne se valide QUE par sa réussite ou son dépôt (soumettreQuiz / soumettreDevoir),
  // jamais par un marquage manuel — sinon on contournerait l'exigence des quiz sommatifs.
  if (lecon.type === "quiz" || lecon.type === "devoir") {
    return { ok: false, message: "Cette leçon se valide en réalisant son évaluation, pas manuellement." };
  }
  try {
    const insc = await prisma.inscriptionCours.upsert({
      where: { utilisateurId_coursId: { utilisateurId: u.id, coursId: lecon.coursId } },
      create: { utilisateurId: u.id, coursId: lecon.coursId },
      update: { derniereActivite: new Date() },
      select: { id: true },
    });
    await prisma.progressionModule.upsert({
      where: { inscriptionId_moduleId: { inscriptionId: insc.id, moduleId } },
      create: { inscriptionId: insc.id, moduleId, termine, dateCompletion: termine ? new Date() : null },
      update: { termine, dateCompletion: termine ? new Date() : null },
    });
    // Recalcul de la progression (% de leçons terminées + seuil / quiz sommatifs obligatoires).
    await appliquerCompletionCours(insc.id, lecon.coursId);
    // Répercute sur les parcours de l'apprenant (progression + badge éventuel) — best-effort.
    await recalculerParcoursPourCours(u.id, lecon.coursId).catch((e) => console.error("[lms] recalcul parcours :", e));
    revalidatePath(`${BASE}/guides`);
    revalidatePath(`${BASE}/parcours`);
  } catch (e) {
    console.error("[lms] progression :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

/** Inscrit / désinscrit l'utilisateur courant à une session de formation. */
export async function basculerInscriptionSession(sessionId: string): Promise<EtatLms> {
  const u = await requireUtilisateur();
  if (u.apercuActif) return { ok: false, message: "Action indisponible en mode aperçu." };
  try {
    const existante = await prisma.inscriptionSession.findUnique({
      where: { utilisateurId_sessionId: { utilisateurId: u.id, sessionId } },
      select: { id: true },
    });
    if (existante) {
      await prisma.inscriptionSession.delete({ where: { id: existante.id } });
      revalidatePath(`${BASE}/formations`);
      return { ok: true, message: "Inscription annulée." };
    }
    const session = await prisma.sessionFormation.findFirst({ where: { id: sessionId, statut: "planifiee" }, select: { id: true, placesMax: true } });
    if (!session) return { ok: false, message: "Session indisponible." };
    if (session.placesMax != null && session.placesMax > 0) {
      const nb = await prisma.inscriptionSession.count({ where: { sessionId } });
      if (nb >= session.placesMax) return { ok: false, message: "Session complète." };
    }
    await prisma.inscriptionSession.create({ data: { utilisateurId: u.id, sessionId } });
    revalidatePath(`${BASE}/formations`);
    return { ok: true, message: "Inscription confirmée." };
  } catch (e) {
    console.error("[lms] inscription session :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
