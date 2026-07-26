import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "../categories";
import { journaliserFinance } from "../commun/audit";
import { allouerPaiements } from "../scolarite/generation";
import type { BalanceAgeeVue, BalanceFormelleLigne, EcritureVue, RegistreComptableVue } from "./types";

/**
 * Domaine COMPTABILITÉ (11) — semis du plan et des journaux, périodes, états formels,
 * collecte des écritures AUTOMATIQUES (une pièce = une écriture, idempotent).
 *
 * ⚠ Plan de comptes V1 = le plan OHADA simplifié DU DÉPÔT (CATEGORIES_OHADA + comptes de
 * trésorerie/produits/tiers utilisés par la comptabilité calculée existante). Le document
 * 11A-Plan-Comptable-OHADA (non encore reçu) affinera subdivisions et intitulés officiels :
 * le plan étant PARAMÉTRABLE et semé une seule fois, l'affinage se fera par ajout de comptes
 * sans migration. La comptabilité CALCULÉE historique reste la source des états existants —
 * le registre FORMEL s'y superpose (logique de CAISSE conservée : produits à l'encaissement ;
 * le passage en engagement avec le compte 411 viendra avec le 11A, cf. rapport).
 */

/** Plan par défaut : catégories OHADA du dépôt + comptes structurels de la compta calculée. */
export const PLAN_DEFAUT: { numero: string; intitule: string; classe: number; nature: string }[] = [
  { numero: "10", intitule: "Capital", classe: 1, nature: "capitaux" },
  { numero: "12", intitule: "Report à nouveau (résultats cumulés)", classe: 1, nature: "capitaux" },
  { numero: "401", intitule: "Fournisseurs", classe: 4, nature: "tiers" },
  { numero: "411", intitule: "Clients — élèves et familles", classe: 4, nature: "tiers" },
  { numero: "521", intitule: "Banque", classe: 5, nature: "tresorerie" },
  { numero: "551", intitule: "Monnaie électronique", classe: 5, nature: "tresorerie" },
  { numero: "571", intitule: "Caisse", classe: 5, nature: "tresorerie" },
  { numero: "7061", intitule: "Scolarité (encaissements)", classe: 7, nature: "produit" },
  ...CATEGORIES_OHADA.map((c) => ({
    numero: c.code,
    intitule: c.libelle,
    classe: Number(c.code.charAt(0)),
    nature: c.sens === "recette" ? "produit" : "charge",
  })),
];

export const JOURNAUX_DEFAUT: { code: string; libelle: string; type: string }[] = [
  { code: "VE", libelle: "Journal des ventes", type: "ventes" },
  { code: "AC", libelle: "Journal des achats", type: "achats" },
  { code: "CA", libelle: "Journal de caisse", type: "caisse" },
  { code: "BQ", libelle: "Journal de banque", type: "banque" },
  { code: "OD", libelle: "Journal des opérations diverses", type: "od" },
  { code: "SA", libelle: "Journal des salaires", type: "salaires" },
  { code: "IM", libelle: "Journal des immobilisations", type: "immobilisations" },
];

/** Compte de trésorerie selon le mode de règlement (aligné sur la comptabilité calculée). */
export const TRESORERIE_PAR_MODE: Record<string, string> = {
  especes: "571",
  mobile_money: "551",
  cheque: "521",
  virement: "521",
  carte: "521",
};

/** Sème plan comptable + journaux si l'établissement n'en a AUCUN (idempotent, audité). */
export async function assurerPlanComptable(etablissementId: string, utilisateurId: string | null): Promise<void> {
  const [nbComptes, nbJournaux] = await Promise.all([
    prisma.compteComptable.count({ where: { etablissementId, annuleLe: null } }),
    prisma.journalComptable.count({ where: { etablissementId, annuleLe: null } }),
  ]);
  if (nbComptes > 0 && nbJournaux > 0) return;
  await prisma.$transaction(async (tx) => {
    if (nbComptes === 0) {
      await tx.compteComptable.createMany({
        data: PLAN_DEFAUT.map((c) => ({ etablissementId, ...c, dateOuverture: new Date() })),
        skipDuplicates: true,
      });
    }
    if (nbJournaux === 0) {
      await tx.journalComptable.createMany({
        data: JOURNAUX_DEFAUT.map((j) => ({ etablissementId, ...j })),
        skipDuplicates: true,
      });
    }
    await journaliserFinance(tx, {
      etablissementId, utilisateurId, action: "plan_comptable.semis",
      entite: "CompteComptable", entiteId: etablissementId,
      nouvelleValeur: { comptes: nbComptes === 0 ? PLAN_DEFAUT.length : 0, journaux: nbJournaux === 0 ? JOURNAUX_DEFAUT.length : 0 },
    });
  });
}

