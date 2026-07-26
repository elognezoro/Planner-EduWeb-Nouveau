"use server";

/**
 * Actions serveur du sous-module IMMOBILISATIONS (15 + 05B/02B) : passeport d'actif, mise en
 * service (RM-1201 : condition de l'amortissement), création depuis un article de stock
 * immobilisable (RM-1104/1205 — sortie de stock + traçabilité de l'origine), cycle de vie à
 * transitions motivées, affectation/localisation/transfert (RM-1204 : historique conservé),
 * maintenance préventive/corrective, réévaluation, comptabilisation des dotations
 * d'amortissement linéaire (RM-1202 : écriture 681/28x, idempotente par exercice), sortie
 * d'actif (RM-1203 : écriture 28x + 81 / 2x) décidée par un SECOND acteur.
 *
 * Écritures via le registre formel (11) — comptes 2/28/68/81/481/106 semés à la demande.
 * TOUTES : garde granulaire, transaction + journaliserFinance, verrouillage optimiste,
 * annulations logiques. Fichier "use server" : exports async uniquement.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { MESSAGE_SEPARATION_RESPONSABILITES } from "./commun/permissions";
import { dateValide, dateFacultative, texteCourt } from "./commun/validation";
import { prochainNumero } from "./commun/numerotation";
import { ecrireEcritureAutomatique, periodeCloturee, periodeDe } from "./comptabilite/serveur";
import { appliquerDeltaMagasinPrincipal, quantiteReservee } from "./stocks/serveur";
import { assurerComptesImmobilisations, dotationsDues } from "./immobilisations/serveur";
import {
  CATEGORIES_IMMO, ETATS_ACTIFS_IMMO, MODES_ACQUISITION, TRANSITIONS_IMMO,
  TYPES_MAINTENANCE, TYPES_SORTIE_IMMO, type ParamsAmortissement,
} from "./immobilisations/types";

const CHEMIN = "/app/vie-scolaire/finances";
const PLAFOND = 1_000_000_000;
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

function montantObligatoire(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n > 0 && n <= PLAFOND ? n : null;
}
function montantFacultatif(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n >= 0 && n <= PLAFOND ? n : null;
}

// ─────────────────────────────────────────────────────────────
//  Fiche d'actif (passeport)
// ─────────────────────────────────────────────────────────────

export async function enregistrerImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const designation = texteCourt(fd.get("designation"), 160);
  if (!designation) return { ok: false, message: "La désignation est obligatoire." };
  const categorie = texteCourt(fd.get("categorie"), 30);
  const cat = CATEGORIES_IMMO.find((c) => c.code === categorie);
  if (!cat) return { ok: false, message: "Catégorie d'immobilisation invalide." };
  const coutAcquisition = montantObligatoire(fd.get("coutAcquisition"));
  if (!coutAcquisition) return { ok: false, message: "Le coût d'acquisition est obligatoire." };
  const valeurResiduelle = montantFacultatif(fd.get("valeurResiduelle")) ?? 0;
  if (valeurResiduelle >= coutAcquisition) return { ok: false, message: "La valeur résiduelle doit être inférieure au coût." };
  const modeAcquisition = texteCourt(fd.get("modeAcquisition"), 15) || "achat";
  if (!MODES_ACQUISITION.some((m) => m.code === modeAcquisition)) return { ok: false, message: "Mode d'acquisition invalide." };
  const dureeBrute = Math.trunc(Number(fd.get("dureeMois")));
  const dureeMois = Number.isFinite(dureeBrute) && dureeBrute > 0 && dureeBrute <= 1200 ? dureeBrute : cat.dureeMoisDefaut;

  const fournisseurIdBrut = texteCourt(fd.get("fournisseurId"), 50);
  const responsableIdBrut = texteCourt(fd.get("responsableId"), 50);
  const donnees = {
    designation, categorie,
    description: texteCourt(fd.get("description"), 400) || null,
    sousCategorie: texteCourt(fd.get("sousCategorie"), 80) || null,
    numeroSerie: texteCourt(fd.get("numeroSerie"), 80) || null,
    codeBarres: texteCourt(fd.get("codeBarres"), 80) || null,
    dateAcquisition: dateValide(fd.get("dateAcquisition")),
    coutAcquisition,
    valeurResiduelle,
    dureeMois,
    amortissable: cat.amortissable,
    modeAcquisition,
    factureReference: texteCourt(fd.get("factureReference"), 120) || null,
    garantieFournisseur: texteCourt(fd.get("garantieFournisseur"), 120) || null,
    garantieEcheance: dateFacultative(fd.get("garantieEcheance")),
    localisation: texteCourt(fd.get("localisation"), 200) || null,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const fournisseurId = fournisseurIdBrut
      ? (await prisma.fournisseur.findFirst({ where: { id: fournisseurIdBrut, etablissementId, annuleLe: null }, select: { id: true } }))?.id ?? null
      : null;
    const responsable = responsableIdBrut
      ? await prisma.utilisateur.findFirst({ where: { id: responsableIdBrut, etablissementId, statutCompte: "actif" }, select: { id: true, nom: true, prenoms: true } })
      : null;
    const responsableNom = responsable ? [responsable.prenoms, responsable.nom].filter(Boolean).join(" ").trim() || null : null;

    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.immobilisation.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true, coutAcquisition: true, valeurBrute: true } });
        if (!avant) return "introuvable" as const;
        // Après mise en service, coût/durée/valeurs sont FIGÉS (le plan d'amortissement en dépend).
        const enService = avant.statut !== "acquisition" && avant.statut !== "installation";
        const dataMaj = enService
          ? {
              designation: donnees.designation, description: donnees.description,
              sousCategorie: donnees.sousCategorie, numeroSerie: donnees.numeroSerie,
              codeBarres: donnees.codeBarres, factureReference: donnees.factureReference,
              garantieFournisseur: donnees.garantieFournisseur, garantieEcheance: donnees.garantieEcheance,
              localisation: donnees.localisation, fournisseurId, responsableId: responsable?.id ?? null, responsableNom,
            }
          : {
              ...donnees, fournisseurId, responsableId: responsable?.id ?? null, responsableNom,
              // le brut suit le coût tant que l'actif n'est pas en service (pas de réévaluation encore)
              valeurBrute: donnees.coutAcquisition,
              compteImmo: cat.compteImmo, compteAmort: cat.compteAmort,
            };
        const maj = await tx.immobilisation.updateMany({
          where: { id, etablissementId, version },
          data: { ...dataMaj, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "immobilisation.modification",
          entite: "Immobilisation", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Immobilisation introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      const exercice = await exerciceDe(etablissementId);
      await prisma.$transaction(async (tx) => {
        const { reference } = await prochainNumero(tx, etablissementId, null, "immobilisation", "IMM");
        const creee = await tx.immobilisation.create({
          data: {
            etablissementId, code: reference, ...donnees,
            valeurBrute: donnees.coutAcquisition,
            compteImmo: cat.compteImmo, compteAmort: cat.compteAmort,
            fournisseurId, responsableId: responsable?.id ?? null, responsableNom,
            statut: "acquisition", creeParId: u.id,
          },
        });
        await tx.evenementImmobilisation.create({
          data: { immobilisationId: creee.id, type: "acquisition", description: `Fiche créée (${cat.libelle})`, montant: coutAcquisition, parId: u.id, parNom: u.nomComplet },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "immobilisation.creation",
          entite: "Immobilisation", entiteId: creee.id, nouvelleValeur: creee,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Fiche d'actif mise à jour." : "Immobilisation enregistrée (au statut « en acquisition »)." };
  } catch (e) {
    console.error("[immo] fiche :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Mise en service (RM-1201) + création depuis stock (RM-1104/1205)
// ─────────────────────────────────────────────────────────────

/** Écriture d'acquisition (à la mise en service) : débit 2x / crédit contrepartie.
 *  Stock-sourcé → crédit 604 (reclassification de la charge d'achats stockés, pas de double
 *  comptage) ; sinon → crédit 481 (fournisseurs d'investissement). */
