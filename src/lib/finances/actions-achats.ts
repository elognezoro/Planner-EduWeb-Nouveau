"use server";

/**
 * Actions serveur du sous-module ACHATS (12-Achats + 99 WF-004, 05B/02B) : cycle
 * Procure-to-Pay complet — fournisseurs (minimum du 12), demandes d'achat (validation par
 * SEUILS : ≤ 1 000 000 F = finance.achats.valider, au-delà = .approuver direction ;
 * séparation demandeur ≠ validateur), devis, bons de commande (RM-900 : demande approuvée ;
 * RM-901 : fournisseur actif ; RM-905 : engagement contrôlé contre le budget), réceptions
 * partielles/totales (RM-902 : cumul ≤ commandé, entrée en stock économat automatique),
 * factures fournisseurs (RM-903 : jamais payées deux fois ; RM-904 : la validation crée
 * l'écriture AC « débit charge 60x / crédit 401 » du registre 11), paiements (opération
 * 60x pour la trésorerie/KPI + écriture « débit 401 / crédit trésorerie » — le 11 exclut
 * ces opérations de sa collecte), retours (bon BR, stock régularisé, contre-écriture).
 *
 * TOUTES les écritures : garde granulaire, transaction + journaliserFinance, verrouillage
 * optimiste, annulations logiques motivées. Fichier "use server" : exports async uniquement.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { CATEGORIES_OHADA } from "./categories";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { MESSAGE_SEPARATION_RESPONSABILITES } from "./commun/permissions";
import { dateFacultative, modeValide, montantValide, texteCourt } from "./commun/validation";
import { prochainNumero } from "./commun/numerotation";
import { controleSessionEspeces } from "./caisse/serveur";
import {
  assurerPlanComptable, ecrireEcritureAutomatique, periodeCloturee, periodeDe,
  TRESORERIE_PAR_MODE,
} from "./comptabilite/serveur";
import { controleBudgetAchat } from "./achats/serveur";
import { SEUIL_APPROBATION_DIRECTION_ACHAT, type LigneBcSaisie, type LigneReceptionSaisie } from "./achats/types";

const CHEMIN = "/app/vie-scolaire/finances";
const PLAFOND = 1_000_000_000;
const TYPES_FOURNISSEUR_VALIDES = new Set(["biens", "services", "travaux", "institution", "financier"]);
const STATUTS_FOURNISSEUR_VALIDES = new Set(["actif", "inactif", "suspendu"]);
const TYPES_ACHAT_VALIDES = new Set(["biens", "services", "travaux"]);
const URGENCES_VALIDES = new Set(["normale", "urgente", "critique"]);
const MESSAGE_PERIODE_CLOTUREE =
  "La période comptable courante est CLÔTURÉE (RM-705) : rouvrez-la (onglet Comptabilité) avant cette opération.";

async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

/** Dernière fin d'exercice CLÔTURÉ (aucune pièce financière sur un exercice clôturé). */
async function finExerciceClos(etablissementId: string): Promise<Date | null> {
  const derniere = await prisma.clotureExercice.findFirst({
    where: { etablissementId, annuleLe: null },
    orderBy: { finPeriode: "desc" },
    select: { finPeriode: true },
  });
  return derniere?.finPeriode ?? null;
}

/** Catégorie budgétaire = code OHADA de DÉPENSE (compte de charge de l'écriture RM-904). */
function categorieDepenseValide(v: FormDataEntryValue | null): string | null {
  const code = texteCourt(v, 10);
  return CATEGORIES_OHADA.some((c) => c.code === code && c.sens === "depense") ? code : null;
}

// ─────────────────────────────────────────────────────────────
//  Fournisseurs (minimum du 12 — référentiel complet au 13)
// ─────────────────────────────────────────────────────────────

