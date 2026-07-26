import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "../categories";
import type {
  DonneesBudgetVue, LigneExecutionVue, LigneRecetteVue, TableauBordBudgetVue,
} from "./types";
import { SEUIL_ALERTE_EPUISEMENT } from "./types";

/**
 * Domaine BUDGETS (16) — CANONIQUE du contrôle budgétaire, généralise le mécanisme posé au
 * 12 : VOTÉ (montantRevise ?? montantPrevu) − ENGAGÉ (BC émis du 12 + engagements manuels)
 * − CONSOMMÉ (factures fournisseurs validées + dépenses directes du journal) = DISPONIBLE.
 * Tout est DÉRIVÉ en temps réel (RM-1300/1302/1303) ; le `controleBudgetAchat` du 12
 * délègue désormais à `controleDisponibleBudget` (source unique de vérité).
 */

const libelleCategorie = (code: string) =>
  CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? code;

export interface AgregatsBudget {
  vote: number;
  montantInitial: number;
  engageBC: number;
  engageManuel: number;
  consomme: number;
}

/**
 * EXÉCUTION budgétaire des DÉPENSES par catégorie OHADA (temps réel). Réunit :
 *  - le VOTÉ effectif (montantRevise ?? montantPrevu) des lignes de dépense ;
 *  - l'ENGAGÉ : bons de commande ÉMIS (12) nets de leurs factures validées + engagements
 *    manuels actifs (contrats/marchés/conventions) ;
 *  - le CONSOMMÉ : factures fournisseurs validées + opérations de dépense DIRECTES (journal
 *    recettes-dépenses), en EXCLUANT les opérations liées aux paiements fournisseurs (déjà
 *    comptées via les factures — jamais de double comptage, même technique qu'au 11).
 */
export async function executionParCategorie(
  db: Prisma.TransactionClient,
  etablissementId: string,
  exercice: string,
): Promise<Map<string, AgregatsBudget>> {
  const [lignes, facturesValidees, bonsEmis, engagementsManuels, operationsDepense, paiementsFrs, depenses, avances] =
    await Promise.all([
      db.budgetLigne.findMany({
        where: { etablissementId, exercice, sens: "depense", annuleLe: null },
        select: { categorie: true, montantPrevu: true, montantRevise: true },
      }),
      db.factureFournisseur.findMany({
        where: { etablissementId, exercice, statut: "validee", annuleLe: null },
        select: { montant: true, bonCommande: { select: { demande: { select: { categorieBudget: true } } } } },
      }),
      db.bonCommande.findMany({
        where: { etablissementId, exercice, statut: "emise", annuleLe: null },
        select: {
          demande: { select: { categorieBudget: true } },
          lignes: { where: { annuleLe: null }, select: { quantite: true, prixUnitaire: true } },
          factures: { where: { statut: "validee", annuleLe: null }, select: { montant: true } },
        },
      }),
      db.engagementBudget.findMany({
        where: { etablissementId, exercice, statut: "actif", annuleLe: null },
        select: { categorie: true, montant: true },
      }),
      db.operationFinanciere.findMany({
        where: { etablissementId, sens: "depense", annule: false },
        select: { id: true, categorie: true, montant: true },
      }),
      db.paiementFournisseur.findMany({
        where: { etablissementId, operationId: { not: null } },
        select: { operationId: true },
      }),
      // 17-Dépenses : demandes APPROUVÉES (engagées) et PAYÉES (consommées).
      db.demandeDepense.findMany({
        where: { etablissementId, exercice, annuleLe: null, statut: { in: ["approuvee", "payee"] } },
        select: { categorie: true, statut: true, montantEstime: true, montantValide: true, operationId: true },
      }),
      // 17-Dépenses : avances (décaissées → provisoirement consommées ; régularisées → montant justifié).
      db.avanceFrais.findMany({
        where: { etablissementId, exercice, annuleLe: null, statut: { in: ["decaissee", "regularisee"] } },
        select: { categorie: true, statut: true, montant: true, montantJustifie: true, operationId: true, operationRegulId: true },
      }),
    ]);

  const carte = new Map<string, AgregatsBudget>();
  const entree = (categorie: string) => {
    const e = carte.get(categorie);
    if (e) return e;
    const n: AgregatsBudget = { vote: 0, montantInitial: 0, engageBC: 0, engageManuel: 0, consomme: 0 };
    carte.set(categorie, n);
    return n;
  };

  for (const l of lignes) {
    const e = entree(l.categorie);
    e.vote += l.montantRevise ?? l.montantPrevu;
    e.montantInitial += l.montantPrevu;
  }
  for (const f of facturesValidees) entree(f.bonCommande.demande.categorieBudget).consomme += f.montant;
  for (const bc of bonsEmis) {
    const total = bc.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    const facture = bc.factures.reduce((s, f) => s + f.montant, 0);
    entree(bc.demande.categorieBudget).engageBC += Math.max(0, total - facture);
  }
  for (const g of engagementsManuels) entree(g.categorie).engageManuel += g.montant;

  // 17 : dépenses hors achats — approuvées = ENGAGÉ, payées = CONSOMMÉ (montant validé).
  for (const d of depenses) {
    const montant = d.montantValide ?? d.montantEstime;
    if (d.statut === "approuvee") entree(d.categorie).engageManuel += montant;
    else entree(d.categorie).consomme += montant; // payee
  }
  // 17 : avances — décaissée = consommée provisoirement ; régularisée = montant justifié.
  for (const a of avances) {
    entree(a.categorie).consomme += a.statut === "regularisee" ? (a.montantJustifie ?? a.montant) : a.montant;
  }

  // Dépenses DIRECTES = opérations de dépense NON déjà comptées via une pièce structurée
  // (paiements fournisseurs 12, dépenses/avances 17) — jamais de double comptage.
  const opsStructurees = new Set<string>([
    ...paiementsFrs.map((p) => p.operationId as string),
    ...depenses.flatMap((d) => (d.operationId ? [d.operationId] : [])),
    ...avances.flatMap((a) => [a.operationId, a.operationRegulId].filter((x): x is string => Boolean(x))),
  ]);
  for (const o of operationsDepense) {
    if (opsStructurees.has(o.id)) continue;
    entree(o.categorie).consomme += o.montant;
  }
  return carte;
}