async function ecrireAcquisition(
  tx: Parameters<typeof ecrireEcritureAutomatique>[0],
  params: { etablissementId: string; exercice: string; immo: { id: string; code: string; designation: string; compteImmo: string; valeurBrute: number }; issuStock: boolean; utilisateurId: string },
) {
  const contrepartie = params.issuStock ? "604" : "481";
  return ecrireEcritureAutomatique(tx, {
    etablissementId: params.etablissementId, exercice: params.exercice, codeJournal: "IM",
    date: new Date(), libelle: `Mise en service ${params.immo.code} — ${params.immo.designation}`,
    pieceJustificative: params.immo.code, sourceType: "acquisition_immobilisation", sourceId: params.immo.id,
    utilisateurId: params.utilisateurId,
    lignes: [
      { compteNumero: params.immo.compteImmo, debit: params.immo.valeurBrute, credit: 0 },
      { compteNumero: contrepartie, debit: 0, credit: params.immo.valeurBrute },
    ],
  });
}

export async function mettreEnServiceImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  const dateMiseEnService = dateValide(fd.get("dateMiseEnService"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  await assurerComptesImmobilisations(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const immo = await tx.immobilisation.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { statut: true, code: true, designation: true, compteImmo: true, valeurBrute: true, origineArticleId: true },
      });
      if (!immo) return { erreur: "Immobilisation introuvable." };
      if (immo.statut !== "acquisition" && immo.statut !== "installation") {
        return { erreur: "Seul un actif « en acquisition » ou « en installation » se met en service (RM : mise en service impossible)." };
      }
      if (await periodeCloturee(tx, etablissementId, periodeDe(dateMiseEnService))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const exercice = await exerciceDe(etablissementId);
      const maj = await tx.immobilisation.updateMany({
        where: { id, etablissementId, version, statut: { in: ["acquisition", "installation"] } },
        data: { statut: "service", dateMiseEnService, dateComptable: dateMiseEnService, version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      const ecriture = await ecrireAcquisition(tx, {
        etablissementId, exercice,
        immo: { id, code: immo.code, designation: immo.designation, compteImmo: immo.compteImmo, valeurBrute: immo.valeurBrute },
        issuStock: immo.origineArticleId !== null, utilisateurId: u.id,
      });
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: id, type: "mise_en_service", description: `Mise en service le ${dateMiseEnService.toISOString().slice(0, 10)}`, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.mise_en_service",
        entite: "Immobilisation", entiteId: id, nouvelleValeur: { dateMiseEnService, ecriture },
      });
      return { ecriture };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Actif mis en service — l'amortissement démarre${resultat.ecriture === "ok" ? " et l'écriture d'immobilisation est passée" : ""}.`,
    };
  } catch (e) {
    console.error("[immo] mise en service :", e);
    return { ok: false, message: "Mise en service impossible." };
  }
}

