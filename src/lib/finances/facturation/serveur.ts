import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allouerPaiements } from "../scolarite/generation";
import {
  STATUTS_FACTURE_SUIVIS,
  type CreanceFacturableVue, type FactureVue, type LigneFactureSaisie,
  type StatistiquesFacturationVue, type StatutFacture, type StatutFactureAffiche,
} from "./types";

/**
 * Domaine FACTURATION (07) — calculs purs + chargeurs serveur (aucune action ici, cf. 02B).
 *
 * Articulation avec le 06 : le PAYÉ d'une facture se déduit de l'allocation des paiements aux
 * CRÉANCES liées à ses lignes (même allocation que le compte financier de l'élève). Une
 * facture manuelle sans créances liées reste à payé 0 jusqu'à l'imputation directe
 * paiement → facture qu'apportera 08-Encaissements (report documenté — rien n'est bloqué :
 * la liaison passe déjà par les créances).
 */

const JOUR_MS = 86_400_000;
const PLAFOND = 1_000_000_000;

/** Normalise et borne une ligne saisie ; null si invalide. */
export function normaliserLigneSaisie(brut: unknown): LigneFactureSaisie | null {
  const b = brut as Record<string, unknown> | null;
  const libelle = String(b?.libelle ?? "").trim().slice(0, 160);
  const quantite = Math.trunc(Number(b?.quantite ?? 1));
  const prixUnitaire = Math.trunc(Number(b?.prixUnitaire));
  const remise = Math.max(0, Math.trunc(Number(b?.remise ?? 0)) || 0);
  const taxe = Math.max(0, Math.trunc(Number(b?.taxe ?? 0)) || 0);
  if (!libelle) return null;
  if (!Number.isFinite(quantite) || quantite < 1 || quantite > 10_000) return null;
  if (!Number.isFinite(prixUnitaire) || prixUnitaire < 0 || prixUnitaire > PLAFOND) return null;
  const description = String(b?.description ?? "").trim().slice(0, 300);
  return { libelle, ...(description ? { description } : {}), quantite, prixUnitaire, remise, taxe };
}

export function montantLigne(l: LigneFactureSaisie): number {
  return l.quantite * l.prixUnitaire - (l.remise ?? 0) + (l.taxe ?? 0);
}

/** Totaux dénormalisés d'une facture (brut, remises, taxes, TTC). */
export function totauxDepuisLignes(lignes: LigneFactureSaisie[]): {
  totalBrut: number; totalRemises: number; totalTaxes: number; montantTotal: number;
} {
  const totalBrut = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  const totalRemises = lignes.reduce((s, l) => s + (l.remise ?? 0), 0);
  const totalTaxes = lignes.reduce((s, l) => s + (l.taxe ?? 0), 0);
  return { totalBrut, totalRemises, totalTaxes, montantTotal: totalBrut - totalRemises + totalTaxes };
}

/** Statut d'affichage : « en_retard » si échéance dépassée et facture émise non soldée (07). */
export function statutAfficheFacture(
  statut: StatutFacture,
  type: string,
  dateEcheance: Date | null,
  paye: number,
  netDu: number,
  maintenant: Date,
): { statutAffiche: StatutFactureAffiche; joursRetard: number } {
  if (
    type === "facture" &&
    (statut === "emise" || statut === "partiellement_payee") &&
    dateEcheance && dateEcheance < maintenant && paye < netDu
  ) {
    return {
      statutAffiche: "en_retard",
      joursRetard: Math.max(1, Math.floor((maintenant.getTime() - dateEcheance.getTime()) / JOUR_MS)),
    };
  }
  return { statutAffiche: statut, joursRetard: 0 };
}

const nomPersonne = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

/**
 * Ventilations DIRECTES paiement → facture (08) actives, agrégées par facture — les paiements
 * ventilés ne portent pas de fraisId : jamais de double comptage avec l'allocation créances.
 */
async function ventilationsParFacture(
  db: Prisma.TransactionClient,
  factureIds: string[],
): Promise<Map<string, number>> {
  if (factureIds.length === 0) return new Map();
  const rangs = await db.ventilationPaiement.groupBy({
    by: ["factureId"],
    where: { factureId: { in: factureIds }, annuleLe: null, paiement: { annule: false } },
    _sum: { montant: true },
  });
  return new Map(rangs.map((r) => [r.factureId, r._sum.montant ?? 0]));
}

