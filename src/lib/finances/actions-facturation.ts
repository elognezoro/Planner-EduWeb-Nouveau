"use server";

/**
 * Actions serveur du sous-module FACTURATION (07-Facturation + 05B/02B) : factures et
 * proformas, cycle de vie (brouillon → validation → émission → payée/soldée), avoirs,
 * notes de débit, suspension, archivage, annulation logique motivée.
 *
 * TOUTES les écritures : garde granulaire `exigerPermissionFinance` (97-RBAC), transaction +
 * journaliserFinance (RM-003/011 — chaque TRANSITION d'état est historisée), verrouillage
 * optimiste (RM-019), annulations logiques (RM-004 : « une facture ne peut jamais être
 * supprimée »). INVARIANT (07) : une facture ÉMISE ne se modifie plus — avoir, note de débit,
 * suspension ou annulation motivée uniquement. Numérotation FAC/PRO/AVR/ND via les séquences
 * de la fondation (RM-014). Fichier "use server" : exports async uniquement (types dans
 * facturation/types.ts).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import type { PermissionFinance } from "./commun/permissions";
import { prochainNumero } from "./commun/numerotation";
import { dateFacultative, montantValide, texteCourt } from "./commun/validation";
import {
  creancesFacturables, majStatutFactures, montantLigne, normaliserLigneSaisie, totauxDepuisLignes,
} from "./facturation/serveur";
import type { LigneFactureSaisie, StatutFacture } from "./facturation/types";

const CHEMIN = "/app/vie-scolaire/finances";
const PLAFOND = 1_000_000_000;
/** Statuts encore MODIFIABLES (avant émission — invariant du 07). */
const STATUTS_MODIFIABLES: StatutFacture[] = ["brouillon", "en_attente_validation"];

async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

/** Élève actif de CET établissement (cloisonnement, comme partout dans le module). */
async function eleveDeLEtablissement(eleveId: string, etablissementId: string) {
  if (!eleveId) return null;
  return prisma.utilisateur.findFirst({
    where: { id: eleveId, etablissementId, roleActif: { nomTechnique: "eleve" } },
    select: { id: true, nom: true, prenoms: true },
  });
}

const nomDe = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