export async function creerImmobilisationDepuisStock(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const articleId = texteCourt(fd.get("articleId"), 50);
  const designation = texteCourt(fd.get("designation"), 160);
  const categorie = texteCourt(fd.get("categorie"), 30);
  const cat = CATEGORIES_IMMO.find((c) => c.code === categorie);
  if (!cat) return { ok: false, message: "Catégorie d'immobilisation invalide." };
  const numeroSerie = texteCourt(fd.get("numeroSerie"), 80) || null;
  const dateMiseEnService = dateValide(fd.get("dateMiseEnService"));
  await assurerComptesImmobilisations(etablissementId, u.id);
  try {
    const article = await prisma.articleEconomat.findFirst({
      where: { id: articleId, etablissementId, annuleLe: null },
      select: { id: true, nom: true, stock: true, typeArticle: true, cump: true, prixAchat: true },
    });
    if (!article) return { ok: false, message: "Article introuvable." };
    if (article.typeArticle !== "immobilisable") {
      return { ok: false, message: "Seul un article de type « immobilisable » (fiche 14) devient un actif (RM-1104)." };
    }
    const cout = montantObligatoire(fd.get("coutAcquisition")) ?? article.cump ?? article.prixAchat ?? 0;
    if (cout <= 0) return { ok: false, message: "Renseignez le coût d'acquisition (aucun CUMP/prix d'achat connu)." };
    const dureeBrute = Math.trunc(Number(fd.get("dureeMois")));
    const dureeMois = Number.isFinite(dureeBrute) && dureeBrute > 0 && dureeBrute <= 1200 ? dureeBrute : cat.dureeMoisDefaut;
    const exercice = await exerciceDe(etablissementId);

    const resultat = await prisma.$transaction(async (tx) => {
      // RM-1100 : le DISPONIBLE (stock − réservé) doit couvrir 1 unité sortie du stock.
      const reserve = await quantiteReservee(tx, articleId);
      const maj = await tx.articleEconomat.updateMany({
        where: { id: articleId, stock: { gte: 1 + reserve } },
        data: { stock: { decrement: 1 } },
      });
      if (maj.count === 0) return { erreur: "Stock disponible insuffisant pour mettre en service une unité." };
      await appliquerDeltaMagasinPrincipal(tx, etablissementId, articleId, -1);
      const mouvement = await tx.mouvementStock.create({
        data: {
          articleId, etablissementId, type: "mise_en_service", quantite: 1, montant: cout,
          motif: "Mise en service — création d'immobilisation (RM-1104)",
          date: dateMiseEnService, dateComptable: dateMiseEnService, saisiParId: u.id,
        },
      });
      const { reference } = await prochainNumero(tx, etablissementId, null, "immobilisation", "IMM");
      const creee = await tx.immobilisation.create({
        data: {
          etablissementId, code: reference,
          designation: designation || article.nom, categorie,
          numeroSerie,
          dateAcquisition: dateMiseEnService, dateMiseEnService,
          coutAcquisition: cout, valeurBrute: cout, valeurResiduelle: 0,
          dureeMois, amortissable: cat.amortissable, modeAcquisition: "transfert",
          compteImmo: cat.compteImmo, compteAmort: cat.compteAmort,
          statut: "service", creeParId: u.id,
          origineArticleId: articleId, origineMouvementId: mouvement.id, dateComptable: dateMiseEnService,
        },
      });
      // Reclassification (RM-1205 : issu du stock) — débit 2x / crédit 604.
      const ecriture = await ecrireAcquisition(tx, {
        etablissementId, exercice,
        immo: { id: creee.id, code: reference, designation: creee.designation, compteImmo: cat.compteImmo, valeurBrute: cout },
        issuStock: true, utilisateurId: u.id,
      });
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: creee.id, type: "mise_en_service", description: `Créée depuis le stock (article « ${article.nom} ») et mise en service`, montant: cout, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.creation_depuis_stock",
        entite: "Immobilisation", entiteId: creee.id, nouvelleValeur: { code: reference, article: article.nom, cout, ecriture },
      });
      return { code: reference };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Immobilisation ${resultat.code} créée depuis le stock et mise en service.` };
  } catch (e) {
    console.error("[immo] création depuis stock :", e);
    return { ok: false, message: "Création impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Cycle de vie, affectation, transfert
// ─────────────────────────────────────────────────────────────

export async function changerEtatImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const cible = texteCourt(fd.get("cible"), 15);
  const motif = texteCourt(fd.get("motif"), 200) || null;
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const immo = await prisma.immobilisation.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true, code: true } });
    if (!immo) return { ok: false, message: "Immobilisation introuvable." };
    const autorisees = TRANSITIONS_IMMO[immo.statut] ?? [];
    if (!autorisees.includes(cible)) return { ok: false, message: `Transition « ${immo.statut} → ${cible} » non autorisée.` };
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.immobilisation.updateMany({
        where: { id, etablissementId, version },
        data: { statut: cible, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: id, type: "etat", description: `État : ${immo.statut} → ${cible}${motif ? ` (${motif})` : ""}`, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.etat",
        entite: "Immobilisation", entiteId: id, ancienneValeur: { statut: immo.statut }, nouvelleValeur: { statut: cible, motif },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `État mis à jour (${cible}).` };
  } catch (e) {
    console.error("[immo] état :", e);
    return { ok: false, message: "Changement d'état impossible." };
  }
}

export async function affecterImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const nouvelleLocalisation = texteCourt(fd.get("localisation"), 200) || null;
  const responsableIdBrut = texteCourt(fd.get("responsableId"), 50);
  try {
    const responsable = responsableIdBrut
      ? await prisma.utilisateur.findFirst({ where: { id: responsableIdBrut, etablissementId, statutCompte: "actif" }, select: { id: true, nom: true, prenoms: true } })
      : null;
    const responsableNom = responsable ? [responsable.prenoms, responsable.nom].filter(Boolean).join(" ").trim() || null : null;
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.immobilisation.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { localisation: true, responsableNom: true } });
      if (!avant) return "introuvable" as const;
      const maj = await tx.immobilisation.updateMany({
        where: { id, etablissementId, version },
        data: {
          localisation: nouvelleLocalisation ?? avant.localisation,
          responsableId: responsable?.id ?? null, responsableNom,
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      const desc = [
        nouvelleLocalisation && nouvelleLocalisation !== avant.localisation ? `Localisation : ${nouvelleLocalisation}` : null,
        responsableNom ? `Responsable : ${responsableNom}` : "Responsable retiré",
      ].filter(Boolean).join(" · ");
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: id, type: "affectation", description: desc || "Affectation mise à jour", parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.affectation",
        entite: "Immobilisation", entiteId: id, ancienneValeur: avant, nouvelleValeur: { localisation: nouvelleLocalisation, responsableNom },
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Immobilisation introuvable." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Affectation / localisation mise à jour (historisée sur le passeport)." };
  } catch (e) {
    console.error("[immo] affectation :", e);
    return { ok: false, message: "Mise à jour impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Réévaluation
// ─────────────────────────────────────────────────────────────

export async function reevaluerImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.amortir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  const nouvelleValeur = montantObligatoire(fd.get("nouvelleValeur"));
  const justification = texteCourt(fd.get("justification"), 300);
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!nouvelleValeur) return { ok: false, message: "La nouvelle valeur brute est invalide." };
  if (!justification) return { ok: false, message: "La justification de la réévaluation est obligatoire." };
  await assurerComptesImmobilisations(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const immo = await tx.immobilisation.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { statut: true, code: true, designation: true, valeurBrute: true, compteImmo: true, dateSortie: true },
      });
      if (!immo) return { erreur: "Immobilisation introuvable." };
      if (immo.dateSortie) return { erreur: "Actif déjà sorti : réévaluation impossible." };
      const ecart = nouvelleValeur - immo.valeurBrute;
      if (ecart === 0) return { erreur: "La nouvelle valeur est identique à la valeur actuelle." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const exercice = await exerciceDe(etablissementId);
      const maj = await tx.immobilisation.updateMany({
        where: { id, etablissementId, version },
        data: { valeurBrute: nouvelleValeur, version: { increment: 1 } },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      // Augmentation : débit 2x / crédit 106 (écart de réévaluation). Diminution : l'inverse.
      const lignes = ecart > 0
        ? [{ compteNumero: immo.compteImmo, debit: ecart, credit: 0 }, { compteNumero: "106", debit: 0, credit: ecart }]
        : [{ compteNumero: "106", debit: -ecart, credit: 0 }, { compteNumero: immo.compteImmo, debit: 0, credit: -ecart }];
      const ecriture = await ecrireEcritureAutomatique(tx, {
        etablissementId, exercice, codeJournal: "IM", date: new Date(),
        libelle: `Réévaluation ${immo.code} — ${justification}`, pieceJustificative: immo.code,
        sourceType: "reevaluation_immobilisation", sourceId: `${id}:${Date.now()}`, utilisateurId: u.id, lignes,
      });
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: id, type: "reevaluation", description: `Réévaluation : ${immo.valeurBrute.toLocaleString("fr-FR")} → ${nouvelleValeur.toLocaleString("fr-FR")} F (${justification})`, montant: ecart, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.reevaluation",
        entite: "Immobilisation", entiteId: id, ancienneValeur: { valeurBrute: immo.valeurBrute }, nouvelleValeur: { valeurBrute: nouvelleValeur, ecart, ecriture },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Réévaluation enregistrée (écriture 2x/106 passée)." };
  } catch (e) {
    console.error("[immo] réévaluation :", e);
    return { ok: false, message: "Réévaluation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Amortissement (RM-1202)
// ─────────────────────────────────────────────────────────────

export async function comptabiliserDotations(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.amortir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  if (!id) return { ok: false, message: "Immobilisation introuvable." };
  const anneeBrute = Math.trunc(Number(fd.get("annee")));
  const anneeCible = Number.isFinite(anneeBrute) && anneeBrute >= 2000 && anneeBrute <= 2100 ? anneeBrute : new Date().getUTCFullYear();
  await assurerComptesImmobilisations(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const immo = await tx.immobilisation.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: { dotations: { where: { annuleLe: null }, select: { periode: true } } },
      });
      if (!immo) return { erreur: "Immobilisation introuvable." };
      if (!immo.amortissable) return { erreur: "Cet actif n'est pas amortissable (ex. terrain)." };
      if (!immo.dateMiseEnService) return { erreur: "Amortissement impossible : l'actif n'est pas en service (RM-1201)." };
      if (immo.dateSortie) return { erreur: "Actif déjà sorti : plus de dotation." };
      if (!immo.compteAmort) return { erreur: "Compte d'amortissement absent pour cette catégorie." };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const params: ParamsAmortissement = {
        valeurBrute: immo.valeurBrute, valeurResiduelle: immo.valeurResiduelle, dureeMois: immo.dureeMois,
        dateMiseEnService: immo.dateMiseEnService.toISOString(), amortissable: immo.amortissable,
      };
      const dejaFaites = new Set(immo.dotations.map((d) => d.periode));
      const dues = dotationsDues(params, dejaFaites, anneeCible);
      if (dues.length === 0) return { erreur: `Aucune dotation due jusqu'en ${anneeCible} (déjà à jour ou actif non encore amortissable).` };
      const exercice = await exerciceDe(etablissementId);
      let comptabilisees = 0;
      for (const d of dues) {
        const dotation = await tx.dotationAmortissement.create({
          data: {
            immobilisationId: id, etablissementId, periode: String(d.annee), montant: d.dotation,
            cumulApres: d.cumul, vncApres: d.vnc, comptabiliseParId: u.id,
          },
        });
        await ecrireEcritureAutomatique(tx, {
          etablissementId, exercice, codeJournal: "IM", date: new Date(),
          libelle: `Dotation amortissement ${immo.code} — exercice ${d.annee}`, pieceJustificative: immo.code,
          sourceType: "dotation_amortissement", sourceId: dotation.id, utilisateurId: u.id,
          lignes: [
            { compteNumero: "681", debit: d.dotation, credit: 0 },
            { compteNumero: immo.compteAmort!, debit: 0, credit: d.dotation },
          ],
        });
        comptabilisees += 1;
      }
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: id, type: "maintenance", description: `${comptabilisees} dotation(s) d'amortissement comptabilisée(s) jusqu'en ${anneeCible}`, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.dotations",
        entite: "Immobilisation", entiteId: id, nouvelleValeur: { anneeCible, comptabilisees },
      });
      return { comptabilisees };
    }, { timeout: 60_000 });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${resultat.comptabilisees} dotation(s) comptabilisée(s) (écritures 681/28x — RM-1202).` };
  } catch (e) {
    console.error("[immo] dotations :", e);
    return { ok: false, message: "Comptabilisation impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Maintenance
// ─────────────────────────────────────────────────────────────

export async function enregistrerMaintenance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const immobilisationId = texteCourt(fd.get("immobilisationId"), 50);
  const type = texteCourt(fd.get("type"), 15);
  const description = texteCourt(fd.get("description"), 300);
  if (!TYPES_MAINTENANCE.some((t) => t.code === type)) return { ok: false, message: "Type de maintenance invalide." };
  if (!description) return { ok: false, message: "La description est obligatoire." };
  const immo = await prisma.immobilisation.findFirst({ where: { id: immobilisationId, etablissementId, annuleLe: null }, select: { id: true } });
  if (!immo) return { ok: false, message: "Immobilisation introuvable." };
  const donnees = {
    type, description,
    prestataire: texteCourt(fd.get("prestataire"), 120) || null,
    datePrevue: dateFacultative(fd.get("datePrevue")),
    dateRealisee: dateFacultative(fd.get("dateRealisee")),
    coutPrevu: montantFacultatif(fd.get("coutPrevu")),
    coutReel: montantFacultatif(fd.get("coutReel")),
  };
  const statut = donnees.dateRealisee ? "realisee" : "planifiee";
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const maj = await tx.maintenanceImmobilisation.updateMany({
          where: { id, etablissementId, version, annuleLe: null },
          data: { ...donnees, statut, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.maintenanceImmobilisation.create({ data: { immobilisationId, etablissementId, ...donnees, statut } });
      }
      await tx.evenementImmobilisation.create({
        data: { immobilisationId, type: "maintenance", description: `Maintenance ${type} : ${description}`.slice(0, 300), montant: donnees.coutReel ?? donnees.coutPrevu ?? null, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: id ? "immobilisation.maintenance_modification" : "immobilisation.maintenance_creation",
        entite: "MaintenanceImmobilisation", entiteId: id || immobilisationId, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Maintenance mise à jour." : "Maintenance enregistrée." };
  } catch (e) {
    console.error("[immo] maintenance :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerMaintenance(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const maj = await prisma.$transaction(async (tx) => {
      const r = await tx.maintenanceImmobilisation.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (r.count > 0) {
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "immobilisation.maintenance_retrait",
          entite: "MaintenanceImmobilisation", entiteId: id,
        });
      }
      return r.count;
    });
    if (maj === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Maintenance retirée." };
  } catch (e) {
    console.error("[immo] retrait maintenance :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Sortie d'actif (RM-1203) — décision par un SECOND acteur
// ─────────────────────────────────────────────────────────────

export async function sortirImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.sortir");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  const typeSortie = texteCourt(fd.get("typeSortie"), 15);
  const motif = texteCourt(fd.get("motif"), 300);
  const pieceJustificative = texteCourt(fd.get("pieceJustificative"), 120);
  const typeInfo = TYPES_SORTIE_IMMO.find((t) => t.code === typeSortie);
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!typeInfo) return { ok: false, message: "Type de sortie invalide." };
  if (!motif) return { ok: false, message: "Le motif de la sortie est obligatoire." };
  if (!pieceJustificative) return { ok: false, message: "La pièce justificative est obligatoire (RM-1203)." };
  const valeurCession = typeSortie === "vente" ? montantFacultatif(fd.get("valeurCession")) : null;
  await assurerComptesImmobilisations(etablissementId, u.id);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const immo = await tx.immobilisation.findFirst({
        where: { id, etablissementId, annuleLe: null },
        include: { dotations: { where: { annuleLe: null }, select: { montant: true } } },
      });
      if (!immo) return { erreur: "Immobilisation introuvable." };
      if (immo.dateSortie || !ETATS_ACTIFS_IMMO.includes(immo.statut)) {
        return { erreur: "Actif déjà sorti ou pas encore en service (409)." };
      }
      // SÉPARATION DES RESPONSABILITÉS : le décideur de la sortie ≠ créateur de la fiche.
      if (immo.creeParId && immo.creeParId === u.id) return { erreur: MESSAGE_SEPARATION_RESPONSABILITES };
      if (await periodeCloturee(tx, etablissementId, periodeDe(new Date()))) return { erreur: MESSAGE_PERIODE_CLOTUREE };
      const amorti = immo.dotations.reduce((s, d) => s + d.montant, 0);
      const vnc = immo.valeurBrute - amorti;
      const exercice = await exerciceDe(etablissementId);
      const maj = await tx.immobilisation.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: {
          statut: typeInfo.etat, typeSortie, motifSortie: motif, dateSortie: new Date(),
          valeurCession, sortieParId: u.id, sortieParNom: u.nomComplet, dateComptable: new Date(),
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      // RM-1203 : écriture de sortie — débit 28x (amorti) + débit 81 (VNC) / crédit 2x (brut).
      const lignes: { compteNumero: string; debit: number; credit: number }[] = [];
      if (immo.compteAmort && amorti > 0) lignes.push({ compteNumero: immo.compteAmort, debit: amorti, credit: 0 });
      if (vnc > 0) lignes.push({ compteNumero: "81", debit: vnc, credit: 0 });
      lignes.push({ compteNumero: immo.compteImmo, debit: 0, credit: immo.valeurBrute });
      const ecriture = await ecrireEcritureAutomatique(tx, {
        etablissementId, exercice, codeJournal: "IM", date: new Date(),
        libelle: `Sortie (${typeInfo.libelle}) ${immo.code} — ${motif}`, pieceJustificative,
        sourceType: "sortie_immobilisation", sourceId: id, utilisateurId: u.id, lignes,
      });
      await tx.evenementImmobilisation.create({
        data: { immobilisationId: id, type: "sortie", description: `${typeInfo.libelle} — VNC ${vnc.toLocaleString("fr-FR")} F (${motif})`, montant: vnc, parId: u.id, parNom: u.nomComplet },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.sortie",
        entite: "Immobilisation", entiteId: id, nouvelleValeur: { typeSortie, vnc, valeurCession, ecriture },
      });
      return { vnc, valeurCession };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Actif sorti du patrimoine (VNC ${resultat.vnc.toLocaleString("fr-FR")} F, écriture RM-1203 passée)${resultat.valeurCession ? ` — encaissez le produit de cession (${resultat.valeurCession.toLocaleString("fr-FR")} F) au journal recettes-dépenses` : ""}.`,
    };
  } catch (e) {
    console.error("[immo] sortie :", e);
    return { ok: false, message: "Sortie impossible." };
  }
}

export async function retirerImmobilisation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.immobilisations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const immo = await tx.immobilisation.findFirst({ where: { id, etablissementId, annuleLe: null }, select: { statut: true } });
      if (!immo) return "introuvable" as const;
      // On ne retire que les fiches encore « en acquisition/installation » (jamais amorties ni sorties).
      if (immo.statut !== "acquisition" && immo.statut !== "installation") return "engage" as const;
      const dotations = await tx.dotationAmortissement.count({ where: { immobilisationId: id, annuleLe: null } });
      if (dotations > 0) return "engage" as const;
      const maj = await tx.immobilisation.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "immobilisation.retrait",
        entite: "Immobilisation", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Immobilisation introuvable." };
    if (resultat === "engage") return { ok: false, message: "Actif déjà en service ou amorti : utilisez une SORTIE (cession/réforme) plutôt qu'un retrait." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Fiche d'actif retirée." };
  } catch (e) {
    console.error("[immo] retrait :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}