/** Période « AAAA-MM » (UTC) d'une date. */
export function periodeDe(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Bornes UTC d'une période « AAAA-MM » : [début du mois, début du mois suivant[. */
export function bornesPeriode(periode: string): { debut: Date; fin: Date } {
  const [annee, mois] = periode.split("-").map(Number);
  return {
    debut: new Date(Date.UTC(annee, mois - 1, 1)),
    fin: new Date(Date.UTC(annee, mois, 1)),
  };
}

/** RM-705 : la période est-elle CLÔTURÉE (clôture active) ? */
export async function periodeCloturee(
  db: Prisma.TransactionClient,
  etablissementId: string,
  periode: string,
): Promise<boolean> {
  const cloture = await db.cloturePeriodeComptable.findFirst({
    where: { etablissementId, periode, annuleLe: null },
    select: { id: true },
  });
  return cloture !== null;
}

/** Écriture candidate produite par la collecte automatique (avant insertion). */
export interface EcritureCandidate {
  sourceType: string;
  sourceId: string;
  journalType: string; // « caisse » | « banque » | « od » | « ventes »
  date: Date;
  libelle: string;
  pieceJustificative: string;
  lignes: { compteNumero: string; debit: number; credit: number }[];
}

const nomPersonne = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

/**
 * COLLECTE des écritures automatiques d'une période (11 — « le comptable ne passe plus les
 * écritures manuellement ») : paiements, ventes économat, opérations diverses (frais et
 * intérêts bancaires du 10 inclus — ce sont des OperationFinanciere), versements
 * caisse → banque CONFIRMÉS (débit 521 / crédit 571 — promesse du 10) et retraits
 * banque → caisse. Chaque pièce donne UNE écriture équilibrée à deux lignes (RM-700).
 */
export async function collecterEcrituresAuto(
  etablissementId: string,
  periode: string,
): Promise<{ candidates: EcritureCandidate[] }> {
  const { debut, fin } = bornesPeriode(periode);
  const [paiements, ventes, operations, depotsCaisse, retraitsBanque] = await Promise.all([
    prisma.paiementScolarite.findMany({
      where: { etablissementId, annule: false, date: { gte: debut, lt: fin } },
      select: {
        id: true, numeroRecu: true, montant: true, mode: true, libelle: true, date: true,
        eleve: { select: { nom: true, prenoms: true } },
      },
    }),
    prisma.mouvementStock.findMany({
      where: { etablissementId, type: "vente", annuleLe: null, montant: { gt: 0 }, date: { gte: debut, lt: fin } },
      select: { id: true, montant: true, mode: true, quantite: true, date: true, article: { select: { nom: true } } },
    }),
    prisma.operationFinanciere.findMany({
      where: { etablissementId, annule: false, date: { gte: debut, lt: fin } },
      select: { id: true, sens: true, categorie: true, libelle: true, montant: true, mode: true, reference: true, date: true },
    }),
    prisma.mouvementBancaire.findMany({
      where: {
        etablissementId, type: "depot", mouvementCaisseId: { not: null }, annuleLe: null,
        dateOperation: { gte: debut, lt: fin },
      },
      select: { id: true, montant: true, libelle: true, pieceJustificative: true, dateOperation: true },
    }),
    prisma.mouvementCaisse.findMany({
      where: { etablissementId, type: "retrait_banque", annuleLe: null, creeLe: { gte: debut, lt: fin } },
      select: { id: true, montant: true, motif: true, pieceJustificative: true, creeLe: true },
    }),
  ]);

  const candidates: EcritureCandidate[] = [];
  for (const p of paiements) {
    const treso = TRESORERIE_PAR_MODE[p.mode] ?? "571";
    candidates.push({
      sourceType: "paiement",
      sourceId: p.id,
      journalType: p.mode === "especes" ? "caisse" : "banque",
      date: p.date,
      libelle: `Encaissement — ${nomPersonne(p.eleve)} : ${p.libelle}`.slice(0, 200),
      pieceJustificative: `RECU-${String(p.numeroRecu).padStart(6, "0")}`,
      lignes: [
        { compteNumero: treso, debit: p.montant, credit: 0 },
        { compteNumero: "7061", debit: 0, credit: p.montant },
      ],
    });
  }
  for (const v of ventes) {
    const treso = TRESORERIE_PAR_MODE[v.mode ?? "especes"] ?? "571";
    candidates.push({
      sourceType: "vente",
      sourceId: v.id,
      journalType: "ventes",
      date: v.date,
      libelle: `Vente économat — ${v.quantite} × ${v.article.nom}`.slice(0, 200),
      pieceJustificative: `VENTE-${v.id.slice(0, 8).toUpperCase()}`,
      lignes: [
        { compteNumero: treso, debit: v.montant ?? 0, credit: 0 },
        { compteNumero: "707", debit: 0, credit: v.montant ?? 0 },
      ],
    });
  }
  for (const o of operations) {
    const treso = TRESORERIE_PAR_MODE[o.mode] ?? "571";
    const estRecette = o.sens === "recette";
    candidates.push({
      sourceType: "operation",
      sourceId: o.id,
      journalType: "od",
      date: o.date,
      libelle: o.libelle.slice(0, 200),
      pieceJustificative: o.reference || `OP-${o.id.slice(0, 8).toUpperCase()}`,
      lignes: estRecette
        ? [
            { compteNumero: treso, debit: o.montant, credit: 0 },
            { compteNumero: o.categorie, debit: 0, credit: o.montant },
          ]
        : [
            { compteNumero: o.categorie, debit: o.montant, credit: 0 },
            { compteNumero: treso, debit: 0, credit: o.montant },
          ],
    });
  }
  // Promesse du 10 : écritures 571 ↔ 521 des mouvements caisse/banque.
  for (const d of depotsCaisse) {
    candidates.push({
      sourceType: "mouvement_bancaire",
      sourceId: d.id,
      journalType: "banque",
      date: d.dateOperation,
      libelle: d.libelle.slice(0, 200),
      pieceJustificative: d.pieceJustificative,
      lignes: [
        { compteNumero: "521", debit: d.montant, credit: 0 },
        { compteNumero: "571", debit: 0, credit: d.montant },
      ],
    });
  }
  for (const r of retraitsBanque) {
    candidates.push({
      sourceType: "mouvement_caisse",
      sourceId: r.id,
      journalType: "banque",
      date: r.creeLe,
      libelle: (r.motif ?? "Retrait bancaire vers la caisse").slice(0, 200),
      pieceJustificative: r.pieceJustificative || `MCA-${r.id.slice(0, 8).toUpperCase()}`,
      lignes: [
        { compteNumero: "571", debit: r.montant, credit: 0 },
        { compteNumero: "521", debit: 0, credit: r.montant },
      ],
    });
  }
  return { candidates };
}

/** Balance ÂGÉE des créances élèves (11) : restes dus classés par ancienneté d'échéance. */
export async function balanceAgee(etablissementId: string, exercice: string): Promise<BalanceAgeeVue> {
  const maintenant = new Date();
  const [creances, paiements] = await Promise.all([
    prisma.creanceEleve.findMany({
      where: { etablissementId, exercice, annuleLe: null, statut: { notIn: ["suspendue", "annulee"] } },
      select: { id: true, eleveId: true, fraisId: true, montant: true, dateEcheance: true, creeLe: true },
    }),
    prisma.paiementScolarite.groupBy({
      by: ["eleveId", "fraisId"],
      where: { etablissementId, annule: false },
      _sum: { montant: true },
    }),
  ]);
  const payeParCle = new Map<string, number>();
  for (const p of paiements) {
    if (p.fraisId) payeParCle.set(`${p.eleveId}:${p.fraisId}`, p._sum.montant ?? 0);
  }
  const groupes = new Map<string, typeof creances>();
  for (const c of creances) {
    const cle = `${c.eleveId}:${c.fraisId}`;
    const liste = groupes.get(cle) ?? [];
    liste.push(c);
    groupes.set(cle, liste);
  }
  const tranches = [
    { libelle: "Non échues / sans échéance", montant: 0, nombre: 0 },
    { libelle: "0 à 30 jours", montant: 0, nombre: 0 },
    { libelle: "31 à 60 jours", montant: 0, nombre: 0 },
    { libelle: "61 à 90 jours", montant: 0, nombre: 0 },
    { libelle: "Plus de 90 jours", montant: 0, nombre: 0 },
  ];
  const JOUR_MS = 86_400_000;
  for (const [cle, liste] of groupes) {
    const alloc = allouerPaiements(
      liste.map((c) => ({ id: c.id, montant: Number(c.montant), dateEcheance: c.dateEcheance, creeLe: c.creeLe })),
      payeParCle.get(cle) ?? 0,
    );
    for (const c of liste) {
      const reste = Number(c.montant) - (alloc.get(c.id) ?? 0);
      if (reste <= 0) continue;
      let indice = 0;
      if (c.dateEcheance && c.dateEcheance < maintenant) {
        const jours = Math.floor((maintenant.getTime() - c.dateEcheance.getTime()) / JOUR_MS);
        indice = jours <= 30 ? 1 : jours <= 60 ? 2 : jours <= 90 ? 3 : 4;
      }
      tranches[indice].montant += reste;
      tranches[indice].nombre += 1;
    }
  }
  return { tranches, total: tranches.reduce((s, t) => s + t.montant, 0) };
}

/** Charge le registre formel : plan, journaux, écritures récentes, balance, clôtures, KPI. */
export async function chargerComptabilite(
  etablissementId: string,
  exercice: string,
): Promise<RegistreComptableVue> {
  const [comptes, journaux, ecrituresBrutes, agregatsBalance, clotures, totalEcritures, brouillons, automatiques, agee] =
    await Promise.all([
      prisma.compteComptable.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { numero: "asc" },
        select: { id: true, numero: true, intitule: true, classe: true, nature: true, parentNumero: true, statut: true, version: true },
      }),
      prisma.journalComptable.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { code: "asc" },
        select: { id: true, code: true, libelle: true, type: true, actif: true, version: true },
      }),
      prisma.ecritureComptable.findMany({
        where: { etablissementId },
        orderBy: [{ date: "desc" }, { creeLe: "desc" }],
        take: 120,
        include: {
          journal: { select: { code: true } },
          lignes: {
            where: { annuleLe: null },
            orderBy: { ordre: "asc" },
            select: {
              id: true, compteId: true, compteNumero: true, compteIntitule: true,
              debit: true, credit: true, libelle: true, centreAnalytique: true, lettrage: true,
            },
          },
        },
      }),
      prisma.ligneEcriture.groupBy({
        by: ["compteNumero", "compteIntitule"],
        where: {
          annuleLe: null,
          ecriture: { etablissementId, exercice, statut: "validee", annuleLe: null },
        },
        _sum: { debit: true, credit: true },
      }),
      prisma.cloturePeriodeComptable.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { periode: "desc" },
        take: 24,
        select: { id: true, periode: true, creeLe: true, version: true },
      }),
      prisma.ecritureComptable.count({ where: { etablissementId, exercice, annuleLe: null } }),
      prisma.ecritureComptable.count({ where: { etablissementId, exercice, annuleLe: null, statut: "brouillon" } }),
      prisma.ecritureComptable.count({ where: { etablissementId, exercice, annuleLe: null, origine: "automatique" } }),
      balanceAgee(etablissementId, exercice),
    ]);

  const ecritures: EcritureVue[] = ecrituresBrutes.map((e) => {
    const totalDebit = e.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = e.lignes.reduce((s, l) => s + l.credit, 0);
    return {
      id: e.id,
      numero: e.numero,
      journalId: e.journalId,
      journalCode: e.journal.code,
      exercice: e.exercice,
      date: e.date.toISOString(),
      libelle: e.libelle,
      pieceJustificative: e.pieceJustificative,
      origine: e.origine,
      sourceType: e.sourceType,
      statut: e.statut,
      contreEcritureDeId: e.contreEcritureDeId,
      totalDebit,
      totalCredit,
      equilibree: totalDebit === totalCredit && totalDebit > 0,
      annulee: e.annuleLe !== null,
      version: e.version,
      lignes: e.lignes,
    };
  });

  const balanceFormelle: BalanceFormelleLigne[] = agregatsBalance
    .map((a) => ({
      compteNumero: a.compteNumero,
      compteIntitule: a.compteIntitule,
      classe: Number(a.compteNumero.charAt(0)) || 0,
      totalDebit: a._sum.debit ?? 0,
      totalCredit: a._sum.credit ?? 0,
      solde: (a._sum.debit ?? 0) - (a._sum.credit ?? 0),
    }))
    .sort((a, b) => a.compteNumero.localeCompare(b.compteNumero));

  return {
    comptes,
    journaux,
    ecritures,
    balanceFormelle,
    balanceAgee: agee,
    cloturesPeriode: clotures.map((c) => ({
      id: c.id, periode: c.periode, clotureLe: c.creeLe.toISOString(), version: c.version,
    })),
    tableauBord: {
      totalEcritures,
      brouillons,
      automatiques,
      manuelles: totalEcritures - automatiques,
      dernierePeriodeCloturee: clotures[0]?.periode ?? null,
    },
  };
}
