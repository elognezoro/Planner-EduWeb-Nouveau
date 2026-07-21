"use server";

/**
 * STAGES PRATIQUES CAFOP — actions serveur.
 *
 * Règles d'accès (vérifiées ICI, côté serveur — jamais seulement masquées en UI) :
 *  - DIRECTION du CAFOP = admin système, Directeur (cafop_admin de SON centre), ADC de SON
 *    centre, Super Admin CAFOP (pays du centre). C'est la SEULE exception d'écriture de
 *    l'ADC (partout ailleurs il reste en lecture seule) : le cahier des charges des stages
 *    confie explicitement au Directeur OU à l'ADC l'attribution des stagiaires et
 *    l'autorisation des modifications de notes.
 *  - MAÎTRE D'APPLICATION (rôle maitre_application, rattaché au CAFOP) : n'agit QUE sur les
 *    stagiaires qui lui sont ATTRIBUÉS (AttributionStagiaire) — présences, dialogue, grille
 *    d'évaluation. Toute MODIFICATION d'une évaluation existante passe par une demande
 *    motivée, autorisée par la direction (traçabilité complète).
 */

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
import { creerNotification } from "@/lib/notifications/creer";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const cheminStages = (cafopId: string) => `/app/systeme/cafop/${cafopId}/stages`;
const CHEMIN_MAITRE = "/app/systeme/cafop/stages";

const nomComplet = (u: { prenoms: string | null; nom: string | null; email: string }) =>
  [u.prenoms, u.nom].filter(Boolean).join(" ").trim() || u.email;

async function journaliser(acteur: UtilisateurCourant, action: string, cible: string, details: Prisma.InputJsonValue) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: acteur.id, acteurEmail: acteur.email, action, cible, details },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

/** DIRECTION des stages d'un CAFOP : admin, Directeur (cafop_admin), ADC, Super Admin CAFOP
 *  (pays), ou superviseur international (tous pays). */
export async function estDirectionStages(u: UtilisateurCourant, cafopId: string | null): Promise<boolean> {
  if (u.apercuActif || !cafopId) return false;
  if (u.roleReel === "admin" || u.roleReel === "superviseur_international") return true;
  if (u.roleReel === "cafop_admin" || u.roleReel === "adc") return u.portee.cafopId === cafopId;
  if (u.roleReel === "super_admin_cafop") {
    const c = await prisma.cafop.findUnique({ where: { id: cafopId }, select: { pays: true } });
    return ecritureNationaleAutorisee(u, "super_admin_cafop", c?.pays);
  }
  return false;
}

/** Maître d'application rattaché à CE CAFOP (hors aperçu). */
function estMaitreDuCafop(u: UtilisateurCourant, cafopId: string | null): boolean {
  return !u.apercuActif && !!cafopId && u.roleReel === "maitre_application" && u.portee.cafopId === cafopId;
}

/** Le stagiaire est-il ATTRIBUÉ à ce maître d'application ? (cloisonnement serveur). */
async function stagiaireAttribueAuMaitre(maitreId: string, apprenantId: string): Promise<boolean> {
  const a = await prisma.attributionStagiaire.findUnique({
    where: { maitreId_apprenantId: { maitreId, apprenantId } },
    select: { id: true },
  });
  return Boolean(a);
}

async function cafopDeApprenant(apprenantId: string): Promise<string | null> {
  const a = await prisma.apprenant.findUnique({
    where: { id: apprenantId },
    select: { cohorte: { select: { cafopId: true } } },
  });
  return a?.cohorte.cafopId ?? null;
}

/** Comptes de la DIRECTION du centre (Directeur + ADC) — destinataires des notifications. */
async function comptesDirection(cafopId: string): Promise<string[]> {
  const l = await prisma.utilisateur.findMany({
    where: { cafopId, roleActif: { nomTechnique: { in: ["cafop_admin", "adc"] } }, statutCompte: "actif" },
    select: { id: true },
  });
  return l.map((x) => x.id);
}

