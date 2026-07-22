"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { creerNotifications } from "@/lib/notifications/creer";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { creneauxHoraires } from "@/lib/emploi-du-temps/horaires";
import {
  correspondSpecialites,
  estEncadreurPedagogique,
  lireSpecialites,
} from "@/lib/inspection/specialites";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/inspection/visites";
const TYPES = ["classe", "etablissement", "suivi"] as const;
const MODALITES = ["programmee", "inopinee"] as const;
const STATUTS_VISITE = ["planifiee", "realisee", "annulee"] as const;
const PRIORITES = ["basse", "moyenne", "haute"] as const;
const STATUTS_RECO = ["ouverte", "en_cours", "traitee"] as const;

type TypeVisite = (typeof TYPES)[number];
type Modalite = (typeof MODALITES)[number];
type StatutVisite = (typeof STATUTS_VISITE)[number];
type Priorite = (typeof PRIORITES)[number];
type StatutReco = (typeof STATUTS_RECO)[number];

/**
 * Inspecteur, Conseiller Pédagogique (établissements couverts par son antenne), ACE (visites
 * de classe pour évaluer l'exercice professionnel des enseignants de SON établissement) ou
 * admin, hors mode aperçu.
 */
function peutInspecter(u: UtilisateurCourant): boolean {
  return (
    !u.apercuActif &&
    (u.roleReel === "admin" ||
      u.roleReel === "inspecteur" ||
      u.roleReel === "conseiller_pedagogique" ||
      u.roleReel === "adjoint_chef_etablissement")
  );
}

/** L'établissement est-il dans le périmètre de l'utilisateur ? (refusé par défaut) */
async function etablissementAccessible(u: UtilisateurCourant, etabId: string): Promise<boolean> {
  if (u.roleReel === "admin") return true;
  // L'ACE visite les classes de SON établissement uniquement.
  if (u.roleReel === "adjoint_chef_etablissement") return etabId === u.portee.etablissementId;
  // Conseiller pédagogique : UNIQUEMENT les établissements COUVERTS par son antenne
  // (CouvertureApfc) — fail-closed : sans antenne ou sans couverture, aucun accès.
  if (u.roleReel === "conseiller_pedagogique") {
    if (!u.portee.apfcId) return false;
    const couverture = await prisma.couvertureApfc.findUnique({
      where: { etablissementId: etabId },
      select: { apfcId: true },
    });
    return couverture?.apfcId === u.portee.apfcId;
  }
  // Inspecteur : sa région (périmètre inchangé).
  const etab = await prisma.etablissement.findUnique({
    where: { id: etabId },
    select: { regionId: true },
  });
  if (!etab) return false;
  return etab.regionId != null && etab.regionId === u.portee.regionId;
}

