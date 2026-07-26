import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  DonneesStocksVue, InventaireVue, LotVue, MagasinVue, SituationArticleVue,
  TableauBordStocksVue,
} from "./types";
import { PALIERS_PEREMPTION_JOURS } from "./types";

/**
 * Domaine STOCKS (14) — helpers TRANSACTIONNELS partagés (magasin principal, répartition
 * par magasin, CUMP, disponible RM-1100) réutilisés par les flux HISTORIQUES (économat,
 * réceptions/retours du 12 — zéro régression : ils continuent de tenir article.stock, et
 * tiennent désormais AUSSI la répartition par magasin), et chargeur de l'onglet.
 */

const JOUR_MS = 86_400_000;

/** Magasin PRINCIPAL de l'établissement — créé au vol si absent (établissements nés après
 *  la migration de reprise). À appeler DANS la transaction du mouvement. */
export async function magasinPrincipal(
  tx: Prisma.TransactionClient,
  etablissementId: string,
): Promise<{ id: string }> {
  const existant = await tx.magasinStock.findFirst({
    where: { etablissementId, principal: true, annuleLe: null },
    select: { id: true },
  });
  if (existant) return existant;
  return tx.magasinStock.create({
    data: { etablissementId, nom: "Magasin central", type: "central", principal: true },
    select: { id: true },
  });
}

/** Applique un DELTA à la répartition (articleId, magasinId) — ligne créée au besoin.
 *  L'INVARIANT Σ StockMagasin = article.stock est maintenu par les appelants (qui font
 *  évoluer article.stock du même delta dans la même transaction). */
export async function appliquerDeltaMagasin(
  tx: Prisma.TransactionClient,
  articleId: string,
  magasinId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  await tx.stockMagasin.upsert({
    where: { articleId_magasinId: { articleId, magasinId } },
    create: { articleId, magasinId, quantite: delta },
    update: { quantite: { increment: delta } },
  });
}

/** Variante « magasin principal » pour les flux historiques (économat, 12). */
export async function appliquerDeltaMagasinPrincipal(
  tx: Prisma.TransactionClient,
  etablissementId: string,
  articleId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return;
  const principal = await magasinPrincipal(tx, etablissementId);
  await appliquerDeltaMagasin(tx, articleId, principal.id, delta);
}

/** Met à jour le CUMP de l'article après une ENTRÉE valorisée :
 *  CUMP' = (stockAvant × CUMP + qté × coût) / (stockAvant + qté), arrondi au franc. */
export async function majCump(
  tx: Prisma.TransactionClient,
  articleId: string,
  stockAvant: number,
  quantiteEntree: number,
  coutUnitaire: number,
): Promise<void> {
  if (quantiteEntree <= 0 || coutUnitaire <= 0) return;
  const article = await tx.articleEconomat.findUnique({
    where: { id: articleId },
    select: { cump: true, prixAchat: true },
  });
  if (!article) return;
  const base = Math.max(0, stockAvant);
  const cumpAvant = article.cump ?? article.prixAchat ?? coutUnitaire;
  const nouveau = Math.round((base * cumpAvant + quantiteEntree * coutUnitaire) / (base + quantiteEntree));
  await tx.articleEconomat.update({ where: { id: articleId }, data: { cump: nouveau } });
}

/** Quantité RÉSERVÉE active d'un article (RM-1100 : disponible = stock − réservé). */
export async function quantiteReservee(
  tx: Prisma.TransactionClient,
  articleId: string,
): Promise<number> {
  const agg = await tx.reservationStock.aggregate({
    where: { articleId, statut: "active", annuleLe: null },
    _sum: { quantite: true },
  });
  return agg._sum.quantite ?? 0;
}

function joursAvant(date: Date | null, maintenant: Date): number | null {
  if (!date) return null;
  return Math.floor((date.getTime() - maintenant.getTime()) / JOUR_MS);
}