// ─────────────────────────────────────────────────────────────
//  Attribution des stagiaires aux maîtres d'application
// ─────────────────────────────────────────────────────────────

/** Attribue un ou plusieurs stagiaires à un maître d'application (Directeur / ADC). */
export async function attribuerStagiaires(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  if (!(await estDirectionStages(u, cafopId))) return { ok: false, message: "Action réservée au Directeur du CAFOP ou à l'ADC." };

  const maitreId = String(formData.get("maitreId") ?? "").trim();
  const annee = Math.min(3, Math.max(1, Number(formData.get("annee") ?? 1) || 1));
  const moduleId = String(formData.get("moduleId") ?? "").trim() || null;
  const apprenantIds = formData.getAll("apprenantIds").map((x) => String(x).trim()).filter(Boolean);
  if (!maitreId || apprenantIds.length === 0) return { ok: false, message: "Choisissez un maître d'application et au moins un stagiaire." };

  // Le maître doit être un compte « maitre_application » DE CE CAFOP.
  const maitre = await prisma.utilisateur.findFirst({
    where: { id: maitreId, cafopId, roleActif: { nomTechnique: "maitre_application" } },
    select: { id: true, prenoms: true, nom: true, email: true },
  });
  if (!maitre) return { ok: false, message: "Ce compte n'est pas un maître d'application de ce centre." };

  // Les stagiaires doivent appartenir à une cohorte DE CE CAFOP.
  const apprenants = await prisma.apprenant.findMany({
    where: { id: { in: apprenantIds }, cohorte: { cafopId } },
    select: { id: true },
  });
  if (apprenants.length === 0) return { ok: false, message: "Aucun stagiaire valide pour ce centre." };
  if (moduleId) {
    const m = await prisma.moduleCafop.findFirst({ where: { id: moduleId, estStage: true }, select: { id: true } });
    if (!m) return { ok: false, message: "Le stage choisi est introuvable." };
  }

  try {
    const r = await prisma.attributionStagiaire.createMany({
      data: apprenants.map((a) => ({ cafopId, annee, maitreId, apprenantId: a.id, moduleId, attribueParId: u.id })),
      skipDuplicates: true,
    });
    await journaliser(u, "stage.attribution", `Utilisateur:${maitreId}`, { cafopId, annee, apprenants: apprenants.map((a) => a.id), moduleId });
    await creerNotification({
      destinataireId: maitreId,
      type: "info",
      titre: "Stagiaires attribués",
      message: `${r.count} stagiaire(s) de ${annee}ᵉ année vous ont été attribués pour le suivi de stage.`,
      lien: CHEMIN_MAITRE,
    });
    revalidatePath(cheminStages(cafopId));
    return { ok: true, message: `${r.count} attribution(s) enregistrée(s) pour ${nomComplet(maitre)}.` };
  } catch (e) {
    console.error("[stages] attribution :", e);
    return { ok: false, message: "Erreur technique lors de l'attribution." };
  }
}

/** Retire une attribution (Directeur / ADC). */
export async function retirerAttribution(id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const attr = await prisma.attributionStagiaire.findUnique({ where: { id }, select: { cafopId: true, maitreId: true, apprenantId: true } });
  if (!attr) return { ok: false, message: "Attribution introuvable." };
  if (!(await estDirectionStages(u, attr.cafopId))) return { ok: false, message: "Action réservée au Directeur du CAFOP ou à l'ADC." };
  await prisma.attributionStagiaire.delete({ where: { id } });
  await journaliser(u, "stage.attribution_retiree", `Apprenant:${attr.apprenantId}`, { cafopId: attr.cafopId, maitreId: attr.maitreId });
  revalidatePath(cheminStages(attr.cafopId));
  return { ok: true, message: "Attribution retirée." };
}

// ─────────────────────────────────────────────────────────────
//  Boîte de dialogues (administration ↔ maître d'application)
// ─────────────────────────────────────────────────────────────

