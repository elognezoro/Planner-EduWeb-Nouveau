"use server";

/**
 * Actions serveur du sous-module SCOLARITÉ (06-Scolarite + 05B/02B) : catégories de frais,
 * génération de créances, compte financier de l'élève, exonérations, bourses, plans de
 * paiement, pénalités, avances, remboursements, règles de blocage, relances, clôture/recalcul.
 *
 * TOUTES les écritures : garde RBAC centralisée (commun/rbac), transaction Prisma +
 * journaliserFinance (RM-003/011), annulations logiques (RM-004), verrouillage optimiste
 * (RM-019). Fichier "use server" : uniquement des exports de fonctions async (jamais
 * d'« export type » — cf. commit 29dcefa) ; les types partagés vivent dans scolarite/types.ts.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { creerNotifications } from "@/lib/notifications/creer";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
// Garde UNIQUE du module (97-RBAC RM-2600/2601) : chaque action vérifie sa permission ATOMIQUE.
import { exigerPermissionFinance } from "./commun/rbac";
import { MESSAGE_SEPARATION_RESPONSABILITES, type PermissionFinance } from "./commun/permissions";
import { prochainNumero } from "./commun/numerotation";
import { montantValide, modeValide, pourcentageValide, dateFacultative, texteCourt } from "./commun/validation";
import {
  contextesEleves, creancesAGenerer, creancesOuvertes, fraisApplicable, fraisPourGeneration,
  majStatutCreances,
} from "./scolarite/generation";
import { chargerCompteEleve } from "./scolarite/solde";
import { majStatutFactures } from "./facturation/serveur";
import type { CompteEleveVue } from "./scolarite/types";

const CHEMIN = "/app/vie-scolaire/finances";
const TYPES_BLOCAGE = new Set(["bulletin", "composition", "reinscription", "transport", "cantine"]);
const DECLENCHEURS = new Set(["retard", "echeance", "rejet"]);
const TYPES_PENALITE = new Set(["fixe", "pourcentage", "interet_journalier"]);
const TYPES_BOURSE = new Set(["nationale", "privee", "interne", "prise_en_charge"]);
const JOUR_MS = 86_400_000;

/** Exercice courant de l'établissement (libellé d'année scolaire, repli année civile). */
async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

async function anneeActiveId(): Promise<string | null> {
  const annee = await prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } });
  return annee?.id ?? null;
}

/** Élève actif de CET établissement (cloisonnement du compte financier). */
async function eleveDeLEtablissement(eleveId: string, etablissementId: string) {
  if (!eleveId) return null;
  return prisma.utilisateur.findFirst({
    where: { id: eleveId, etablissementId, roleActif: { nomTechnique: "eleve" } },
    select: { id: true, nom: true, prenoms: true },
  });
}

const nomDe = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

// ─────────────────────────────────────────────────────────────
//  Compte financier de l'élève (lecture)
// ─────────────────────────────────────────────────────────────

