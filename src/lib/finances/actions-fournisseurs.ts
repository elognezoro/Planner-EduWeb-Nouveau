"use server";

/**
 * Actions serveur du sous-module FOURNISSEURS (13 + 05B/02B) : workflow de QUALIFICATION
 * (prospect → approbation par un SECOND acteur → actif — SupplierApproved du 92 ; RM-1001 :
 * doublons RCCM/NIF refusés ; RM-1002/1005 : suspendu/archivé non commandables — gardes
 * posées dans actions-achats), transitions d'état motivées, contacts, comptes bancaires,
 * documents administratifs (versionnés), contrats, évaluations (RM-1004 : le score global
 * reste DÉRIVÉ), litiges (ouverture motivée → résolution documentée).
 *
 * TOUTES les écritures : garde granulaire (finance.fournisseurs.gerer / approuver /
 * evaluer), transaction + journaliserFinance, verrouillage optimiste, annulations
 * logiques. Fichier "use server" : exports async uniquement (types dans fournisseurs/types).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { MESSAGE_SEPARATION_RESPONSABILITES } from "./commun/permissions";
import { dateFacultative, texteCourt } from "./commun/validation";
import {
  GRAVITES_LITIGE, RENOUVELLEMENTS_CONTRAT, TRANSITIONS_FOURNISSEUR,
  TYPES_DOCUMENT_FOURNISSEUR, TYPES_LITIGE_FOURNISSEUR,
} from "./fournisseurs/types";

const CHEMIN = "/app/vie-scolaire/finances";
const PLAFOND = 1_000_000_000;

/** Fournisseur de CET établissement (cloisonnement — parent de tous les satellites). */
async function fournisseurDe(fournisseurId: string, etablissementId: string) {
  if (!fournisseurId) return null;
  return prisma.fournisseur.findFirst({
    where: { id: fournisseurId, etablissementId, annuleLe: null },
    select: {
      id: true, code: true, raisonSociale: true, statut: true, creeParId: true,
      telephone: true, email: true, numeroRccm: true, numeroFiscal: true, version: true,
    },
  });
}

function montantFacultatif(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n > 0 && n <= PLAFOND ? n : null;
}

// ─────────────────────────────────────────────────────────────
//  Qualification & transitions d'état (RM-1002/1005, 92)
// ─────────────────────────────────────────────────────────────