/** Poste un message dans le fil de suivi d'un stagiaire (direction OU maître attribué). */
export async function posterDialogueStage(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const apprenantId = String(formData.get("apprenantId") ?? "").trim();
  const contenu = String(formData.get("contenu") ?? "").trim();
  if (!apprenantId || !contenu) return { ok: false, message: "Le message est vide." };
  if (contenu.length > 4000) return { ok: false, message: "Message trop long (4 000 caractères max.)." };

  const cafopId = await cafopDeApprenant(apprenantId);
  if (!cafopId) return { ok: false, message: "Stagiaire introuvable." };
  const direction = await estDirectionStages(u, cafopId);
  const maitreAttribue = estMaitreDuCafop(u, cafopId) && (await stagiaireAttribueAuMaitre(u.id, apprenantId));
  if (!direction && !maitreAttribue) return { ok: false, message: "Vous n'êtes pas autorisé sur ce stagiaire." };

  try {
    await prisma.dialogueStage.create({
      data: { cafopId, apprenantId, auteurId: u.id, auteurNom: nomComplet(u), duMaitre: !direction, contenu },
    });
    // Notification à l'autre partie du fil.
    const destinataires = direction
      ? (await prisma.attributionStagiaire.findMany({ where: { apprenantId }, select: { maitreId: true } })).map((a) => a.maitreId)
      : await comptesDirection(cafopId);
    const lien = direction ? CHEMIN_MAITRE : cheminStages(cafopId);
    for (const destinataireId of [...new Set(destinataires)].filter((d) => d !== u.id)) {
      await creerNotification({
        destinataireId,
        type: "info",
        titre: "Suivi de stagiaire : nouveau message",
        message: `${nomComplet(u)} a écrit dans le fil de suivi d'un stagiaire.`,
        lien,
      });
    }
    revalidatePath(cheminStages(cafopId));
    revalidatePath(CHEMIN_MAITRE);
    return { ok: true, message: "Message publié." };
  } catch (e) {
    console.error("[stages] dialogue :", e);
    return { ok: false, message: "Erreur technique lors de la publication." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Visites de classe des professeurs de CAFOP aux stagiaires
// ─────────────────────────────────────────────────────────────

/** Enregistre une visite de classe d'un professeur de CAFOP à un stagiaire (direction). */
export async function enregistrerVisiteStagiaire(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const apprenantId = String(formData.get("apprenantId") ?? "").trim();
  const cafopId = await cafopDeApprenant(apprenantId);
  if (!cafopId) return { ok: false, message: "Stagiaire introuvable." };
  if (!(await estDirectionStages(u, cafopId))) return { ok: false, message: "Action réservée au Directeur du CAFOP ou à l'ADC." };

  const professeur = String(formData.get("professeur") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const date = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : null;
  if (!professeur || !date || Number.isNaN(date.getTime())) return { ok: false, message: "Professeur et date sont obligatoires." };
  const noteBrute = String(formData.get("noteGlobale") ?? "").trim().replace(",", ".");
  const noteGlobale = noteBrute === "" ? null : Number(noteBrute);
  if (noteGlobale !== null && (Number.isNaN(noteGlobale) || noteGlobale < 0 || noteGlobale > 20)) {
    return { ok: false, message: "L'appréciation chiffrée doit être comprise entre 0 et 20." };
  }

  try {
    await prisma.visiteStagiaire.create({
      data: {
        cafopId, apprenantId, professeur, date,
        ecole: String(formData.get("ecole") ?? "").trim() || null,
        objet: String(formData.get("objet") ?? "").trim() || null,
        observations: String(formData.get("observations") ?? "").trim() || null,
        recommandations: String(formData.get("recommandations") ?? "").trim() || null,
        noteGlobale, saisiParId: u.id,
      },
    });
    await journaliser(u, "stage.visite", `Apprenant:${apprenantId}`, { cafopId, professeur, date: dateStr });
    revalidatePath(cheminStages(cafopId));
    revalidatePath(CHEMIN_MAITRE);
    return { ok: true, message: "Visite enregistrée." };
  } catch (e) {
    console.error("[stages] visite :", e);
    return { ok: false, message: "Erreur technique lors de l'enregistrement." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Grilles d'évaluation (prof de CAFOP / maître d'application)
// ─────────────────────────────────────────────────────────────

interface CritereGrille {
  critere: string;
  note: number;
  sur: number;
}

function lireCriteres(formData: FormData): { criteres: CritereGrille[]; noteGlobale: number; sur: number } | null {
  try {
    const brut = JSON.parse(String(formData.get("criteres") ?? "[]")) as unknown;
    if (!Array.isArray(brut) || brut.length === 0) return null;
    const criteres: CritereGrille[] = [];
    for (const c of brut) {
      const critere = String((c as CritereGrille).critere ?? "").trim();
      const note = Number((c as CritereGrille).note);
      const sur = Number((c as CritereGrille).sur) || 20;
      if (!critere || Number.isNaN(note) || note < 0 || note > sur) return null;
      criteres.push({ critere, note, sur });
    }
    const totalSur = criteres.reduce((s, c) => s + c.sur, 0);
    const total = criteres.reduce((s, c) => s + c.note, 0);
    const sur = 20;
    const noteGlobale = totalSur > 0 ? Math.round((total / totalSur) * 20 * 100) / 100 : 0;
    return { criteres, noteGlobale, sur };
  } catch {
    return null;
  }
}

/**
 * Enregistre la grille d'évaluation d'un stagiaire pour un stage.
 *  - PREMIÈRE saisie : direction (grille « prof_cafop ») ou maître attribué (« maitre_application »).
 *  - MODIFICATION d'une grille existante : la direction modifie directement (motif obligatoire,
 *    journalisé) ; le maître d'application doit passer par une DEMANDE motivée, qui n'est
 *    appliquée qu'après AUTORISATION du Directeur ou de l'ADC.
 */
export async function enregistrerEvaluationStage(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const apprenantId = String(formData.get("apprenantId") ?? "").trim();
  const moduleId = String(formData.get("moduleId") ?? "").trim();
  const evaluateurType = String(formData.get("evaluateurType") ?? "").trim();
  if (!["prof_cafop", "maitre_application"].includes(evaluateurType)) return { ok: false, message: "Type d'évaluateur invalide." };

  const cafopId = await cafopDeApprenant(apprenantId);
  if (!cafopId) return { ok: false, message: "Stagiaire introuvable." };
  const direction = await estDirectionStages(u, cafopId);
  const maitreAttribue = estMaitreDuCafop(u, cafopId) && (await stagiaireAttribueAuMaitre(u.id, apprenantId));
  if (evaluateurType === "prof_cafop" && !direction) return { ok: false, message: "La grille du professeur de CAFOP est saisie par la direction du centre." };
  if (evaluateurType === "maitre_application" && !direction && !maitreAttribue) return { ok: false, message: "Vous n'êtes pas le maître d'application de ce stagiaire." };

  const module_ = await prisma.moduleCafop.findFirst({ where: { id: moduleId, estStage: true }, select: { id: true, nom: true } });
  if (!module_) return { ok: false, message: "Stage introuvable." };
  const lu = lireCriteres(formData);
  if (!lu) return { ok: false, message: "Grille invalide : chaque critère doit avoir un intitulé et une note entre 0 et son barème." };
  const appreciation = String(formData.get("appreciation") ?? "").trim() || null;
  const evaluateurNom = String(formData.get("evaluateurNom") ?? "").trim() || nomComplet(u);

  const existante = await prisma.evaluationStage.findUnique({
    where: { apprenantId_moduleId_evaluateurType: { apprenantId, moduleId, evaluateurType } },
    select: { id: true, criteres: true, noteGlobale: true, appreciation: true },
  });

  try {
    if (!existante) {
      await prisma.evaluationStage.create({
        data: {
          cafopId, apprenantId, moduleId, evaluateurType, evaluateurNom,
          criteres: lu.criteres as unknown as Prisma.InputJsonValue,
          noteGlobale: lu.noteGlobale, sur: lu.sur, appreciation, saisiParId: u.id,
        },
      });
      await journaliser(u, "stage.evaluation_creee", `Apprenant:${apprenantId}`, { cafopId, moduleId, evaluateurType, noteGlobale: lu.noteGlobale });
      revalidatePath(cheminStages(cafopId));
      revalidatePath(CHEMIN_MAITRE);
      return { ok: true, message: `Grille enregistrée — note globale ${lu.noteGlobale.toLocaleString("fr-FR")}/20.` };
    }

    // Grille EXISTANTE → gouvernance des modifications.
    const motif = String(formData.get("motif") ?? "").trim();
    if (!motif) return { ok: false, message: "Modification d'une note déjà attribuée : le MOTIF est obligatoire." };
    const valeurAvant = { criteres: existante.criteres, noteGlobale: existante.noteGlobale, appreciation: existante.appreciation };
    const valeurProposee = { criteres: lu.criteres, noteGlobale: lu.noteGlobale, appreciation };

    if (direction) {
      await prisma.evaluationStage.update({
        where: { id: existante.id },
        data: { criteres: lu.criteres as unknown as Prisma.InputJsonValue, noteGlobale: lu.noteGlobale, appreciation, evaluateurNom, saisiParId: u.id },
      });
      await journaliser(u, "stage.evaluation_modifiee", `EvaluationStage:${existante.id}`, { cafopId, motif, valeurAvant, valeurApres: valeurProposee } as unknown as Prisma.InputJsonValue);
      revalidatePath(cheminStages(cafopId));
      revalidatePath(CHEMIN_MAITRE);
      return { ok: true, message: "Grille modifiée (modification tracée au journal)." };
    }

    // Maître d'application : demande d'autorisation au Directeur / à l'ADC.
    const apprenant = await prisma.apprenant.findUnique({ where: { id: apprenantId }, select: { nom: true, prenoms: true } });
    await prisma.demandeModificationCafop.create({
      data: {
        cafopId, type: "evaluation_stage", cibleId: existante.id,
        cibleLibelle: `Grille du maître d'application — ${[apprenant?.prenoms, apprenant?.nom].filter(Boolean).join(" ")} · ${module_.nom}`,
        demandeurId: u.id, demandeurNom: nomComplet(u), motif,
        valeurAvant: valeurAvant as Prisma.InputJsonValue,
        valeurProposee: valeurProposee as unknown as Prisma.InputJsonValue,
      },
    });
    for (const destinataireId of await comptesDirection(cafopId)) {
      await creerNotification({
        destinataireId,
        type: "alerte",
        titre: "Modification de note à autoriser",
        message: `${nomComplet(u)} demande à modifier une grille d'évaluation de stage (motif : ${motif.slice(0, 120)}).`,
        lien: `${cheminStages(cafopId)}?onglet=autorisations`,
      });
    }
    await journaliser(u, "stage.modification_demandee", `EvaluationStage:${existante.id}`, { cafopId, motif });
    return { ok: true, message: "Demande de modification transmise au Directeur / à l'ADC — la note actuelle reste en vigueur jusqu'à autorisation." };
  } catch (e) {
    console.error("[stages] évaluation :", e);
    return { ok: false, message: "Erreur technique lors de l'enregistrement de la grille." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Notes CAFOP (formation théorique) : modification gouvernée
// ─────────────────────────────────────────────────────────────

/** Modifie une note de la formation théorique (direction uniquement, motif obligatoire, journalisé). */
export async function modifierNoteCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const id = String(formData.get("id") ?? "").trim();
  const note = await prisma.noteCafop.findUnique({
    where: { id },
    select: { id: true, valeur: true, bareme: true, type: true, apprenant: { select: { cohorte: { select: { cafopId: true } } } } },
  });
  if (!note) return { ok: false, message: "Note introuvable." };
  const cafopId = note.apprenant.cohorte.cafopId;
  if (!(await estDirectionStages(u, cafopId))) {
    return { ok: false, message: "Toute modification d'une note attribuée requiert l'autorisation du Directeur du CAFOP ou de l'ADC." };
  }
  const motif = String(formData.get("motif") ?? "").trim();
  if (!motif) return { ok: false, message: "Le motif de la modification est obligatoire." };
  const valeur = Number(String(formData.get("valeur") ?? "").replace(",", "."));
  const bareme = Number(String(formData.get("bareme") ?? note.bareme).replace(",", ".")) || note.bareme;
  if (Number.isNaN(valeur) || valeur < 0 || valeur > bareme) return { ok: false, message: `La note doit être comprise entre 0 et ${bareme}.` };

  try {
    await prisma.noteCafop.update({ where: { id }, data: { valeur, bareme, saisiParId: u.id } });
    await journaliser(u, "cafop.note_modifiee", `NoteCafop:${id}`, {
      cafopId: cafopId ?? undefined, motif, avant: { valeur: note.valeur, bareme: note.bareme }, apres: { valeur, bareme },
    });
    if (cafopId) revalidatePath(`/app/systeme/cafop/${cafopId}/notes-bulletins`);
    return { ok: true, message: "Note modifiée (motif tracé au journal d'activité)." };
  } catch (e) {
    console.error("[stages] note modifiée :", e);
    return { ok: false, message: "Erreur technique lors de la modification." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Décision du Directeur / de l'ADC sur une demande de modification
// ─────────────────────────────────────────────────────────────

export async function deciderModificationCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim(); // « autoriser » | « refuser »
  const motifDecision = String(formData.get("motifDecision") ?? "").trim() || null;

  const d = await prisma.demandeModificationCafop.findUnique({ where: { id } });
  if (!d || d.statut !== "en_attente") return { ok: false, message: "Demande introuvable ou déjà traitée." };
  if (!(await estDirectionStages(u, d.cafopId))) return { ok: false, message: "Décision réservée au Directeur du CAFOP ou à l'ADC." };

  try {
    if (decision === "autoriser") {
      // Application de la valeur PROPOSÉE sur la cible, puis clôture de la demande.
      if (d.type === "evaluation_stage") {
        const v = d.valeurProposee as { criteres?: unknown; noteGlobale?: number; appreciation?: string | null };
        await prisma.evaluationStage.update({
          where: { id: d.cibleId },
          data: {
            criteres: (v.criteres ?? []) as Prisma.InputJsonValue,
            noteGlobale: Number(v.noteGlobale ?? 0),
            appreciation: v.appreciation ?? null,
          },
        });
      } else if (d.type === "note_cafop") {
        const v = d.valeurProposee as { valeur?: number; bareme?: number };
        await prisma.noteCafop.update({
          where: { id: d.cibleId },
          data: { valeur: Number(v.valeur ?? 0), ...(v.bareme ? { bareme: Number(v.bareme) } : {}) },
        });
      } else {
        return { ok: false, message: "Type de demande inconnu." };
      }
    } else if (decision !== "refuser") {
      return { ok: false, message: "Décision invalide." };
    }

    await prisma.demandeModificationCafop.update({
      where: { id },
      data: {
        statut: decision === "autoriser" ? "autorisee" : "refusee",
        decideParId: u.id, decideParNom: nomComplet(u), decideLe: new Date(), motifDecision,
      },
    });
    await journaliser(u, `stage.modification_${decision === "autoriser" ? "autorisee" : "refusee"}`, `${d.type}:${d.cibleId}`, {
      cafopId: d.cafopId, demandeId: d.id, demandeurId: d.demandeurId, motifDemande: d.motif, motifDecision,
    });
    await creerNotification({
      destinataireId: d.demandeurId,
      type: decision === "autoriser" ? "succes" : "alerte",
      titre: decision === "autoriser" ? "Modification autorisée" : "Modification refusée",
      message:
        (decision === "autoriser"
          ? "Votre demande de modification a été autorisée et appliquée"
          : "Votre demande de modification a été refusée") +
        (motifDecision ? ` — ${motifDecision}` : "") + ".",
      lien: CHEMIN_MAITRE,
    });
    revalidatePath(cheminStages(d.cafopId));
    revalidatePath(CHEMIN_MAITRE);
    return { ok: true, message: decision === "autoriser" ? "Modification autorisée et appliquée." : "Modification refusée." };
  } catch (e) {
    console.error("[stages] décision :", e);
    return { ok: false, message: "Erreur technique lors de la décision." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Fiche de présence du stagiaire (registre d'appel du stage)
// ─────────────────────────────────────────────────────────────

/**
 * Saisit les présences du jour pour les stagiaires ATTRIBUÉS au maître d'application
 * (la direction du centre peut aussi saisir). Une ligne par stagiaire coché.
 */
export async function saisirPresencesStage(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  const direction = await estDirectionStages(u, cafopId);
  const maitre = estMaitreDuCafop(u, cafopId);
  if (!direction && !maitre) return { ok: false, message: "Action non autorisée." };

  const dateStr = String(formData.get("date") ?? "").trim();
  const date = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : null;
  if (!date || Number.isNaN(date.getTime())) return { ok: false, message: "Date invalide." };
  // Jamais null : la clé d'unicité (apprenant, date, créneau) exige une valeur.
  const heureSeance = String(formData.get("heureSeance") ?? "").trim() || "Journée";
  const moduleId = String(formData.get("moduleId") ?? "").trim() || null;
  const composantes = formData.getAll("composantes").map((x) => String(x).trim()).filter(Boolean);
  const themes = formData.getAll("themes").map((x) => String(x).trim()).filter(Boolean);

  let lignes: { apprenantId: string; statut: string; motif?: string; justifie?: boolean }[];
  try {
    lignes = JSON.parse(String(formData.get("lignes") ?? "[]"));
    if (!Array.isArray(lignes) || lignes.length === 0) throw new Error("vide");
  } catch {
    return { ok: false, message: "Aucune présence à enregistrer." };
  }

  // Cloisonnement : le maître ne peut saisir QUE pour ses stagiaires attribués.
  const autorises = new Set(
    direction
      ? (await prisma.apprenant.findMany({ where: { cohorte: { cafopId } }, select: { id: true } })).map((a) => a.id)
      : (await prisma.attributionStagiaire.findMany({ where: { maitreId: u.id }, select: { apprenantId: true } })).map((a) => a.apprenantId),
  );
  const valides = lignes.filter((l) => autorises.has(l.apprenantId) && ["present", "absent", "retard"].includes(l.statut));
  if (valides.length === 0) return { ok: false, message: "Aucun stagiaire autorisé dans cette saisie." };

  try {
    for (const l of valides) {
      await prisma.presenceCafop.upsert({
        where: { apprenantId_date_heureSeance: { apprenantId: l.apprenantId, date, heureSeance } },
        update: {
          statut: l.statut, motif: l.motif?.trim() || null, justifie: Boolean(l.justifie),
          moduleId, enseignantId: u.id,
          composantes: composantes as unknown as Prisma.InputJsonValue,
          themes: themes as unknown as Prisma.InputJsonValue,
        },
        create: {
          apprenantId: l.apprenantId, date, heureSeance,
          statut: l.statut, motif: l.motif?.trim() || null, justifie: Boolean(l.justifie),
          moduleId, enseignantId: u.id,
          composantes: composantes as unknown as Prisma.InputJsonValue,
          themes: themes as unknown as Prisma.InputJsonValue,
        },
      });
    }
    await journaliser(u, "stage.presences", `Cafop:${cafopId}`, { date: dateStr, heureSeance, nb: valides.length, moduleId });
    revalidatePath(CHEMIN_MAITRE);
    revalidatePath(cheminStages(cafopId));
    return { ok: true, message: `${valides.length} présence(s) enregistrée(s).` };
  } catch (e) {
    console.error("[stages] présences :", e);
    return { ok: false, message: "Erreur technique lors de la saisie des présences." };
  }
}
