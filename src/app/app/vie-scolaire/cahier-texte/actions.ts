"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { creerNotification } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/vie-scolaire/cahier-texte";

/**
 * Peut-on consigner le cahier de texte pour cette classe / discipline ?
 * admin · chef d'établissement du périmètre · enseignant affecté à la discipline dans la classe.
 */
async function peutSaisir(
  u: UtilisateurCourant,
  classeId: string,
  disciplineId: string,
): Promise<boolean> {
  if (u.apercuActif) return false;
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) return false;
  if (u.roleReel === "admin") return true;
  if (
    (u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement") &&
    classe.etablissementId === u.portee.etablissementId
  ) {
    return true;
  }
  if (u.roleReel === "enseignant") {
    const aff = await prisma.affectationEnseignant.findFirst({
      where: { enseignantId: u.id, classeId, disciplineId },
    });
    return Boolean(aff);
  }
  return false;
}

function normaliserDate(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sous-titre hiérarchique de séance (4 niveaux). */
export interface SousTitre {
  niveau: 1 | 2 | 3 | 4;
  texte: string;
}

function lireListe(brut: string): string[] {
  try {
    const l = JSON.parse(brut);
    return Array.isArray(l) ? l.map((x) => String(x).trim().slice(0, 300)).filter(Boolean).slice(0, 30) : [];
  } catch {
    return [];
  }
}

function lireSousTitres(brut: string): SousTitre[] {
  try {
    const l = JSON.parse(brut);
    if (!Array.isArray(l)) return [];
    return l
      .map((x) => ({
        niveau: Math.min(4, Math.max(1, Number(x?.niveau) || 1)) as SousTitre["niveau"],
        texte: String(x?.texte ?? "").trim().slice(0, 200),
      }))
      .filter((x) => x.texte)
      .slice(0, 40);
  } catch {
    return [];
  }
}

/**
 * Création / modification d'une séance complète du cahier de texte
 * (modale « Nouvelle séance » : horaire, titre, amorce, sous-titres à 4 niveaux,
 * résumé, activités, prochaine séance — en brouillon ou publiée).
 */
export async function enregistrerSeance(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const seanceId = String(formData.get("seanceId") ?? "").trim() || null;
  const classeId = String(formData.get("classeId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "").trim() || null;
  const statut = String(formData.get("statut") ?? "publie") === "brouillon" ? "brouillon" : "publie";
  const date = normaliserDate(String(formData.get("date") ?? ""));
  const heureDebut = /^\d{2}:\d{2}$/.test(String(formData.get("heureDebut"))) ? String(formData.get("heureDebut")) : null;
  const dureeBrute = Number(formData.get("dureeMin"));
  const dureeMin = Number.isInteger(dureeBrute) && dureeBrute > 0 && dureeBrute <= 600 ? dureeBrute : null;
  const typeActivite = String(formData.get("typeActivite") ?? "").trim().slice(0, 60) || null;
  const titre = String(formData.get("titre") ?? "").trim().slice(0, 200);
  const amorce = String(formData.get("amorce") ?? "").trim().slice(0, 2000) || null;
  const contenu = String(formData.get("resume") ?? "").trim().slice(0, 4000);
  const sousTitres = lireSousTitres(String(formData.get("sousTitres") ?? "[]"));
  const activitesApprentissage = lireListe(String(formData.get("activitesApprentissage") ?? "[]"));
  const activitesEvaluation = lireListe(String(formData.get("activitesEvaluation") ?? "[]"));
  const prochaineSeanceLe = normaliserDate(String(formData.get("prochaineSeance") ?? ""));

  if (!classeId || !disciplineId || !date) return { ok: false, message: "Classe, matière ou date invalide." };
  if (!titre) return { ok: false, message: "Le titre de la leçon / séance est obligatoire." };
  if (!contenu && statut === "publie") {
    return { ok: false, message: "Le résumé de la séance est obligatoire pour publier (enregistrez en brouillon sinon)." };
  }
  if (!(await peutSaisir(u, classeId, disciplineId))) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }
  // L'enseignant de la séance : un enseignant ne peut consigner que pour lui-même.
  const enseignantFinal = u.roleReel === "enseignant" ? u.id : enseignantId;

  const donnees = {
    classeId,
    disciplineId,
    date,
    statut: statut as "brouillon" | "publie",
    titre,
    heureDebut,
    dureeMin,
    typeActivite,
    amorce,
    contenu: contenu || titre,
    sousTitres: sousTitres as unknown as object[],
    activitesApprentissage,
    activitesEvaluation,
    prochaineSeanceLe,
    enseignantId: enseignantFinal,
  };

  try {
    if (seanceId) {
      const existante = await prisma.cahierTexte.findUnique({
        where: { id: seanceId },
        select: { saisiParId: true, classe: { select: { etablissementId: true } } },
      });
      if (!existante) return { ok: false, message: "Séance introuvable." };
      const autorise =
        u.roleReel === "admin" ||
        ((u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement") && existante.classe.etablissementId === u.portee.etablissementId) ||
        (u.roleReel === "enseignant" && existante.saisiParId === u.id);
      if (!autorise) return { ok: false, message: "Modification non autorisée." };
      await prisma.cahierTexte.update({ where: { id: seanceId }, data: donnees });
    } else {
      await prisma.cahierTexte.create({ data: { ...donnees, saisiParId: u.id } });
    }
    revalidatePath(BASE);
  } catch (e) {
    console.error("[cahier-texte] séance :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return {
    ok: true,
    message: seanceId
      ? statut === "publie" ? "Séance mise à jour et publiée." : "Séance mise à jour (brouillon)."
      : statut === "publie" ? "Séance créée et publiée." : "Séance enregistrée en brouillon.",
  };
}

/** Accorde ou refuse une demande d'accès à une séance (colonne « Demandes d'accès »). */
export async function traiterDemandeAcces(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Mode aperçu : lecture seule." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const demandeId = String(formData.get("demandeId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!demandeId || !["accordee", "refusee"].includes(decision)) return { ok: false, message: "Paramètres invalides." };

  try {
    const demande = await prisma.demandeAccesCahier.findUnique({
      where: { id: demandeId },
      include: {
        cahier: { select: { titre: true, saisiParId: true, classe: { select: { nom: true, etablissementId: true } } } },
      },
    });
    if (!demande || demande.statut !== "en_attente") return { ok: false, message: "Demande introuvable ou déjà traitée." };

    const autorise =
      u.roleReel === "admin" ||
      ((u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement") && demande.cahier.classe.etablissementId === u.portee.etablissementId) ||
      (u.roleReel === "enseignant" && demande.cahier.saisiParId === u.id);
    if (!autorise) return { ok: false, message: "Action non autorisée." };

    await prisma.demandeAccesCahier.update({
      where: { id: demande.id },
      data: { statut: decision as "accordee" | "refusee", traiteLe: new Date() },
    });
    await creerNotification({
      destinataireId: demande.demandeurId,
      type: decision === "accordee" ? "succes" : "alerte",
      titre: decision === "accordee" ? "Accès accordé au cahier de texte" : "Demande d'accès refusée",
      message:
        decision === "accordee"
          ? `Votre accès à la séance « ${demande.cahier.titre ?? "—"} » (${demande.cahier.classe.nom}) a été accordé.`
          : `Votre demande d'accès à la séance « ${demande.cahier.titre ?? "—"} » (${demande.cahier.classe.nom}) n'a pas été retenue.`,
      lien: BASE,
    });
    revalidatePath(BASE);
    return { ok: true, message: decision === "accordee" ? "Accès accordé." : "Demande refusée." };
  } catch (e) {
    console.error("[cahier-texte] demande d'accès :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerEntree(entreeId: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Action non autorisée en mode aperçu." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const entree = await prisma.cahierTexte.findUnique({
    where: { id: entreeId },
    include: { classe: { select: { etablissementId: true } } },
  });
  if (!entree) return { ok: false, message: "Entrée introuvable." };

  const autorise =
    u.roleReel === "admin" ||
    ((u.roleReel === "chef_etablissement" || u.roleReel === "adjoint_chef_etablissement") &&
      entree.classe.etablissementId === u.portee.etablissementId) ||
    (u.roleReel === "enseignant" && entree.saisiParId === u.id);
  if (!autorise) return { ok: false, message: "Suppression non autorisée." };

  try {
    await prisma.cahierTexte.delete({ where: { id: entreeId } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[cahier-texte] suppression :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Entrée supprimée." };
}