/** Payé par créance pour un ensemble d'élèves (allocation identique au compte élève du 06). */
async function payeParCreancePourEleves(
  db: Prisma.TransactionClient,
  etablissementId: string,
  eleveIds: string[],
): Promise<Map<string, number>> {
  if (eleveIds.length === 0) return new Map();
  const [creances, paiements] = await Promise.all([
    db.creanceEleve.findMany({
      where: {
        etablissementId, eleveId: { in: eleveIds }, annuleLe: null,
        statut: { notIn: ["suspendue", "annulee"] },
      },
      select: { id: true, eleveId: true, fraisId: true, montant: true, dateEcheance: true, creeLe: true },
    }),
    db.paiementScolarite.groupBy({
      by: ["eleveId", "fraisId"],
      where: { etablissementId, eleveId: { in: eleveIds }, annule: false },
      _sum: { montant: true },
    }),
  ]);
  const payeParEleveFrais = new Map<string, number>();
  for (const p of paiements) {
    if (p.fraisId) payeParEleveFrais.set(`${p.eleveId}:${p.fraisId}`, p._sum.montant ?? 0);
  }
  const groupes = new Map<string, typeof creances>();
  for (const c of creances) {
    const cle = `${c.eleveId}:${c.fraisId}`;
    const liste = groupes.get(cle) ?? [];
    liste.push(c);
    groupes.set(cle, liste);
  }
  const resultat = new Map<string, number>();
  for (const [cle, liste] of groupes) {
    const alloc = allouerPaiements(
      liste.map((c) => ({ id: c.id, montant: Number(c.montant), dateEcheance: c.dateEcheance, creeLe: c.creeLe })),
      payeParEleveFrais.get(cle) ?? 0,
    );
    for (const [id, m] of alloc) resultat.set(id, m);
  }
  return resultat;
}

/**
 * Charge les factures d'un établissement (lignes, avoirs, notes de débit, payé alloué) et le
 * tableau de bord du 07 — tout est calculé côté serveur, seules les vues partent au client.
 */
