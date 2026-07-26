"use server";

/**
 * Actions serveur du sous-module BUDGETS (16 + 05B/02B) : enveloppes budgétaires (workflow
 * préparation → vote/approbation → exécution → clôture ; vote par un SECOND acteur), lignes
 * budgétaires enrichies (centre de coût, rattachement à une enveloppe ; RM-1304 : ligne
 * clôturée figée), révisions historisées (augmentation/diminution/virement/ouverture/
 * annulation — RM-1301, jamais sous l'engagé+consommé), centres de coûts/profits,
 * engagements manuels (contrats/marchés/conventions — RM-1302, réservent immédiatement des
 * crédits). Le DISPONIBLE et le CONSOMMÉ restent DÉRIVÉS (jamais stockés).
 *
 * TOUTES : garde granulaire, transaction + journaliserFinance, verrouillage optimiste,
 * annulations logiques. Fichier "use server" : exports async uniquement.
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
import { montantValide, texteCourt } from "./commun/validation";
import { executionParCategorie } from "./budgets/serveur";
import { SOURCES_ENGAGEMENT, TYPES_BUDGET, TYPES_REVISION } from "./budgets/types";

const CHEMIN = "/app/vie-scolaire/finances";

async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

const categorieValide = (code: string, sens: string) =>
  CATEGORIES_OHADA.some((c) => c.code === code && c.sens === sens);

// ─────────────────────────────────────────────────────────────
//  Enveloppes budgétaires (workflow)
// ─────────────────────────────────────────────────────────────

export async function enregistrerBudgetEnveloppe(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const libelle = texteCourt(fd.get("libelle"), 120);
  const type = texteCourt(fd.get("type"), 20) || "fonctionnement";
  if (!libelle) return { ok: false, message: "Le libellé du budget est obligatoire." };
  if (!TYPES_BUDGET.some((t) => t.code === type)) return { ok: false, message: "Type de budget invalide." };
  const notes = texteCourt(fd.get("notes"), 400) || null;
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.budget.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true } });
        if (!avant) return "introuvable" as const;
        if (avant.statut !== "brouillon") return "fige" as const;
        const maj = await tx.budget.updateMany({
          where: { id, etablissementId, version, statut: "brouillon" },
          data: { libelle, type, notes, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "budget.modification",
          entite: "Budget", entiteId: id, nouvelleValeur: { libelle, type },
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Budget introuvable." };
      if (resultat === "fige") return { ok: false, message: "Seul un budget en brouillon se modifie." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      const exercice = await exerciceDe(etablissementId);
      await prisma.$transaction(async (tx) => {
        const cree = await tx.budget.create({
          data: { etablissementId, exercice, libelle, type, notes, preparParId: u.id, preparParNom: u.nomComplet },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "budget.creation",
          entite: "Budget", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Budget mis à jour." : "Budget créé (brouillon)." };
  } catch (e) {
    console.error("[budget] enveloppe :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function soumettreBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const lignes = await tx.budgetLigne.count({ where: { budgetId: id, annuleLe: null } });
      if (lignes === 0) return "vide" as const;
      const maj = await tx.budget.updateMany({
        where: { id, etablissementId, version, statut: "brouillon", annuleLe: null },
        data: { statut: "soumis", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "budget.soumission", entite: "Budget", entiteId: id });
      return "ok" as const;
    });
    if (resultat === "vide") return { ok: false, message: "Ajoutez au moins une ligne budgétaire avant de soumettre." };
    if (resultat === "conflit") return { ok: false, message: "Seul un budget en brouillon se soumet (ou version dépassée)." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Budget soumis au vote." };
  } catch (e) {
    console.error("[budget] soumission :", e);
    return { ok: false, message: "Soumission impossible." };
  }
}

export async function voterBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.voter");
  if (!u) return { ok: false, message: "Action non autorisée (le vote revient à la direction)." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const decision = texteCourt(fd.get("decision"), 10); // « approuver » | « rejeter »
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (decision !== "approuver" && decision !== "rejeter") return { ok: false, message: "Décision invalide." };
  try {
    const budget = await prisma.budget.findFirst({
      where: { id, etablissementId, annuleLe: null },
      select: { statut: true, preparParId: true, libelle: true },
    });
    if (!budget) return { ok: false, message: "Budget introuvable." };
    if (budget.statut !== "soumis") return { ok: false, message: "Seul un budget SOUMIS se vote." };
    // Séparation des responsabilités : le votant n'est pas le préparateur.
    if (budget.preparParId && budget.preparParId === u.id) return { ok: false, message: MESSAGE_SEPARATION_RESPONSABILITES };
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.budget.updateMany({
        where: { id, etablissementId, version, statut: "soumis" },
        data: decision === "approuver"
          ? { statut: "execution", voteParId: u.id, voteParNom: u.nomComplet, dateVote: new Date(), version: { increment: 1 } }
          : { statut: "brouillon", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: decision === "approuver" ? "budget.vote_approbation" : "budget.vote_rejet",
        entite: "Budget", entiteId: id, nouvelleValeur: { libelle: budget.libelle, decision },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: decision === "approuver" ? "Budget voté — passage en EXÉCUTION." : "Budget renvoyé en brouillon (rejeté)." };
  } catch (e) {
    console.error("[budget] vote :", e);
    return { ok: false, message: "Vote impossible." };
  }
}

export async function cloturerBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.voter");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.budget.updateMany({
        where: { id, etablissementId, version, statut: "execution", annuleLe: null },
        data: { statut: "cloture", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await tx.budgetLigne.updateMany({ where: { budgetId: id, annuleLe: null }, data: { statut: "cloturee" } });
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "budget.cloture", entite: "Budget", entiteId: id });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: "Seul un budget EN EXÉCUTION se clôture (ou version dépassée)." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Budget clôturé — ses lignes sont figées (RM-1304)." };
  } catch (e) {
    console.error("[budget] clôture :", e);
    return { ok: false, message: "Clôture impossible." };
  }
}

export async function retirerBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const budget = await tx.budget.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true } });
      if (!budget) return "introuvable" as const;
      if (budget.statut !== "brouillon") return "fige" as const;
      // Les lignes rattachées redeviennent des lignes libres (budgetId détaché par la FK SetNull).
      const maj = await tx.budget.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "budget.retrait", entite: "Budget", entiteId: id });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Budget introuvable." };
    if (resultat === "fige") return { ok: false, message: "Seul un budget en brouillon se retire." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Budget retiré (ses lignes redeviennent libres)." };
  } catch (e) {
    console.error("[budget] retrait :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Lignes budgétaires
// ─────────────────────────────────────────────────────────────

export async function enregistrerLigneBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const categorie = texteCourt(fd.get("categorie"), 10);
  const sens = texteCourt(fd.get("sens"), 10);
  const montantPrevu = montantValide(fd.get("montantPrevu"));
  if (!categorieValide(categorie, sens)) return { ok: false, message: "Catégorie / sens invalide." };
  if (montantPrevu === null) return { ok: false, message: "Montant prévu invalide." };
  const budgetIdBrut = texteCourt(fd.get("budgetId"), 50);
  const centreCoutIdBrut = texteCourt(fd.get("centreCoutId"), 50);
  const libelle = texteCourt(fd.get("libelle"), 120) || null;
  const code = texteCourt(fd.get("code"), 20) || null;
  try {
    const exercice = await exerciceDe(etablissementId);
    const [budget, centre] = await Promise.all([
      budgetIdBrut
        ? prisma.budget.findFirst({ where: { id: budgetIdBrut, etablissementId, annuleLe: null }, select: { id: true, statut: true } })
        : Promise.resolve(null),
      centreCoutIdBrut
        ? prisma.centreCout.findFirst({ where: { id: centreCoutIdBrut, etablissementId, annuleLe: null }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (budgetIdBrut && !budget) return { ok: false, message: "Enveloppe budgétaire introuvable." };
    if (budget && budget.statut !== "brouillon") return { ok: false, message: "On n'ajoute des lignes qu'à un budget en brouillon." };
    const resultat = await prisma.$transaction(async (tx) => {
      const existante = await tx.budgetLigne.findUnique({
        where: { etablissementId_exercice_categorie_sens: { etablissementId, exercice, categorie, sens } },
        select: { id: true, statut: true, annuleLe: true },
      });
      if (existante && existante.annuleLe === null && existante.statut === "cloturee") return "cloturee" as const;
      await tx.budgetLigne.upsert({
        where: { etablissementId_exercice_categorie_sens: { etablissementId, exercice, categorie, sens } },
        create: {
          etablissementId, exercice, categorie, sens, montantPrevu, libelle, code,
          budgetId: budget?.id ?? null, centreCoutId: centre?.id ?? null,
        },
        update: {
          montantPrevu, libelle, code, budgetId: budget?.id ?? null, centreCoutId: centre?.id ?? null,
          annuleLe: null, annuleParId: null, statut: "active", version: { increment: 1 },
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "budget.ligne_enregistrement",
        entite: "BudgetLigne", entiteId: `${exercice}:${categorie}:${sens}`,
        nouvelleValeur: { categorie, sens, montantPrevu, budgetId: budget?.id ?? null },
      });
      return "ok" as const;
    });
    if (resultat === "cloturee") return { ok: false, message: "Cette ligne est CLÔTURÉE : elle ne se modifie plus (RM-1304)." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Ligne budgétaire enregistrée." };
  } catch (e) {
    console.error("[budget] ligne :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function cloturerLigneBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.budgetLigne.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: { statut: "cloturee", version: { increment: 1 } },
      });
      if (r.count > 0) {
        await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "budget.ligne_cloture", entite: "BudgetLigne", entiteId: id });
      }
      return r.count;
    });
    if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Ligne clôturée (figée)." };
  } catch (e) {
    console.error("[budget] clôture ligne :", e);
    return { ok: false, message: "Clôture impossible." };
  }
}

export async function retirerLigneBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const ligne = await tx.budgetLigne.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true } });
      if (!ligne) return "introuvable" as const;
      if (ligne.statut === "cloturee") return "cloturee" as const;
      const maj = await tx.budgetLigne.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "budget.ligne_retrait", entite: "BudgetLigne", entiteId: id });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Ligne introuvable." };
    if (resultat === "cloturee") return { ok: false, message: "Une ligne clôturée ne se retire pas (RM-1304)." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Ligne retirée." };
  } catch (e) {
    console.error("[budget] retrait ligne :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Révisions (RM-1301) — jamais sous l'engagé + consommé
// ─────────────────────────────────────────────────────────────

export async function reviserBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.reviser");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const type = texteCourt(fd.get("type"), 15);
  const motif = texteCourt(fd.get("motif"), 300);
  const montant = montantValide(fd.get("montant"));
  const ligneId = texteCourt(fd.get("ligneId"), 50);
  const ligneCibleId = texteCourt(fd.get("ligneCibleId"), 50);
  if (!TYPES_REVISION.some((t) => t.code === type)) return { ok: false, message: "Type de révision invalide." };
  if (!motif) return { ok: false, message: "Le motif de la révision est obligatoire (RM-1301)." };
  if (montant === null) return { ok: false, message: "Montant de révision invalide." };
  if (!ligneId) return { ok: false, message: "Ligne budgétaire à réviser manquante." };
  const virement = type === "virement";
  if (virement && (!ligneCibleId || ligneCibleId === ligneId)) return { ok: false, message: "Un virement exige une ligne destinataire distincte." };

  try {
    const exercice = await exerciceDe(etablissementId);
    const execution = await executionParCategorie(prisma, etablissementId, exercice);
    const resultat = await prisma.$transaction(async (tx) => {
      const source = await tx.budgetLigne.findFirst({
        where: { id: ligneId, etablissementId, annuleLe: null },
        select: { id: true, categorie: true, montantPrevu: true, montantRevise: true, statut: true, version: true },
      });
      if (!source) return { erreur: "Ligne budgétaire introuvable." };
      if (source.statut === "cloturee") return { erreur: "Ligne clôturée : révision interdite (RM-1304)." };
      const voteSource = source.montantRevise ?? source.montantPrevu;
      const baisse = type === "diminution" || type === "annulation" || virement;
      const hausse = type === "augmentation" || type === "ouverture";
      const nouveauVoteSource = baisse ? voteSource - montant : hausse ? voteSource + montant : voteSource;
      if (baisse) {
        // On ne descend jamais sous l'engagé + consommé de la catégorie (RM-1300).
        const a = execution.get(source.categorie);
        const plancher = a ? a.engageBC + a.engageManuel + a.consomme : 0;
        if (nouveauVoteSource < plancher) {
          return { erreur: `Révision refusée : le crédit ne peut pas descendre sous l'engagé + consommé (${plancher.toLocaleString("fr-FR")} F) de la catégorie ${source.categorie}.` };
        }
      }
      await tx.budgetLigne.update({
        where: { id: source.id },
        data: { montantRevise: nouveauVoteSource, version: { increment: 1 } },
      });
      await tx.revisionBudget.create({
        data: {
          etablissementId, exercice, type, ligneId: source.id,
          ligneCibleId: virement ? ligneCibleId : null, categorie: source.categorie,
          montant, montantAvant: voteSource, montantApres: nouveauVoteSource, motif,
          parId: u.id, parNom: u.nomComplet,
        },
      });
      if (virement) {
        const cible = await tx.budgetLigne.findFirst({
          where: { id: ligneCibleId, etablissementId, annuleLe: null },
          select: { id: true, categorie: true, montantPrevu: true, montantRevise: true, statut: true },
        });
        if (!cible) return { erreur: "Ligne destinataire introuvable." };
        if (cible.statut === "cloturee") return { erreur: "Ligne destinataire clôturée : virement interdit." };
        const voteCible = cible.montantRevise ?? cible.montantPrevu;
        await tx.budgetLigne.update({ where: { id: cible.id }, data: { montantRevise: voteCible + montant, version: { increment: 1 } } });
        await tx.revisionBudget.create({
          data: {
            etablissementId, exercice, type: "augmentation", ligneId: cible.id, categorie: cible.categorie,
            montant, montantAvant: voteCible, montantApres: voteCible + montant,
            motif: `Virement reçu depuis ${source.categorie} — ${motif}`, parId: u.id, parNom: u.nomComplet,
          },
        });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "budget.revision",
        entite: "BudgetLigne", entiteId: source.id,
        nouvelleValeur: { type, categorie: source.categorie, montant, avant: voteSource, apres: nouveauVoteSource },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Révision budgétaire enregistrée (historisée)." };
  } catch (e) {
    console.error("[budget] révision :", e);
    return { ok: false, message: "Révision impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Centres de coûts / profits
// ─────────────────────────────────────────────────────────────

export async function enregistrerCentreCout(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const code = texteCourt(fd.get("code"), 20);
  const libelle = texteCourt(fd.get("libelle"), 80);
  const type = texteCourt(fd.get("type"), 10) === "profit" ? "profit" : "cout";
  if (!code || !libelle) return { ok: false, message: "Code et libellé du centre sont obligatoires." };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const maj = await prisma.$transaction(async (tx) => {
        const r = await tx.centreCout.updateMany({
          where: { id, etablissementId, version, annuleLe: null },
          data: { code, libelle, type, version: { increment: 1 } },
        });
        if (r.count > 0) {
          await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "centre_cout.modification", entite: "CentreCout", entiteId: id, nouvelleValeur: { code, libelle, type } });
        }
        return r.count;
      });
      if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.centreCout.create({ data: { etablissementId, code, libelle, type } });
        await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "centre_cout.creation", entite: "CentreCout", entiteId: cree.id, nouvelleValeur: cree });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Centre mis à jour." : "Centre créé." };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: `Le code ${code} existe déjà.` };
    }
    console.error("[budget] centre :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerCentreCout(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.centreCout.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (r.count > 0) {
        await tx.budgetLigne.updateMany({ where: { centreCoutId: id }, data: { centreCoutId: null } });
        await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "centre_cout.retrait", entite: "CentreCout", entiteId: id });
      }
      return r.count;
    });
    if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Centre retiré." };
  } catch (e) {
    console.error("[budget] retrait centre :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Engagements manuels (RM-1302)
// ─────────────────────────────────────────────────────────────

export async function enregistrerEngagementManuel(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.reviser");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const categorie = texteCourt(fd.get("categorie"), 10);
  const montant = montantValide(fd.get("montant"));
  const libelle = texteCourt(fd.get("libelle"), 160);
  const source = texteCourt(fd.get("source"), 15) || "autre";
  if (!categorieValide(categorie, "depense")) return { ok: false, message: "Catégorie de dépense invalide." };
  if (montant === null) return { ok: false, message: "Montant invalide." };
  if (!libelle) return { ok: false, message: "Le libellé de l'engagement est obligatoire." };
  if (!SOURCES_ENGAGEMENT.some((s) => s.code === source)) return { ok: false, message: "Source d'engagement invalide." };
  const centreCoutIdBrut = texteCourt(fd.get("centreCoutId"), 50);
  try {
    const exercice = await exerciceDe(etablissementId);
    // RM-1300 : l'engagement manuel ne peut pas dépasser le disponible de la catégorie.
    const execution = await executionParCategorie(prisma, etablissementId, exercice);
    const a = execution.get(categorie);
    if (a && a.vote > 0) {
      const disponible = a.vote - a.engageBC - a.engageManuel - a.consomme;
      if (montant > disponible) {
        return { ok: false, message: `Engagement refusé : disponible ${disponible.toLocaleString("fr-FR")} F pour la catégorie ${categorie} (RM-1300).` };
      }
    }
    const centre = centreCoutIdBrut
      ? await prisma.centreCout.findFirst({ where: { id: centreCoutIdBrut, etablissementId, annuleLe: null }, select: { id: true } })
      : null;
    await prisma.$transaction(async (tx) => {
      const cree = await tx.engagementBudget.create({
        data: {
          etablissementId, exercice, categorie, montant, libelle, source,
          reference: texteCourt(fd.get("reference"), 80) || null,
          centreCoutId: centre?.id ?? null, parId: u.id, parNom: u.nomComplet,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "engagement_manuel.creation",
        entite: "EngagementBudget", entiteId: cree.id, nouvelleValeur: { categorie, montant, source },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: "Engagement enregistré — les crédits sont réservés (RM-1302)." };
  } catch (e) {
    console.error("[budget] engagement :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function changerStatutEngagement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.reviser");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const statut = texteCourt(fd.get("statut"), 10); // « solde » | « annule »
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (statut !== "solde" && statut !== "annule") return { ok: false, message: "Statut invalide." };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.engagementBudget.updateMany({
        where: { id, etablissementId, version, statut: "actif", annuleLe: null },
        data: statut === "annule"
          ? { statut: "annule", annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } }
          : { statut: "solde", version: { increment: 1 } },
      });
      if (r.count > 0) {
        await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: `engagement_manuel.${statut}`, entite: "EngagementBudget", entiteId: id });
      }
      return r.count;
    });
    if (maj === 0) return { ok: false, message: "Engagement déjà soldé/annulé ou version dépassée." };
    revalidatePath(CHEMIN);
    return { ok: true, message: statut === "annule" ? "Engagement annulé — crédits libérés." : "Engagement soldé (crédits libérés du disponible engagé)." };
  } catch (e) {
    console.error("[budget] statut engagement :", e);
    return { ok: false, message: "Mise à jour impossible." };
  }
}
