"use server";

/**
 * Actions serveur du sous-module DÉPENSES (17 + 05B/02B) : demandes de dépense hors achats
 * (workflow demande → validation à SEUILS → engagement budgétaire → décaissement → écriture
 * de charge), notes de frais (type mission + bénéficiaire), avances sur frais régularisées,
 * dépenses récurrentes (échéancier). Contrôle budgétaire à la validation (RM-1400 via le 16),
 * séparation demandeur ≠ valideur, décaissement espèces sous session (09), écriture 6x/tréso
 * au registre (11). Une dépense APPROUVÉE engage le budget ; PAYÉE, elle le consomme.
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
import { dateValide, modeValide, montantValide, texteCourt } from "./commun/validation";
import { prochainNumero } from "./commun/numerotation";
import { controleSessionEspeces } from "./caisse/serveur";
import { controleDisponibleBudget } from "./budgets/serveur";
import {
  assurerPlanComptable, ecrireEcritureAutomatique, periodeCloturee, periodeDe, TRESORERIE_PAR_MODE,
} from "./comptabilite/serveur";
import { ajouterMois, moisDePeriodicite } from "./depenses/serveur";
import {
  MOTIFS_AVANCE, PERIODICITES, SEUIL_APPROBATION_DIRECTION_DEPENSE, TYPES_DEPENSE, URGENCES_DEPENSE,
} from "./depenses/types";

const CHEMIN = "/app/vie-scolaire/finances";
const MESSAGE_PERIODE_CLOTUREE =
  "La période comptable courante est CLÔTURÉE (RM-705) : rouvrez-la (onglet Comptabilité) avant cette opération.";

async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

async function finExerciceClos(etablissementId: string): Promise<Date | null> {
  const derniere = await prisma.clotureExercice.findFirst({
    where: { etablissementId, annuleLe: null },
    orderBy: { finPeriode: "desc" },
    select: { finPeriode: true },
  });
  return derniere?.finPeriode ?? null;
}

const categorieDepenseValide = (code: string) =>
  CATEGORIES_OHADA.some((c) => c.code === code && c.sens === "depense");

/** Décaissement partagé : session espèces (09) + OperationFinanciere + écriture 6x/trésorerie. */
async function decaisser(
  tx: Parameters<typeof ecrireEcritureAutomatique>[0],
  params: {
    etablissementId: string; exercice: string; utilisateurId: string; categorie: string;
    montant: number; mode: string; libelle: string; pieceJustificative: string;
    sourceType: string; sourceId: string;
  },
): Promise<{ erreur: string } | { operationId: string; sessionCaisseId: string | null }> {
  let sessionCaisseId: string | null = null;
  if (params.mode === "especes") {
    const controle = await controleSessionEspeces(tx, params.etablissementId, params.utilisateurId);
    if (controle.erreur) return { erreur: controle.erreur };
    sessionCaisseId = controle.sessionId;
  }
  const operation = await tx.operationFinanciere.create({
    data: {
      etablissementId: params.etablissementId, sens: "depense", categorie: params.categorie,
      libelle: params.libelle.slice(0, 200), montant: params.montant, mode: params.mode,
      reference: params.pieceJustificative.slice(0, 80) || null,
      date: new Date(), dateComptable: new Date(), saisiParId: params.utilisateurId, sessionCaisseId,
    },
  });
  await ecrireEcritureAutomatique(tx, {
    etablissementId: params.etablissementId, exercice: params.exercice,
    codeJournal: params.mode === "especes" ? "CA" : "BQ", date: new Date(),
    libelle: params.libelle, pieceJustificative: params.pieceJustificative,
    sourceType: params.sourceType, sourceId: params.sourceId, utilisateurId: params.utilisateurId,
    lignes: [
      { compteNumero: params.categorie, debit: params.montant, credit: 0 },
      { compteNumero: TRESORERIE_PAR_MODE[params.mode] ?? "571", debit: 0, credit: params.montant },
    ],
  });
  return { operationId: operation.id, sessionCaisseId };
}

// ─────────────────────────────────────────────────────────────
//  Demandes de dépense
// ─────────────────────────────────────────────────────────────