export async function enregistrerFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const raisonSociale = texteCourt(fd.get("raisonSociale"), 120);
  if (!raisonSociale) return { ok: false, message: "La raison sociale est obligatoire." };
  const type = texteCourt(fd.get("type"), 20) || "biens";
  if (!TYPES_FOURNISSEUR_VALIDES.has(type)) return { ok: false, message: "Type de fournisseur invalide." };
  const statut = texteCourt(fd.get("statut"), 10) || "actif";
  if (!STATUTS_FOURNISSEUR_VALIDES.has(statut)) return { ok: false, message: "Statut invalide." };
  const donnees = {
    raisonSociale, type, statut,
    nomCommercial: texteCourt(fd.get("nomCommercial"), 120) || null,
    contactNom: texteCourt(fd.get("contactNom"), 80) || null,
    contactFonction: texteCourt(fd.get("contactFonction"), 80) || null,
    telephone: texteCourt(fd.get("telephone"), 30) || null,
    email: texteCourt(fd.get("email"), 120) || null,
    adresse: texteCourt(fd.get("adresse"), 160) || null,
    ville: texteCourt(fd.get("ville"), 80) || null,
    numeroRccm: texteCourt(fd.get("numeroRccm"), 40) || null,
    numeroFiscal: texteCourt(fd.get("numeroFiscal"), 40) || null,
    notes: texteCourt(fd.get("notes"), 300) || null,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.fournisseur.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.fournisseur.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "fournisseur.modification",
          entite: "Fournisseur", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Fournisseur introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        // Séquence PÉRENNE (exercice nul) : le code fournisseur ne repart jamais à zéro.
        const { reference } = await prochainNumero(tx, etablissementId, null, "fournisseur", "FRS");
        const cree = await tx.fournisseur.create({ data: { etablissementId, code: reference, ...donnees } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "fournisseur.creation",
          entite: "Fournisseur", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Fournisseur mis à jour." : "Fournisseur créé." };
  } catch (e) {
    console.error("[achats] fournisseur :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.fournisseur.findFirst({ where: { id, etablissementId, annuleLe: null } });
      if (!avant) return "introuvable" as const;
      const utilise = await tx.bonCommande.count({
        where: { fournisseurId: id, annuleLe: null, statut: { not: "annulee" } },
      });
      if (utilise > 0) return "utilise" as const;
      const maj = await tx.fournisseur.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.retrait",
        entite: "Fournisseur", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Fournisseur introuvable." };
    if (resultat === "utilise") {
      return { ok: false, message: "Ce fournisseur porte des commandes : passez-le « inactif » plutôt que de le retirer." };
    }
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Fournisseur retiré." };
  } catch (e) {
    console.error("[achats] retrait fournisseur :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Demandes d'achat (workflow par seuils, double acteur)
// ─────────────────────────────────────────────────────────────

export async function enregistrerDemandeAchat(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.demander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const objet = texteCourt(fd.get("objet"), 160);
  const justification = texteCourt(fd.get("justification"), 400);
  if (!objet) return { ok: false, message: "L'objet du besoin est obligatoire." };
  if (!justification) return { ok: false, message: "La JUSTIFICATION est obligatoire (12 : toute dépense justifiée)." };
  const typeAchat = texteCourt(fd.get("typeAchat"), 15) || "biens";
  if (!TYPES_ACHAT_VALIDES.has(typeAchat)) return { ok: false, message: "Type d'achat invalide." };
  const urgence = texteCourt(fd.get("urgence"), 15) || "normale";
  if (!URGENCES_VALIDES.has(urgence)) return { ok: false, message: "Niveau d'urgence invalide." };
  const categorieBudget = categorieDepenseValide(fd.get("categorieBudget"));
  if (!categorieBudget) return { ok: false, message: "Choisissez la catégorie budgétaire (dépense OHADA)." };
  const montantEstime = montantValide(fd.get("montantEstime"));
  if (!montantEstime) return { ok: false, message: "Montant estimé invalide." };
  const donnees = {
    typeAchat, objet, justification, urgence, categorieBudget, montantEstime,
    service: texteCourt(fd.get("service"), 80) || null,
    centreCout: texteCourt(fd.get("centreCout"), 60) || null,
    pieceJustificative: texteCourt(fd.get("pieceJustificative"), 120) || null,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.demandeAchat.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        if (avant.statut !== "brouillon") return "figee" as const;
        const maj = await tx.demandeAchat.updateMany({
          where: { id, etablissementId, version, statut: "brouillon" },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "demande_achat.modification",
          entite: "DemandeAchat", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Demande introuvable." };
      if (resultat === "figee") return { ok: false, message: "Seul un BROUILLON se modifie (la demande est déjà soumise)." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      const exercice = await exerciceDe(etablissementId);
      await prisma.$transaction(async (tx) => {
        const cree = await tx.demandeAchat.create({
          data: { etablissementId, exercice, ...donnees, demandeurId: u.id, demandeurNom: u.nomComplet },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "demande_achat.creation",
          entite: "DemandeAchat", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Demande mise à jour." : "Demande d'achat enregistrée en brouillon." };
  } catch (e) {
    console.error("[achats] demande :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function soumettreDemandeAchat(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.demander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  type ResultatSoumission =
    | { erreur: "introuvable" | "statut" | "conflit" }
    | { numero: string; direction: boolean };
  try {
    const resultat = await prisma.$transaction(async (tx): Promise<ResultatSoumission> => {
      const demande = await tx.demandeAchat.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { statut: true, exercice: true, montantEstime: true },
      });
      if (!demande) return { erreur: "introuvable" as const };
      if (demande.statut !== "brouillon") return { erreur: "statut" as const };
      const { reference } = await prochainNumero(tx, etablissementId, demande.exercice, "demande_achat", "DA");
      const maj = await tx.demandeAchat.updateMany({
        where: { id, etablissementId, version, statut: "brouillon" },
        data: { statut: "soumise", numero: reference, version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: "conflit" as const };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "demande_achat.soumission",
        entite: "DemandeAchat", entiteId: id, nouvelleValeur: { numero: reference },
      });
      return { numero: reference, direction: demande.montantEstime > SEUIL_APPROBATION_DIRECTION_ACHAT };
    });
    if ("erreur" in resultat) {
      const messages = { introuvable: "Demande introuvable.", statut: "Seul un brouillon se soumet.", conflit: MESSAGE_CONFLIT_VERSION } as const;
      return { ok: false, message: messages[resultat.erreur] };
    }
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Demande ${resultat.numero} soumise${resultat.direction ? " — montant au-delà du seuil : APPROBATION DIRECTION requise" : ""}.`,
    };
  } catch (e) {
    console.error("[achats] soumission demande :", e);
    return { ok: false, message: "Soumission impossible." };
  }
}

export async function deciderDemandeAchat(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const id = texteCourt(fd.get("id"), 50);
  const decision = texteCourt(fd.get("decision"), 10); // « approuver » | « refuser »
  const motifRefus = texteCourt(fd.get("motifRefus"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (decision !== "approuver" && decision !== "refuser") return { ok: false, message: "Décision invalide." };
  if (decision === "refuser" && !motifRefus) return { ok: false, message: "Le motif du refus est obligatoire." };

  const demande = await prisma.demandeAchat.findFirst({
    where: { id, etablissementId, annuleLe: null },
    select: { montantEstime: true, demandeurId: true, statut: true, exercice: true, categorieBudget: true, numero: true },
  });
  if (!demande) return { ok: false, message: "Demande introuvable." };
  // SEUILS du 12 : au-delà du seuil direction, la décision exige finance.achats.approuver.
  const permission =
    demande.montantEstime > SEUIL_APPROBATION_DIRECTION_ACHAT ? "finance.achats.approuver" : "finance.achats.valider";
  const u = await exigerPermissionFinance(etablissementId, permission);
  if (!u) {
    return {
      ok: false,
      message:
        demande.montantEstime > SEUIL_APPROBATION_DIRECTION_ACHAT
          ? "Montant au-delà du seuil : seule la DIRECTION peut décider (finance.achats.approuver)."
          : "Action non autorisée.",
    };
  }
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  // SÉPARATION DES RESPONSABILITÉS (OPERATIONS_DOUBLE_ACTEUR) : jamais juge et partie.
  if (demande.demandeurId && demande.demandeurId === u.id) {
    return { ok: false, message: MESSAGE_SEPARATION_RESPONSABILITES };
  }
  if (demande.statut !== "soumise") return { ok: false, message: "Seule une demande SOUMISE se décide." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (decision === "approuver") {
        // 12 « Budget insuffisant » : bloquant si un budget existe pour la catégorie.
        const refus = await controleBudgetAchat(tx, {
          etablissementId, exercice: demande.exercice, categorie: demande.categorieBudget,
          montant: demande.montantEstime,
        });
        if (refus) return { erreur: "budget" as const, message: refus };
      }
      const maj = await tx.demandeAchat.updateMany({
        where: { id, etablissementId, version, statut: "soumise" },
        data: {
          statut: decision === "approuver" ? "approuvee" : "refusee",
          decideParId: u.id, decideParNom: u.nomComplet, dateDecision: new Date(),
          motifRefus: decision === "refuser" ? motifRefus : null,
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: "conflit" as const, message: MESSAGE_CONFLIT_VERSION };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: decision === "approuver" ? "demande_achat.approbation" : "demande_achat.refus",
        entite: "DemandeAchat", entiteId: id,
        nouvelleValeur: { numero: demande.numero, decision, motifRefus: motifRefus || undefined },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.message };
    revalidatePath(CHEMIN);
    return { ok: true, message: decision === "approuver" ? `Demande ${demande.numero ?? ""} approuvée.` : "Demande refusée (motif tracé)." };
  } catch (e) {
    console.error("[achats] décision demande :", e);
    return { ok: false, message: "Décision impossible." };
  }
}

export async function retirerDemandeAchat(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.demander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.demandeAchat.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { statut: true, numero: true },
      });
      if (!avant) return "introuvable" as const;
      if (!["brouillon", "soumise", "refusee"].includes(avant.statut)) return "figee" as const;
      const maj = await tx.demandeAchat.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "demande_achat.retrait",
        entite: "DemandeAchat", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Demande introuvable." };
    if (resultat === "figee") return { ok: false, message: "Une demande approuvée ou commandée ne se retire plus." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Demande retirée." };
  } catch (e) {
    console.error("[achats] retrait demande :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

export async function cloturerDemandeAchat(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.demandeAchat.updateMany({
        where: { id, etablissementId, version, statut: "commandee", annuleLe: null },
        data: { statut: "cloturee", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "demande_achat.cloture",
        entite: "DemandeAchat", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: "Seule une demande COMMANDÉE se clôture (ou version dépassée)." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Demande clôturée (fin de cycle)." };
  } catch (e) {
    console.error("[achats] clôture demande :", e);
    return { ok: false, message: "Clôture impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Consultation fournisseurs : devis
// ─────────────────────────────────────────────────────────────

export async function enregistrerDevisFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.commander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const demandeId = texteCourt(fd.get("demandeId"), 50);
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant du devis invalide." };
  const delaiBrut = Math.trunc(Number(fd.get("delaiJours") ?? 0));
  const delaiJours = Number.isFinite(delaiBrut) && delaiBrut > 0 && delaiBrut <= 1000 ? delaiBrut : null;
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const [demande, fournisseur] = await Promise.all([
        tx.demandeAchat.findFirst({
          where: { id: demandeId, etablissementId, annuleLe: null, statut: { in: ["soumise", "approuvee"] } },
          select: { id: true },
        }),
        tx.fournisseur.findFirst({
          where: { id: fournisseurId, etablissementId, annuleLe: null },
          select: { raisonSociale: true },
        }),
      ]);
      if (!demande || !fournisseur) return "invalide" as const;
      const cree = await tx.devisFournisseur.create({
        data: {
          etablissementId, demandeId, fournisseurId, montant, delaiJours,
          conditions: texteCourt(fd.get("conditions"), 200) || null,
          pieceReference: texteCourt(fd.get("pieceReference"), 120) || null,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "devis.creation",
        entite: "DevisFournisseur", entiteId: cree.id,
        nouvelleValeur: { demandeId, fournisseur: fournisseur.raisonSociale, montant, delaiJours },
      });
      return "ok" as const;
    });
    if (resultat === "invalide") return { ok: false, message: "Demande (soumise/approuvée) ou fournisseur introuvable." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Devis enregistré (archivé avec la consultation)." };
  } catch (e) {
    console.error("[achats] devis :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retenirDevisFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.commander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  if (!id) return { ok: false, message: "Devis introuvable." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const devis = await tx.devisFournisseur.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { demandeId: true },
      });
      if (!devis) return "introuvable" as const;
      // Un SEUL devis retenu actif par demande (le choix reste réversible et tracé).
      await tx.devisFournisseur.updateMany({
        where: { demandeId: devis.demandeId, etablissementId, annuleLe: null, retenu: true },
        data: { retenu: false },
      });
      await tx.devisFournisseur.update({ where: { id }, data: { retenu: true } });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "devis.retenu",
        entite: "DevisFournisseur", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Devis introuvable." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Devis retenu pour la commande." };
  } catch (e) {
    console.error("[achats] choix devis :", e);
    return { ok: false, message: "Choix impossible." };
  }
}

export async function retirerDevisFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.commander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.devisFournisseur.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, retenu: false, version: { increment: 1 } },
      });
      if (r.count > 0) {
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "devis.retrait",
          entite: "DevisFournisseur", entiteId: id,
        });
      }
      return r.count;
    });
    if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Devis retiré (archivé)." };
  } catch (e) {
    console.error("[achats] retrait devis :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Bons de commande
// ─────────────────────────────────────────────────────────────

/** Lignes du formulaire de BC (JSON) : désignation, quantité, PU — article économat optionnel. */
function lignesBcDepuisFormulaire(fd: FormData):
  | { ok: true; lignes: LigneBcSaisie[] }
  | { ok: false; message: string } {
  let brut: unknown;
  try {
    brut = JSON.parse(String(fd.get("lignes") ?? "[]"));
  } catch {
    return { ok: false, message: "Lignes illisibles." };
  }
  if (!Array.isArray(brut) || brut.length === 0) return { ok: false, message: "Ajoutez au moins une ligne." };
  if (brut.length > 60) return { ok: false, message: "Trop de lignes (60 maximum)." };
  const lignes: LigneBcSaisie[] = [];
  for (const l of brut) {
    if (typeof l !== "object" || l === null) return { ok: false, message: "Ligne invalide." };
    const o = l as Record<string, unknown>;
    const designation = String(o.designation ?? "").trim().slice(0, 160);
    const quantite = Math.trunc(Number(o.quantite ?? 0));
    const prixUnitaire = Math.trunc(Number(o.prixUnitaire ?? 0));
    if (!designation) return { ok: false, message: "Chaque ligne porte une désignation." };
    if (!Number.isFinite(quantite) || quantite <= 0 || quantite > 1_000_000) {
      return { ok: false, message: "Quantité invalide." };
    }
    if (!Number.isFinite(prixUnitaire) || prixUnitaire <= 0 || prixUnitaire > PLAFOND) {
      return { ok: false, message: "Prix unitaire invalide." };
    }
    lignes.push({
      designation, quantite, prixUnitaire,
      articleId: String(o.articleId ?? "").slice(0, 50) || undefined,
    });
  }
  return { ok: true, lignes };
}

export async function enregistrerBonCommande(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.commander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const demandeId = texteCourt(fd.get("demandeId"), 50);
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const rLignes = lignesBcDepuisFormulaire(fd);
  if (!rLignes.ok) return { ok: false, message: rLignes.message };
  const entete = {
    conditionsPaiement: texteCourt(fd.get("conditionsPaiement"), 160) || null,
    lieuLivraison: texteCourt(fd.get("lieuLivraison"), 160) || null,
    dateLivraisonPrevue: dateFacultative(fd.get("dateLivraisonPrevue")),
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // RM-900 : demande APPROUVÉE obligatoire (« empêcher tout achat hors procédure »).
      const [demande, fournisseur, articles] = await Promise.all([
        tx.demandeAchat.findFirst({
          where: { id: demandeId, etablissementId, annuleLe: null, statut: { in: ["approuvee", "commandee"] } },
          select: { id: true },
        }),
        // RM-901 : fournisseur ACTIF uniquement.
        tx.fournisseur.findFirst({
          where: { id: fournisseurId, etablissementId, annuleLe: null, statut: "actif" },
          select: { id: true },
        }),
        tx.articleEconomat.findMany({
          where: {
            etablissementId, annuleLe: null,
            id: { in: rLignes.lignes.flatMap((l) => (l.articleId ? [l.articleId] : [])) },
          },
          select: { id: true },
        }),
      ]);
      if (!demande) return "demande" as const;
      if (!fournisseur) return "fournisseur" as const;
      const articlesValides = new Set(articles.map((a) => a.id));
      const donneesLignes = rLignes.lignes.map((l, i) => ({
        designation: l.designation, quantite: l.quantite, prixUnitaire: l.prixUnitaire, ordre: i,
        articleId: l.articleId && articlesValides.has(l.articleId) ? l.articleId : null,
      }));
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const avant = await tx.bonCommande.findFirst({
          where: { id, etablissementId, annuleLe: null },
          select: { statut: true },
        });
        if (!avant) return "introuvable" as const;
        if (avant.statut !== "brouillon") return "fige" as const;
        const maj = await tx.bonCommande.updateMany({
          where: { id, etablissementId, version, statut: "brouillon" },
          data: { demandeId, fournisseurId, ...entete, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await tx.ligneBonCommande.updateMany({
          where: { bonCommandeId: id, annuleLe: null },
          data: { annuleLe: new Date(), annuleParId: u.id },
        });
        await tx.ligneBonCommande.createMany({ data: donneesLignes.map((l) => ({ ...l, bonCommandeId: id })) });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "bon_commande.modification",
          entite: "BonCommande", entiteId: id, nouvelleValeur: { demandeId, fournisseurId, lignes: donneesLignes.length },
        });
        return "ok" as const;
      }
      const exercice = await exerciceDe(etablissementId);
      const cree = await tx.bonCommande.create({
        data: { etablissementId, exercice, demandeId, fournisseurId, ...entete },
      });
      await tx.ligneBonCommande.createMany({ data: donneesLignes.map((l) => ({ ...l, bonCommandeId: cree.id })) });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "bon_commande.creation",
        entite: "BonCommande", entiteId: cree.id,
        nouvelleValeur: { demandeId, fournisseurId, lignes: donneesLignes.length },
      });
      return "ok" as const;
    });
    if (resultat === "demande") return { ok: false, message: "Le bon de commande exige une demande APPROUVÉE (RM-900)." };
    if (resultat === "fournisseur") return { ok: false, message: "Fournisseur introuvable ou non ACTIF (RM-901)." };
    if (resultat === "introuvable") return { ok: false, message: "Bon de commande introuvable." };
    if (resultat === "fige") return { ok: false, message: "Un bon ÉMIS ne se modifie plus (annulez-le si nécessaire)." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Bon de commande mis à jour." : "Bon de commande enregistré en brouillon." };
  } catch (e) {
    console.error("[achats] bon de commande :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function emettreBonCommande(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.commander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const bc = await tx.bonCommande.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: {
          demande: { select: { id: true, statut: true, categorieBudget: true, annuleLe: true } },
          fournisseur: { select: { statut: true, annuleLe: true, raisonSociale: true } },
          lignes: { where: { annuleLe: null }, select: { quantite: true, prixUnitaire: true } },
        },
      });
      if (!bc) return { erreur: "Bon de commande introuvable." };
      if (bc.statut !== "brouillon") return { erreur: "Seul un brouillon s'émet." };
      if (bc.demande.annuleLe || !["approuvee", "commandee"].includes(bc.demande.statut)) {
        return { erreur: "La demande liée n'est plus approuvée (RM-900)." };
      }
      if (bc.fournisseur.annuleLe || bc.fournisseur.statut !== "actif") {
        return { erreur: "Fournisseur non ACTIF : émission refusée (RM-901)." };
      }
      if (bc.lignes.length === 0) return { erreur: "Aucune ligne active : rien à commander." };
      const total = bc.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
      // RM-905 : l'ENGAGEMENT naît à l'émission — contrôle budgétaire sur le montant réel.
      const refusBudget = await controleBudgetAchat(tx, {
        etablissementId, exercice: bc.exercice, categorie: bc.demande.categorieBudget, montant: total,
      });
      if (refusBudget) return { erreur: refusBudget };
      const { reference } = await prochainNumero(tx, etablissementId, bc.exercice, "bon_commande", "BC");
      const maj = await tx.bonCommande.updateMany({
        where: { id, etablissementId, version, statut: "brouillon" },
        data: {
          statut: "emise", numero: reference, dateEmission: new Date(), dateComptable: new Date(),
          emisParId: u.id, emisParNom: u.nomComplet, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      if (bc.demande.statut === "approuvee") {
        await tx.demandeAchat.update({ where: { id: bc.demande.id }, data: { statut: "commandee" } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "bon_commande.emission",
        entite: "BonCommande", entiteId: id,
        nouvelleValeur: { numero: reference, fournisseur: bc.fournisseur.raisonSociale, total },
      });
      return { numero: reference };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Bon de commande ${resultat.numero} émis — l'engagement budgétaire est pris (RM-905).` };
  } catch (e) {
    console.error("[achats] émission BC :", e);
    return { ok: false, message: "Émission impossible." };
  }
}

export async function annulerBonCommande(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.commander");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const bc = await tx.bonCommande.findFirst({
        where: { id, etablissementId, annuleLe: null, statut: { not: "annulee" } },
        select: { numero: true, statut: true },
      });
      if (!bc) return "introuvable" as const;
      const [receptions, factures] = await Promise.all([
        tx.receptionAchat.count({ where: { bonCommandeId: id, annuleLe: null } }),
        tx.factureFournisseur.count({ where: { bonCommandeId: id, annuleLe: null } }),
      ]);
      if (receptions > 0 || factures > 0) return "mouvemente" as const;
      const maj = await tx.bonCommande.updateMany({
        where: { id, etablissementId, version },
        data: { statut: "annulee", motifAnnulation: motif, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "bon_commande.annulation",
        entite: "BonCommande", entiteId: id, ancienneValeur: bc, nouvelleValeur: { motif },
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Bon de commande introuvable." };
    if (resultat === "mouvemente") {
      return { ok: false, message: "Des réceptions ou factures existent : traitez-les d'abord (retour fournisseur, annulation de facture)." };
    }
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Bon de commande annulé — l'engagement budgétaire est libéré." };
  } catch (e) {
    console.error("[achats] annulation BC :", e);
    return { ok: false, message: "Annulation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Réceptions (RM-902) — entrée en stock économat automatique
// ─────────────────────────────────────────────────────────────

export async function enregistrerReception(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.receptionner");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const bonCommandeId = texteCourt(fd.get("bonCommandeId"), 50);
  let lignesBrutes: unknown;
  try {
    lignesBrutes = JSON.parse(String(fd.get("lignes") ?? "[]"));
  } catch {
    return { ok: false, message: "Lignes illisibles." };
  }
  if (!Array.isArray(lignesBrutes) || lignesBrutes.length === 0) {
    return { ok: false, message: "Saisissez au moins une quantité reçue." };
  }
  const saisies: LigneReceptionSaisie[] = [];
  for (const l of lignesBrutes) {
    const o = l as Record<string, unknown>;
    const ligneBonCommandeId = String(o.ligneBonCommandeId ?? "").slice(0, 50);
    const quantiteRecue = Math.trunc(Number(o.quantiteRecue ?? 0));
    const quantiteRefusee = Math.trunc(Number(o.quantiteRefusee ?? 0));
    if (!ligneBonCommandeId || !Number.isFinite(quantiteRecue) || quantiteRecue < 0 || quantiteRecue > 1_000_000) {
      return { ok: false, message: "Quantité reçue invalide." };
    }
    if (!Number.isFinite(quantiteRefusee) || quantiteRefusee < 0 || quantiteRefusee > 1_000_000) {
      return { ok: false, message: "Quantité refusée invalide." };
    }
    if (quantiteRecue === 0 && quantiteRefusee === 0) continue;
    saisies.push({
      ligneBonCommandeId, quantiteRecue, quantiteRefusee,
      observation: String(o.observation ?? "").slice(0, 160) || undefined,
    });
  }
  if (saisies.length === 0) return { ok: false, message: "Saisissez au moins une quantité reçue." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const bc = await tx.bonCommande.findFirst({
        where: { id: bonCommandeId, etablissementId, annuleLe: null, statut: "emise" },
        include: {
          lignes: {
            where: { annuleLe: null },
            include: {
              lignesReception: { where: { reception: { annuleLe: null } }, select: { quantiteRecue: true } },
            },
          },
        },
      });
      if (!bc) return { erreur: "Bon de commande émis introuvable (brouillon ou annulé ?)." };
      const lignesParId = new Map(bc.lignes.map((l) => [l.id, l]));
      // RM-902 : le CUMUL reçu ne dépasse JAMAIS le commandé (l'autorisation spécifique de
      // dépassement viendra avec le paramétrage — refus strict en V1).
      for (const s of saisies) {
        const ligne = lignesParId.get(s.ligneBonCommandeId);
        if (!ligne) return { erreur: "Une ligne reçue n'appartient pas à ce bon." };
        const dejaRecu = ligne.lignesReception.reduce((x, r) => x + r.quantiteRecue, 0);
        if (dejaRecu + s.quantiteRecue > ligne.quantite) {
          return {
            erreur: `« ${ligne.designation} » : ${dejaRecu + s.quantiteRecue} reçu(s) pour ${ligne.quantite} commandé(s) — dépassement refusé (RM-902).`,
          };
        }
      }
      const reception = await tx.receptionAchat.create({
        data: {
          etablissementId, bonCommandeId, receptionnaireId: u.id, receptionnaireNom: u.nomComplet,
          observations: texteCourt(fd.get("observations"), 300) || null, dateComptable: new Date(),
        },
      });
      let entreesStock = 0;
      for (const s of saisies) {
        const ligne = lignesParId.get(s.ligneBonCommandeId)!;
        let mouvementStockId: string | null = null;
        // Article STOCKABLE : l'entrée en stock économat découle de la réception (12/WF-005).
        if (ligne.articleId && s.quantiteRecue > 0) {
          const article = await tx.articleEconomat.findFirst({
            where: { id: ligne.articleId, etablissementId, annuleLe: null },
            select: { id: true },
          });
          if (article) {
            const mouvement = await tx.mouvementStock.create({
              data: {
                articleId: article.id, etablissementId, type: "entree",
                quantite: s.quantiteRecue, montant: s.quantiteRecue * ligne.prixUnitaire,
                date: new Date(), dateComptable: new Date(), saisiParId: u.id,
              },
            });
            await tx.articleEconomat.update({
              where: { id: article.id },
              data: { stock: { increment: s.quantiteRecue } },
            });
            mouvementStockId = mouvement.id;
            entreesStock += 1;
          }
        }
        await tx.ligneReception.create({
          data: {
            receptionId: reception.id, ligneBonCommandeId: s.ligneBonCommandeId,
            quantiteRecue: s.quantiteRecue, quantiteRefusee: s.quantiteRefusee ?? 0,
            observation: s.observation ?? null, mouvementStockId,
          },
        });
      }
      // Conformité (12) : écarts DÉRIVÉS et signalés — jamais bloquants à ce stade.
      const totalCommande = bc.lignes.reduce((s, l) => s + l.quantite, 0);
      const totalRecuApres = bc.lignes.reduce(
        (s, l) =>
          s + l.lignesReception.reduce((x, r) => x + r.quantiteRecue, 0) +
          (saisies.find((x) => x.ligneBonCommandeId === l.id)?.quantiteRecue ?? 0),
        0,
      );
      const refusees = saisies.reduce((s, x) => s + (x.quantiteRefusee ?? 0), 0);
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "reception.creation",
        entite: "ReceptionAchat", entiteId: reception.id,
        nouvelleValeur: { bonCommandeId, lignes: saisies.length, entreesStock, refusees },
      });
      return { complete: totalRecuApres >= totalCommande, entreesStock, refusees };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    const details = [
      resultat.complete ? "réception TOTALE" : "réception PARTIELLE",
      resultat.entreesStock > 0 ? `${resultat.entreesStock} entrée(s) en stock économat` : null,
      resultat.refusees > 0 ? `${resultat.refusees} article(s) REFUSÉ(S) — écart signalé` : null,
    ].filter(Boolean).join(" · ");
    return { ok: true, message: `Réception enregistrée (${details}).` };
  } catch (e) {
    console.error("[achats] réception :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function annulerReception(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.receptionner");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const reception = await tx.receptionAchat.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: { lignes: { select: { quantiteRecue: true, mouvementStockId: true } } },
      });
      if (!reception) return "introuvable" as const;
      const maj = await tx.receptionAchat.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      // Symétrie stock : les entrées liées sont annulées et le stock redescend d'autant.
      for (const l of reception.lignes) {
        if (!l.mouvementStockId) continue;
        const mouvement = await tx.mouvementStock.findFirst({
          where: { id: l.mouvementStockId, annuleLe: null },
          select: { id: true, articleId: true, quantite: true },
        });
        if (!mouvement) continue;
        await tx.mouvementStock.update({
          where: { id: mouvement.id },
          data: { annuleLe: new Date(), annuleParId: u.id },
        });
        await tx.articleEconomat.update({
          where: { id: mouvement.articleId },
          data: { stock: { decrement: mouvement.quantite } },
        });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "reception.annulation",
        entite: "ReceptionAchat", entiteId: id, nouvelleValeur: { motif },
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Réception introuvable." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Réception annulée — stock régularisé." };
  } catch (e) {
    console.error("[achats] annulation réception :", e);
    return { ok: false, message: "Annulation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Factures fournisseurs (RM-903/904)
// ─────────────────────────────────────────────────────────────

export async function enregistrerFactureFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.facturer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const bonCommandeId = texteCourt(fd.get("bonCommandeId"), 50);
  const numeroFournisseur = texteCourt(fd.get("numeroFournisseur"), 60);
  const pieceJustificative = texteCourt(fd.get("pieceJustificative"), 120);
  const montant = montantValide(fd.get("montant"));
  if (!numeroFournisseur) return { ok: false, message: "Le numéro de la facture du fournisseur est obligatoire." };
  if (!pieceJustificative) return { ok: false, message: "La pièce justificative est obligatoire (12)." };
  if (!montant) return { ok: false, message: "Montant invalide." };
  const taxesBrutes = Math.trunc(Number(fd.get("taxes") ?? 0));
  const taxes = Number.isFinite(taxesBrutes) && taxesBrutes >= 0 && taxesBrutes <= montant ? taxesBrutes : 0;
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const bc = await tx.bonCommande.findFirst({
        where: { id: bonCommandeId, etablissementId, annuleLe: null, statut: "emise" },
        select: {
          exercice: true, fournisseurId: true, numero: true,
          lignes: { where: { annuleLe: null }, select: { quantite: true, prixUnitaire: true } },
        },
      });
      if (!bc) return { erreur: "Bon de commande émis introuvable." };
      const cree = await tx.factureFournisseur.create({
        data: {
          etablissementId, exercice: bc.exercice, bonCommandeId, fournisseurId: bc.fournisseurId,
          numeroFournisseur, montant, taxes,
          dateEcheance: dateFacultative(fd.get("dateEcheance")),
          pieceJustificative, dateComptable: new Date(),
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "facture_fournisseur.creation",
        entite: "FactureFournisseur", entiteId: cree.id,
        nouvelleValeur: { bonCommande: bc.numero, numeroFournisseur, montant, taxes },
      });
      const totalBc = bc.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
      return { ecart: montant - totalBc };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Facture fournisseur saisie${resultat.ecart !== 0 ? ` — ÉCART de ${resultat.ecart.toLocaleString("fr-FR")} F par rapport à la commande (contrôle de cohérence, 12)` : " (conforme au montant commandé)"}.`,
    };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: `La facture ${numeroFournisseur} de ce fournisseur est DÉJÀ saisie (RM-903).` };
    }
    console.error("[achats] facture fournisseur :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function validerFactureFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.facturer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  // RM-904 : les comptes 60x/401 et le journal AC doivent exister — semis idempotent AVANT.
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const facture = await tx.factureFournisseur.findFirst({
        where: { id, etablissementId, annuleLe: null, statut: "saisie" },
        include: {
          fournisseur: { select: { raisonSociale: true } },
          bonCommande: { select: { demande: { select: { categorieBudget: true } } } },
        },
      });
      if (!facture) return { erreur: "Facture (au statut « saisie ») introuvable." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) {
        return { erreur: MESSAGE_PERIODE_CLOTUREE };
      }
      const maj = await tx.factureFournisseur.updateMany({
        where: { id, etablissementId, version, statut: "saisie" },
        data: {
          statut: "validee", valideeParId: u.id, valideeParNom: u.nomComplet,
          dateValidation: new Date(), version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      // RM-904 : « toute facture validée génère automatiquement les écritures comptables » —
      // journal AC : débit charge (catégorie budgétaire) / crédit 401 Fournisseurs.
      const ecriture = await ecrireEcritureAutomatique(tx, {
        etablissementId, exercice: facture.exercice, codeJournal: "AC", date: new Date(),
        libelle: `Facture fournisseur ${facture.fournisseur.raisonSociale} — ${facture.numeroFournisseur}`,
        pieceJustificative: facture.pieceJustificative || facture.numeroFournisseur,
        sourceType: "facture_fournisseur", sourceId: id, utilisateurId: u.id,
        lignes: [
          { compteNumero: facture.bonCommande.demande.categorieBudget, debit: facture.montant, credit: 0 },
          { compteNumero: "401", debit: 0, credit: facture.montant },
        ],
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "facture_fournisseur.validation",
        entite: "FactureFournisseur", entiteId: id,
        nouvelleValeur: { numeroFournisseur: facture.numeroFournisseur, montant: facture.montant, ecriture },
      });
      return { ecriture };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Facture validée — écriture comptable ${resultat.ecriture === "ok" ? "générée au journal AC (RM-904)" : "déjà présente"}.`,
    };
  } catch (e) {
    console.error("[achats] validation facture :", e);
    return { ok: false, message: "Validation impossible." };
  }
}

export async function annulerFactureFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.facturer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const facture = await tx.factureFournisseur.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: {
          fournisseur: { select: { raisonSociale: true } },
          bonCommande: { select: { demande: { select: { categorieBudget: true } } } },
        },
      });
      if (!facture) return { erreur: "Facture introuvable." };
      const paiements = await tx.paiementFournisseur.count({ where: { factureId: id, annuleLe: null } });
      if (paiements > 0) return { erreur: "Des paiements existent : annulez-les d'abord." };
      if (facture.statut === "validee" && (await periodeCloturee(tx, etablissementId, periodeDe(new Date())))) {
        return { erreur: MESSAGE_PERIODE_CLOTUREE };
      }
      const maj = await tx.factureFournisseur.updateMany({
        where: { id, etablissementId, version },
        data: {
          statut: "annulee", motifAnnulation: motif,
          annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      // Facture VALIDÉE : la charge constatée est reprise par une écriture INVERSE (le
      // registre du 11 ne se corrige JAMAIS par suppression — RM-701/702).
      if (facture.statut === "validee") {
        await ecrireEcritureAutomatique(tx, {
          etablissementId, exercice: facture.exercice, codeJournal: "AC", date: new Date(),
          libelle: `Annulation facture ${facture.fournisseur.raisonSociale} — ${facture.numeroFournisseur} : ${motif}`,
          pieceJustificative: facture.pieceJustificative || facture.numeroFournisseur,
          sourceType: "annulation_facture_fournisseur", sourceId: id, utilisateurId: u.id,
          lignes: [
            { compteNumero: "401", debit: facture.montant, credit: 0 },
            { compteNumero: facture.bonCommande.demande.categorieBudget, debit: 0, credit: facture.montant },
          ],
        });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "facture_fournisseur.annulation",
        entite: "FactureFournisseur", entiteId: id,
        ancienneValeur: { statut: facture.statut, montant: facture.montant }, nouvelleValeur: { motif },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Facture annulée (écriture inverse passée si elle était validée)." };
  } catch (e) {
    console.error("[achats] annulation facture :", e);
    return { ok: false, message: "Annulation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Paiements fournisseurs (RM-903) et retours
// ─────────────────────────────────────────────────────────────

export async function payerFactureFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.payer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const factureId = texteCourt(fd.get("factureId"), 50);
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const mode = modeValide(fd.get("mode"));
  const reference = texteCourt(fd.get("reference"), 80) || null;
  const clos = await finExerciceClos(etablissementId);
  if (clos && new Date() <= clos) return { ok: false, message: "Exercice CLÔTURÉ — paiement refusé." };
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const facture = await tx.factureFournisseur.findFirst({
        where: { id: factureId, etablissementId, annuleLe: null, statut: "validee" },
        include: {
          fournisseur: { select: { raisonSociale: true } },
          bonCommande: { select: { demande: { select: { categorieBudget: true } } } },
          paiements: { where: { annuleLe: null }, select: { montant: true } },
        },
      });
      if (!facture) return { erreur: "Facture VALIDÉE introuvable (une facture se paie après validation)." };
      // RM-903 : jamais payée deux fois — le CUMUL des paiements actifs reste ≤ au montant.
      const dejaPaye = facture.paiements.reduce((s, p) => s + p.montant, 0);
      if (dejaPaye >= facture.montant) return { erreur: "Cette facture est DÉJÀ soldée (RM-903)." };
      if (dejaPaye + montant > facture.montant) {
        return { erreur: `Reste à payer : ${(facture.montant - dejaPaye).toLocaleString("fr-FR")} F — le cumul ne peut pas dépasser la facture (RM-903).` };
      }
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) {
        return { erreur: MESSAGE_PERIODE_CLOTUREE };
      }
      // Espèces : session de caisse exigée si l'établissement utilise des caisses (09).
      let sessionCaisseId: string | null = null;
      if (mode === "especes") {
        const controle = await controleSessionEspeces(tx, etablissementId, u.id);
        if (controle.erreur) return { erreur: controle.erreur };
        sessionCaisseId = controle.sessionId;
      }
      const categorie = facture.bonCommande.demande.categorieBudget;
      // Trésorerie/KPI/budget : l'OperationFinanciere porte la sortie de fonds (60x) — le 11
      // EXCLUT ces opérations de sa collecte (l'écriture formelle dédiée est ci-dessous).
      const operation = await tx.operationFinanciere.create({
        data: {
          etablissementId, sens: "depense", categorie,
          libelle: `Règlement fournisseur ${facture.fournisseur.raisonSociale} — facture ${facture.numeroFournisseur}`.slice(0, 200),
          montant, mode, reference: reference ?? facture.numeroFournisseur,
          date: new Date(), dateComptable: new Date(), saisiParId: u.id, sessionCaisseId,
        },
      });
      const paiement = await tx.paiementFournisseur.create({
        data: {
          etablissementId, factureId, montant, mode, reference,
          operationId: operation.id, payeParId: u.id, payeParNom: u.nomComplet, dateComptable: new Date(),
        },
      });
      // Registre formel (12) : débit 401 Fournisseurs / crédit trésorerie (571/551/521).
      await ecrireEcritureAutomatique(tx, {
        etablissementId, exercice: facture.exercice, codeJournal: mode === "especes" ? "CA" : "BQ",
        date: new Date(),
        libelle: `Règlement fournisseur ${facture.fournisseur.raisonSociale} — facture ${facture.numeroFournisseur}`,
        pieceJustificative: reference ?? facture.numeroFournisseur,
        sourceType: "paiement_fournisseur", sourceId: paiement.id, utilisateurId: u.id,
        lignes: [
          { compteNumero: "401", debit: montant, credit: 0 },
          { compteNumero: TRESORERIE_PAR_MODE[mode] ?? "571", debit: 0, credit: montant },
        ],
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "paiement_fournisseur.creation",
        entite: "PaiementFournisseur", entiteId: paiement.id,
        nouvelleValeur: { facture: facture.numeroFournisseur, montant, mode, solde: dejaPaye + montant >= facture.montant },
      });
      return { solde: dejaPaye + montant >= facture.montant };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: resultat.solde ? "Paiement enregistré — facture SOLDÉE." : "Paiement partiel enregistré (échelonnement possible)." };
  } catch (e) {
    console.error("[achats] paiement fournisseur :", e);
    return { ok: false, message: "Paiement impossible." };
  }
}

export async function annulerPaiementFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.payer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const paiement = await tx.paiementFournisseur.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: {
          facture: {
            select: { exercice: true, numeroFournisseur: true, fournisseur: { select: { raisonSociale: true } } },
          },
        },
      });
      if (!paiement) return { erreur: "Paiement introuvable." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) {
        return { erreur: MESSAGE_PERIODE_CLOTUREE };
      }
      const maj = await tx.paiementFournisseur.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      if (paiement.operationId) {
        await tx.operationFinanciere.updateMany({
          where: { id: paiement.operationId, etablissementId, annule: false },
          data: { annule: true, motifAnnulation: motif, annuleLe: new Date(), annuleParId: u.id },
        });
      }
      // Écriture INVERSE (débit trésorerie / crédit 401) — le registre ne s'efface jamais.
      await ecrireEcritureAutomatique(tx, {
        etablissementId, exercice: paiement.facture.exercice,
        codeJournal: paiement.mode === "especes" ? "CA" : "BQ", date: new Date(),
        libelle: `Annulation règlement ${paiement.facture.fournisseur.raisonSociale} — facture ${paiement.facture.numeroFournisseur} : ${motif}`,
        pieceJustificative: paiement.reference ?? paiement.facture.numeroFournisseur,
        sourceType: "annulation_paiement_fournisseur", sourceId: id, utilisateurId: u.id,
        lignes: [
          { compteNumero: TRESORERIE_PAR_MODE[paiement.mode] ?? "571", debit: paiement.montant, credit: 0 },
          { compteNumero: "401", debit: 0, credit: paiement.montant },
        ],
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "paiement_fournisseur.annulation",
        entite: "PaiementFournisseur", entiteId: id,
        ancienneValeur: { montant: paiement.montant, mode: paiement.mode }, nouvelleValeur: { motif },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Paiement annulé (opération et écriture inverses passées)." };
  } catch (e) {
    console.error("[achats] annulation paiement :", e);
    return { ok: false, message: "Annulation impossible." };
  }
}

export async function enregistrerRetourFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.achats.payer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const ligneBonCommandeId = texteCourt(fd.get("ligneBonCommandeId"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const quantite = Math.trunc(Number(fd.get("quantite") ?? 0));
  if (!motif) return { ok: false, message: "Le motif du retour est obligatoire." };
  if (!Number.isFinite(quantite) || quantite <= 0 || quantite > 1_000_000) {
    return { ok: false, message: "Quantité invalide." };
  }
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneBonCommande.findFirst({
        where: { id: ligneBonCommandeId, annuleLe: null, bonCommande: { etablissementId, annuleLe: null } },
        include: {
          bonCommande: {
            select: {
              id: true, exercice: true, numero: true,
              demande: { select: { categorieBudget: true } },
              fournisseur: { select: { raisonSociale: true } },
              factures: { where: { annuleLe: null, statut: "validee" }, select: { id: true }, take: 1 },
            },
          },
          lignesReception: { where: { reception: { annuleLe: null } }, select: { quantiteRecue: true } },
          retours: { where: { annuleLe: null }, select: { quantite: true } },
        },
      });
      if (!ligne) return { erreur: "Ligne de commande introuvable." };
      const recue = ligne.lignesReception.reduce((s, r) => s + r.quantiteRecue, 0);
      const dejaRetournee = ligne.retours.reduce((s, r) => s + r.quantite, 0);
      if (quantite > recue - dejaRetournee) {
        return { erreur: `Retour impossible : ${recue - dejaRetournee} article(s) retournable(s) (reçus ${recue}, déjà retournés ${dejaRetournee}).` };
      }
      const montantRetour = quantite * ligne.prixUnitaire;
      if (ligne.bonCommande.factures.length > 0 && (await periodeCloturee(tx, etablissementId, periodeDe(new Date())))) {
        return { erreur: MESSAGE_PERIODE_CLOTUREE };
      }
      const { reference } = await prochainNumero(tx, etablissementId, ligne.bonCommande.exercice, "retour_fournisseur", "BR");
      // Régularisation de stock : sortie tracée d'un type dédié (l'économat reste la vérité du 14).
      let mouvementStockId: string | null = null;
      if (ligne.articleId) {
        const article = await tx.articleEconomat.findFirst({
          where: { id: ligne.articleId, etablissementId, annuleLe: null },
          select: { id: true },
        });
        if (article) {
          const mouvement = await tx.mouvementStock.create({
            data: {
              articleId: article.id, etablissementId, type: "retour_fournisseur",
              quantite, montant: montantRetour, date: new Date(), dateComptable: new Date(), saisiParId: u.id,
            },
          });
          await tx.articleEconomat.update({
            where: { id: article.id },
            data: { stock: { decrement: quantite } },
          });
          mouvementStockId = mouvement.id;
        }
      }
      const retour = await tx.retourFournisseur.create({
        data: {
          etablissementId, bonCommandeId: ligne.bonCommande.id, ligneBonCommandeId,
          numero: reference, quantite, motif, mouvementStockId,
          retourneParId: u.id, retourneParNom: u.nomComplet, dateComptable: new Date(),
        },
      });
      // Écriture de régularisation (12) si une facture VALIDÉE existe : débit 401 / crédit charge.
      let ecriture: "ok" | "existe" | "comptes_manquants" | "sans_objet" = "sans_objet";
      if (ligne.bonCommande.factures.length > 0) {
        ecriture = await ecrireEcritureAutomatique(tx, {
          etablissementId, exercice: ligne.bonCommande.exercice, codeJournal: "AC", date: new Date(),
          libelle: `Retour fournisseur ${ligne.bonCommande.fournisseur.raisonSociale} — ${reference} (${ligne.designation})`,
          pieceJustificative: reference,
          sourceType: "retour_fournisseur", sourceId: retour.id, utilisateurId: u.id,
          lignes: [
            { compteNumero: "401", debit: montantRetour, credit: 0 },
            { compteNumero: ligne.bonCommande.demande.categorieBudget, debit: 0, credit: montantRetour },
          ],
        });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "retour_fournisseur.creation",
        entite: "RetourFournisseur", entiteId: retour.id,
        nouvelleValeur: { numero: reference, bonCommande: ligne.bonCommande.numero, quantite, montantRetour, ecriture },
      });
      return { numero: reference, stock: mouvementStockId !== null, ecriture };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    const details = [
      resultat.stock ? "stock régularisé" : null,
      resultat.ecriture === "ok" ? "écriture de régularisation passée" : null,
    ].filter(Boolean).join(" · ");
    return { ok: true, message: `Bon de retour ${resultat.numero} enregistré${details ? ` (${details})` : ""}.` };
  } catch (e) {
    console.error("[achats] retour fournisseur :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}