export async function chargerFactures(
  etablissementId: string,
  anneeScolaireActiveId: string | null,
  options?: { eleveId?: string; take?: number },
): Promise<{ factures: FactureVue[]; stats: StatistiquesFacturationVue }> {
  const maintenant = new Date();
  const brutes = await prisma.factureEleve.findMany({
    where: { etablissementId, ...(options?.eleveId ? { eleveId: options.eleveId } : {}) },
    orderBy: { creeLe: "desc" },
    take: options?.take ?? 300,
    include: {
      eleve: {
        select: {
          nom: true, prenoms: true, matricule: true,
          inscriptions: {
            where: anneeScolaireActiveId ? { anneeScolaireId: anneeScolaireActiveId } : undefined,
            take: 1,
            select: { classe: { select: { nom: true } } },
          },
        },
      },
      lignes: {
        where: { annuleLe: null },
        orderBy: { ordre: "asc" },
        select: {
          id: true, creanceId: true, libelle: true, description: true, quantite: true,
          prixUnitaire: true, remise: true, taxe: true, montant: true,
        },
      },
      avoirs: {
        where: { annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, numero: true, type: true, montant: true, motif: true, creeLe: true, version: true },
      },
      notesDebit: {
        where: { annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, numero: true, libelle: true, montant: true, motif: true, creeLe: true, version: true },
      },
    },
  });

  const [payeParCreance, ventileParFacture] = await Promise.all([
    payeParCreancePourEleves(prisma, etablissementId, [...new Set(brutes.map((f) => f.eleveId))]),
    ventilationsParFacture(prisma, brutes.map((f) => f.id)),
  ]);

  const factures: FactureVue[] = brutes.map((f) => {
    const totalAvoirs = f.avoirs.reduce((s, a) => s + a.montant, 0);
    const totalNotesDebit = f.notesDebit.reduce((s, n) => s + n.montant, 0);
    const netDu = Math.max(0, f.montantTotal + totalNotesDebit - totalAvoirs);
    const paye =
      f.lignes.reduce((s, l) => s + (l.creanceId ? payeParCreance.get(l.creanceId) ?? 0 : 0), 0) +
      (ventileParFacture.get(f.id) ?? 0);
    const statut = f.statut as StatutFacture;
    const { statutAffiche, joursRetard } = statutAfficheFacture(statut, f.type, f.dateEcheance, paye, netDu, maintenant);
    return {
      id: f.id,
      type: f.type,
      numero: f.numero,
      exercice: f.exercice,
      eleveId: f.eleveId,
      eleveNom: nomPersonne(f.eleve),
      classe: f.eleve.inscriptions[0]?.classe?.nom ?? null,
      matricule: f.eleve.matricule,
      objet: f.objet,
      observations: f.observations,
      totalBrut: f.totalBrut,
      totalRemises: f.totalRemises,
      totalTaxes: f.totalTaxes,
      montantTotal: f.montantTotal,
      totalAvoirs,
      totalNotesDebit,
      netDu,
      paye,
      statut,
      statutAffiche,
      joursRetard,
      motifAnnulation: f.motifAnnulation,
      dateEmission: f.dateEmission ? f.dateEmission.toISOString() : null,
      dateEcheance: f.dateEcheance ? f.dateEcheance.toISOString() : null,
      creeLe: f.creeLe.toISOString(),
      version: f.version,
      lignes: f.lignes,
      avoirs: f.avoirs.map((a) => ({ ...a, creeLe: a.creeLe.toISOString() })),
      notesDebit: f.notesDebit.map((n) => ({ ...n, creeLe: n.creeLe.toISOString() })),
    };
  });

  // ── Tableau de bord (07) : les proformas (documents informatifs) et les brouillons sont
  //    exclus du facturé ; les annulées comptées à part. ──
  const emises = factures.filter(
    (f) => f.type === "facture" && (STATUTS_FACTURE_SUIVIS as readonly string[]).concat(["suspendue", "archivee"]).includes(f.statut),
  );
  const montantFacture = emises.reduce((s, f) => s + f.netDu, 0);
  const montantEncaisse = emises.reduce((s, f) => s + Math.min(f.paye, f.netDu), 0);
  const enRetard = factures.filter((f) => f.statutAffiche === "en_retard");
  const stats: StatistiquesFacturationVue = {
    nombre: emises.length,
    montantFacture,
    montantEncaisse,
    resteAEncaisser: Math.max(0, montantFacture - montantEncaisse),
    tauxPaiement: montantFacture > 0 ? Math.round((montantEncaisse / montantFacture) * 100) : 0,
    enRetardNombre: enRetard.length,
    enRetardMontant: enRetard.reduce((s, f) => s + Math.max(0, f.netDu - f.paye), 0),
    montantsAnnules: factures.filter((f) => f.statut === "annulee" && f.type === "facture").reduce((s, f) => s + f.montantTotal, 0),
    totalAvoirs: factures.reduce((s, f) => s + f.totalAvoirs, 0),
    brouillons: factures.filter((f) => f.type === "facture" && ["brouillon", "en_attente_validation", "validee"].includes(f.statut)).length,
  };
  return { factures, stats };
}

/**
 * Met à jour les statuts STOCKÉS des factures ÉMISES d'un élève d'après les paiements alloués
 * aux créances liées (07 : « les paiements mettent à jour automatiquement le statut ») — à
 * appeler DANS la transaction de tout encaissement / annulation / imputation d'avance.
 */
export async function majStatutFactures(
  tx: Prisma.TransactionClient,
  params: { etablissementId: string; eleveId: string },
): Promise<void> {
  const factures = await tx.factureEleve.findMany({
    where: {
      etablissementId: params.etablissementId,
      eleveId: params.eleveId,
      type: "facture",
      annuleLe: null,
      statut: { in: [...STATUTS_FACTURE_SUIVIS] },
    },
    select: {
      id: true, statut: true, montantTotal: true,
      lignes: { where: { annuleLe: null }, select: { creanceId: true } },
      avoirs: { where: { annuleLe: null }, select: { montant: true } },
      notesDebit: { where: { annuleLe: null }, select: { montant: true } },
    },
  });
  if (factures.length === 0) return;
  const [payeParCreance, ventileParFacture] = await Promise.all([
    payeParCreancePourEleves(tx, params.etablissementId, [params.eleveId]),
    ventilationsParFacture(tx, factures.map((f) => f.id)),
  ]);
  for (const f of factures) {
    const netDu = Math.max(
      0,
      f.montantTotal + f.notesDebit.reduce((s, n) => s + n.montant, 0) - f.avoirs.reduce((s, a) => s + a.montant, 0),
    );
    const paye =
      f.lignes.reduce((s, l) => s + (l.creanceId ? payeParCreance.get(l.creanceId) ?? 0 : 0), 0) +
      (ventileParFacture.get(f.id) ?? 0);
    const statut: StatutFacture = paye >= netDu ? "soldee" : paye > 0 ? "partiellement_payee" : "emise";
    if (statut !== f.statut) {
      await tx.factureEleve.updateMany({ where: { id: f.id }, data: { statut, version: { increment: 1 } } });
    }
  }
}