/** Charge l'onglet Stocks (magasins, situations, lots, séries, réservations, inventaires, KPI). */
export async function chargerStocks(etablissementId: string): Promise<DonneesStocksVue> {
  const maintenant = new Date();
  const [magasinsBruts, articles, stocksMagasin, lotsBruts, seriesBrutes, reservationsBrutes, inventairesBruts] =
    await Promise.all([
      prisma.magasinStock.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: [{ principal: "desc" }, { creeLe: "asc" }],
        select: { id: true, nom: true, type: true, parentId: true, statut: true, principal: true, version: true },
      }),
      prisma.articleEconomat.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { nom: "asc" },
        select: {
          id: true, nom: true, unite: true, typeArticle: true, stock: true, seuilAlerte: true,
          stockMax: true, cump: true, prixAchat: true, actif: true,
        },
      }),
      prisma.stockMagasin.findMany({
        where: { magasin: { etablissementId, annuleLe: null } },
        select: { articleId: true, magasinId: true, quantite: true },
      }),
      prisma.lotStock.findMany({
        where: { annuleLe: null, article: { etablissementId, annuleLe: null } },
        orderBy: [{ datePeremption: "asc" }, { creeLe: "desc" }],
        include: { article: { select: { nom: true } } },
      }),
      prisma.serieStock.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 200,
        include: { article: { select: { nom: true } } },
      }),
      prisma.reservationStock.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: { article: { select: { nom: true } } },
      }),
      prisma.inventaireStock.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 20,
        include: {
          magasin: { select: { nom: true } },
          lignes: { orderBy: { articleNom: "asc" } },
        },
      }),
    ]);

  // Hiérarchie : chemin complet et profondeur (parentId libre — 14).
  const parNom = new Map(magasinsBruts.map((m) => [m.id, m]));
  const chemin = (id: string): { chemin: string; profondeur: number } => {
    const morceaux: string[] = [];
    let courant = parNom.get(id);
    let garde = 0;
    while (courant && garde < 10) {
      morceaux.unshift(courant.nom);
      courant = courant.parentId ? parNom.get(courant.parentId) : undefined;
      garde += 1;
    }
    return { chemin: morceaux.join(" › "), profondeur: morceaux.length - 1 };
  };
  const quantitesParMagasin = new Map<string, { nb: number; total: number }>();
  for (const s of stocksMagasin) {
    const e = quantitesParMagasin.get(s.magasinId) ?? { nb: 0, total: 0 };
    if (s.quantite !== 0) e.nb += 1;
    e.total += s.quantite;
    quantitesParMagasin.set(s.magasinId, e);
  }
  const magasins: MagasinVue[] = magasinsBruts.map((m) => {
    const c = chemin(m.id);
    const q = quantitesParMagasin.get(m.id) ?? { nb: 0, total: 0 };
    return {
      id: m.id, nom: m.nom, type: m.type, parentId: m.parentId,
      cheminComplet: c.chemin, profondeur: c.profondeur,
      statut: m.statut, principal: m.principal,
      nbArticles: q.nb, quantiteTotale: q.total, version: m.version,
    };
  });

  const reserveParArticle = new Map<string, number>();
  for (const r of reservationsBrutes) {
    if (r.statut === "active") {
      reserveParArticle.set(r.articleId, (reserveParArticle.get(r.articleId) ?? 0) + r.quantite);
    }
  }
  const magasinNomParId = new Map(magasinsBruts.map((m) => [m.id, m.nom]));
  const stocksParArticle = new Map<string, { magasinId: string; quantite: number }[]>();
  for (const s of stocksMagasin) {
    const liste = stocksParArticle.get(s.articleId) ?? [];
    liste.push({ magasinId: s.magasinId, quantite: s.quantite });
    stocksParArticle.set(s.articleId, liste);
  }

  const situations: SituationArticleVue[] = articles.map((a) => {
    const reserve = reserveParArticle.get(a.id) ?? 0;
    const cout = a.cump ?? a.prixAchat ?? 0;
    return {
      articleId: a.id, nom: a.nom, unite: a.unite, typeArticle: a.typeArticle,
      stock: a.stock, reserve, disponible: a.stock - reserve,
      stockMin: a.seuilAlerte, stockMax: a.stockMax, cump: a.cump,
      valeur: a.stock * cout,
      rupture: a.actif && a.stock <= 0,
      sousSeuil: a.actif && a.stock > 0 && a.stock < a.seuilAlerte,
      surstock: a.stockMax !== null && a.stock > a.stockMax,
      parMagasin: (stocksParArticle.get(a.id) ?? [])
        .filter((s) => s.quantite !== 0)
        .map((s) => ({
          magasinId: s.magasinId,
          magasinNom: magasinNomParId.get(s.magasinId) ?? "—",
          quantite: s.quantite,
        })),
    };
  });

  const lots: LotVue[] = lotsBruts.map((l) => {
    const jours = joursAvant(l.datePeremption, maintenant);
    return {
      id: l.id, articleId: l.articleId, articleNom: l.article.nom, numeroLot: l.numeroLot,
      dateFabrication: l.dateFabrication?.toISOString() ?? null,
      datePeremption: l.datePeremption?.toISOString() ?? null,
      fournisseurRef: l.fournisseurRef, coutAcquisition: l.coutAcquisition,
      quantite: l.quantite,
      perime: jours !== null && jours < 0,
      joursRestants: jours,
      version: l.version,
    };
  });

  const inventaires: InventaireVue[] = inventairesBruts.map((i) => {
    const lignes = i.lignes.map((l) => ({
      id: l.id, articleId: l.articleId, articleNom: l.articleNom,
      stockTheorique: l.stockTheorique, stockPhysique: l.stockPhysique,
      ecart: l.stockPhysique === null ? null : l.stockPhysique - l.stockTheorique,
      observation: l.observation,
    }));
    return {
      id: i.id, reference: i.reference, type: i.type,
      magasinId: i.magasinId, magasinNom: i.magasin?.nom ?? null,
      statut: i.statut, notes: i.notes,
      compteParNom: i.compteParNom, compteParId: i.compteParId,
      valideParNom: i.valideParNom,
      dateValidation: i.dateValidation?.toISOString() ?? null,
      date: i.creeLe.toISOString(), version: i.version,
      lignes,
      nbComptees: lignes.filter((l) => l.stockPhysique !== null).length,
      nbEcarts: lignes.filter((l) => l.ecart !== null && l.ecart !== 0).length,
    };
  });

  const premierPalier = PALIERS_PEREMPTION_JOURS[0];
  const tableauBord: TableauBordStocksVue = {
    valeurTotale: situations.reduce((s, a) => s + a.valeur, 0),
    nbRuptures: situations.filter((a) => a.rupture).length,
    nbSousSeuil: situations.filter((a) => a.sousSeuil).length,
    nbSurstock: situations.filter((a) => a.surstock).length,
    nbLotsPerimes: lots.filter((l) => l.perime && l.quantite > 0).length,
    nbLotsProches: lots.filter((l) => !l.perime && l.joursRestants !== null && l.joursRestants <= premierPalier && l.quantite > 0).length,
    quantiteReservee: situations.reduce((s, a) => s + a.reserve, 0),
    inventairesEnCours: inventaires.filter((i) => i.statut === "en_cours").length,
  };

  return {
    magasins,
    situations,
    lots,
    series: seriesBrutes.map((s) => ({
      id: s.id, articleId: s.articleId, articleNom: s.article.nom,
      numeroSerie: s.numeroSerie, statut: s.statut, observation: s.observation, version: s.version,
    })),
    reservations: reservationsBrutes.map((r) => ({
      id: r.id, articleId: r.articleId, articleNom: r.article.nom, quantite: r.quantite,
      motif: r.motif, beneficiaire: r.beneficiaire,
      dateDebut: r.dateDebut.toISOString(), dateFin: r.dateFin?.toISOString() ?? null,
      statut: r.statut, demandeParNom: r.demandeParNom, version: r.version,
    })),
    inventaires,
    tableauBord,
  };
}
