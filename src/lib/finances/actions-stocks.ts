"use server";

/**
 * Actions serveur du sous-module STOCKS (14 + 05B/02B) : magasins hiérarchisés (un PRINCIPAL
 * porte le stock historique), transferts entre magasins (paire liée, stock total inchangé),
 * sorties motivées (consommation/distribution/rebut — RM-1100 : jamais de disponible
 * négatif ; RM-1103 : au-delà du seuil de valeur, la sortie exige finance.stocks.valider),
 * lots/péremption, numéros de série uniques, réservations (réduisent le DISPONIBLE),
 * inventaires (théorique FIGÉ → comptage → VALIDATION par un SECOND acteur → ajustements
 * automatiques RM-1105 — les écritures de régularisation comptable suivront l'arrivée des
 * comptes de classe 3 avec le 11A, décision documentée).
 *
 * TOUTES les écritures : garde granulaire, transaction + journaliserFinance, verrouillage
 * optimiste, annulations logiques, contrôles de quantités DANS la transaction.
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
import { prochainNumero } from "./commun/numerotation";
import { appliquerDeltaMagasin, magasinPrincipal, quantiteReservee } from "./stocks/serveur";
import {
  MOTIFS_RESERVATION, SEUIL_VALIDATION_SORTIE_STOCK, STATUTS_SERIE, TYPES_INVENTAIRE,
  TYPES_MAGASIN, TYPES_SORTIE_STOCK,
} from "./stocks/types";

const CHEMIN = "/app/vie-scolaire/finances";

function quantitePositive(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : null;
}

/** Article ACTIF de l'établissement (cloisonnement). */
async function articleDe(articleId: string, etablissementId: string) {
  if (!articleId) return null;
  return prisma.articleEconomat.findFirst({
    where: { id: articleId, etablissementId, annuleLe: null },
    select: { id: true, nom: true, stock: true, cump: true, prixAchat: true },
  });
}

// ─────────────────────────────────────────────────────────────
//  Magasins
// ─────────────────────────────────────────────────────────────