/** Peut gérer cette visite : admin, ou inspecteur/conseiller/ACE propriétaire. */
async function peutGererVisite(u: UtilisateurCourant, visiteId: string): Promise<boolean> {
  if (u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  if (
    u.roleReel !== "inspecteur" &&
    u.roleReel !== "conseiller_pedagogique" &&
    u.roleReel !== "adjoint_chef_etablissement"
  )
    return false;
  const v = await prisma.visite.findUnique({ where: { id: visiteId }, select: { inspecteurId: true } });
  return v?.inspecteurId === u.id;
}

function normaliserDate(valeur: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const d = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Contexte du formulaire « Planifier une visite » (types classe / suivi) ──

export interface OptionEnseignant {
  id: string;
  /** « Prénoms NOM — Spécialité(s) » (disciplines CompetenceEnseignant jointes par « / »). */
  libelle: string;
}

export interface ContexteVisite {
  ok: boolean;
  message?: string;
  enseignants: OptionEnseignant[];
  classes: { id: string; nom: string }[];
  /** Vrai si la liste d'enseignants est RESTREINTE aux spécialités de l'encadreur. */
  restreinte: boolean;
  /** Spécialités de l'encadreur ayant servi à la restriction (affichage). */
  specialites: string[];
  /** Vrai si l'encadreur (inspecteur/conseiller) n'a AUCUNE spécialité renseignée → aide Mon Profil. */
  sansSpecialite: boolean;
}

const CONTEXTE_VIDE = {
  enseignants: [] as OptionEnseignant[],
  classes: [] as { id: string; nom: string }[],
  restreinte: false,
  specialites: [] as string[],
  sansSpecialite: false,
};

/**
 * Enseignants et classes de l'établissement choisi, pour les visites de classe / de suivi.
 * La liste des enseignants est RESTREINTE à ceux dont une spécialité (CompetenceEnseignant)
 * correspond à l'une des spécialités de l'INSPECTEUR / CONSEILLER courant ; sans spécialité
 * renseignée, pas de restriction (et l'interface invite à compléter Mon Profil).
 */
export async function chargerContexteVisite(etablissementId: string): Promise<ContexteVisite> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée.", ...CONTEXTE_VIDE };
  if (!peutInspecter(u)) return { ok: false, message: "Action non autorisée.", ...CONTEXTE_VIDE };
  if (!etablissementId || !(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre.", ...CONTEXTE_VIDE };
  }

  try {
    const [comptes, classes, moi] = await Promise.all([
      prisma.utilisateur.findMany({
        where: {
          roleActif: { nomTechnique: "enseignant" },
          OR: [
            { etablissementId },
            { etablissementsSecondaires: { some: { etablissementId } } },
          ],
        },
        orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
        select: {
          id: true,
          prenoms: true,
          nom: true,
          email: true,
          competences: {
            where: { etablissementId },
            select: { discipline: { select: { nom: true } } },
          },
        },
      }),
      prisma.classe.findMany({
        where: { etablissementId },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      prisma.utilisateur.findUnique({ where: { id: u.id }, select: { specialites: true } }),
    ]);

    const encadreur = estEncadreurPedagogique(u.roleReel);
    const specialites = encadreur ? lireSpecialites(moi?.specialites) : [];
    const restreinte = specialites.length > 0;
    const retenus = restreinte
      ? comptes.filter((c) =>
          correspondSpecialites(c.competences.map((k) => k.discipline.nom), specialites),
        )
      : comptes;

    return {
      ok: true,
      enseignants: retenus.map((c) => {
        const nom = [c.prenoms, c.nom].filter(Boolean).join(" ") || c.email;
        const disciplines = [...new Set(c.competences.map((k) => k.discipline.nom))];
        return { id: c.id, libelle: disciplines.length > 0 ? `${nom} — ${disciplines.join(" / ")}` : nom };
      }),
      classes,
      restreinte,
      specialites,
      sansSpecialite: encadreur && specialites.length === 0,
    };
  } catch (e) {
    console.error("[inspection] contexte visite :", e);
    return { ok: false, message: "Erreur technique.", ...CONTEXTE_VIDE };
  }
}

export interface CreneauEdtVisite {
  jour: number; // 0 = lundi … 5 = samedi
  periode: number;
  /** « 07h30 - 08h25 » (horaires réels de l'établissement) ou « P1 » en repli. */
  heure: string;
  classeId: string;
  classeNom: string;
  disciplineNom: string;
}

export interface EdtEnseignantVisite {
  ok: boolean;
  message?: string;
  creneaux: CreneauEdtVisite[];
}

/**
 * Emploi du temps HEBDOMADAIRE de l'enseignant dans l'établissement choisi : aide
 * l'encadreur à cibler la séance à visiter (un clic sur un créneau renseigne la classe
 * et l'heure de séance du formulaire).
 */
export async function chargerEdtEnseignantVisite(
  etablissementId: string,
  enseignantId: string,
): Promise<EdtEnseignantVisite> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée.", creneaux: [] };
  if (!peutInspecter(u)) return { ok: false, message: "Action non autorisée.", creneaux: [] };
  if (!etablissementId || !enseignantId || !(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre.", creneaux: [] };
  }

  try {
    const [creneaux, etab] = await Promise.all([
      prisma.creneau.findMany({
        where: { etablissementId, enseignantId },
        orderBy: [{ jour: "asc" }, { periode: "asc" }],
        select: { jour: true, periode: true, classeId: true, classeNom: true, disciplineNom: true },
      }),
      prisma.etablissement.findUnique({
        where: { id: etablissementId },
        select: {
          creneauxParJour: true,
          horaireDebutMatin: true,
          horairePauseMatinDebut: true,
          horairePauseMatinFin: true,
          horairePauseMidiDebut: true,
          horaireRepriseApresMidi: true,
          horaireFinJournee: true,
        },
      }),
    ]);
    const horaires = etab ? creneauxHoraires(etab) : null;
    return {
      ok: true,
      creneaux: creneaux.map((c) => ({
        jour: c.jour,
        periode: c.periode,
        heure: horaires?.[c.periode]
          ? `${horaires[c.periode].debut} - ${horaires[c.periode].fin}`
          : `P${c.periode + 1}`,
        classeId: c.classeId,
        classeNom: c.classeNom,
        disciplineNom: c.disciplineNom,
      })),
    };
  } catch (e) {
    console.error("[inspection] EDT enseignant :", e);
    return { ok: false, message: "Erreur technique.", creneaux: [] };
  }
}

export async function creerVisite(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutInspecter(u)) return { ok: false, message: "Action réservée aux inspecteurs (ou mode aperçu)." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const etablissementId = String(formData.get("etablissementId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "").trim() || null;
  const classeId = String(formData.get("classeId") ?? "").trim() || null;
  const dateStr = String(formData.get("date") ?? "");
  const heureSeance = String(formData.get("heureSeance") ?? "").trim().slice(0, 40) || null;
  const type = String(formData.get("type") ?? "classe") as TypeVisite;
  const modalite = String(formData.get("modalite") ?? "programmee") as Modalite;
  const objet = String(formData.get("objet") ?? "").trim();
  const date = normaliserDate(dateStr);

  if (!etablissementId || !date) return { ok: false, message: "Établissement ou date invalide." };
  if (!objet) return { ok: false, message: "L'objet de la visite est obligatoire." };
  if (!TYPES.includes(type)) return { ok: false, message: "Type de visite invalide." };
  if (!MODALITES.includes(modalite)) return { ok: false, message: "Modalité invalide." };
  if (!(await etablissementAccessible(u, etablissementId))) {
    return { ok: false, message: "Établissement hors de votre périmètre." };
  }

  // Types classe / suivi : l'enseignant ET la classe (objet de la visite) sont obligatoires.
  if (type === "classe" || type === "suivi") {
    if (!enseignantId) return { ok: false, message: "Choisissez l'enseignant à visiter." };
    if (!classeId) return { ok: false, message: "Choisissez la classe (objet de la visite)." };
  }

  try {
    // Ne jamais faire confiance au client : l'enseignant et la classe doivent APPARTENIR
    // à l'établissement choisi (principal ou rattachement secondaire pour l'enseignant).
    if (enseignantId) {
      const ens = await prisma.utilisateur.findFirst({
        where: {
          id: enseignantId,
          roleActif: { nomTechnique: "enseignant" },
          OR: [
            { etablissementId },
            { etablissementsSecondaires: { some: { etablissementId } } },
          ],
        },
        select: { id: true },
      });
      if (!ens) return { ok: false, message: "Cet enseignant n'appartient pas à l'établissement choisi." };
    }
    let classeNom: string | null = null;
    if (classeId) {
      const classe = await prisma.classe.findFirst({
        where: { id: classeId, etablissementId },
        select: { nom: true },
      });
      if (!classe) return { ok: false, message: "Cette classe n'appartient pas à l'établissement choisi." };
      classeNom = classe.nom;
    }

    await prisma.visite.create({
      data: {
        inspecteurId: u.id,
        etablissementId,
        enseignantId,
        classeId,
        classeNom,
        date,
        heureSeance,
        type,
        modalite,
        objet,
      },
    });

    // Notification UNIQUEMENT pour une visite PROGRAMMÉE (annoncée) : la direction de
    // l'établissement (chef ET adjoint — l'ACE seconde le chef) et l'enseignant concerné
    // sont prévenus. Une visite INOPINÉE n'envoie AUCUNE notification à l'établissement —
    // l'effet de surprise en est le principe.
    if (modalite === "programmee") {
      const chefs = await prisma.utilisateur.findMany({
        where: {
          etablissementId,
          roleActif: { nomTechnique: { in: ["chef_etablissement", "adjoint_chef_etablissement"] } },
        },
        select: { id: true },
      });
      const destinataires = [
        ...chefs.map((c) => c.id),
        ...(enseignantId ? [enseignantId] : []),
      ].filter((id, i, tous) => tous.indexOf(id) === i);
      await creerNotifications(destinataires, {
        type: "info",
        titre: "Visite d'inspection planifiée",
        message: `Une visite (${objet}) est planifiée dans votre établissement le ${dateStr}${heureSeance ? ` (${heureSeance})` : ""}.`,
        lien: BASE,
      });
    }
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] création visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Visite planifiée." };
}

export async function changerStatutVisite(visiteId: string, statut: StatutVisite): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!STATUTS_VISITE.includes(statut)) return { ok: false, message: "Statut invalide." };
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  try {
    await prisma.visite.update({ where: { id: visiteId }, data: { statut } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] statut visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

export async function enregistrerCompteRendu(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const visiteId = String(formData.get("visiteId") ?? "");
  const observations = String(formData.get("observations") ?? "").trim() || null;
  const noteBrute = String(formData.get("noteGlobale") ?? "").trim();
  const noteGlobale = noteBrute === "" ? null : Math.min(20, Math.max(0, Number(noteBrute)));
  if (noteBrute !== "" && Number.isNaN(Number(noteBrute))) {
    return { ok: false, message: "Note invalide." };
  }
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  try {
    await prisma.visite.update({
      where: { id: visiteId },
      data: { observations, noteGlobale, statut: "realisee" },
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] compte-rendu :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Compte-rendu enregistré." };
}

export async function ajouterRecommandation(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const visiteId = String(formData.get("visiteId") ?? "");
  const texte = String(formData.get("texte") ?? "").trim();
  const priorite = String(formData.get("priorite") ?? "moyenne") as Priorite;
  if (!texte) return { ok: false, message: "Le texte de la recommandation est obligatoire." };
  if (!PRIORITES.includes(priorite)) return { ok: false, message: "Priorité invalide." };
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  try {
    await prisma.recommandation.create({ data: { visiteId, texte, priorite } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] ajout recommandation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Recommandation ajoutée." };
}

export async function changerStatutRecommandation(recoId: string, statut: StatutReco): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!STATUTS_RECO.includes(statut)) return { ok: false, message: "Statut invalide." };
  const reco = await prisma.recommandation.findUnique({
    where: { id: recoId },
    select: { visiteId: true },
  });
  if (!reco) return { ok: false, message: "Recommandation introuvable." };
  if (!(await peutGererVisite(u, reco.visiteId))) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  try {
    await prisma.recommandation.update({ where: { id: recoId }, data: { statut } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] statut recommandation :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true };
}

export async function supprimerVisite(visiteId: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!(await peutGererVisite(u, visiteId))) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  try {
    await prisma.visite.delete({ where: { id: visiteId } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[inspection] suppression visite :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Visite supprimée." };
}