/** Compte financier COMPLET d'un élève — lecture (aperçu de rôle autorisé). */
export async function compteFinancierEleve(
  etablissementId: string,
  eleveId: string,
): Promise<{ ok: boolean; message?: string; compte?: CompteEleveVue }> {
  const u = await exigerPermissionFinance(etablissementId, "finance.scolarite.lire");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const eleve = await eleveDeLEtablissement(eleveId, etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  try {
    const exercice = await exerciceDe(etablissementId);
    const compte = await chargerCompteEleve(etablissementId, eleveId, exercice, await anneeActiveId());
    if (!compte) return { ok: false, message: "Élève introuvable dans cet établissement." };
    return { ok: true, compte };
  } catch (e) {
    console.error("[scolarite] compte élève :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Catégories de frais (priorité d'imputation)
// ─────────────────────────────────────────────────────────────

export async function enregistrerCategorie(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.frais.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const nom = texteCourt(fd.get("nom"), 80);
  if (!nom) return { ok: false, message: "Le nom de la catégorie est obligatoire." };
  const ordreBrut = Math.trunc(Number(fd.get("ordreImputation")));
  const donnees = {
    nom,
    code: texteCourt(fd.get("code"), 20) || null,
    ordreImputation: Number.isFinite(ordreBrut) && ordreBrut >= 0 ? ordreBrut : 0,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.categorieFrais.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.categorieFrais.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "categorie.modification",
          entite: "CategorieFrais", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Catégorie introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const creee = await tx.categorieFrais.create({ data: { etablissementId, ...donnees } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "categorie.creation",
          entite: "CategorieFrais", entiteId: creee.id, nouvelleValeur: creee,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Catégorie mise à jour." : "Catégorie ajoutée." };
  } catch (e) {
    console.error("[scolarite] catégorie :", e);
    return { ok: false, message: "Une catégorie active porte peut-être déjà ce nom." };
  }
}

export async function supprimerCategorie(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const c = await prisma.categorieFrais.findUnique({ where: { id }, select: { etablissementId: true, annuleLe: true } });
  if (!c || c.annuleLe) return { ok: false, message: "Catégorie introuvable." };
  const u = await exigerPermissionFinance(c.etablissementId, "finance.frais.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.categorieFrais.findFirst({ where: { id } });
      const maj = await tx.categorieFrais.updateMany({
        where: { id, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: c.etablissementId, utilisateurId: u.id, action: "categorie.annulation",
        entite: "CategorieFrais", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Catégorie retirée (les frais rattachés redeviennent « sans catégorie » à l'usage)." };
  } catch (e) {
    console.error("[scolarite] retrait catégorie :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Génération des créances (élève / classe / établissement)
// ─────────────────────────────────────────────────────────────

export async function genererCreances(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.creances.generer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const portee = texteCourt(fd.get("portee"), 20);
  const eleveId = texteCourt(fd.get("eleveId"), 50);
  const classeId = texteCourt(fd.get("classeId"), 50);
  if (portee === "eleve" && !eleveId) return { ok: false, message: "Choisissez un élève." };
  if (portee === "classe") {
    const classe = await prisma.classe.findFirst({ where: { id: classeId, etablissementId }, select: { id: true } });
    if (!classe) return { ok: false, message: "Classe hors de cet établissement." };
  }
  if (!["eleve", "classe", "etablissement"].includes(portee)) return { ok: false, message: "Portée invalide." };
  if (portee === "eleve" && !(await eleveDeLEtablissement(eleveId, etablissementId))) {
    return { ok: false, message: "Élève introuvable dans cet établissement." };
  }

  try {
    const exercice = await exerciceDe(etablissementId);
    const [frais, eleves, existantes, payes] = await Promise.all([
      fraisPourGeneration(etablissementId),
      contextesEleves(etablissementId, await anneeActiveId(), portee === "eleve" ? { eleveId } : portee === "classe" ? { classeId } : {}),
      prisma.creanceEleve.findMany({
        where: { etablissementId, exercice, annuleLe: null, ...(portee === "eleve" ? { eleveId } : {}) },
        select: { eleveId: true, fraisId: true },
      }),
      prisma.paiementScolarite.groupBy({
        by: ["eleveId", "fraisId"],
        where: { etablissementId, annule: false, ...(portee === "eleve" ? { eleveId } : {}) },
        _sum: { montant: true },
      }),
    ]);
    if (frais.length === 0) return { ok: false, message: "Aucun frais obligatoire actif : définissez d'abord le barème." };
    if (eleves.length === 0) return { ok: false, message: "Aucun élève actif dans cette portée." };

    const lignes = creancesAGenerer({
      etablissementId, exercice, eleves, frais,
      clesExistantes: new Set(existantes.map((e) => `${e.eleveId}:${e.fraisId}`)),
      payeParCle: new Map(payes.filter((p) => p.fraisId).map((p) => [`${p.eleveId}:${p.fraisId}`, p._sum.montant ?? 0])),
    });
    if (lignes.length === 0) {
      return { ok: true, message: "Aucune nouvelle créance à générer : les comptes sont déjà à jour." };
    }

    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < lignes.length; i += 1000) {
          await tx.creanceEleve.createMany({ data: lignes.slice(i, i + 1000) });
        }
        await journaliserFinance(tx, {
          etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "creance.generation",
          entite: "CreanceEleve",
          entiteId: portee === "eleve" ? eleveId : portee === "classe" ? classeId : etablissementId,
          nouvelleValeur: { portee, exercice, nombreCreances: lignes.length, nombreEleves: eleves.length },
        });
      },
      { timeout: 120_000 },
    );
    revalidatePath(CHEMIN);
    return { ok: true, message: `${lignes.length} créance(s) générée(s) pour ${eleves.length} élève(s) — exercice ${exercice}.` };
  } catch (e) {
    console.error("[scolarite] génération :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Exonérations
// ─────────────────────────────────────────────────────────────

export async function accorderExoneration(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.exonerations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const type = texteCourt(fd.get("type"), 20) === "totale" ? "totale" : "partielle";
  const decision = texteCourt(fd.get("decision"), 300);
  if (!decision) return { ok: false, message: "La référence de la décision est obligatoire." };
  const taux = pourcentageValide(fd.get("taux"));
  const montant = montantValide(fd.get("montant"));
  if (type === "partielle" && !taux && !montant) {
    return { ok: false, message: "Exonération partielle : indiquez un taux OU un montant." };
  }
  const debut = dateFacultative(fd.get("debut")) ?? new Date();
  const fin = dateFacultative(fd.get("fin"));
  if (fin && fin < debut) return { ok: false, message: "La fin de validité doit suivre le début." };

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.exonerationEleve.create({
        data: {
          etablissementId, eleveId: eleve.id,
          fraisId: texteCourt(fd.get("fraisId"), 50) || null,
          type, taux: type === "totale" ? null : (montant ? null : taux), montant: type === "totale" ? null : montant,
          decision, responsableId: u.id, debut, fin,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "exoneration.creation",
        entite: "ExonerationEleve", entiteId: creee.id, nouvelleValeur: creee,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Exonération ${type} accordée à ${nomDe(eleve)}.` };
  } catch (e) {
    console.error("[scolarite] exonération :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function annulerExoneration(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulationSimple(fd, "exonerationEleve", "ExonerationEleve", "exoneration.annulation", "Exonération annulée.", "finance.exonerations.gerer");
}

// ─────────────────────────────────────────────────────────────
//  Bourses & prises en charge
// ─────────────────────────────────────────────────────────────

export async function accorderBourse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.bourses.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const type = texteCourt(fd.get("type"), 30);
  if (!TYPES_BOURSE.has(type)) return { ok: false, message: "Type de bourse invalide." };
  const taux = pourcentageValide(fd.get("taux"));
  const montantFixe = montantValide(fd.get("montantFixe"));
  if (!taux && !montantFixe) return { ok: false, message: "Indiquez un taux OU un montant fixe." };
  let fraisCibles: string[] | null = null;
  try {
    const brut = JSON.parse(String(fd.get("fraisCibles") ?? "null"));
    if (Array.isArray(brut)) {
      fraisCibles = brut.map((x) => String(x)).filter(Boolean).slice(0, 50);
      if (fraisCibles.length === 0) fraisCibles = null;
    }
  } catch {
    fraisCibles = null;
  }
  const periode = texteCourt(fd.get("periode"), 20) || (await exerciceDe(etablissementId));

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.bourseEleve.create({
        data: {
          etablissementId, eleveId: eleve.id, type,
          organisme: texteCourt(fd.get("organisme"), 120) || null,
          taux: montantFixe ? null : taux, montantFixe,
          fraisCibles: fraisCibles ?? undefined, periode,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "bourse.creation",
        entite: "BourseEleve", entiteId: creee.id, nouvelleValeur: creee,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Bourse accordée à ${nomDe(eleve)} (${periode}).` };
  } catch (e) {
    console.error("[scolarite] bourse :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function annulerBourse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulationSimple(fd, "bourseEleve", "BourseEleve", "bourse.annulation", "Bourse annulée.", "finance.bourses.gerer");
}

// ─────────────────────────────────────────────────────────────
//  Plans de paiement
// ─────────────────────────────────────────────────────────────

export async function enregistrerPlanPaiement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.plans.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };

  let echeances: { date: string; montant: number }[] = [];
  try {
    const brut = JSON.parse(String(fd.get("echeances") ?? "[]"));
    if (Array.isArray(brut)) {
      echeances = brut
        .map((e) => ({ date: String(e?.date ?? "").trim(), montant: Math.trunc(Number(e?.montant)) || 0 }))
        .filter((e) => e.montant > 0 && !Number.isNaN(new Date(e.date).getTime()))
        .slice(0, 36);
    }
  } catch {
    return { ok: false, message: "Échéancier illisible." };
  }
  if (echeances.length === 0) return { ok: false, message: "Ajoutez au moins une échéance valide (date + montant)." };

  const creanceIdBrut = texteCourt(fd.get("creanceId"), 50);
  const creanceId = creanceIdBrut
    ? (await prisma.creanceEleve.findFirst({
        where: { id: creanceIdBrut, etablissementId, eleveId: eleve.id, annuleLe: null },
        select: { id: true },
      }))?.id ?? null
    : null;

  try {
    await prisma.$transaction(async (tx) => {
      const cree = await tx.planPaiement.create({
        data: {
          etablissementId, eleveId: eleve.id, creanceId,
          libelle: texteCourt(fd.get("libelle"), 120) || null,
          echeances,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "plan.creation",
        entite: "PlanPaiement", entiteId: cree.id, nouvelleValeur: cree,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Plan de paiement enregistré (${echeances.length} échéance(s)).` };
  } catch (e) {
    console.error("[scolarite] plan :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function annulerPlanPaiement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulationSimple(fd, "planPaiement", "PlanPaiement", "plan.annulation", "Plan de paiement annulé.", "finance.plans.gerer", { statut: "annule" });
}

// ─────────────────────────────────────────────────────────────
//  Règles de pénalités & pénalités
// ─────────────────────────────────────────────────────────────

export async function enregistrerReglePenalite(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.penalites.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const declencheur = texteCourt(fd.get("declencheur"), 20);
  const type = texteCourt(fd.get("type"), 30);
  if (!DECLENCHEURS.has(declencheur)) return { ok: false, message: "Déclencheur invalide." };
  if (!TYPES_PENALITE.has(type)) return { ok: false, message: "Type de pénalité invalide." };
  const valeur = Number(String(fd.get("valeur") ?? "").replace(/[\s ]/g, "").replace(",", "."));
  if (!Number.isFinite(valeur) || valeur <= 0 || valeur > 1_000_000_000) {
    return { ok: false, message: "Valeur de pénalité invalide." };
  }
  if (type !== "fixe" && valeur > 100) return { ok: false, message: "Un taux de pénalité ne dépasse pas 100 %." };
  const delaiBrut = Math.trunc(Number(fd.get("delaiJours")));
  const donnees = {
    declencheur, type, valeur,
    delaiJours: Number.isFinite(delaiBrut) && delaiBrut >= 0 && delaiBrut <= 365 ? delaiBrut : 0,
    actif: String(fd.get("actif") ?? "oui") !== "non",
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.reglePenalite.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.reglePenalite.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "regle_penalite.modification",
          entite: "ReglePenalite", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Règle introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const creee = await tx.reglePenalite.create({ data: { etablissementId, ...donnees } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "regle_penalite.creation",
          entite: "ReglePenalite", entiteId: creee.id, nouvelleValeur: creee,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Règle de pénalité mise à jour." : "Règle de pénalité ajoutée." };
  } catch (e) {
    console.error("[scolarite] règle pénalité :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerReglePenalite(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulationSimple(fd, "reglePenalite", "ReglePenalite", "regle_penalite.annulation", "Règle de pénalité retirée.", "finance.penalites.gerer");
}

/**
 * Applique les règles de pénalités actives aux créances EN RETARD de l'élève (déclencheurs
 * « retard »/« échéance » ; « rejet bancaire » attend les données bancaires des specs 09/10).
 * Idempotent : une seule pénalité par créance × règle.
 */
export async function appliquerPenalitesEleve(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.penalites.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };

  try {
    const maintenant = new Date();
    const [regles, ouvertes, existantes] = await Promise.all([
      prisma.reglePenalite.findMany({
        where: { etablissementId, actif: true, annuleLe: null, declencheur: { in: ["retard", "echeance"] } },
        select: { id: true, type: true, valeur: true, delaiJours: true },
      }),
      creancesOuvertes(prisma, { etablissementId, eleveId: eleve.id }),
      prisma.penaliteEleve.findMany({
        where: { etablissementId, eleveId: eleve.id, annuleLe: null },
        select: { creanceId: true, regleId: true },
      }),
    ]);
    if (regles.length === 0) return { ok: false, message: "Aucune règle de pénalité active (voir Paramétrage)." };
    const deja = new Set(existantes.map((e) => `${e.creanceId}:${e.regleId ?? ""}`));
    const aCreer: { creanceId: string; regleId: string; montant: number; libelle: string }[] = [];
    for (const regle of regles) {
      for (const c of ouvertes) {
        if (!c.dateEcheance || c.reste <= 0) continue;
        const limite = new Date(c.dateEcheance.getTime() + regle.delaiJours * JOUR_MS);
        if (limite >= maintenant) continue;
        if (deja.has(`${c.id}:${regle.id}`)) continue;
        const valeur = Number(regle.valeur);
        let montant = 0;
        if (regle.type === "fixe") montant = Math.round(valeur);
        else if (regle.type === "pourcentage") montant = Math.round((valeur * c.reste) / 100);
        else {
          const jours = Math.max(1, Math.floor((maintenant.getTime() - limite.getTime()) / JOUR_MS));
          montant = Math.round((valeur * c.reste * jours) / 100);
        }
        if (montant > 0) aCreer.push({ creanceId: c.id, regleId: regle.id, montant, libelle: c.libelle });
      }
    }
    if (aCreer.length === 0) return { ok: true, message: "Aucune pénalité à appliquer : pas de créance en retard non pénalisée." };

    await prisma.$transaction(async (tx) => {
      await tx.penaliteEleve.createMany({
        data: aCreer.map((p) => ({
          etablissementId, eleveId: eleve.id, creanceId: p.creanceId, regleId: p.regleId, montant: p.montant,
        })),
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "penalite.application",
        entite: "PenaliteEleve", entiteId: eleve.id,
        nouvelleValeur: { penalites: aCreer, total: aCreer.reduce((s, p) => s + p.montant, 0) },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `${aCreer.length} pénalité(s) appliquée(s) à ${nomDe(eleve)}.` };
  } catch (e) {
    console.error("[scolarite] pénalités :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function annulerPenalite(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulationSimple(fd, "penaliteEleve", "PenaliteEleve", "penalite.annulation", "Pénalité annulée.", "finance.penalites.gerer", { statut: "annulee" });
}

// ─────────────────────────────────────────────────────────────
//  Avances / acomptes
// ─────────────────────────────────────────────────────────────

export async function enregistrerAvance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.avances.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.avanceEleve.create({
        data: {
          etablissementId, eleveId: eleve.id, montant, solde: montant,
          mode: modeValide(fd.get("mode")),
          reference: texteCourt(fd.get("reference"), 80) || null,
          dateComptable: new Date(),
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "avance.creation",
        entite: "AvanceEleve", entiteId: creee.id, nouvelleValeur: creee,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Avance de ${montant.toLocaleString("fr-FR")} F enregistrée pour ${nomDe(eleve)} — pensez à l'imputer sur ses créances.` };
  } catch (e) {
    console.error("[scolarite] avance :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Impute une avance sur les créances OUVERTES de l'élève, dans l'ORDRE D'IMPUTATION des
 * catégories de frais (puis par échéance) : chaque affectation crée un reçu PaiementScolarite
 * (la trésorerie reconnaît les fonds à l'imputation — choix V1 documenté).
 */
export async function imputerAvance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const avance = await prisma.avanceEleve.findFirst({
    where: { id, annuleLe: null },
    select: { id: true, etablissementId: true, eleveId: true, solde: true, mode: true, version: true },
  });
  if (!avance) return { ok: false, message: "Avance introuvable." };
  const u = await exigerPermissionFinance(avance.etablissementId, "finance.avances.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  if (avance.solde <= 0) return { ok: false, message: "Cette avance est déjà entièrement imputée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  const categories = await prisma.categorieFrais.findMany({
    where: { etablissementId: avance.etablissementId, annuleLe: null },
    select: { id: true, ordreImputation: true },
  });
  const ordreCategorie = new Map(categories.map((c) => [c.id, c.ordreImputation]));

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // Verrou + contrôle de version sur l'avance (RM-019).
      const verrou = await tx.avanceEleve.updateMany({
        where: { id, version, solde: { gt: 0 }, annuleLe: null },
        data: { version: { increment: 1 } },
      });
      if (verrou.count === 0) return { statut: "conflit" as const };

      const ouvertes = (await creancesOuvertes(tx, { etablissementId: avance.etablissementId, eleveId: avance.eleveId }))
        .filter((c) => c.reste > 0)
        .sort((a, b) => {
          const oa = a.categorieId ? ordreCategorie.get(a.categorieId) ?? 999 : 999;
          const ob = b.categorieId ? ordreCategorie.get(b.categorieId) ?? 999 : 999;
          if (oa !== ob) return oa - ob;
          const da = a.dateEcheance?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const db = b.dateEcheance?.getTime() ?? Number.MAX_SAFE_INTEGER;
          return da !== db ? da - db : a.creeLe.getTime() - b.creeLe.getTime();
        });
      if (ouvertes.length === 0) return { statut: "rien" as const };

      const maintenant = new Date();
      let disponible = avance.solde;
      const imputations: { creanceId: string; libelle: string; montant: number; numeroRecu: number }[] = [];
      const fraisTouches = new Set<string>();
      for (const c of ouvertes) {
        if (disponible <= 0) break;
        const m = Math.min(disponible, c.reste);
        disponible -= m;
        // Reçu numéroté via les SÉQUENCES de la fondation (RM-014, branché par 08-Encaissements).
        const { numero } = await prochainNumero(tx, avance.etablissementId, null, "recu", "REC");
        await tx.paiementScolarite.create({
          data: {
            etablissementId: avance.etablissementId, eleveId: avance.eleveId, fraisId: c.fraisId,
            libelle: c.libelle, montant: m, mode: avance.mode,
            reference: `AVANCE-${avance.id.slice(0, 8).toUpperCase()}`,
            numeroRecu: numero, date: maintenant, dateComptable: maintenant, encaisseParId: u.id,
          },
        });
        imputations.push({ creanceId: c.id, libelle: c.libelle, montant: m, numeroRecu: numero });
        fraisTouches.add(c.fraisId);
      }
      const totalImpute = avance.solde - disponible;
      await tx.avanceEleve.updateMany({ where: { id }, data: { solde: { decrement: totalImpute } } });
      for (const fraisId of fraisTouches) {
        await majStatutCreances(tx, { etablissementId: avance.etablissementId, eleveId: avance.eleveId, fraisId });
      }
      // 07-Facturation : l'imputation met aussi à jour le statut des factures liées.
      await majStatutFactures(tx, { etablissementId: avance.etablissementId, eleveId: avance.eleveId });
      await journaliserFinance(tx, {
        etablissementId: avance.etablissementId, utilisateurId: u.id, action: "avance.imputation",
        entite: "AvanceEleve", entiteId: id,
        ancienneValeur: { solde: avance.solde },
        nouvelleValeur: { imputations, soldeRestant: disponible },
      });
      return { statut: "ok" as const, totalImpute, nombre: imputations.length };
    });
    if (resultat.statut === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    if (resultat.statut === "rien") return { ok: false, message: "Aucune créance ouverte : générez d'abord les créances de l'élève." };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${resultat.totalImpute.toLocaleString("fr-FR")} F imputés sur ${resultat.nombre} créance(s) (reçus émis).` };
  } catch (e) {
    console.error("[scolarite] imputation avance :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Remboursements (demande → validation/refus → paiement)
// ─────────────────────────────────────────────────────────────

export async function demanderRemboursement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.remboursements.demander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const motif = texteCourt(fd.get("motif"), 300);
  if (!motif) return { ok: false, message: "Le motif du remboursement est obligatoire." };

  const paiementIdBrut = texteCourt(fd.get("paiementId"), 50);
  let paiementId: string | null = null;
  if (paiementIdBrut) {
    const paiement = await prisma.paiementScolarite.findFirst({
      where: { id: paiementIdBrut, etablissementId, eleveId: eleve.id },
      select: { id: true, montant: true },
    });
    if (!paiement) return { ok: false, message: "Paiement d'origine introuvable pour cet élève." };
    if (montant > paiement.montant) return { ok: false, message: "Le remboursement dépasse le paiement d'origine." };
    paiementId = paiement.id;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.demandeRemboursement.create({
        data: { etablissementId, eleveId: eleve.id, paiementId, montant, motif, demandeParId: u.id },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "remboursement.demande",
        entite: "DemandeRemboursement", entiteId: creee.id, nouvelleValeur: creee,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Demande de remboursement enregistrée pour ${nomDe(eleve)} — en attente de validation.` };
  } catch (e) {
    console.error("[scolarite] demande remboursement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function deciderRemboursement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const decision = texteCourt(fd.get("decision"), 20);
  if (decision !== "valider" && decision !== "refuser") return { ok: false, message: "Décision invalide." };
  const d = await prisma.demandeRemboursement.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, statut: true, demandeParId: true },
  });
  if (!d) return { ok: false, message: "Demande introuvable." };
  if (d.statut !== "demandee") return { ok: false, message: "Cette demande a déjà été instruite." };
  const u = await exigerPermissionFinance(d.etablissementId, "finance.remboursements.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  // SÉPARATION DES RESPONSABILITÉS (97 + 04) : le validateur doit être différent du demandeur
  // (cf. OPERATIONS_DOUBLE_ACTEUR — src/lib/finances/commun/permissions.ts).
  if (d.demandeParId && d.demandeParId === u.id) {
    return { ok: false, message: MESSAGE_SEPARATION_RESPONSABILITES };
  }
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  const statut = decision === "valider" ? "validee" : "refusee";
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.demandeRemboursement.findFirst({ where: { id } });
      const maj = await tx.demandeRemboursement.updateMany({
        where: { id, version, statut: "demandee" },
        data: { statut, valideeParId: u.id, dateValidation: new Date(), version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: d.etablissementId, utilisateurId: u.id,
        action: decision === "valider" ? "remboursement.validation" : "remboursement.refus",
        entite: "DemandeRemboursement", entiteId: id, ancienneValeur: avant, nouvelleValeur: { statut },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: decision === "valider" ? "Demande validée — procédez au paiement." : "Demande refusée." };
  } catch (e) {
    console.error("[scolarite] décision remboursement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Paie un remboursement VALIDÉ : crée le décaissement au journal (OperationFinanciere, cat. 65). */
export async function payerRemboursement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const d = await prisma.demandeRemboursement.findFirst({
    where: { id, annuleLe: null },
    select: {
      etablissementId: true, statut: true, montant: true,
      eleve: { select: { nom: true, prenoms: true } },
    },
  });
  if (!d) return { ok: false, message: "Demande introuvable." };
  if (d.statut !== "validee") return { ok: false, message: "Seule une demande VALIDÉE peut être payée." };
  const u = await exigerPermissionFinance(d.etablissementId, "finance.remboursements.payer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.demandeRemboursement.updateMany({
        where: { id, version, statut: "validee" },
        data: { statut: "payee", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      const maintenant = new Date();
      const operation = await tx.operationFinanciere.create({
        data: {
          etablissementId: d.etablissementId, sens: "depense", categorie: "65",
          libelle: `Remboursement scolarité — ${nomDe(d.eleve)}`,
          montant: d.montant, mode: modeValide(fd.get("mode")),
          reference: `REMB-${id.slice(0, 8).toUpperCase()}`,
          date: maintenant, dateComptable: maintenant, saisiParId: u.id,
        },
      });
      await tx.demandeRemboursement.updateMany({ where: { id }, data: { operationId: operation.id } });
      await journaliserFinance(tx, {
        etablissementId: d.etablissementId, utilisateurId: u.id, action: "remboursement.paiement",
        entite: "DemandeRemboursement", entiteId: id,
        nouvelleValeur: { statut: "payee", operationId: operation.id, montant: d.montant },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Remboursement payé — décaissement enregistré au journal (catégorie 65)." };
  } catch (e) {
    console.error("[scolarite] paiement remboursement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Règles de blocage (configuration + consultation V1)
// ─────────────────────────────────────────────────────────────

export async function enregistrerRegleBlocage(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.blocages.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const type = texteCourt(fd.get("type"), 30);
  if (!TYPES_BLOCAGE.has(type)) return { ok: false, message: "Type de blocage invalide." };
  const seuilImpaye = montantValide(fd.get("seuilImpaye")); // null = tout impayé bloque
  const actif = String(fd.get("actif") ?? "oui") !== "non";
  const id = texteCourt(fd.get("id"), 50);

  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.regleBlocage.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.regleBlocage.updateMany({
          where: { id, etablissementId, version },
          data: { type, seuilImpaye, actif, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "regle_blocage.modification",
          entite: "RegleBlocage", entiteId: id, ancienneValeur: avant, nouvelleValeur: { type, seuilImpaye, actif },
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Règle introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const creee = await tx.regleBlocage.create({ data: { etablissementId, type, seuilImpaye, actif } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "regle_blocage.creation",
          entite: "RegleBlocage", entiteId: creee.id, nouvelleValeur: creee,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: "Règle de blocage enregistrée (application effective : specs des modules concernés)." };
  } catch (e) {
    console.error("[scolarite] règle blocage :", e);
    return { ok: false, message: "Une règle active existe peut-être déjà pour ce type." };
  }
}

export async function supprimerRegleBlocage(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulationSimple(fd, "regleBlocage", "RegleBlocage", "regle_blocage.annulation", "Règle de blocage retirée.", "finance.blocages.gerer");
}

// ─────────────────────────────────────────────────────────────
//  Cas particuliers : clôture de compte, recalcul, relance
// ─────────────────────────────────────────────────────────────

/**
 * Clôture le compte d'un élève (transfert/démission) : suspend les créances FUTURES non
 * entamées, constate le solde et journalise. Le relevé imprimable arrive avec une spec dédiée.
 */
export async function cloturerCompteEleve(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.scolarite.cloturer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const motif = texteCourt(fd.get("motif"), 300);
  if (!motif) return { ok: false, message: "Le motif de clôture (transfert, démission…) est obligatoire." };

  try {
    const exercice = await exerciceDe(etablissementId);
    const compte = await chargerCompteEleve(etablissementId, eleve.id, exercice, await anneeActiveId());
    if (!compte) return { ok: false, message: "Élève introuvable dans cet établissement." };

    const nb = await prisma.$transaction(async (tx) => {
      const ouvertes = await creancesOuvertes(tx, { etablissementId, eleveId: eleve.id, exercice });
      const aSuspendre = ouvertes.filter((c) => c.paye === 0 && c.statut === "generee").map((c) => c.id);
      if (aSuspendre.length > 0) {
        await tx.creanceEleve.updateMany({
          where: { id: { in: aSuspendre } },
          data: { statut: "suspendue", version: { increment: 1 } },
        });
      }
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "compte.cloture",
        entite: "CreanceEleve", entiteId: eleve.id,
        nouvelleValeur: { motif, solde: compte.detail, creancesSuspendues: aSuspendre.length },
      });
      return aSuspendre.length;
    });
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Compte de ${nomDe(eleve)} clôturé (${motif}) : ${nb} créance(s) future(s) suspendue(s) — solde constaté : ${compte.detail.solde.toLocaleString("fr-FR")} F.`,
    };
  } catch (e) {
    console.error("[scolarite] clôture compte :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Recalcule les créances de l'élève après un changement de classe : suspend les créances non
 * entamées de frais devenus inapplicables, réactive celles redevenues applicables et génère
 * les créances manquantes (idempotent).
 */
export async function recalculerCreancesEleve(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.creances.generer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };

  try {
    const exercice = await exerciceDe(etablissementId);
    const maintenant = new Date();
    const [frais, ctxs, toutes, payes] = await Promise.all([
      fraisPourGeneration(etablissementId),
      contextesEleves(etablissementId, await anneeActiveId(), { eleveId: eleve.id }),
      prisma.creanceEleve.findMany({
        where: { etablissementId, eleveId: eleve.id, exercice, annuleLe: null },
        select: { id: true, fraisId: true, statut: true },
      }),
      prisma.paiementScolarite.groupBy({
        by: ["fraisId"],
        where: { etablissementId, eleveId: eleve.id, annule: false },
        _sum: { montant: true },
      }),
    ]);
    const ctx = ctxs[0] ?? { eleveId: eleve.id, niveauId: null, niveauNom: null, cycle: null, classeNom: null };
    const applicables = new Set(frais.filter((f) => fraisApplicable(f, ctx, maintenant)).map((f) => f.id));

    const lignes = creancesAGenerer({
      etablissementId, exercice, eleves: [ctx], frais,
      clesExistantes: new Set(toutes.map((c) => `${eleve.id}:${c.fraisId}`)),
      payeParCle: new Map(payes.filter((p) => p.fraisId).map((p) => [`${eleve.id}:${p.fraisId}`, p._sum.montant ?? 0])),
      maintenant,
    });

    const bilan = await prisma.$transaction(async (tx) => {
      const ouvertes = await creancesOuvertes(tx, { etablissementId, eleveId: eleve.id, exercice });
      // 1. Suspendre les créances non entamées de frais devenus inapplicables.
      const aSuspendre = ouvertes
        .filter((c) => c.statut === "generee" && c.paye === 0 && !applicables.has(c.fraisId))
        .map((c) => c.id);
      if (aSuspendre.length > 0) {
        await tx.creanceEleve.updateMany({
          where: { id: { in: aSuspendre } },
          data: { statut: "suspendue", version: { increment: 1 } },
        });
      }
      // 2. Réactiver les créances suspendues dont le frais est (re)devenu applicable.
      const suspendues = toutes.filter((c) => c.statut === "suspendue" && applicables.has(c.fraisId));
      const fraisReactives = new Set<string>();
      if (suspendues.length > 0) {
        await tx.creanceEleve.updateMany({
          where: { id: { in: suspendues.map((c) => c.id) } },
          data: { statut: "generee", version: { increment: 1 } },
        });
        for (const c of suspendues) fraisReactives.add(c.fraisId);
        for (const fraisId of fraisReactives) {
          await majStatutCreances(tx, { etablissementId, eleveId: eleve.id, fraisId });
        }
      }
      // 3. Générer les créances manquantes de la nouvelle classe.
      if (lignes.length > 0) await tx.creanceEleve.createMany({ data: lignes });
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "creance.recalcul",
        entite: "CreanceEleve", entiteId: eleve.id,
        nouvelleValeur: {
          classe: ctx.classeNom, suspendues: aSuspendre.length,
          reactivees: suspendues.length, generees: lignes.length,
        },
      });
      return { suspendues: aSuspendre.length, reactivees: suspendues.length, generees: lignes.length };
    });
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Recalcul terminé pour ${nomDe(eleve)} : ${bilan.generees} générée(s), ${bilan.suspendues} suspendue(s), ${bilan.reactivees} réactivée(s).`,
    };
  } catch (e) {
    console.error("[scolarite] recalcul :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Relance interne (notifications à l'élève et à ses parents liés) — journalisée. */
export async function relancerEleve(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.scolarite.relancer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };

  try {
    const exercice = await exerciceDe(etablissementId);
    const compte = await chargerCompteEleve(etablissementId, eleve.id, exercice, await anneeActiveId());
    if (!compte || compte.detail.solde <= 0) {
      return { ok: false, message: "Aucun solde dû : pas de relance nécessaire." };
    }
    const parents = await prisma.lienParentEleve.findMany({
      where: { eleveId: eleve.id },
      select: { parentId: true },
    });
    const destinataires = [...new Set([eleve.id, ...parents.map((p) => p.parentId)])];
    await creerNotifications(destinataires, {
      titre: "Rappel de frais de scolarité",
      message: `Solde restant dû pour ${compte.eleveNom} : ${compte.detail.solde.toLocaleString("fr-FR")} F (exercice ${exercice}). Merci de régulariser auprès de l'économat.`,
      type: "alerte",
      lien: null,
    });
    await prisma.$transaction(async (tx) => {
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "creance.relance",
        entite: "CreanceEleve", entiteId: eleve.id,
        nouvelleValeur: { solde: compte.detail.solde, destinataires: destinataires.length },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Relance envoyée (${destinataires.length} destinataire(s)) — les relances automatiques arriveront avec 21-Notifications.` };
  } catch (e) {
    console.error("[scolarite] relance :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Annulation logique générique (RM-004) — helper interne
// ─────────────────────────────────────────────────────────────

type ModeleAnnulable = "exonerationEleve" | "bourseEleve" | "planPaiement" | "penaliteEleve" | "reglePenalite" | "regleBlocage";

/**
 * Vue structurelle minimale d'un délégué Prisma annulable : les 6 modèles ci-dessous portent
 * TOUS les colonnes de la fondation (etablissementId, version, annuleLe, annuleParId) — le
 * passage par cette interface évite l'union de délégués hétérogènes, sans `any`.
 */
interface DelegueAnnulable {
  findFirst(args: { where: { id: string; annuleLe?: null } }): Promise<({ etablissementId: string } & Record<string, unknown>) | null>;
  updateMany(args: {
    where: { id: string; version: number; annuleLe: null };
    data: { annuleLe: Date; annuleParId: string; version: { increment: number }; statut?: string };
  }): Promise<{ count: number }>;
}

async function annulationSimple(
  fd: FormData,
  modele: ModeleAnnulable,
  entite: string,
  action: string,
  messageOk: string,
  permission: PermissionFinance,
  donneesSupplementaires?: { statut: string },
): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  const delegue = prisma[modele] as unknown as DelegueAnnulable;
  const existant = await delegue.findFirst({ where: { id, annuleLe: null } });
  if (!existant) return { ok: false, message: "Élément introuvable (déjà annulé ?)." };
  const u = await exigerPermissionFinance(existant.etablissementId, permission);
  if (!u) return { ok: false, message: "Action non autorisée." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const dTx = tx[modele] as unknown as DelegueAnnulable;
      const avant = await dTx.findFirst({ where: { id } });
      const maj = await dTx.updateMany({
        where: { id, version, annuleLe: null },
        data: {
          annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 },
          ...(donneesSupplementaires ?? {}),
        },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: existant.etablissementId, utilisateurId: u.id, action,
        entite, entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: messageOk };
  } catch (e) {
    console.error(`[scolarite] ${action} :`, e);
    return { ok: false, message: "Erreur technique." };
  }
}