export interface ResteFacture {
  id: string;
  numero: string | null;
  objet: string;
  netDu: number;
  paye: number;
  reste: number;
  dateEcheance: Date | null;
  creeLe: Date;
}

/**
 * RESTES DUS des factures ouvertes d'un élève (émises / partiellement payées, type facture) —
 * ordonnés par échéance puis ancienneté : sert à la VENTILATION d'un encaissement (08).
 * Utilisable dans une transaction (le calcul reste cohérent avec majStatutFactures).
 */
export async function restesFactures(
  db: Prisma.TransactionClient,
  etablissementId: string,
  eleveId: string,
): Promise<ResteFacture[]> {
  const factures = await db.factureEleve.findMany({
    where: {
      etablissementId, eleveId, type: "facture", annuleLe: null,
      statut: { in: ["emise", "partiellement_payee"] },
    },
    select: {
      id: true, numero: true, objet: true, montantTotal: true, dateEcheance: true, creeLe: true,
      lignes: { where: { annuleLe: null }, select: { creanceId: true } },
      avoirs: { where: { annuleLe: null }, select: { montant: true } },
      notesDebit: { where: { annuleLe: null }, select: { montant: true } },
    },
  });
  if (factures.length === 0) return [];
  const [payeParCreance, ventileParFacture] = await Promise.all([
    payeParCreancePourEleves(db, etablissementId, [eleveId]),
    ventilationsParFacture(db, factures.map((f) => f.id)),
  ]);
  return factures
    .map((f) => {
      const netDu = Math.max(
        0,
        f.montantTotal + f.notesDebit.reduce((s, n) => s + n.montant, 0) - f.avoirs.reduce((s, a) => s + a.montant, 0),
      );
      const paye =
        f.lignes.reduce((s, l) => s + (l.creanceId ? payeParCreance.get(l.creanceId) ?? 0 : 0), 0) +
        (ventileParFacture.get(f.id) ?? 0);
      return {
        id: f.id, numero: f.numero, objet: f.objet, netDu, paye,
        reste: Math.max(0, netDu - paye), dateEcheance: f.dateEcheance, creeLe: f.creeLe,
      };
    })
    .sort((a, b) => {
      const da = a.dateEcheance?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db2 = b.dateEcheance?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da !== db2 ? da - db2 : a.creeLe.getTime() - b.creeLe.getTime();
    });
}

/**
 * Créances FACTURABLES d'un élève : actives (non annulées, non suspendues) et non déjà liées
 * à une ligne active d'une facture active de l'exercice (idempotence de « Facturer »).
 */
export async function creancesFacturables(
  etablissementId: string,
  eleveId: string,
  exercice: string,
): Promise<CreanceFacturableVue[]> {
  const [creances, lignesLiees] = await Promise.all([
    prisma.creanceEleve.findMany({
      where: {
        etablissementId, eleveId, exercice, annuleLe: null,
        statut: { notIn: ["suspendue", "annulee"] },
      },
      orderBy: [{ dateEcheance: "asc" }, { creeLe: "asc" }],
      select: { id: true, libelle: true, montant: true, dateEcheance: true },
    }),
    prisma.ligneFacture.findMany({
      where: {
        creanceId: { not: null },
        annuleLe: null,
        facture: { etablissementId, eleveId, annuleLe: null, statut: { not: "annulee" } },
      },
      select: { creanceId: true },
    }),
  ]);
  const dejaFacturees = new Set(lignesLiees.map((l) => l.creanceId).filter((id): id is string => !!id));
  return creances
    .filter((c) => !dejaFacturees.has(c.id))
    .map((c) => ({
      id: c.id,
      libelle: c.libelle,
      montant: Number(c.montant),
      dateEcheance: c.dateEcheance ? c.dateEcheance.toISOString() : null,
    }));
}
