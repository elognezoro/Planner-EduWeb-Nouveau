"use server";

/**
 * Actions serveur du sous-module COMPTABILITÉ (11-Comptabilite + 05B/02B) : plan comptable
 * paramétrable, journaux, écritures en partie double (RM-700 : équilibre débit = crédit
 * STRICT ; RM-701/702 : une écriture VALIDÉE ne se modifie ni ne se supprime JAMAIS —
 * correction par CONTRE-PASSATION ; RM-703 : pièce justificative OBLIGATOIRE ; RM-704 :
 * exercice obligatoire ; RM-705 : période clôturée verrouillée), génération AUTOMATIQUE
 * idempotente depuis les pièces des modules 07-10 (une pièce = UNE écriture, unicité
 * partielle par source), clôtures de PÉRIODE mensuelles avec réouverture justifiée.
 *
 * TOUTES les écritures : garde granulaire (finance.ecritures.saisir / valider / cloturer —
 * 04 : le comptable saisit et valide, le Gestionnaire lance les clôtures), transaction +
 * journaliserFinance, verrouillage optimiste, annulations logiques.
 * Fichier "use server" : exports async uniquement (types dans comptabilite/types.ts).
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { dateValide, texteCourt } from "./commun/validation";
import { prochainNumero, reserverPlageNumeros } from "./commun/numerotation";
import {
  bornesPeriode, collecterEcrituresAuto, periodeCloturee, periodeDe,
} from "./comptabilite/serveur";
import { LIBELLE_NATURE_COMPTE, LIBELLE_TYPE_JOURNAL, type LigneEcritureSaisie } from "./comptabilite/types";

const CHEMIN = "/app/vie-scolaire/finances";
const PLAFOND = 1_000_000_000;
const PERIODE_VALIDE = /^\d{4}-(0[1-9]|1[0-2])$/;
const NUMERO_COMPTE_VALIDE = /^\d{1,10}$/;
const CODE_JOURNAL_VALIDE = /^[A-Z]{2,4}$/;

async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

/** Lignes du formulaire d'écriture (JSON) : ≥ 2 lignes valides et ÉQUILIBRE STRICT (RM-700). */
function lignesDepuisFormulaire(fd: FormData):
  | { ok: true; lignes: LigneEcritureSaisie[] }
  | { ok: false; message: string } {
  let brut: unknown;
  try {
    brut = JSON.parse(String(fd.get("lignes") ?? "[]"));
  } catch {
    return { ok: false, message: "Lignes illisibles." };
  }
  if (!Array.isArray(brut) || brut.length < 2) {
    return { ok: false, message: "Une écriture comporte au moins deux lignes (partie double)." };
  }
  if (brut.length > 60) return { ok: false, message: "Trop de lignes (60 maximum)." };
  const lignes: LigneEcritureSaisie[] = [];
  for (const l of brut) {
    if (typeof l !== "object" || l === null) return { ok: false, message: "Ligne invalide." };
    const o = l as Record<string, unknown>;
    const compteId = String(o.compteId ?? "").slice(0, 50);
    const debit = Math.trunc(Number(o.debit ?? 0));
    const credit = Math.trunc(Number(o.credit ?? 0));
    if (!compteId) return { ok: false, message: "Chaque ligne doit porter un compte." };
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || debit > PLAFOND || credit > PLAFOND) {
      return { ok: false, message: "Montant de ligne invalide." };
    }
    if ((debit > 0) === (credit > 0)) {
      return { ok: false, message: "Chaque ligne est SOIT au débit SOIT au crédit (montant > 0)." };
    }
    lignes.push({
      compteId, debit, credit,
      libelle: String(o.libelle ?? "").slice(0, 120) || undefined,
      centreAnalytique: String(o.centreAnalytique ?? "").slice(0, 60) || undefined,
    });
  }
  const totalDebit = lignes.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lignes.reduce((s, l) => s + l.credit, 0);
  if (totalDebit !== totalCredit) {
    return { ok: false, message: `Écriture déséquilibrée : débit ${totalDebit} ≠ crédit ${totalCredit} (RM-700).` };
  }
  if (totalDebit <= 0) return { ok: false, message: "Le total de l'écriture doit être positif." };
  return { ok: true, lignes };
}