export async function enregistrerMagasin(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const nom = texteCourt(fd.get("nom"), 80);
  if (!nom) return { ok: false, message: "Le nom du magasin (ou de l'emplacement) est obligatoire." };
  const type = texteCourt(fd.get("type"), 20) || "central";
  if (!TYPES_MAGASIN.some((t) => t.code === type)) return { ok: false, message: "Type de magasin invalide." };
  const statut = texteCourt(fd.get("statut"), 10) === "ferme" ? "ferme" : "ouvert";
  const parentIdBrut = texteCourt(fd.get("parentId"), 50);
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const parentId = parentIdBrut
        ? (
            await tx.magasinStock.findFirst({
              where: { id: parentIdBrut, etablissementId, annuleLe: null, ...(id ? { id: { not: id } } : {}) },
              select: { id: true },
            })
          )?.id ?? null
        : null;
      const donnees = { nom, type, statut, parentId };
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const maj = await tx.magasinStock.updateMany({
          where: { id, etablissementId, version, annuleLe: null },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.magasinStock.create({ data: { etablissementId, ...donnees } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: id ? "magasin.modification" : "magasin.creation",
        entite: "MagasinStock", entiteId: id || nom, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Magasin mis à jour." : "Magasin créé." };
  } catch (e) {
    console.error("[stocks] magasin :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerMagasin(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const magasin = await tx.magasinStock.findFirst({
        where: { id, etablissementId, annuleLe: null },
        select: { principal: true },
      });
      if (!magasin) return "introuvable" as const;
      if (magasin.principal) return "principal" as const;
      const stock = await tx.stockMagasin.aggregate({ where: { magasinId: id }, _sum: { quantite: true } });
      if ((stock._sum.quantite ?? 0) !== 0) return "plein" as const;
      const maj = await tx.magasinStock.updateMany({
        where: { id, etablissementId, version },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "magasin.retrait",
        entite: "MagasinStock", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Magasin introuvable." };
    if (resultat === "principal") return { ok: false, message: "Le magasin PRINCIPAL ne se retire pas (il porte le stock historique)." };
    if (resultat === "plein") return { ok: false, message: "Ce magasin contient encore du stock : transférez-le d'abord." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Magasin retiré." };
  } catch (e) {
    console.error("[stocks] retrait magasin :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Transferts entre magasins (paire liée — stock total inchangé)
// ─────────────────────────────────────────────────────────────

export async function transfererStock(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const articleId = texteCourt(fd.get("articleId"), 50);
  const sourceId = texteCourt(fd.get("sourceId"), 50);
  const cibleId = texteCourt(fd.get("cibleId"), 50);
  const quantite = quantitePositive(fd.get("quantite"));
  const motif = texteCourt(fd.get("motif"), 200) || null;
  if (!quantite) return { ok: false, message: "Quantité invalide." };
  if (sourceId === cibleId) return { ok: false, message: "Choisissez deux magasins différents." };
  const article = await articleDe(articleId, etablissementId);
  if (!article) return { ok: false, message: "Article introuvable." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const [source, cible] = await Promise.all([
        tx.magasinStock.findFirst({ where: { id: sourceId, etablissementId, annuleLe: null }, select: { nom: true, statut: true } }),
        tx.magasinStock.findFirst({ where: { id: cibleId, etablissementId, annuleLe: null }, select: { nom: true, statut: true } }),
      ]);
      if (!source || !cible) return { erreur: "Magasin introuvable." };
      if (source.statut !== "ouvert" || cible.statut !== "ouvert") {
        return { erreur: "Un magasin FERMÉ ne reçoit ni n'émet de mouvements." };
      }
      // Quantité disponible dans le magasin SOURCE, contrôlée DANS la transaction (RM-1100).
      const enSource = await tx.stockMagasin.findUnique({
        where: { articleId_magasinId: { articleId, magasinId: sourceId } },
        select: { quantite: true },
      });
      if ((enSource?.quantite ?? 0) < quantite) {
        return { erreur: `Stock insuffisant dans « ${source.nom} » : ${enSource?.quantite ?? 0} ${article.nom}.` };
      }
      await appliquerDeltaMagasin(tx, articleId, sourceId, -quantite);
      await appliquerDeltaMagasin(tx, articleId, cibleId, quantite);
      const maintenant = new Date();
      const sortie = await tx.mouvementStock.create({
        data: {
          articleId, etablissementId, type: "transfert_sortie", quantite,
          magasinId: sourceId, motif, date: maintenant, dateComptable: maintenant, saisiParId: u.id,
        },
      });
      const entree = await tx.mouvementStock.create({
        data: {
          articleId, etablissementId, type: "transfert_entree", quantite,
          magasinId: cibleId, motif, lieMouvementId: sortie.id,
          date: maintenant, dateComptable: maintenant, saisiParId: u.id,
        },
      });
      await tx.mouvementStock.update({ where: { id: sortie.id }, data: { lieMouvementId: entree.id } });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "stock.transfert",
        entite: "MouvementStock", entiteId: sortie.id,
        nouvelleValeur: { article: article.nom, quantite, source: source.nom, cible: cible.nom },
      });
      return { source: source.nom, cible: cible.nom };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${quantite} « ${article.nom} » transféré(s) de ${resultat.source} vers ${resultat.cible}.` };
  } catch (e) {
    console.error("[stocks] transfert :", e);
    return { ok: false, message: "Transfert impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Sorties motivées (RM-1100 / RM-1103)
// ─────────────────────────────────────────────────────────────

export async function sortirStock(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const articleId = texteCourt(fd.get("articleId"), 50);
  const type = texteCourt(fd.get("type"), 20);
  const motif = texteCourt(fd.get("motif"), 200);
  const beneficiaire = texteCourt(fd.get("beneficiaire"), 120) || null;
  const magasinId = texteCourt(fd.get("magasinId"), 50);
  const quantite = quantitePositive(fd.get("quantite"));
  if (!TYPES_SORTIE_STOCK.some((t) => t.code === type)) return { ok: false, message: "Type de sortie invalide." };
  if (!motif) return { ok: false, message: "Le motif de la sortie est obligatoire." };
  if (!quantite) return { ok: false, message: "Quantité invalide." };
  const article = await articleDe(articleId, etablissementId);
  if (!article) return { ok: false, message: "Article introuvable." };
  // RM-1103 : les sorties IMPORTANTES (valeur au CUMP) exigent la validation hiérarchique.
  const valeur = quantite * (article.cump ?? article.prixAchat ?? 0);
  let valideParId: string | null = null;
  if (valeur > SEUIL_VALIDATION_SORTIE_STOCK) {
    const valideur = await exigerPermissionFinance(etablissementId, "finance.stocks.valider");
    if (!valideur) {
      return {
        ok: false,
        message: `Sortie de ${valeur.toLocaleString("fr-FR")} F (> ${SEUIL_VALIDATION_SORTIE_STOCK.toLocaleString("fr-FR")} F) : la validation hiérarchique est requise (RM-1103).`,
      };
    }
    valideParId = valideur.id;
  }
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const magasin = magasinId
        ? await tx.magasinStock.findFirst({
            where: { id: magasinId, etablissementId, annuleLe: null },
            select: { id: true, nom: true, statut: true },
          })
        : { ...(await magasinPrincipal(tx, etablissementId)), nom: "Magasin central", statut: "ouvert" };
      if (!magasin) return { erreur: "Magasin introuvable." };
      if (magasin.statut !== "ouvert") return { erreur: "Un magasin FERMÉ n'émet pas de mouvements." };
      // RM-1100 : jamais de DISPONIBLE négatif — contrôles DANS la transaction.
      const [reserve, enMagasin] = await Promise.all([
        quantiteReservee(tx, articleId),
        tx.stockMagasin.findUnique({
          where: { articleId_magasinId: { articleId, magasinId: magasin.id } },
          select: { quantite: true },
        }),
      ]);
      if ((enMagasin?.quantite ?? 0) < quantite) {
        return { erreur: `Stock insuffisant dans « ${magasin.nom} » : ${enMagasin?.quantite ?? 0} ${article.nom}.` };
      }
      const maj = await tx.articleEconomat.updateMany({
        where: { id: articleId, stock: { gte: quantite + reserve } },
        data: { stock: { decrement: quantite } },
      });
      if (maj.count === 0) {
        return { erreur: "Stock DISPONIBLE insuffisant (une partie est réservée — RM-1100)." };
      }
      await appliquerDeltaMagasin(tx, articleId, magasin.id, -quantite);
      const maintenant = new Date();
      const mouvement = await tx.mouvementStock.create({
        data: {
          articleId, etablissementId, type, quantite, montant: valeur > 0 ? valeur : null,
          magasinId: magasin.id, motif, beneficiaire, valideParId,
          date: maintenant, dateComptable: maintenant, saisiParId: u.id,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: `stock.${type}`,
        entite: "MouvementStock", entiteId: mouvement.id,
        nouvelleValeur: { article: article.nom, quantite, valeur, magasin: magasin.nom, motif, beneficiaire },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    const libelle = TYPES_SORTIE_STOCK.find((t) => t.code === type)?.libelle ?? type;
    return { ok: true, message: `${libelle} : ${quantite} « ${article.nom} » sorti(s) du stock.` };
  } catch (e) {
    console.error("[stocks] sortie :", e);
    return { ok: false, message: "Sortie impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Lots (péremption) & numéros de série
// ─────────────────────────────────────────────────────────────

export async function enregistrerLot(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const articleId = texteCourt(fd.get("articleId"), 50);
  const numeroLot = texteCourt(fd.get("numeroLot"), 60);
  if (!numeroLot) return { ok: false, message: "Le numéro de lot est obligatoire." };
  const quantiteBrute = Math.trunc(Number(fd.get("quantite") ?? 0));
  const quantite = Number.isFinite(quantiteBrute) && quantiteBrute >= 0 && quantiteBrute <= 1_000_000 ? quantiteBrute : null;
  if (quantite === null) return { ok: false, message: "Quantité invalide." };
  const article = await articleDe(articleId, etablissementId);
  if (!article) return { ok: false, message: "Article introuvable." };
  const coutBrut = Math.trunc(Number(fd.get("coutAcquisition") ?? 0));
  const donnees = {
    numeroLot, quantite,
    dateFabrication: dateFacultative(fd.get("dateFabrication")),
    datePeremption: dateFacultative(fd.get("datePeremption")),
    fournisseurRef: texteCourt(fd.get("fournisseurRef"), 120) || null,
    coutAcquisition: Number.isFinite(coutBrut) && coutBrut > 0 ? coutBrut : null,
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (id) {
        const version = versionDepuisFormulaire(fd.get("version"));
        if (version === null) return "conflit" as const;
        const maj = await tx.lotStock.updateMany({
          where: { id, articleId, version, annuleLe: null },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
      } else {
        await tx.lotStock.create({ data: { articleId, ...donnees } });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id,
        action: id ? "stock.lot_modification" : "stock.lot_creation",
        entite: "LotStock", entiteId: id || `${articleId}:${numeroLot}`, nouvelleValeur: donnees,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Lot mis à jour." : `Lot ${numeroLot} enregistré.` };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: `Le lot ${numeroLot} existe déjà pour cet article.` };
    }
    console.error("[stocks] lot :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function retirerLot(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.lotStock.updateMany({
        where: { id, version, annuleLe: null, article: { etablissementId } },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "stock.lot_retrait",
        entite: "LotStock", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Lot retiré." };
  } catch (e) {
    console.error("[stocks] retrait lot :", e);
    return { ok: false, message: "Retrait impossible." };
  }
}

export async function enregistrerSerie(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const articleId = texteCourt(fd.get("articleId"), 50);
  const numeroSerie = texteCourt(fd.get("numeroSerie"), 80);
  if (!numeroSerie) return { ok: false, message: "Le numéro de série est obligatoire." };
  const article = await articleDe(articleId, etablissementId);
  if (!article) return { ok: false, message: "Article introuvable." };
  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.serieStock.create({
        data: {
          etablissementId, articleId, numeroSerie,
          observation: texteCourt(fd.get("observation"), 160) || null,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "stock.serie_creation",
        entite: "SerieStock", entiteId: creee.id, nouvelleValeur: { article: article.nom, numeroSerie },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Numéro de série ${numeroSerie} enregistré.` };
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, message: `Le numéro de série ${numeroSerie} est DÉJÀ utilisé dans l'établissement.` };
    }
    console.error("[stocks] série :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
}

export async function changerStatutSerie(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const statut = texteCourt(fd.get("statut"), 15);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  if (!STATUTS_SERIE.some((s) => s.code === statut)) return { ok: false, message: "Statut de série invalide." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.serieStock.updateMany({
        where: { id, etablissementId, version, annuleLe: null },
        data: { statut, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "stock.serie_statut",
        entite: "SerieStock", entiteId: id, nouvelleValeur: { statut },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Statut de la série mis à jour." };
  } catch (e) {
    console.error("[stocks] statut série :", e);
    return { ok: false, message: "Mise à jour impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Réservations (réduisent le DISPONIBLE — RM-1100)
// ─────────────────────────────────────────────────────────────

export async function reserverStock(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const articleId = texteCourt(fd.get("articleId"), 50);
  const motif = texteCourt(fd.get("motif"), 25);
  const quantite = quantitePositive(fd.get("quantite"));
  if (!MOTIFS_RESERVATION.some((m) => m.code === motif)) return { ok: false, message: "Motif de réservation invalide." };
  if (!quantite) return { ok: false, message: "Quantité invalide." };
  const article = await articleDe(articleId, etablissementId);
  if (!article) return { ok: false, message: "Article introuvable." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const reserve = await quantiteReservee(tx, articleId);
      const disponible = article.stock - reserve;
      if (quantite > disponible) {
        return { erreur: `Disponible insuffisant : ${disponible} « ${article.nom} » (stock ${article.stock}, déjà réservé ${reserve}).` };
      }
      const creee = await tx.reservationStock.create({
        data: {
          etablissementId, articleId, quantite, motif,
          beneficiaire: texteCourt(fd.get("beneficiaire"), 120) || null,
          dateFin: dateFacultative(fd.get("dateFin")),
          demandeParId: u.id, demandeParNom: u.nomComplet,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "stock.reservation",
        entite: "ReservationStock", entiteId: creee.id,
        nouvelleValeur: { article: article.nom, quantite, motif },
      });
      return { ok: true as const };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${quantite} « ${article.nom} » réservé(s) — le disponible est réduit d'autant.` };
  } catch (e) {
    console.error("[stocks] réservation :", e);
    return { ok: false, message: "Réservation impossible." };
  }
}

export async function libererReservation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.reservationStock.updateMany({
        where: { id, etablissementId, version, statut: "active", annuleLe: null },
        data: { statut: "liberee", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "stock.reservation_liberation",
        entite: "ReservationStock", entiteId: id,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: "Réservation déjà libérée ou version dépassée." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Réservation libérée — le disponible remonte d'autant." };
  } catch (e) {
    console.error("[stocks] libération :", e);
    return { ok: false, message: "Libération impossible." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Inventaires (théorique figé → comptage → validation 2ᵉ acteur)
// ─────────────────────────────────────────────────────────────

export async function ouvrirInventaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.inventorier");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const type = texteCourt(fd.get("type"), 15) || "general";
  if (!TYPES_INVENTAIRE.some((t) => t.code === type)) return { ok: false, message: "Type d'inventaire invalide." };
  const magasinIdBrut = texteCourt(fd.get("magasinId"), 50);
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const dejaOuvert = await tx.inventaireStock.findFirst({
        where: { etablissementId, statut: "en_cours", annuleLe: null },
        select: { reference: true },
      });
      if (dejaOuvert) return { erreur: `L'inventaire ${dejaOuvert.reference} est déjà EN COURS : validez-le ou annulez-le d'abord.` };
      const magasin = magasinIdBrut
        ? await tx.magasinStock.findFirst({
            where: { id: magasinIdBrut, etablissementId, annuleLe: null },
            select: { id: true, nom: true },
          })
        : null;
      // THÉORIQUE FIGÉ à l'ouverture : stock du magasin visé, ou stock TOTAL de l'article.
      const articles = await tx.articleEconomat.findMany({
        where: { etablissementId, annuleLe: null, actif: true },
        select: { id: true, nom: true, stock: true },
        orderBy: { nom: "asc" },
      });
      if (articles.length === 0) return { erreur: "Aucun article actif à inventorier." };
      let theoriqueParArticle = new Map(articles.map((a) => [a.id, a.stock]));
      if (magasin) {
        const stocks = await tx.stockMagasin.findMany({
          where: { magasinId: magasin.id },
          select: { articleId: true, quantite: true },
        });
        theoriqueParArticle = new Map(stocks.map((s) => [s.articleId, s.quantite]));
      }
      const { reference } = await prochainNumero(tx, etablissementId, null, "inventaire_stock", "INV");
      const inventaire = await tx.inventaireStock.create({
        data: {
          etablissementId, reference, type, magasinId: magasin?.id ?? null,
          notes: texteCourt(fd.get("notes"), 300) || null,
          compteParId: u.id, compteParNom: u.nomComplet,
        },
      });
      await tx.ligneInventaire.createMany({
        data: articles
          .filter((a) => !magasin || theoriqueParArticle.has(a.id))
          .map((a) => ({
            inventaireId: inventaire.id, articleId: a.id, articleNom: a.nom,
            stockTheorique: theoriqueParArticle.get(a.id) ?? 0,
          })),
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "inventaire.ouverture",
        entite: "InventaireStock", entiteId: inventaire.id,
        nouvelleValeur: { reference, type, magasin: magasin?.nom ?? "tout l'établissement" },
      });
      return { reference };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Inventaire ${resultat.reference} ouvert — le théorique est FIGÉ, saisissez le comptage physique.` };
  } catch (e) {
    console.error("[stocks] ouverture inventaire :", e);
    return { ok: false, message: "Ouverture impossible." };
  }
}

export async function saisirComptage(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.inventorier");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const inventaireId = texteCourt(fd.get("inventaireId"), 50);
  let brut: unknown;
  try {
    brut = JSON.parse(String(fd.get("lignes") ?? "[]"));
  } catch {
    return { ok: false, message: "Comptage illisible." };
  }
  if (!Array.isArray(brut) || brut.length === 0) return { ok: false, message: "Aucun comptage saisi." };
  const saisies: { ligneId: string; stockPhysique: number; observation: string | null }[] = [];
  for (const l of brut) {
    const o = l as Record<string, unknown>;
    const ligneId = String(o.ligneId ?? "").slice(0, 50);
    const stockPhysique = Math.trunc(Number(o.stockPhysique));
    if (!ligneId || !Number.isFinite(stockPhysique) || stockPhysique < 0 || stockPhysique > 10_000_000) continue;
    saisies.push({ ligneId, stockPhysique, observation: String(o.observation ?? "").slice(0, 160) || null });
  }
  if (saisies.length === 0) return { ok: false, message: "Aucun comptage valide." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const inventaire = await tx.inventaireStock.findFirst({
        where: { id: inventaireId, etablissementId, statut: "en_cours", annuleLe: null },
        select: { id: true, reference: true },
      });
      if (!inventaire) return "introuvable" as const;
      for (const s of saisies) {
        await tx.ligneInventaire.updateMany({
          where: { id: s.ligneId, inventaireId },
          data: { stockPhysique: s.stockPhysique, observation: s.observation },
        });
      }
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "inventaire.comptage",
        entite: "InventaireStock", entiteId: inventaireId,
        nouvelleValeur: { lignes: saisies.length },
      });
      return "ok" as const;
    });
    if (resultat === "introuvable") return { ok: false, message: "Inventaire EN COURS introuvable." };
    revalidatePath(CHEMIN);
    return { ok: true, message: `${saisies.length} comptage(s) enregistré(s).` };
  } catch (e) {
    console.error("[stocks] comptage :", e);
    return { ok: false, message: "Saisie impossible." };
  }
}

export async function validerInventaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (!id || version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const inventaire = await tx.inventaireStock.findFirst({
        where: { id, etablissementId, statut: "en_cours", annuleLe: null },
        include: { lignes: true },
      });
      if (!inventaire) return { erreur: "Inventaire EN COURS introuvable." };
      // SÉPARATION DES RESPONSABILITÉS : le valideur n'est pas celui qui a compté.
      if (inventaire.compteParId && inventaire.compteParId === u.id) {
        return { erreur: MESSAGE_SEPARATION_RESPONSABILITES };
      }
      const comptees = inventaire.lignes.filter((l) => l.stockPhysique !== null);
      if (comptees.length === 0) return { erreur: "Aucune ligne comptée : rien à valider." };
      const magasinCible = inventaire.magasinId
        ? { id: inventaire.magasinId }
        : await magasinPrincipal(tx, etablissementId);
      let ajustements = 0;
      const maintenant = new Date();
      for (const l of comptees) {
        const ecart = (l.stockPhysique ?? 0) - l.stockTheorique;
        if (ecart === 0) continue;
        // RM-1105 : la validation génère les régularisations — mouvement d'ajustement tracé,
        // stock total ET répartition du magasin visé corrigés du même écart.
        await tx.mouvementStock.create({
          data: {
            articleId: l.articleId, etablissementId, type: "ajustement",
            quantite: Math.abs(ecart), magasinId: magasinCible.id,
            motif: `Inventaire ${inventaire.reference} — écart ${ecart > 0 ? "+" : ""}${ecart}`,
            valideParId: u.id, date: maintenant, dateComptable: maintenant, saisiParId: u.id,
          },
        });
        await tx.articleEconomat.update({
          where: { id: l.articleId },
          data: { stock: { increment: ecart } },
        });
        await tx.stockMagasin.upsert({
          where: { articleId_magasinId: { articleId: l.articleId, magasinId: magasinCible.id } },
          create: { articleId: l.articleId, magasinId: magasinCible.id, quantite: ecart },
          update: { quantite: { increment: ecart } },
        });
        ajustements += 1;
      }
      const maj = await tx.inventaireStock.updateMany({
        where: { id, etablissementId, version, statut: "en_cours" },
        data: {
          statut: "valide", valideParId: u.id, valideParNom: u.nomComplet,
          dateValidation: maintenant, version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { erreur: MESSAGE_CONFLIT_VERSION };
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "inventaire.validation",
        entite: "InventaireStock", entiteId: id,
        nouvelleValeur: { reference: inventaire.reference, comptees: comptees.length, ajustements },
      });
      return { ajustements };
    });
    if ("erreur" in resultat) return { ok: false, message: resultat.erreur };
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message: `Inventaire validé — ${resultat.ajustements} régularisation(s) de stock passée(s) (RM-1105).`,
    };
  } catch (e) {
    console.error("[stocks] validation inventaire :", e);
    return { ok: false, message: "Validation impossible." };
  }
}

export async function annulerInventaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.stocks.inventorier");
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
      const maj = await tx.inventaireStock.updateMany({
        where: { id, etablissementId, version, statut: "en_cours", annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "inventaire.annulation",
        entite: "InventaireStock", entiteId: id, nouvelleValeur: { motif },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: "Seul un inventaire EN COURS s'annule (ou version dépassée)." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Inventaire annulé (aucun stock modifié)." };
  } catch (e) {
    console.error("[stocks] annulation inventaire :", e);
    return { ok: false, message: "Annulation impossible." };
  }
}