/**
 * CONTRÔLE BUDGÉTAIRE (RM-1300) — source unique. Bloquant SEULEMENT si un budget est voté
 * pour la catégorie (sans ligne budgétaire, l'opération passe). Le `montant` proposé ne peut
 * pas dépasser le DISPONIBLE = voté − engagé (BC + manuel) − consommé.
 */
export async function controleDisponibleBudget(
  db: Prisma.TransactionClient,
  params: { etablissementId: string; exercice: string; categorie: string; montant: number },
): Promise<string | null> {
  const carte = await executionParCategorie(db, params.etablissementId, params.exercice);
  const a = carte.get(params.categorie);
  if (!a || a.vote <= 0) return null; // aucun crédit voté pour la catégorie
  const disponible = a.vote - a.engageBC - a.engageManuel - a.consomme;
  if (params.montant > disponible) {
    return `Crédit insuffisant pour la catégorie ${params.categorie} — ${libelleCategorie(params.categorie)} : disponible ${disponible.toLocaleString("fr-FR")} F (voté ${a.vote.toLocaleString("fr-FR")} F, engagé ${(a.engageBC + a.engageManuel).toLocaleString("fr-FR")} F, consommé ${a.consomme.toLocaleString("fr-FR")} F) — RM-1300.`;
  }
  return null;
}

/** Réalisé des RECETTES par catégorie (centres de profit) : opérations recette + scolarité + économat. */
async function realiseRecettes(
  db: Prisma.TransactionClient,
  etablissementId: string,
): Promise<Map<string, number>> {
  const [operations, paiements, ventes] = await Promise.all([
    db.operationFinanciere.groupBy({
      by: ["categorie"],
      where: { etablissementId, sens: "recette", annule: false },
      _sum: { montant: true },
    }),
    db.paiementScolarite.aggregate({ where: { etablissementId, annule: false }, _sum: { montant: true } }),
    db.mouvementStock.aggregate({ where: { etablissementId, type: "vente", annuleLe: null }, _sum: { montant: true } }),
  ]);
  const carte = new Map<string, number>();
  for (const o of operations) carte.set(o.categorie, o._sum.montant ?? 0);
  carte.set("7061", paiements._sum.montant ?? 0);
  carte.set("707", (carte.get("707") ?? 0) + (ventes._sum.montant ?? 0));
  return carte;
}