/** Comptes ACTIFS de l'établissement pour les lignes saisies (numéro/intitulé figés). */
async function comptesPourLignes(etablissementId: string, lignes: LigneEcritureSaisie[]) {
  const ids = [...new Set(lignes.map((l) => l.compteId))];
  const comptes = await prisma.compteComptable.findMany({
    where: { id: { in: ids }, etablissementId, annuleLe: null, statut: "actif" },
    select: { id: true, numero: true, intitule: true },
  });
  if (comptes.length !== ids.length) return null;
  return new Map(comptes.map((c) => [c.id, c]));
}

// ─────────────────────────────────────────────────────────────
//  Plan comptable
// ─────────────────────────────────────────────────────────────

export async function enregistrerCompteComptable(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.saisir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const numero = texteCourt(fd.get("numero"), 10);
  const intitule = texteCourt(fd.get("intitule"), 120);
  if (!NUMERO_COMPTE_VALIDE.test(numero)) return { ok: false, message: "Numéro de compte invalide (chiffres uniquement)." };
  if (!intitule) return { ok: false, message: "L'intitulé du compte est obligatoire." };
  const nature = texteCourt(fd.get("nature"), 20);
  if (!(nature in LIBELLE_NATURE_COMPTE)) return { ok: false, message: "Nature de compte invalide." };
  const statut = texteCourt(fd.get("statut"), 10) || "actif";
  if (statut !== "actif" && statut !== "ferme") return { ok: false, message: "Statut invalide." };
  const parentNumero = texteCourt(fd.get("parentNumero"), 10) || null;
  if (parentNumero && !NUMERO_COMPTE_VALIDE.test(parentNumero)) return { ok: false, message: "Compte parent invalide." };
  const donnees = { numero, intitule, classe: Number(numero.charAt(0)), nature, parentNumero, statut };

  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.compteComptable.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        if (avant.numero !== numero) {
          // Les lignes figent le numéro : renuméroter un compte MOUVEMENTÉ casserait l'historique.
          const utilisees = await tx.ligneEcriture.count({
            where: { compteId: id, annuleLe: null, ecriture: { annuleLe: null } },
          });
          if (utilisees > 0) return "mouvemente" as const;
        }
        const maj = await tx.compteComptable.updateMany({
          where: { id, etablissementId, version },
          data: {
            ...donnees,
            dateCloture: statut === "ferme" && avant.statut !== "ferme" ? new Date() : avant.dateCloture,
            version: { increment: 1 },
          },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "compte_comptable.modification",
          entite: "CompteComptable", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Compte introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      if (resultat === "mouvemente") {
        return { ok: false, message: "Ce compte porte des écritures : son numéro ne peut plus changer (fermez-le et créez un nouveau compte)." };
      }
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.compteComptable.create({
          data: { etablissementId, ...donnees, dateOuverture: new Date() },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "compte_comptable.creation",
          entite: "CompteComptable", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Compte mis à jour." : `Compte ${numero} créé.` };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: `Le numéro ${numero} existe déjà dans le plan.` };
    }
    console.error("[compta] compte :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function supprimerCompteComptable(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.saisir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.compteComptable.findFirst({ where: { id, etablissementId, annuleLe: null } });
      if (!avant) return "introuvable" as const;
      const utilisees = await tx.ligneEcriture.count({
        where: { compteId: id, annuleLe: null, ecriture: { annuleLe: null } },
      });
      if (utilisees > 0) return "mouvemente" as const;
      const maj = await tx.compteComptable.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "compte_comptable.retrait",
        entite: "CompteComptable", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Compte introuvable." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    if (resultat === "mouvemente") {
      return { ok: false, message: "Ce compte porte des écritures : fermez-le plutôt que de le retirer." };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: "Compte retiré du plan." };
  } catch (e) {
    console.error("[compta] retrait compte :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Journaux
// ─────────────────────────────────────────────────────────────

export async function enregistrerJournalComptable(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.saisir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const code = texteCourt(fd.get("code"), 4).toUpperCase();
  const libelle = texteCourt(fd.get("libelle"), 120);
  const type = texteCourt(fd.get("type"), 20);
  if (!CODE_JOURNAL_VALIDE.test(code)) return { ok: false, message: "Code de journal invalide (2 à 4 lettres)." };
  if (!libelle) return { ok: false, message: "Le libellé du journal est obligatoire." };
  if (!(type in LIBELLE_TYPE_JOURNAL)) return { ok: false, message: "Type de journal invalide." };
  const actif = String(fd.get("actif") ?? "oui") !== "non";
  const donnees = { code, libelle, type, actif };

  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.journalComptable.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        if (avant.code !== code) {
          const utilisees = await tx.ecritureComptable.count({ where: { journalId: id, annuleLe: null } });
          if (utilisees > 0) return "mouvemente" as const;
        }
        const maj = await tx.journalComptable.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "journal_comptable.modification",
          entite: "JournalComptable", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Journal introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      if (resultat === "mouvemente") {
        return { ok: false, message: "Ce journal porte des écritures : son code ne peut plus changer." };
      }
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.journalComptable.create({ data: { etablissementId, ...donnees } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "journal_comptable.creation",
          entite: "JournalComptable", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Journal mis à jour." : `Journal ${code} créé.` };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: `Le code ${code} existe déjà.` };
    }
    console.error("[compta] journal :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Écritures — saisie manuelle et cycle brouillon → validée
// ─────────────────────────────────────────────────────────────

export async function saisirEcriture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.saisir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const journalId = texteCourt(fd.get("journalId"), 50);
  const libelle = texteCourt(fd.get("libelle"), 200);
  const pieceJustificative = texteCourt(fd.get("pieceJustificative"), 120);
  const date = dateValide(fd.get("date"));
  if (!journalId) return { ok: false, message: "Choisissez un journal." };
  if (!libelle) return { ok: false, message: "Le libellé est obligatoire." };
  if (!pieceJustificative) return { ok: false, message: "La pièce justificative est OBLIGATOIRE (RM-703)." };
  const rLignes = lignesDepuisFormulaire(fd);
  if (!rLignes.ok) return { ok: false, message: rLignes.message };

  const [journal, comptes, exercice] = await Promise.all([
    prisma.journalComptable.findFirst({
      where: { id: journalId, etablissementId, annuleLe: null, actif: true },
      select: { id: true, code: true },
    }),
    comptesPourLignes(etablissementId, rLignes.lignes),
    exerciceDe(etablissementId),
  ]);
  if (!journal) return { ok: false, message: "Journal introuvable ou inactif." };
  if (!comptes) return { ok: false, message: "Une ligne vise un compte inconnu, fermé ou retiré." };

  const id = texteCourt(fd.get("id"), 50); // présent = MODIFICATION d'un brouillon
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (await periodeCloturee(tx, etablissementId, periodeDe(date))) return "cloturee" as const;
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const avant = await tx.ecritureComptable.findFirst({
          where: { id, etablissementId, annuleLe: null },
          select: { id: true, statut: true, libelle: true, date: true, pieceJustificative: true, journalId: true },
        });
        if (!avant) return "introuvable" as const;
        if (avant.statut !== "brouillon") return "validee" as const; // RM-701
        const maj = await tx.ecritureComptable.updateMany({
          where: { id, etablissementId, version, statut: "brouillon" },
          data: { journalId, date, libelle, pieceJustificative, exercice, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        // Remplacement des lignes par ANNULATION LOGIQUE (RM-004 : l'historique reste lisible).
        await tx.ligneEcriture.updateMany({
          where: { ecritureId: id, annuleLe: null },
          data: { annuleLe: new Date(), annuleParId: u.id },
        });
        await tx.ligneEcriture.createMany({
          data: rLignes.lignes.map((l, i) => {
            const c = comptes.get(l.compteId)!;
            return {
              ecritureId: id, compteId: l.compteId, compteNumero: c.numero, compteIntitule: c.intitule,
              debit: l.debit, credit: l.credit, libelle: l.libelle ?? null,
              centreAnalytique: l.centreAnalytique ?? null, ordre: i,
            };
          }),
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "ecriture.modification",
          entite: "EcritureComptable", entiteId: id, ancienneValeur: avant,
          nouvelleValeur: { journalId, date, libelle, pieceJustificative, lignes: rLignes.lignes.length },
        });
        return "ok" as const;
      }
      const cree = await tx.ecritureComptable.create({
        data: {
          etablissementId, exercice, journalId, date, libelle, pieceJustificative,
          origine: "manuelle", statut: "brouillon", creeParId: u.id, dateComptable: date,
        },
      });
      await tx.ligneEcriture.createMany({
        data: rLignes.lignes.map((l, i) => {
          const c = comptes.get(l.compteId)!;
          return {
            ecritureId: cree.id, compteId: l.compteId, compteNumero: c.numero, compteIntitule: c.intitule,
            debit: l.debit, credit: l.credit, libelle: l.libelle ?? null,
            centreAnalytique: l.centreAnalytique ?? null, ordre: i,
          };
        }),
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "ecriture.saisie",
        entite: "EcritureComptable", entiteId: cree.id,
        nouvelleValeur: { journal: journal.code, date, libelle, pieceJustificative, lignes: rLignes.lignes.length },
      });
      return "ok" as const;
    });
    if (resultat === "cloturee") return { ok: false, message: "Cette période est CLÔTURÉE (RM-705) : rouvrez-la d'abord." };
    if (resultat === "introuvable") return { ok: false, message: "Écriture introuvable." };
    if (resultat === "validee") return { ok: false, message: "Une écriture VALIDÉE ne se modifie jamais (RM-701) : contre-passez-la." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Brouillon mis à jour." : "Écriture enregistrée en brouillon." };
  } catch (e) {
    console.error("[compta] saisie écriture :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function validerEcriture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  type ResultatValidation =
    | { erreur: "introuvable" | "deja" | "cloturee" | "desequilibre" | "conflit" }
    | { numero: string };
  try {
    const resultat = await prisma.$transaction(async (tx): Promise<ResultatValidation> => {
      const ecriture = await tx.ecritureComptable.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: {
          journal: { select: { code: true } },
          lignes: { where: { annuleLe: null }, select: { debit: true, credit: true } },
        },
      });
      if (!ecriture) return { erreur: "introuvable" as const };
      if (ecriture.statut !== "brouillon") return { erreur: "deja" as const };
      if (await periodeCloturee(tx, etablissementId, periodeDe(ecriture.date))) return { erreur: "cloturee" as const };
      const totalDebit = ecriture.lignes.reduce((s, l) => s + l.debit, 0);
      const totalCredit = ecriture.lignes.reduce((s, l) => s + l.credit, 0);
      // RM-700 revérifié À LA VALIDATION (le brouillon a pu vivre).
      if (ecriture.lignes.length < 2 || totalDebit !== totalCredit || totalDebit <= 0) {
        return { erreur: "desequilibre" as const };
      }
      const { reference } = await prochainNumero(
        tx, etablissementId, ecriture.exercice, `ecriture_${ecriture.journal.code}`, ecriture.journal.code,
      );
      const maj = await tx.ecritureComptable.updateMany({
        where: { id, etablissementId, version, statut: "brouillon" },
        data: {
          statut: "validee", numero: reference, valideeParId: u.id, dateValidation: new Date(),
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: "conflit" as const };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "ecriture.validation",
        entite: "EcritureComptable", entiteId: id,
        nouvelleValeur: { numero: reference, totalDebit, totalCredit },
      });
      return { numero: reference };
    });
    if ("erreur" in resultat) {
      const messages = {
        introuvable: "Écriture introuvable.",
        deja: "Cette écriture est déjà validée.",
        cloturee: "Cette période est CLÔTURÉE (RM-705) : rouvrez-la d'abord.",
        desequilibre: "Écriture déséquilibrée ou vide : impossible de valider (RM-700).",
        conflit: MESSAGE_CONFLIT_VERSION,
      } as const;
      return { ok: false, message: messages[resultat.erreur] };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: `Écriture validée sous le numéro ${resultat.numero}.` };
  } catch (e) {
    console.error("[compta] validation écriture :", e);
    return { ok: false, message: "Validation impossible." };
  }
}

export async function supprimerEcritureBrouillon(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.saisir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.ecritureComptable.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { statut: true, libelle: true, pieceJustificative: true },
      });
      if (!avant) return "introuvable" as const;
      if (avant.statut !== "brouillon") return "validee" as const; // RM-701 : JAMAIS une validée.
      const maj = await tx.ecritureComptable.updateMany({
        where: { id, etablissementId, version, statut: "brouillon" },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "ecriture.suppression_brouillon",
        entite: "EcritureComptable", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Écriture introuvable." };
    if (resultat === "validee") {
      return { ok: false, message: "Une écriture VALIDÉE ne se supprime jamais (RM-701) : contre-passez-la." };
    }
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Brouillon supprimé." };
  } catch (e) {
    console.error("[compta] suppression brouillon :", e);
    return { ok: false, message: "Suppression impossible." };
  }
}

export async function contrePasserEcriture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 200);
  if (!id) return { ok: false, message: "Écriture introuvable." };
  if (!motif) return { ok: false, message: "Le motif de la contre-passation est OBLIGATOIRE (RM-702)." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const source = await tx.ecritureComptable.findFirst({
        where: { id, etablissementId, annuleLe: null, statut: "validee" },
        include: {
          journal: { select: { code: true } },
          lignes: {
            where: { annuleLe: null }, orderBy: { ordre: "asc" },
            select: { compteId: true, compteNumero: true, compteIntitule: true, debit: true, credit: true, libelle: true, centreAnalytique: true },
          },
        },
      });
      if (!source) return { erreur: "introuvable" as const };
      const dejaContrepassee = await tx.ecritureComptable.findFirst({
        where: { etablissementId, contreEcritureDeId: id, annuleLe: null },
        select: { numero: true },
      });
      if (dejaContrepassee) return { erreur: "deja" as const, numero: dejaContrepassee.numero };
      const maintenant = new Date();
      // La contre-passation s'enregistre dans la période COURANTE (jamais dans une clôturée).
      if (await periodeCloturee(tx, etablissementId, periodeDe(maintenant))) return { erreur: "cloturee" as const };
      const { reference } = await prochainNumero(
        tx, etablissementId, source.exercice, `ecriture_${source.journal.code}`, source.journal.code,
      );
      const contre = await tx.ecritureComptable.create({
        data: {
          etablissementId, exercice: source.exercice, journalId: source.journalId,
          numero: reference, date: maintenant, dateComptable: maintenant,
          libelle: `Contre-passation de ${source.numero ?? "l'écriture"} — ${motif}`.slice(0, 200),
          pieceJustificative: source.pieceJustificative,
          origine: "manuelle", statut: "validee", valideeParId: u.id, dateValidation: maintenant,
          contreEcritureDeId: id, creeParId: u.id,
        },
      });
      await tx.ligneEcriture.createMany({
        data: source.lignes.map((l, i) => ({
          ecritureId: contre.id, compteId: l.compteId, compteNumero: l.compteNumero,
          compteIntitule: l.compteIntitule,
          debit: l.credit, credit: l.debit, // INVERSION débit ↔ crédit (RM-702)
          libelle: l.libelle, centreAnalytique: l.centreAnalytique, ordre: i,
        })),
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "ecriture.contre_passation",
        entite: "EcritureComptable", entiteId: contre.id,
        ancienneValeur: { source: id, numeroSource: source.numero },
        nouvelleValeur: { numero: reference, motif },
      });
      return { numero: reference };
    });
    if ("erreur" in resultat) {
      if (resultat.erreur === "introuvable") return { ok: false, message: "Écriture validée introuvable." };
      if (resultat.erreur === "deja") {
        return { ok: false, message: `Déjà contre-passée (écriture ${resultat.numero ?? "—"}).` };
      }
      return { ok: false, message: "La période courante est CLÔTURÉE : rouvrez-la d'abord." };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: `Contre-passation enregistrée sous le numéro ${resultat.numero}.` };
  } catch (e) {
    console.error("[compta] contre-passation :", e);
    return { ok: false, message: "Contre-passation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Génération automatique (les pièces des modules 07-10)
// ─────────────────────────────────────────────────────────────

function parMorceaux<T>(tab: T[], taille: number): T[][] {
  const morceaux: T[][] = [];
  for (let i = 0; i < tab.length; i += taille) morceaux.push(tab.slice(i, i + taille));
  return morceaux;
}

export async function genererEcrituresPeriode(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.saisir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const periode = texteCourt(fd.get("periode"), 7);
  if (!PERIODE_VALIDE.test(periode)) return { ok: false, message: "Période invalide (AAAA-MM)." };
  if (periode > periodeDe(new Date())) return { ok: false, message: "Période future : rien à générer." };

  try {
    const [exercice, comptes, journaux, { candidates }] = await Promise.all([
      exerciceDe(etablissementId),
      prisma.compteComptable.findMany({
        where: { etablissementId, annuleLe: null, statut: "actif" },
        select: { id: true, numero: true, intitule: true },
      }),
      prisma.journalComptable.findMany({
        where: { etablissementId, annuleLe: null, actif: true },
        select: { id: true, code: true, type: true },
      }),
      collecterEcrituresAuto(etablissementId, periode),
    ]);
    if (comptes.length === 0 || journaux.length === 0) {
      return { ok: false, message: "Plan comptable ou journaux absents : rechargez la page (semis automatique)." };
    }
    const compteParNumero = new Map(comptes.map((c) => [c.numero, c]));
    const journalParType = new Map<string, { id: string; code: string }>();
    for (const j of journaux) if (!journalParType.has(j.type)) journalParType.set(j.type, j);
    const journalOd = journalParType.get("od") ?? journaux[0];

    // Idempotence (une pièce = UNE écriture) : les sources déjà écrites sont écartées.
    const dejaEcrites = await prisma.ecritureComptable.findMany({
      where: {
        etablissementId, annuleLe: null, sourceType: { not: null },
        sourceId: { in: candidates.map((c) => c.sourceId) },
      },
      select: { sourceType: true, sourceId: true },
    });
    const clesExistantes = new Set(dejaEcrites.map((e) => `${e.sourceType}:${e.sourceId}`));
    let ignorees = 0;
    const aCreer = candidates.filter((c) => {
      if (clesExistantes.has(`${c.sourceType}:${c.sourceId}`)) return false;
      if (!c.lignes.every((l) => compteParNumero.has(l.compteNumero))) {
        ignorees += 1; // compte absent du plan (catégorie libre…) — signalé, jamais bloquant
        return false;
      }
      return true;
    });
    if (aCreer.length === 0) {
      return {
        ok: true,
        message: `Rien à générer pour ${periode} : ${candidates.length - ignorees} pièce(s) déjà écrite(s)${ignorees ? `, ${ignorees} ignorée(s) (compte absent du plan)` : ""}.`,
      };
    }

    const resultat = await prisma.$transaction(
      async (tx) => {
        if (await periodeCloturee(tx, etablissementId, periode)) return "cloturee" as const;
        // Une plage de numéros par journal (UN incrément atomique chacun).
        const parJournal = new Map<string, typeof aCreer>();
        for (const c of aCreer) {
          const j = journalParType.get(c.journalType) ?? journalOd;
          const liste = parJournal.get(j.id) ?? [];
          liste.push(c);
          parJournal.set(j.id, liste);
        }
        const maintenant = new Date();
        const ecritures: {
          id: string; etablissementId: string; exercice: string; journalId: string; numero: string;
          date: Date; dateComptable: Date; libelle: string; pieceJustificative: string; origine: string;
          sourceType: string; sourceId: string; statut: string; valideeParId: string;
          dateValidation: Date; creeParId: string;
        }[] = [];
        const lignes: {
          ecritureId: string; compteId: string; compteNumero: string; compteIntitule: string;
          debit: number; credit: number; ordre: number;
        }[] = [];
        for (const [journalId, liste] of parJournal) {
          const code = journaux.find((j) => j.id === journalId)?.code ?? "OD";
          const plage = await reserverPlageNumeros(
            tx, etablissementId, exercice, `ecriture_${code}`, code, liste.length,
          );
          liste.forEach((c, i) => {
            const idEcriture = randomUUID();
            ecritures.push({
              id: idEcriture, etablissementId, exercice, journalId,
              numero: plage.referencePour(plage.premier + i),
              date: c.date, dateComptable: c.date, libelle: c.libelle,
              pieceJustificative: c.pieceJustificative, origine: "automatique",
              sourceType: c.sourceType, sourceId: c.sourceId,
              statut: "validee", valideeParId: u.id, dateValidation: maintenant, creeParId: u.id,
            });
            c.lignes.forEach((l, ordre) => {
              const compte = compteParNumero.get(l.compteNumero)!;
              lignes.push({
                ecritureId: idEcriture, compteId: compte.id, compteNumero: compte.numero,
                compteIntitule: compte.intitule, debit: l.debit, credit: l.credit, ordre,
              });
            });
          });
        }
        for (const morceau of parMorceaux(ecritures, 400)) {
          await tx.ecritureComptable.createMany({ data: morceau, skipDuplicates: true });
        }
        for (const morceau of parMorceaux(lignes, 800)) {
          await tx.ligneEcriture.createMany({ data: morceau });
        }
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "ecriture.generation_periode",
          entite: "EcritureComptable", entiteId: `${etablissementId}:${periode}`,
          nouvelleValeur: { periode, creees: ecritures.length, ignorees },
        });
        return ecritures.length;
      },
      { timeout: 120_000 },
    );
    if (resultat === "cloturee") {
      return { ok: false, message: "Cette période est CLÔTURÉE (RM-705) : rouvrez-la d'abord." };
    }
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `${resultat} écriture(s) générée(s) pour ${periode}${ignorees ? ` — ${ignorees} pièce(s) ignorée(s) (compte absent du plan)` : ""}.`,
    };
  } catch (e) {
    console.error("[compta] génération période :", e);
    return { ok: false, message: "Génération impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Clôtures de période (RM-705)
// ─────────────────────────────────────────────────────────────

export async function cloturerPeriode(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.cloturer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const periode = texteCourt(fd.get("periode"), 7);
  if (!PERIODE_VALIDE.test(periode)) return { ok: false, message: "Période invalide (AAAA-MM)." };
  if (periode > periodeDe(new Date())) return { ok: false, message: "Impossible de clôturer une période future." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (await periodeCloturee(tx, etablissementId, periode)) return "deja" as const;
      const { debut, fin } = bornesPeriode(periode);
      const brouillons = await tx.ecritureComptable.count({
        where: { etablissementId, annuleLe: null, statut: "brouillon", date: { gte: debut, lt: fin } },
      });
      if (brouillons > 0) return brouillons;
      const cloture = await tx.cloturePeriodeComptable.create({
        data: { etablissementId, periode, clotureParId: u.id },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "periode.cloture",
        entite: "CloturePeriodeComptable", entiteId: cloture.id, nouvelleValeur: { periode },
      });
      return "ok" as const;
    });
    if (resultat === "deja") return { ok: false, message: "Cette période est déjà clôturée." };
    if (typeof resultat === "number") {
      return { ok: false, message: `${resultat} brouillon(s) restent dans ${periode} : validez-les ou supprimez-les d'abord.` };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: `Période ${periode} clôturée : plus aucune écriture ne peut y être passée.` };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: "Cette période est déjà clôturée." };
    }
    console.error("[compta] clôture période :", e);
    return { ok: false, message: "Clôture impossible." };
  }
}

export async function rouvrirPeriode(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.ecritures.cloturer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  const justification = texteCourt(fd.get("justification"), 200);
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!justification) return { ok: false, message: "La réouverture d'une période exige une JUSTIFICATION." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.cloturePeriodeComptable.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { periode: true },
      });
      if (!avant) return "introuvable" as const;
      const maj = await tx.cloturePeriodeComptable.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "periode.reouverture",
        entite: "CloturePeriodeComptable", entiteId: id,
        ancienneValeur: { periode: avant.periode }, nouvelleValeur: { justification },
      });
      return avant.periode;
    });
    if (resultat === "introuvable") return { ok: false, message: "Clôture introuvable." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Période ${resultat} rouverte (réouverture tracée au journal d'audit).` };
  } catch (e) {
    console.error("[compta] réouverture période :", e);
    return { ok: false, message: "Réouverture impossible." };
  }
}