export async function enregistrerDepense(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const objet = texteCourt(fd.get("objet"), 160);
  const type = texteCourt(fd.get("type"), 20) || "fonctionnement";
  const categorie = texteCourt(fd.get("categorie"), 10);
  const montantEstime = montantValide(fd.get("montantEstime"));
  const urgence = texteCourt(fd.get("urgence"), 10) || "normale";
  if (!objet) return { ok: false, message: "L'objet de la dépense est obligatoire." };
  if (!TYPES_DEPENSE.some((t) => t.code === type)) return { ok: false, message: "Type de dépense invalide." };
  if (!categorieDepenseValide(categorie)) return { ok: false, message: "Catégorie budgétaire (dépense OHADA) invalide." };
  if (!montantEstime) return { ok: false, message: "Montant estimé invalide." };
  if (!URGENCES_DEPENSE.some((x) => x.code === urgence)) return { ok: false, message: "Urgence invalide." };
  const centreCoutIdBrut = texteCourt(fd.get("centreCoutId"), 50);
  const donnees = {
    type, objet, categorie, montantEstime, urgence,
    description: texteCourt(fd.get("description"), 400) || null,
    service: texteCourt(fd.get("service"), 80) || null,
    projet: texteCourt(fd.get("projet"), 80) || null,
    beneficiaire: texteCourt(fd.get("beneficiaire"), 120) || null,
    pieceJustificative: texteCourt(fd.get("pieceJustificative"), 120) || null,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const centreCoutId = centreCoutIdBrut
      ? (await prisma.centreCout.findFirst({ where: { id: centreCoutIdBrut, etablissementId, annuleLe: null }, select: { id: true } }))?.id ?? null
      : null;
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.demandeDepense.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true } });
        if (!avant) return "introuvable" as const;
        if (avant.statut !== "brouillon") return "figee" as const;
        const maj = await tx.demandeDepense.updateMany({
          where: { id, etablissementId, version, statut: "brouillon" },
          data: { ...donnees, centreCoutId, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "depense.modification",
          entite: "DemandeDepense", entiteId: id, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Dépense introuvable." };
      if (resultat === "figee") return { ok: false, message: "Seul un brouillon se modifie." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      const exercice = await exerciceDe(etablissementId);
      await prisma.$transaction(async (tx) => {
        const cree = await tx.demandeDepense.create({
          data: { etablissementId, exercice, ...donnees, centreCoutId, demandeurId: u.id, demandeurNom: u.nomComplet },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "depense.creation",
          entite: "DemandeDepense", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Dépense mise à jour." : "Demande de dépense enregistrée (brouillon)." };
  } catch (e) {
    console.error("[depense] demande :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function soumettreDepense(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.creer");
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
      const d = await tx.demandeDepense.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true, exercice: true, montantEstime: true } });
      if (!d) return { erreur: "introuvable" as const };
      if (d.statut !== "brouillon") return { erreur: "statut" as const };
      const { reference } = await prochainNumero(tx, etablissementId, d.exercice, "depense", "DEP");
      const maj = await tx.demandeDepense.updateMany({
        where: { id, etablissementId, version, statut: "brouillon" },
        data: { statut: "soumise", numero: reference, version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: "conflit" as const };
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "depense.soumission", entite: "DemandeDepense", entiteId: id, nouvelleValeur: { numero: reference } });
      return { numero: reference, direction: d.montantEstime > SEUIL_APPROBATION_DIRECTION_DEPENSE };
    });
    if ("erreur" in resultat) {
      const m = { introuvable: "Dépense introuvable.", statut: "Seul un brouillon se soumet.", conflit: MESSAGE_CONFLIT_VERSION } as const;
      return { ok: false, message: m[resultat.erreur] };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: `Dépense ${resultat.numero} soumise${resultat.direction ? " — montant au-delà du seuil : APPROBATION DIRECTION requise" : ""}.` };
  } catch (e) {
    console.error("[depense] soumission :", e);
    return { ok: false, message: "Soumission impossible." };
  }
}

export async function deciderDepense(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const id = texteCourt(fd.get("id"), 50);
  const decision = texteCourt(fd.get("decision"), 10); // « approuver » | « refuser »
  const motifRefus = texteCourt(fd.get("motifRefus"), 300);
  const montantValideBrut = montantValide(fd.get("montantValide"));
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (decision !== "approuver" && decision !== "refuser") return { ok: false, message: "Décision invalide." };
  if (decision === "refuser" && !motifRefus) return { ok: false, message: "Le motif du refus est obligatoire." };

  const d = await prisma.demandeDepense.findFirst({
    where: { id, etablissementId, annuleLe: null },
    select: { statut: true, demandeurId: true, exercice: true, categorie: true, montantEstime: true, numero: true },
  });
  if (!d) return { ok: false, message: "Dépense introuvable." };
  if (d.statut !== "soumise") return { ok: false, message: "Seule une dépense SOUMISE se décide." };
  // Montant validé (peut différer de l'estimé — notes de frais), borné à l'estimé.
  const montantValideFinal = decision === "approuver" ? Math.min(montantValideBrut ?? d.montantEstime, d.montantEstime) : null;
  // SEUIL : au-delà du seuil direction (sur le montant validé), l'approbation exige .approuver.
  const permission = (montantValideFinal ?? d.montantEstime) > SEUIL_APPROBATION_DIRECTION_DEPENSE
    ? "finance.depenses.approuver" : "finance.depenses.valider";
  const u = await exigerPermissionFinance(etablissementId, permission);
  if (!u) {
    return {
      ok: false,
      message: (montantValideFinal ?? d.montantEstime) > SEUIL_APPROBATION_DIRECTION_DEPENSE
        ? "Montant au-delà du seuil : seule la DIRECTION peut approuver (finance.depenses.approuver)."
        : "Action non autorisée.",
    };
  }
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  if (d.demandeurId && d.demandeurId === u.id) return { ok: false, message: MESSAGE_SEPARATION_RESPONSABILITES };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (decision === "approuver") {
        // RM-1400 : contrôle budgétaire (bloquant si un crédit est voté pour la catégorie).
        const refus = await controleDisponibleBudget(tx, { etablissementId, exercice: d.exercice, categorie: d.categorie, montant: montantValideFinal ?? 0 });
        if (refus) return { erreur: refus };
      }
      const maj = await tx.demandeDepense.updateMany({
        where: { id, etablissementId, version, statut: "soumise" },
        data: {
          statut: decision === "approuver" ? "approuvee" : "refusee",
          montantValide: montantValideFinal,
          decideParId: u.id, decideParNom: u.nomComplet, dateDecision: new Date(),
          motifRefus: decision === "refuser" ? motifRefus : null, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: decision === "approuver" ? "depense.approbation" : "depense.refus",
        entite: "DemandeDepense", entiteId: id, nouvelleValeur: { numero: d.numero, decision, montantValide: montantValideFinal },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: decision === "approuver" ? `Dépense ${d.numero ?? ""} approuvée — crédits engagés (RM-1400).` : "Dépense refusée (motif tracé)." };
  } catch (e) {
    console.error("[depense] décision :", e);
    return { ok: false, message: "Décision impossible." };
  }
}

export async function payerDepense(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.payer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const mode = modeValide(fd.get("mode"));
  const reference = texteCourt(fd.get("reference"), 80) || null;
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const clos = await finExerciceClos(etablissementId);
  if (clos && new Date() <= clos) return { ok: false, message: "Exercice CLÔTURÉ — décaissement refusé." };
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeDepense.findFirst({
        where: { id, etablissementId, annuleLe: null, statut: "approuvee" },
        select: { exercice: true, categorie: true, montantValide: true, montantEstime: true, numero: true, objet: true, pieceJustificative: true },
      });
      if (!d) return { erreur: "Dépense APPROUVÉE introuvable (une dépense se paie après approbation — 409 si déjà payée)." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const montant = d.montantValide ?? d.montantEstime;
      const dec = await decaisser(tx, {
        etablissementId, exercice: d.exercice, utilisateurId: u.id, categorie: d.categorie,
        montant, mode, libelle: `Dépense ${d.numero ?? ""} — ${d.objet}`,
        pieceJustificative: reference ?? d.pieceJustificative ?? d.numero ?? "DEP",
        sourceType: "depense", sourceId: id,
      });
      if ("erreur" in dec) return { erreur: dec.erreur };
      const maj = await tx.demandeDepense.updateMany({
        where: { id, etablissementId, version, statut: "approuvee" },
        data: {
          statut: "payee", mode, reference, datePaiement: new Date(), dateComptable: new Date(),
          operationId: dec.operationId, sessionCaisseId: dec.sessionCaisseId,
          payeParId: u.id, payeParNom: u.nomComplet, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "depense.paiement",
        entite: "DemandeDepense", entiteId: id, nouvelleValeur: { numero: d.numero, montant, mode },
      });
      return { montant };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Dépense décaissée (${resultat.montant.toLocaleString("fr-FR")} F) — écriture de charge passée (RM-1402).` };
  } catch (e) {
    console.error("[depense] paiement :", e);
    return { ok: false, message: "Décaissement impossible." };
  }
}

export async function cloturerDepense(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.demandeDepense.updateMany({
        where: { id, etablissementId, version, statut: "payee", annuleLe: null },
        data: { statut: "cloturee", version: { increment: 1 } },
      });
      if (r.count > 0) await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "depense.cloture", entite: "DemandeDepense", entiteId: id });
      return r.count;
    });
    if (maj === 0) return { ok: false, message: "Seule une dépense PAYÉE se clôture (ou version dépassée)." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Dépense clôturée (RM-1405)." };
  } catch (e) {
    console.error("[depense] clôture :", e);
    return { ok: false, message: "Clôture impossible." };
  }
}

export async function retirerDepense(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeDepense.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true } });
      if (!d) return "introuvable" as const;
      if (!["brouillon", "soumise", "refusee"].includes(d.statut)) return "figee" as const;
      const maj = await tx.demandeDepense.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "depense.retrait", entite: "DemandeDepense", entiteId: id });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Dépense introuvable." };
    if (resultat === "figee") return { ok: false, message: "Une dépense approuvée ou payée ne se retire plus (annulez le paiement d'abord)." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Dépense retirée." };
  } catch (e) {
    console.error("[depense] retrait :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Avances sur frais (RM-1403)
// ─────────────────────────────────────────────────────────────

export async function enregistrerAvance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.payer");
  if (!u) return { ok: false, message: "Action non autorisée (le décaissement d'une avance revient au payeur)." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const beneficiaireNom = texteCourt(fd.get("beneficiaireNom"), 120);
  const objet = texteCourt(fd.get("objet"), 160);
  const motif = texteCourt(fd.get("motif"), 15) || "mission";
  const categorie = texteCourt(fd.get("categorie"), 10);
  const montant = montantValide(fd.get("montant"));
  const mode = modeValide(fd.get("mode"));
  if (!beneficiaireNom || !objet) return { ok: false, message: "Bénéficiaire et objet sont obligatoires." };
  if (!MOTIFS_AVANCE.some((m) => m.code === motif)) return { ok: false, message: "Motif d'avance invalide." };
  if (!categorieDepenseValide(categorie)) return { ok: false, message: "Catégorie budgétaire invalide." };
  if (!montant) return { ok: false, message: "Montant invalide." };
  const clos = await finExerciceClos(etablissementId);
  if (clos && new Date() <= clos) return { ok: false, message: "Exercice CLÔTURÉ — décaissement refusé." };
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const exercice = await exerciceDe(etablissementId);
    const resultat = await prisma.$transaction(async (tx) => {
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const { reference } = await prochainNumero(tx, etablissementId, exercice, "avance_frais", "AVF");
      const cree = await tx.avanceFrais.create({
        data: {
          etablissementId, exercice, numero: reference, beneficiaireNom, motif, objet, categorie,
          montant, mode, reference: texteCourt(fd.get("reference"), 80) || null,
          decaisseParId: u.id, decaisseParNom: u.nomComplet, dateComptable: new Date(),
        },
      });
      const dec = await decaisser(tx, {
        etablissementId, exercice, utilisateurId: u.id, categorie, montant, mode,
        libelle: `Avance ${reference} — ${beneficiaireNom} : ${objet}`,
        pieceJustificative: reference, sourceType: "avance_frais", sourceId: cree.id,
      });
      if ("erreur" in dec) return { erreur: dec.erreur };
      await tx.avanceFrais.update({ where: { id: cree.id }, data: { operationId: dec.operationId, sessionCaisseId: dec.sessionCaisseId } });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "avance.decaissement",
        entite: "AvanceFrais", entiteId: cree.id, nouvelleValeur: { numero: reference, beneficiaireNom, montant, mode },
      });
      return { numero: reference };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Avance ${resultat.numero} décaissée — à régulariser (RM-1403).` };
  } catch (e) {
    console.error("[depense] avance :", e);
    return { ok: false, message: "Décaissement impossible." };
  }
}

export async function regulariserAvance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const montantJustifie = montantValide(fd.get("montantJustifie"));
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (montantJustifie === null) return { ok: false, message: "Le montant justifié est obligatoire (peut être 0)." };
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const a = await tx.avanceFrais.findFirst({
        where: { id, etablissementId, annuleLe: null, statut: "decaissee" },
        select: { exercice: true, categorie: true, montant: true, mode: true, numero: true, beneficiaireNom: true },
      });
      if (!a) return { erreur: "Avance décaissée introuvable (déjà régularisée ?)." };
      if (montantJustifie > a.montant + 100_000_000) return { erreur: "Montant justifié invalide." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const diff = montantJustifie - a.montant; // >0 : à compléter ; <0 : à rembourser
      let soldeType = "equilibre";
      let operationRegulId: string | null = null;
      if (diff < 0) {
        // Trop-perçu remboursé par l'agent : RECETTE (réduction nette de la dépense).
        soldeType = "rembourse";
        const op = await tx.operationFinanciere.create({
          data: {
            etablissementId, sens: "recette", categorie: a.categorie,
            libelle: `Régularisation avance ${a.numero} — remboursement ${a.beneficiaireNom}`.slice(0, 200),
            montant: -diff, mode: a.mode, reference: a.numero, date: new Date(), dateComptable: new Date(), saisiParId: u.id,
          },
        });
        operationRegulId = op.id;
        await ecrireEcritureAutomatique(tx, {
          etablissementId, exercice: a.exercice, codeJournal: a.mode === "especes" ? "CA" : "BQ", date: new Date(),
          libelle: `Remboursement avance ${a.numero} — ${a.beneficiaireNom}`, pieceJustificative: a.numero!,
          sourceType: "regularisation_avance", sourceId: id, utilisateurId: u.id,
          lignes: [
            { compteNumero: TRESORERIE_PAR_MODE[a.mode] ?? "571", debit: -diff, credit: 0 },
            { compteNumero: a.categorie, debit: 0, credit: -diff },
          ],
        });
      } else if (diff > 0) {
        // Agent a avancé de sa poche : DÉPENSE complémentaire.
        soldeType = "complete";
        const dec = await decaisser(tx, {
          etablissementId, exercice: a.exercice, utilisateurId: u.id, categorie: a.categorie,
          montant: diff, mode: a.mode, libelle: `Complément avance ${a.numero} — ${a.beneficiaireNom}`,
          pieceJustificative: a.numero!, sourceType: "complement_avance", sourceId: id,
        });
        if ("erreur" in dec) return { erreur: dec.erreur };
        operationRegulId = dec.operationId;
      }
      const maj = await tx.avanceFrais.updateMany({
        where: { id, etablissementId, version, statut: "decaissee" },
        data: { statut: "regularisee", montantJustifie, soldeType, operationRegulId, dateRegularisation: new Date(), version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "avance.regularisation",
        entite: "AvanceFrais", entiteId: id, nouvelleValeur: { numero: a.numero, montantJustifie, soldeType },
      });
      return { soldeType, diff };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    const msg = resultat.soldeType === "rembourse"
      ? `Avance régularisée — trop-perçu de ${(-resultat.diff).toLocaleString("fr-FR")} F remboursé.`
      : resultat.soldeType === "complete"
        ? `Avance régularisée — complément de ${resultat.diff.toLocaleString("fr-FR")} F décaissé.`
        : "Avance régularisée (soldée à l'équilibre).";
    return { ok: true, message: msg };
  } catch (e) {
    console.error("[depense] régularisation :", e);
    return { ok: false, message: "Régularisation impossible." };
  }
}

export async function annulerAvance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.payer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  await assurerPlanComptable(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const a = await tx.avanceFrais.findFirst({
        where: { id, etablissementId, annuleLe: null, statut: "decaissee" },
        select: { exercice: true, categorie: true, montant: true, mode: true, numero: true, beneficiaireNom: true, operationId: true },
      });
      if (!a) return { erreur: "Seule une avance DÉCAISSÉE non régularisée s'annule." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      if (a.operationId) {
        await tx.operationFinanciere.updateMany({
          where: { id: a.operationId, etablissementId, annule: false },
          data: { annule: true, motifAnnulation: motif, annuleLe: new Date(), annuleParId: u.id },
        });
      }
      // Écriture INVERSE : reprise de la charge (débit trésorerie / crédit 6x).
      await ecrireEcritureAutomatique(tx, {
        etablissementId, exercice: a.exercice, codeJournal: a.mode === "especes" ? "CA" : "BQ", date: new Date(),
        libelle: `Annulation avance ${a.numero} — ${a.beneficiaireNom} : ${motif}`, pieceJustificative: a.numero!,
        sourceType: "annulation_avance", sourceId: id, utilisateurId: u.id,
        lignes: [
          { compteNumero: TRESORERIE_PAR_MODE[a.mode] ?? "571", debit: a.montant, credit: 0 },
          { compteNumero: a.categorie, debit: 0, credit: a.montant },
        ],
      });
      const maj = await tx.avanceFrais.updateMany({
        where: { id, etablissementId, version, statut: "decaissee" },
        data: { statut: "annulee", annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "avance.annulation", entite: "AvanceFrais", entiteId: id, nouvelleValeur: { motif } });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Avance annulée (opération et écriture inverses passées)." };
  } catch (e) {
    console.error("[depense] annulation avance :", e);
    return { ok: false, message: "Annulation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Dépenses récurrentes
// ─────────────────────────────────────────────────────────────

export async function enregistrerRecurrente(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const libelle = texteCourt(fd.get("libelle"), 120);
  const categorie = texteCourt(fd.get("categorie"), 10);
  const montant = montantValide(fd.get("montant"));
  const periodicite = texteCourt(fd.get("periodicite"), 15) || "mensuelle";
  const prochaineEcheance = dateValide(fd.get("prochaineEcheance"));
  if (!libelle) return { ok: false, message: "Le libellé est obligatoire." };
  if (!categorieDepenseValide(categorie)) return { ok: false, message: "Catégorie budgétaire invalide." };
  if (!montant) return { ok: false, message: "Montant invalide." };
  if (!PERIODICITES.some((p) => p.code === periodicite)) return { ok: false, message: "Périodicité invalide." };
  const donnees = {
    libelle, categorie, montant, periodicite, prochaineEcheance,
    beneficiaire: texteCourt(fd.get("beneficiaire"), 120) || null,
    actif: String(fd.get("actif") ?? "oui") !== "non",
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const maj = await prisma.$transaction(async (tx) => {
        const r = await tx.depenseRecurrente.updateMany({
          where: { id, etablissementId, version, annuleLe: null },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (r.count > 0) await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "recurrente.modification", entite: "DepenseRecurrente", entiteId: id, nouvelleValeur: donnees });
        return r.count;
      });
      if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.depenseRecurrente.create({ data: { etablissementId, ...donnees } });
        await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "recurrente.creation", entite: "DepenseRecurrente", entiteId: cree.id, nouvelleValeur: cree });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Dépense récurrente mise à jour." : "Dépense récurrente planifiée." };
  } catch (e) {
    console.error("[depense] récurrente :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerRecurrente(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.depenseRecurrente.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (r.count > 0) await journaliserFinance(tx, { etablissementId, utilisateurId: u.id, action: "recurrente.retrait", entite: "DepenseRecurrente", entiteId: id });
      return r.count;
    });
    if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Dépense récurrente retirée." };
  } catch (e) {
    console.error("[depense] retrait récurrente :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

export async function genererEcheancesRecurrentes(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.depenses.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  try {
    const exercice = await exerciceDe(etablissementId);
    const maintenant = new Date();
    const dues = await prisma.depenseRecurrente.findMany({
      where: { etablissementId, annuleLe: null, actif: true, prochaineEcheance: { lte: maintenant } },
    });
    if (dues.length === 0) return { ok: true, message: "Aucune échéance due à générer." };
    let creees = 0;
    for (const r of dues) {
      await prisma.$transaction(async (tx) => {
        const { reference } = await prochainNumero(tx, etablissementId, exercice, "depense", "DEP");
        await tx.demandeDepense.create({
          data: {
            etablissementId, exercice, numero: reference, type: "fonctionnement",
            objet: `${r.libelle} (échéance ${r.prochaineEcheance.toISOString().slice(0, 10)})`,
            categorie: r.categorie, centreCoutId: r.centreCoutId, beneficiaire: r.beneficiaire,
            montantEstime: r.montant, montantValide: r.montant, statut: "approuvee",
            demandeurNom: u.nomComplet, decideParId: u.id, decideParNom: u.nomComplet, dateDecision: new Date(),
            pieceJustificative: `Récurrence — ${r.libelle}`,
          },
        });
        await tx.depenseRecurrente.update({
          where: { id: r.id },
          data: { prochaineEcheance: ajouterMois(r.prochaineEcheance, moisDePeriodicite(r.periodicite)), derniereGeneration: new Date() },
        });
        creees += 1;
      });
    }
    await prisma.$transaction(async (tx) => {
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "recurrente.generation",
        entite: "DepenseRecurrente", entiteId: etablissementId, nouvelleValeur: { creees },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `${creees} dépense(s) récurrente(s) générée(s) (approuvées, prêtes à payer).` };
  } catch (e) {
    console.error("[depense] génération récurrentes :", e);
    return { ok: false, message: "Génération impossible." };
  }
}