/** Charge l'onglet Budget : exécution (dépenses), recettes, enveloppes, centres, engagements, révisions, KPI. */
export async function chargerBudget(etablissementId: string, exercice: string): Promise<DonneesBudgetVue> {
  const [execCarte, lignesDepense, recetteVotees, recetteRealise, enveloppesBrutes, centresBruts, engagementsBruts, revisionsBrutes] =
    await Promise.all([
      executionParCategorie(prisma, etablissementId, exercice),
      prisma.budgetLigne.findMany({
        where: { etablissementId, exercice, sens: "depense", annuleLe: null },
        include: { centreCout: { select: { libelle: true } } },
      }),
      prisma.budgetLigne.findMany({
        where: { etablissementId, exercice, sens: "recette", annuleLe: null },
        select: { categorie: true, montantPrevu: true, montantRevise: true },
      }),
      realiseRecettes(prisma, etablissementId),
      prisma.budget.findMany({
        where: { etablissementId, exercice, annuleLe: null },
        orderBy: { creeLe: "desc" },
        include: { lignes: { where: { annuleLe: null }, select: { montantPrevu: true, montantRevise: true } } },
      }),
      prisma.centreCout.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { code: "asc" },
      }),
      prisma.engagementBudget.findMany({
        where: { etablissementId, exercice, annuleLe: null },
        orderBy: { creeLe: "desc" },
      }),
      prisma.revisionBudget.findMany({
        where: { etablissementId, exercice },
        orderBy: { creeLe: "desc" },
        take: 100,
      }),
    ]);

  // Métadonnées de ligne (statut, centre, budget) par catégorie de dépense.
  const metaParCategorie = new Map(lignesDepense.map((l) => [l.categorie, l]));

  const execution: LigneExecutionVue[] = [...execCarte.entries()]
    .map(([categorie, a]) => {
      const meta = metaParCategorie.get(categorie);
      const engage = a.engageBC + a.engageManuel;
      const disponible = a.vote - engage - a.consomme;
      const tauxExecution = a.vote > 0 ? (engage + a.consomme) / a.vote : 0;
      return {
        categorie,
        libelle: meta?.libelle || libelleCategorie(categorie),
        centreCoutId: meta?.centreCoutId ?? null,
        centreCoutLibelle: meta?.centreCout?.libelle ?? null,
        ligneId: meta?.id ?? null,
        budgetId: meta?.budgetId ?? null,
        statut: meta?.statut ?? "active",
        vote: a.vote,
        montantInitial: a.montantInitial,
        engageBC: a.engageBC,
        engageManuel: a.engageManuel,
        consomme: a.consomme,
        disponible,
        tauxExecution,
        depasse: a.vote > 0 && disponible < 0,
        procheEpuisement: a.vote > 0 && disponible >= 0 && tauxExecution >= SEUIL_ALERTE_EPUISEMENT,
      };
    })
    .sort((x, y) => x.categorie.localeCompare(y.categorie));

  const voteRecetteParCategorie = new Map<string, number>();
  for (const r of recetteVotees) {
    voteRecetteParCategorie.set(r.categorie, (voteRecetteParCategorie.get(r.categorie) ?? 0) + (r.montantRevise ?? r.montantPrevu));
  }
  const recettes: LigneRecetteVue[] = [...voteRecetteParCategorie.entries()]
    .map(([categorie, vote]) => {
      const realise = recetteRealise.get(categorie) ?? 0;
      return { categorie, libelle: libelleCategorie(categorie), vote, realise, taux: vote > 0 ? realise / vote : 0 };
    })
    .sort((x, y) => x.categorie.localeCompare(y.categorie));

  const totalVote = execution.reduce((s, l) => s + l.vote, 0);
  const totalEngage = execution.reduce((s, l) => s + l.engageBC + l.engageManuel, 0);
  const totalConsomme = execution.reduce((s, l) => s + l.consomme, 0);
  const tableauBord: TableauBordBudgetVue = {
    totalVote,
    totalEngage,
    totalConsomme,
    totalDisponible: totalVote - totalEngage - totalConsomme,
    tauxExecution: totalVote > 0 ? (totalEngage + totalConsomme) / totalVote : 0,
    lignesDepassees: execution.filter((l) => l.depasse).length,
    lignesProchesEpuisement: execution.filter((l) => l.procheEpuisement).length,
    totalVoteRecettes: recettes.reduce((s, l) => s + l.vote, 0),
    totalRealiseRecettes: recettes.reduce((s, l) => s + l.realise, 0),
  };

  return {
    exercice,
    execution,
    recettes,
    enveloppes: enveloppesBrutes.map((b) => ({
      id: b.id, exercice: b.exercice, type: b.type, libelle: b.libelle, statut: b.statut,
      preparParNom: b.preparParNom, voteParNom: b.voteParNom,
      dateVote: b.dateVote?.toISOString() ?? null, notes: b.notes, creeParId: b.preparParId,
      version: b.version, nbLignes: b.lignes.length,
      totalVote: b.lignes.reduce((s, l) => s + (l.montantRevise ?? l.montantPrevu), 0),
    })),
    centres: centresBruts.map((c) => ({
      id: c.id, code: c.code, libelle: c.libelle, type: c.type, actif: c.actif, version: c.version,
    })),
    engagementsManuels: engagementsBruts.map((g) => ({
      id: g.id, exercice: g.exercice, categorie: g.categorie, categorieLibelle: libelleCategorie(g.categorie),
      centreCoutLibelle: null, montant: g.montant, libelle: g.libelle,
      source: g.source, reference: g.reference, statut: g.statut, parNom: g.parNom, version: g.version,
    })),
    revisions: revisionsBrutes.map((r) => ({
      id: r.id, type: r.type, categorie: r.categorie, montant: r.montant,
      montantAvant: r.montantAvant, montantApres: r.montantApres, motif: r.motif,
      parNom: r.parNom, date: r.creeLe.toISOString(),
    })),
    tableauBord,
  };
}