/** Lignes saisies (JSON du formulaire) : 1 à 50 lignes valides, total borné. */
function lignesDepuisFormulaire(fd: FormData): LigneFactureSaisie[] | null {
  try {
    const brut = JSON.parse(String(fd.get("lignes") ?? "[]"));
    if (!Array.isArray(brut)) return null;
    const lignes = brut.map(normaliserLigneSaisie).filter((l): l is LigneFactureSaisie => l !== null).slice(0, 50);
    if (lignes.length === 0) return null;
    const { montantTotal } = totauxDepuisLignes(lignes);
    if (montantTotal < 0 || montantTotal > PLAFOND) return null;
    return lignes;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Création (manuelle et depuis les créances du 06)
// ─────────────────────────────────────────────────────────────

export async function creerFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.factures.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const type = texteCourt(fd.get("type"), 20) === "proforma" ? "proforma" : "facture";
  const objet = texteCourt(fd.get("objet"), 200);
  if (!objet) return { ok: false, message: "L'objet de la facture est obligatoire." };
  const lignes = lignesDepuisFormulaire(fd);
  if (!lignes) return { ok: false, message: "Ajoutez au moins une ligne valide (libellé, quantité, prix)." };
  const dateEcheance = dateFacultative(fd.get("dateEcheance"));

  try {
    const exercice = await exerciceDe(etablissementId);
    await prisma.$transaction(async (tx) => {
      const facture = await tx.factureEleve.create({
        data: {
          etablissementId, exercice, eleveId: eleve.id, type, objet,
          observations: texteCourt(fd.get("observations"), 500) || null,
          dateEcheance, creeParId: u.id,
          ...totauxDepuisLignes(lignes),
        },
      });
      await tx.ligneFacture.createMany({
        data: lignes.map((l, i) => ({
          factureId: facture.id, libelle: l.libelle, description: l.description ?? null,
          quantite: l.quantite, prixUnitaire: l.prixUnitaire, remise: l.remise ?? 0,
          taxe: l.taxe ?? 0, montant: montantLigne(l), ordre: i,
        })),
      });
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "facture.creation",
        entite: "FactureEleve", entiteId: facture.id,
        nouvelleValeur: { type, objet, montantTotal: facture.montantTotal, lignes: lignes.length, eleveId: eleve.id },
      });
    });
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: type === "proforma"
        ? `Proforma (brouillon) créée pour ${nomDe(eleve)} — validez puis émettez-la.`
        : `Facture (brouillon) créée pour ${nomDe(eleve)} — validez puis émettez-la.`,
    };
  } catch (e) {
    console.error("[facturation] création :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * FACTURE LES CRÉANCES ouvertes de l'élève (06 → 07, WF-001) : une ligne par créance non
 * encore facturée — idempotent (une créance active n'est liée qu'à UNE facture active).
 */
export async function facturerCreances(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.factures.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const eleve = await eleveDeLEtablissement(texteCourt(fd.get("eleveId"), 50), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };

  try {
    const exercice = await exerciceDe(etablissementId);
    const facturables = await creancesFacturables(etablissementId, eleve.id, exercice);
    if (facturables.length === 0) {
      return { ok: false, message: "Aucune créance à facturer : toutes les créances ouvertes sont déjà couvertes par une facture (générez d'abord les créances au Compte élève si besoin)." };
    }
    const echeances = facturables.map((c) => c.dateEcheance).filter((d): d is string => !!d);
    const dateEcheance = echeances.length > 0 ? new Date(echeances.sort()[echeances.length - 1]) : null;

    await prisma.$transaction(async (tx) => {
      const total = facturables.reduce((s, c) => s + c.montant, 0);
      const facture = await tx.factureEleve.create({
        data: {
          etablissementId, exercice, eleveId: eleve.id, type: "facture",
          objet: `Frais de scolarité — exercice ${exercice}`,
          dateEcheance, creeParId: u.id,
          totalBrut: total, montantTotal: total,
        },
      });
      await tx.ligneFacture.createMany({
        data: facturables.map((c, i) => ({
          factureId: facture.id, creanceId: c.id, libelle: c.libelle,
          quantite: 1, prixUnitaire: c.montant, montant: c.montant, ordre: i,
        })),
      });
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "facture.creation",
        entite: "FactureEleve", entiteId: facture.id,
        nouvelleValeur: { source: "creances", eleveId: eleve.id, lignes: facturables.length, montantTotal: total },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Facture (brouillon) créée pour ${nomDe(eleve)} : ${facturables.length} créance(s) regroupée(s) — validez puis émettez-la.` };
  } catch (e) {
    console.error("[facturation] facturation des créances :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Modification (brouillons uniquement) et cycle de vie
// ─────────────────────────────────────────────────────────────

export async function modifierFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const f = await prisma.factureEleve.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, statut: true },
  });
  if (!f) return { ok: false, message: "Facture introuvable." };
  if (!STATUTS_MODIFIABLES.includes(f.statut as StatutFacture)) {
    return { ok: false, message: "Une facture validée ou émise ne se modifie plus : créez un avoir ou une note de débit." };
  }
  const u = await exigerPermissionFinance(f.etablissementId, "finance.factures.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  const objet = texteCourt(fd.get("objet"), 200);
  if (!objet) return { ok: false, message: "L'objet de la facture est obligatoire." };
  const lignes = lignesDepuisFormulaire(fd);
  if (!lignes) return { ok: false, message: "Ajoutez au moins une ligne valide (libellé, quantité, prix)." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.factureEleve.findFirst({
        where: { id },
        include: { lignes: { where: { annuleLe: null } } },
      });
      const maj = await tx.factureEleve.updateMany({
        where: { id, version, statut: { in: STATUTS_MODIFIABLES }, annuleLe: null },
        data: {
          objet,
          observations: texteCourt(fd.get("observations"), 500) || null,
          dateEcheance: dateFacultative(fd.get("dateEcheance")),
          ...totauxDepuisLignes(lignes),
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      // RM-004 : les anciennes lignes sont ANNULÉES logiquement, jamais supprimées.
      await tx.ligneFacture.updateMany({
        where: { factureId: id, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id },
      });
      await tx.ligneFacture.createMany({
        data: lignes.map((l, i) => ({
          factureId: id, libelle: l.libelle, description: l.description ?? null,
          quantite: l.quantite, prixUnitaire: l.prixUnitaire, remise: l.remise ?? 0,
          taxe: l.taxe ?? 0, montant: montantLigne(l), ordre: i,
        })),
      });
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, utilisateurId: u.id, action: "facture.modification",
        entite: "FactureEleve", entiteId: id,
        ancienneValeur: avant, nouvelleValeur: { objet, lignes: lignes.length, ...totauxDepuisLignes(lignes) },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Facture (brouillon) mise à jour." };
  } catch (e) {
    console.error("[facturation] modification :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Transition d'état générique (historisée) — les transitions spéciales ont leur action dédiée. */
async function transitionFacture(
  fd: FormData,
  params: {
    depuis: StatutFacture[];
    vers: StatutFacture;
    permission: PermissionFinance;
    action: string;
    messageOk: string;
    messageMauvaisEtat: string;
    donnees?: (uId: string) => { dateValidation?: Date; valideeParId?: string };
    apresMajStatuts?: boolean;
  },
): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const f = await prisma.factureEleve.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, eleveId: true, statut: true, numero: true },
  });
  if (!f) return { ok: false, message: "Facture introuvable." };
  if (!params.depuis.includes(f.statut as StatutFacture)) {
    return { ok: false, message: params.messageMauvaisEtat };
  }
  const u = await exigerPermissionFinance(f.etablissementId, params.permission);
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.factureEleve.updateMany({
        where: { id, version, statut: { in: params.depuis }, annuleLe: null },
        data: { statut: params.vers, ...(params.donnees?.(u.id) ?? {}), version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, utilisateurId: u.id, action: params.action,
        entite: "FactureEleve", entiteId: id,
        ancienneValeur: { statut: f.statut }, nouvelleValeur: { statut: params.vers },
      });
      if (params.apresMajStatuts) {
        await majStatutFactures(tx, { etablissementId: f.etablissementId, eleveId: f.eleveId });
      }
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: params.messageOk };
  } catch (e) {
    console.error(`[facturation] ${params.action} :`, e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function soumettreFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return transitionFacture(fd, {
    depuis: ["brouillon"], vers: "en_attente_validation",
    permission: "finance.factures.creer", action: "facture.soumission",
    messageOk: "Facture soumise à validation.",
    messageMauvaisEtat: "Seul un brouillon peut être soumis à validation.",
  });
}

export async function validerFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const f = await prisma.factureEleve.findFirst({ where: { id, annuleLe: null }, select: { montantTotal: true } });
  if (f && f.montantTotal <= 0) return { ok: false, message: "Le montant de la facture doit être positif pour la valider." };
  return transitionFacture(fd, {
    depuis: ["brouillon", "en_attente_validation"], vers: "validee",
    permission: "finance.factures.valider", action: "facture.validation",
    messageOk: "Facture validée — vous pouvez l'émettre.",
    messageMauvaisEtat: "Seul un brouillon (ou une facture en attente) peut être validé.",
    donnees: (uId) => ({ dateValidation: new Date(), valideeParId: uId }),
  });
}

/** ÉMISSION : attribue le numéro (FAC/PRO via les séquences de la fondation) — irréversible. */
export async function emettreFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const f = await prisma.factureEleve.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, eleveId: true, statut: true, type: true, exercice: true },
  });
  if (!f) return { ok: false, message: "Facture introuvable." };
  if (f.statut !== "validee") return { ok: false, message: "Seule une facture VALIDÉE peut être émise." };
  const u = await exigerPermissionFinance(f.etablissementId, "finance.factures.emettre");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maintenant = new Date();
      const { reference } = await prochainNumero(
        tx, f.etablissementId, f.exercice,
        f.type === "proforma" ? "proforma" : "facture",
        f.type === "proforma" ? "PRO" : "FAC",
      );
      const maj = await tx.factureEleve.updateMany({
        where: { id, version, statut: "validee", annuleLe: null },
        data: {
          statut: "emise", numero: reference, dateEmission: maintenant, dateComptable: maintenant,
          emiseParId: u.id, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { statut: "conflit" as const };
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, exerciceId: f.exercice, utilisateurId: u.id,
        action: "facture.emission", entite: "FactureEleve", entiteId: id,
        nouvelleValeur: { numero: reference, type: f.type },
      });
      // Les paiements déjà alloués aux créances liées peuvent solder la facture dès l'émission.
      if (f.type === "facture") {
        await majStatutFactures(tx, { etablissementId: f.etablissementId, eleveId: f.eleveId });
      }
      return { statut: "ok" as const, numero: reference };
    });
    if (resultat.statut === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${f.type === "proforma" ? "Proforma émise" : "Facture émise"} — n° ${resultat.numero}.` };
  } catch (e) {
    console.error("[facturation] émission :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function annulerFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const motif = texteCourt(fd.get("motif"), 300);
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  const id = texteCourt(fd.get("id"), 50);
  const f = await prisma.factureEleve.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, statut: true, numero: true },
  });
  if (!f) return { ok: false, message: "Facture introuvable." };
  if (f.statut === "soldee" || f.statut === "archivee") {
    return { ok: false, message: "Une facture soldée ne s'annule pas : créez un avoir." };
  }
  if (f.statut === "annulee") return { ok: false, message: "Facture déjà annulée." };
  const u = await exigerPermissionFinance(f.etablissementId, "finance.factures.annuler");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.factureEleve.findFirst({ where: { id } });
      const maj = await tx.factureEleve.updateMany({
        where: { id, version, annuleLe: null, statut: { notIn: ["soldee", "archivee", "annulee"] } },
        data: {
          statut: "annulee", motifAnnulation: motif,
          annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      // 07 : conserve l'historique ; les contre-écritures formelles viendront avec
      // 11-Comptabilité (notre comptabilité calculée exclut les factures annulées).
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, utilisateurId: u.id, action: "facture.annulation",
        entite: "FactureEleve", entiteId: id,
        ancienneValeur: avant, nouvelleValeur: { statut: "annulee", motifAnnulation: motif },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Facture ${f.numero ?? "(brouillon)"} annulée — l'historique est conservé.` };
  } catch (e) {
    console.error("[facturation] annulation :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function suspendreFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return transitionFacture(fd, {
    depuis: ["emise", "partiellement_payee"], vers: "suspendue",
    permission: "finance.factures.emettre", action: "facture.suspension",
    messageOk: "Facture suspendue (le suivi de paiement est gelé).",
    messageMauvaisEtat: "Seule une facture émise (non soldée) peut être suspendue.",
  });
}

export async function reprendreFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return transitionFacture(fd, {
    depuis: ["suspendue"], vers: "emise",
    permission: "finance.factures.emettre", action: "facture.reprise",
    messageOk: "Facture reprise — statut de paiement recalculé.",
    messageMauvaisEtat: "Seule une facture suspendue peut être reprise.",
    apresMajStatuts: true,
  });
}

export async function archiverFacture(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return transitionFacture(fd, {
    depuis: ["soldee"], vers: "archivee",
    permission: "finance.factures.emettre", action: "facture.archivage",
    messageOk: "Facture archivée (lecture seule).",
    messageMauvaisEtat: "Seule une facture soldée peut être archivée.",
  });
}

// ─────────────────────────────────────────────────────────────
//  Avoirs & notes de débit (sur facture émise)
// ─────────────────────────────────────────────────────────────

const STATUTS_AJUSTABLES: StatutFacture[] = ["emise", "partiellement_payee", "soldee", "suspendue"];

export async function creerAvoir(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const factureId = texteCourt(fd.get("factureId"), 50);
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant d'avoir invalide." };
  const motif = texteCourt(fd.get("motif"), 300);
  if (!motif) return { ok: false, message: "Le motif de l'avoir est obligatoire." };

  const f = await prisma.factureEleve.findFirst({
    where: { id: factureId, annuleLe: null, type: "facture" },
    select: {
      etablissementId: true, eleveId: true, exercice: true, statut: true, numero: true, montantTotal: true,
      avoirs: { where: { annuleLe: null }, select: { montant: true } },
      notesDebit: { where: { annuleLe: null }, select: { montant: true } },
    },
  });
  if (!f) return { ok: false, message: "Facture introuvable." };
  if (!STATUTS_AJUSTABLES.includes(f.statut as StatutFacture)) {
    return { ok: false, message: "Un avoir ne peut être créé que sur une facture ÉMISE." };
  }
  const netDu = Math.max(0, f.montantTotal + f.notesDebit.reduce((s, n) => s + n.montant, 0) - f.avoirs.reduce((s, a) => s + a.montant, 0));
  if (montant > netDu) {
    return { ok: false, message: `L'avoir dépasse le net dû de la facture (${netDu.toLocaleString("fr-FR")} F).` };
  }
  const u = await exigerPermissionFinance(f.etablissementId, "finance.factures.avoir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  try {
    const numeroAvoir = await prisma.$transaction(async (tx) => {
      const { reference } = await prochainNumero(tx, f.etablissementId, f.exercice, "avoir", "AVR");
      const maintenant = new Date();
      const avoir = await tx.avoirFacture.create({
        data: {
          etablissementId: f.etablissementId, factureId, numero: reference,
          type: montant >= netDu ? "total" : "partiel",
          montant, motif, creeParId: u.id, dateComptable: maintenant,
        },
      });
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, exerciceId: f.exercice, utilisateurId: u.id,
        action: "avoir.creation", entite: "AvoirFacture", entiteId: avoir.id,
        nouvelleValeur: { numero: reference, factureId, montant, motif, facture: f.numero },
      });
      await majStatutFactures(tx, { etablissementId: f.etablissementId, eleveId: f.eleveId });
      return reference;
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Avoir ${numeroAvoir} créé sur la facture ${f.numero ?? ""} — net dû recalculé.` };
  } catch (e) {
    console.error("[facturation] avoir :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function creerNoteDebit(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const factureId = texteCourt(fd.get("factureId"), 50);
  const libelle = texteCourt(fd.get("libelle"), 160);
  if (!libelle) return { ok: false, message: "Le libellé de la note de débit est obligatoire." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant de note de débit invalide." };

  const f = await prisma.factureEleve.findFirst({
    where: { id: factureId, annuleLe: null, type: "facture" },
    select: { etablissementId: true, eleveId: true, exercice: true, statut: true, numero: true },
  });
  if (!f) return { ok: false, message: "Facture introuvable." };
  if (!STATUTS_AJUSTABLES.includes(f.statut as StatutFacture)) {
    return { ok: false, message: "Une note de débit ne peut être créée que sur une facture ÉMISE." };
  }
  const u = await exigerPermissionFinance(f.etablissementId, "finance.factures.debiter");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  try {
    const numeroNote = await prisma.$transaction(async (tx) => {
      const { reference } = await prochainNumero(tx, f.etablissementId, f.exercice, "note_debit", "ND");
      const note = await tx.noteDebitFacture.create({
        data: {
          etablissementId: f.etablissementId, factureId, numero: reference, libelle, montant,
          motif: texteCourt(fd.get("motif"), 300) || null, creeParId: u.id, dateComptable: new Date(),
        },
      });
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, exerciceId: f.exercice, utilisateurId: u.id,
        action: "note_debit.creation", entite: "NoteDebitFacture", entiteId: note.id,
        nouvelleValeur: { numero: reference, factureId, libelle, montant, facture: f.numero },
      });
      await majStatutFactures(tx, { etablissementId: f.etablissementId, eleveId: f.eleveId });
      return reference;
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Note de débit ${numeroNote} ajoutée à la facture ${f.numero ?? ""} — net dû recalculé.` };
  } catch (e) {
    console.error("[facturation] note de débit :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Annulation logique d'un avoir (RM-004) — recalcul du statut de la facture. */
export async function annulerAvoir(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulerAjustement(fd, "avoir");
}

/** Annulation logique d'une note de débit (RM-004) — recalcul du statut de la facture. */
export async function annulerNoteDebit(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  return annulerAjustement(fd, "note_debit");
}

async function annulerAjustement(fd: FormData, genre: "avoir" | "note_debit"): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const existant =
    genre === "avoir"
      ? await prisma.avoirFacture.findFirst({
          where: { id, annuleLe: null },
          select: { etablissementId: true, numero: true, facture: { select: { eleveId: true } } },
        })
      : await prisma.noteDebitFacture.findFirst({
          where: { id, annuleLe: null },
          select: { etablissementId: true, numero: true, facture: { select: { eleveId: true } } },
        });
  if (!existant) return { ok: false, message: "Document introuvable (déjà annulé ?)." };
  const u = await exigerPermissionFinance(
    existant.etablissementId,
    genre === "avoir" ? "finance.factures.avoir" : "finance.factures.debiter",
  );
  if (!u) return { ok: false, message: "Action non autorisée." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const donnees = { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 as const } };
      const critere = { id, version, annuleLe: null };
      const maj =
        genre === "avoir"
          ? await tx.avoirFacture.updateMany({ where: critere, data: donnees })
          : await tx.noteDebitFacture.updateMany({ where: critere, data: donnees });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: existant.etablissementId, utilisateurId: u.id,
        action: genre === "avoir" ? "avoir.annulation" : "note_debit.annulation",
        entite: genre === "avoir" ? "AvoirFacture" : "NoteDebitFacture", entiteId: id,
        ancienneValeur: { numero: existant.numero },
      });
      await majStatutFactures(tx, { etablissementId: existant.etablissementId, eleveId: existant.facture.eleveId });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: genre === "avoir" ? "Avoir annulé — net dû recalculé." : "Note de débit annulée — net dû recalculé." };
  } catch (e) {
    console.error(`[facturation] annulation ${genre} :`, e);
    return { ok: false, message: "Erreur technique." };
  }
}