export async function approuverFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.approuver");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  const f = await fournisseurDe(id, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  if (f.statut !== "prospect") return { ok: false, message: "Seule une fiche PROSPECT se qualifie." };
  // SÉPARATION DES RESPONSABILITÉS : l'approbateur n'est jamais le créateur de la fiche.
  if (f.creeParId && f.creeParId === u.id) return { ok: false, message: MESSAGE_SEPARATION_RESPONSABILITES };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // QUALIFICATION (13) : complétude minimale — un moyen de contact est exigé
      // (téléphone/e-mail de la fiche ou contact actif).
      const contact = await tx.contactFournisseur.findFirst({
        where: { fournisseurId: id, annuleLe: null, OR: [{ telephone: { not: null } }, { email: { not: null } }] },
        select: { id: true },
      });
      if (!f.telephone && !f.email && !contact) return "incomplet" as const;
      // Absence de doublons (re-vérifiée à l'approbation — RM-1001).
      if (f.numeroRccm || f.numeroFiscal) {
        const doublon = await tx.fournisseur.findFirst({
          where: {
            etablissementId, annuleLe: null, id: { not: id },
            OR: [
              ...(f.numeroRccm ? [{ numeroRccm: f.numeroRccm }] : []),
              ...(f.numeroFiscal ? [{ numeroFiscal: f.numeroFiscal }] : []),
            ],
          },
          select: { id: true },
        });
        if (doublon) return "doublon" as const;
      }
      const maj = await tx.fournisseur.updateMany({
        where: { id, etablissementId, version, statut: "prospect" },
        data: {
          statut: "actif", approuveParId: u.id, approuveParNom: u.nomComplet,
          dateApprobation: new Date(), version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.approbation",
        entite: "Fournisseur", entiteId: id,
        nouvelleValeur: { code: f.code, raisonSociale: f.raisonSociale },
      });
      return "ok" as const;
    });
    if (resultat === "incomplet") {
      return { ok: false, message: "Qualification incomplète : renseignez au moins un téléphone ou un e-mail (fiche ou contact)." };
    }
    if (resultat === "doublon") return { ok: false, message: "Doublon RCCM / identifiant fiscal détecté (RM-1001)." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${f.raisonSociale} approuvé — la fiche est ACTIVE et commandable.` };
  } catch (e) {
    console.error("[fournisseurs] approbation :", e);
    return { ok: false, message: "Approbation impossible." };
  }
}

const ACTIONS_TRANSITION: Record<string, string> = {
  surveillance: "fournisseur.surveillance",
  suspendu: "fournisseur.suspension",
  archive: "fournisseur.archivage",
  actif: "fournisseur.reactivation",
  prospect: "fournisseur.requalification",
};

export async function changerEtatFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.approuver");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const cible = texteCourt(fd.get("cible"), 15);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  const f = await fournisseurDe(id, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  const autorisees = TRANSITIONS_FOURNISSEUR[f.statut] ?? [];
  if (!autorisees.includes(cible)) {
    return { ok: false, message: `Transition « ${f.statut} → ${cible} » non autorisée (l'activation d'un prospect passe par l'APPROBATION).` };
  }
  if ((cible === "suspendu" || cible === "archive") && !motif) {
    return { ok: false, message: "Le motif est obligatoire pour suspendre ou archiver." };
  }
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.fournisseur.updateMany({
        where: { id, etablissementId, version },
        data: { statut: cible, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: ACTIONS_TRANSITION[cible] ?? "fournisseur.transition",
        entite: "Fournisseur", entiteId: id,
        ancienneValeur: { statut: f.statut },
        nouvelleValeur: { statut: cible, motif: motif || undefined },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    const libelles: Record<string, string> = {
      surveillance: "placé SOUS SURVEILLANCE (reste commandable).",
      suspendu: "SUSPENDU — plus aucune nouvelle commande (RM-1002).",
      archive: "ARCHIVÉ — consultable mais plus sélectionnable (RM-1005).",
      actif: "réactivé (ACTIF).",
      prospect: "repassé PROSPECT — une nouvelle qualification est requise.",
    };
    return { ok: true, message: `${f.raisonSociale} ${libelles[cible] ?? "mis à jour."}` };
  } catch (e) {
    console.error("[fournisseurs] transition :", e);
    return { ok: false, message: "Changement d'état impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Contacts
// ─────────────────────────────────────────────────────────────

export async function enregistrerContactFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const nom = texteCourt(fd.get("nom"), 80);
  if (!nom) return { ok: false, message: "Le nom du contact est obligatoire." };
  const f = await fournisseurDe(fournisseurId, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  const donnees = {
    nom,
    fonction: texteCourt(fd.get("fonction"), 80) || null,
    telephone: texteCourt(fd.get("telephone"), 30) || null,
    email: texteCourt(fd.get("email"), 120) || null,
    principal: String(fd.get("principal") ?? "") === "oui",
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (donnees.principal) {
        await tx.contactFournisseur.updateMany({
          where: { fournisseurId, annuleLe: null, principal: true },
          data: { principal: false },
        });
      }
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const maj = await tx.contactFournisseur.updateMany({
          where: { id, fournisseurId, version, annuleLe: null },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.contactFournisseur.create({ data: { fournisseurId, ...donnees } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: id ? "fournisseur.contact_modification" : "fournisseur.contact_creation",
        entite: "ContactFournisseur", entiteId: id || fournisseurId, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Contact mis à jour." : "Contact ajouté." };
  } catch (e) {
    console.error("[fournisseurs] contact :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerContactFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
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
      const maj = await tx.contactFournisseur.updateMany({
        where: { id, version, annuleLe: null, fournisseur: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.contact_retrait",
        entite: "ContactFournisseur", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Contact retiré." };
  } catch (e) {
    console.error("[fournisseurs] retrait contact :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Comptes bancaires du fournisseur
// ─────────────────────────────────────────────────────────────

export async function enregistrerCompteBancaireFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const banque = texteCourt(fd.get("banque"), 80);
  if (!banque) return { ok: false, message: "La banque est obligatoire." };
  const f = await fournisseurDe(fournisseurId, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  const donnees = {
    banque,
    agence: texteCourt(fd.get("agence"), 80) || null,
    numeroCompte: texteCourt(fd.get("numeroCompte"), 40) || null,
    iban: texteCourt(fd.get("iban"), 40) || null,
    swift: texteCourt(fd.get("swift"), 20) || null,
    mobileMoney: texteCourt(fd.get("mobileMoney"), 30) || null,
    principal: String(fd.get("principal") ?? "") === "oui",
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (donnees.principal) {
        await tx.compteBancaireFournisseur.updateMany({
          where: { fournisseurId, annuleLe: null, principal: true },
          data: { principal: false },
        });
      }
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const maj = await tx.compteBancaireFournisseur.updateMany({
          where: { id, fournisseurId, version, annuleLe: null },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.compteBancaireFournisseur.create({ data: { fournisseurId, ...donnees } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: id ? "fournisseur.compte_modification" : "fournisseur.compte_creation",
        entite: "CompteBancaireFournisseur", entiteId: id || fournisseurId, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Coordonnées bancaires mises à jour." : "Coordonnées bancaires ajoutées." };
  } catch (e) {
    console.error("[fournisseurs] compte bancaire :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerCompteBancaireFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
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
      const maj = await tx.compteBancaireFournisseur.updateMany({
        where: { id, version, annuleLe: null, fournisseur: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.compte_retrait",
        entite: "CompteBancaireFournisseur", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Coordonnées bancaires retirées." };
  } catch (e) {
    console.error("[fournisseurs] retrait compte :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Documents administratifs (RM-1003 : expirations dérivées)
// ─────────────────────────────────────────────────────────────

export async function enregistrerDocumentFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const type = texteCourt(fd.get("type"), 30);
  if (!TYPES_DOCUMENT_FOURNISSEUR.some((t) => t.code === type)) {
    return { ok: false, message: "Type de document invalide." };
  }
  const f = await fournisseurDe(fournisseurId, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  const donnees = {
    type,
    reference: texteCourt(fd.get("reference"), 120) || null,
    dateEmission: dateFacultative(fd.get("dateEmission")),
    dateExpiration: dateFacultative(fd.get("dateExpiration")),
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        // Mise à jour = NOUVELLE version du document (13 : les documents sont versionnés).
        const maj = await tx.documentFournisseur.updateMany({
          where: { id, fournisseurId, version, annuleLe: null },
          data: { ...donnees, numeroVersion: { increment: 1 }, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.documentFournisseur.create({ data: { fournisseurId, ...donnees } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: id ? "fournisseur.document_modification" : "fournisseur.document_creation",
        entite: "DocumentFournisseur", entiteId: id || fournisseurId, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Document mis à jour (nouvelle version)." : "Document enregistré." };
  } catch (e) {
    console.error("[fournisseurs] document :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerDocumentFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
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
      const maj = await tx.documentFournisseur.updateMany({
        where: { id, version, annuleLe: null, fournisseur: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.document_retrait",
        entite: "DocumentFournisseur", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Document retiré." };
  } catch (e) {
    console.error("[fournisseurs] retrait document :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Contrats
// ─────────────────────────────────────────────────────────────

export async function enregistrerContratFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const reference = texteCourt(fd.get("reference"), 60);
  const objet = texteCourt(fd.get("objet"), 200);
  if (!reference || !objet) return { ok: false, message: "Référence et objet du contrat sont obligatoires." };
  const dateDebut = dateFacultative(fd.get("dateDebut"));
  if (!dateDebut) return { ok: false, message: "La date de début est obligatoire." };
  const dateFin = dateFacultative(fd.get("dateFin"));
  if (dateFin && dateFin <= dateDebut) return { ok: false, message: "La date de fin doit suivre la date de début." };
  const renouvellement = texteCourt(fd.get("renouvellement"), 10) || "aucun";
  if (!RENOUVELLEMENTS_CONTRAT.some((r) => r.code === renouvellement)) {
    return { ok: false, message: "Mode de renouvellement invalide." };
  }
  const f = await fournisseurDe(fournisseurId, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  const donnees = {
    reference, objet, dateDebut, dateFin, renouvellement,
    montant: montantFacultatif(fd.get("montant")),
    conditionsPaiement: texteCourt(fd.get("conditionsPaiement"), 160) || null,
    penalites: texteCourt(fd.get("penalites"), 200) || null,
    documentReference: texteCourt(fd.get("documentReference"), 120) || null,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const maj = await tx.contratFournisseur.updateMany({
          where: { id, fournisseurId, version, annuleLe: null },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.contratFournisseur.create({ data: { fournisseurId, ...donnees } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: id ? "fournisseur.contrat_modification" : "fournisseur.contrat_creation",
        entite: "ContratFournisseur", entiteId: id || fournisseurId, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Contrat mis à jour." : "Contrat enregistré." };
  } catch (e) {
    console.error("[fournisseurs] contrat :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerContratFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
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
      const maj = await tx.contratFournisseur.updateMany({
        where: { id, version, annuleLe: null, fournisseur: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.contrat_retrait",
        entite: "ContratFournisseur", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Contrat retiré." };
  } catch (e) {
    console.error("[fournisseurs] retrait contrat :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Évaluations (RM-1004) & litiges
// ─────────────────────────────────────────────────────────────

export async function evaluerFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.evaluer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const periode = texteCourt(fd.get("periode"), 40);
  if (!periode) return { ok: false, message: "La période évaluée est obligatoire." };
  const notes: Record<string, number> = {};
  for (const cle of ["scoreQualite", "scoreDelais", "scorePrix", "scoreService", "scoreConformite"]) {
    const n = Math.trunc(Number(fd.get(cle)));
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return { ok: false, message: "Chaque critère est noté de 1 à 5." };
    }
    notes[cle] = n;
  }
  const f = await fournisseurDe(fournisseurId, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.evaluationFournisseur.create({
        data: {
          fournisseurId, periode,
          scoreQualite: notes.scoreQualite, scoreDelais: notes.scoreDelais,
          scorePrix: notes.scorePrix, scoreService: notes.scoreService,
          scoreConformite: notes.scoreConformite,
          commentaire: texteCourt(fd.get("commentaire"), 300) || null,
          evalueParId: u.id, evalueParNom: u.nomComplet,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.evaluation",
        entite: "EvaluationFournisseur", entiteId: creee.id,
        nouvelleValeur: { fournisseur: f.raisonSociale, periode, ...notes },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Évaluation « ${periode} » enregistrée — le score global est recalculé (RM-1004).` };
  } catch (e) {
    console.error("[fournisseurs] évaluation :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerEvaluationFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.evaluer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.evaluationFournisseur.updateMany({
        where: { id, version, annuleLe: null, fournisseur: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.evaluation_retrait",
        entite: "EvaluationFournisseur", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Évaluation retirée (score recalculé)." };
  } catch (e) {
    console.error("[fournisseurs] retrait évaluation :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

export async function ouvrirLitigeFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.evaluer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fournisseurId = texteCourt(fd.get("fournisseurId"), 50);
  const type = texteCourt(fd.get("type"), 30);
  const description = texteCourt(fd.get("description"), 400);
  const gravite = texteCourt(fd.get("gravite"), 10) || "moyenne";
  if (!TYPES_LITIGE_FOURNISSEUR.some((t) => t.code === type)) return { ok: false, message: "Type de litige invalide." };
  if (!description) return { ok: false, message: "La description du litige est obligatoire." };
  if (!GRAVITES_LITIGE.some((g) => g.code === gravite)) return { ok: false, message: "Gravité invalide." };
  const f = await fournisseurDe(fournisseurId, etablissementId);
  if (!f) return { ok: false, message: "Fournisseur introuvable." };
  try {
    await prisma.$transaction(async (tx) => {
      const cree = await tx.litigeFournisseur.create({
        data: {
          fournisseurId, type, description, gravite,
          responsable: texteCourt(fd.get("responsable"), 80) || null,
          ouvertParId: u.id, ouvertParNom: u.nomComplet,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.litige_ouverture",
        entite: "LitigeFournisseur", entiteId: cree.id,
        nouvelleValeur: { fournisseur: f.raisonSociale, type, gravite },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: "Litige ouvert (suivi sur la fiche fournisseur)." };
  } catch (e) {
    console.error("[fournisseurs] litige :", e);
    return { ok: false, message: "Ouverture impossible." };
  }
}

export async function resoudreLitigeFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.evaluer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const solution = texteCourt(fd.get("solution"), 400);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!solution) return { ok: false, message: "La solution apportée est obligatoire pour clore un litige." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.litigeFournisseur.updateMany({
        where: { id, version, annuleLe: null, statut: "ouvert", fournisseur: { etablissementId } },
        data: {
          statut: "resolu", solution, dateCloture: new Date(),
          cloParId: u.id, cloParNom: u.nomComplet, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.litige_resolution",
        entite: "LitigeFournisseur", entiteId: id, nouvelleValeur: { solution },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: "Litige déjà résolu ou version dépassée." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Litige résolu (solution et date de clôture tracées)." };
  } catch (e) {
    console.error("[fournisseurs] résolution litige :", e);
    return { ok: false, message: "Résolution impossible." };
  }
}

export async function retirerLitigeFournisseur(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.fournisseurs.evaluer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const motif = texteCourt(fd.get("motif"), 300);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!motif) return { ok: false, message: "Le motif du retrait est obligatoire." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.litigeFournisseur.updateMany({
        where: { id, version, annuleLe: null, fournisseur: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "fournisseur.litige_retrait",
        entite: "LitigeFournisseur", entiteId: id, nouvelleValeur: { motif },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Litige retiré (motif tracé)." };
  } catch (e) {
    console.error("[fournisseurs] retrait litige :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}
