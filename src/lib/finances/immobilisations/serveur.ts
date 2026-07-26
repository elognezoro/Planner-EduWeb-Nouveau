import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { journaliserFinance } from "../commun/audit";
import {
  amortissementCumuleTheorique, LIBELLE_CATEGORIE_IMMO, planAmortissement,
  SEUIL_ALERTE_GARANTIE_JOURS, vncTheorique,
  type DonneesImmobilisationsVue, type ImmobilisationVue, type ParamsAmortissement,
  type TableauBordImmoVue,
} from "./types";

/**
 * Domaine IMMOBILISATIONS (15) — semis idempotent des comptes OHADA de classe 2/28/68/81/82
 * (absents du plan V1 du dépôt, qui ne portait que les classes 6 et 7), chargeur du
 * patrimoine (plan d'amortissement et VNC DÉRIVÉS) et helpers d'exercice.
 */

const JOUR_MS = 86_400_000;

/** Comptes requis par les écritures d'immobilisation (acquisition, dotation, sortie). */
const COMPTES_IMMOBILISATIONS: { numero: string; intitule: string; classe: number; nature: string }[] = [
  { numero: "21", intitule: "Immobilisations incorporelles", classe: 2, nature: "immobilisations" },
  { numero: "22", intitule: "Terrains", classe: 2, nature: "immobilisations" },
  { numero: "23", intitule: "Bâtiments, installations et agencements", classe: 2, nature: "immobilisations" },
  { numero: "24", intitule: "Matériel, mobilier et équipements", classe: 2, nature: "immobilisations" },
  { numero: "281", intitule: "Amortissements des immobilisations incorporelles", classe: 2, nature: "immobilisations" },
  { numero: "283", intitule: "Amortissements des bâtiments et installations", classe: 2, nature: "immobilisations" },
  { numero: "284", intitule: "Amortissements du matériel et mobilier", classe: 2, nature: "immobilisations" },
  { numero: "481", intitule: "Fournisseurs d'investissement", classe: 4, nature: "tiers" },
  { numero: "106", intitule: "Écarts de réévaluation", classe: 1, nature: "capitaux" },
  { numero: "681", intitule: "Dotations aux amortissements d'exploitation", classe: 6, nature: "charge" },
  { numero: "81", intitule: "Valeurs comptables des cessions d'immobilisations", classe: 8, nature: "charge" },
  { numero: "82", intitule: "Produits des cessions d'immobilisations", classe: 8, nature: "produit" },
];

/**
 * Sème les comptes d'immobilisation manquants (idempotent). Distinct de assurerPlanComptable
 * (qui ne s'exécute que sur un plan vierge) : ici on complète un plan déjà semé, à la demande,
 * avant toute écriture d'immobilisation. À appeler HORS transaction d'écriture.
 */
export async function assurerComptesImmobilisations(
  etablissementId: string,
  utilisateurId: string | null,
): Promise<void> {
  const existants = await prisma.compteComptable.findMany({
    where: { etablissementId, annuleLe: null, numero: { in: COMPTES_IMMOBILISATIONS.map((c) => c.numero) } },
    select: { numero: true },
  });
  const presents = new Set(existants.map((c) => c.numero));
  const manquants = COMPTES_IMMOBILISATIONS.filter((c) => !presents.has(c.numero));
  if (manquants.length === 0) return;
  await prisma.$transaction(async (tx) => {
    await tx.compteComptable.createMany({
      data: manquants.map((c) => ({ etablissementId, ...c, dateOuverture: new Date() })),
      skipDuplicates: true,
    });
    await journaliserFinance(tx, {
      etablissementId, utilisateurId, action: "plan_comptable.comptes_immobilisations",
      entite: "CompteComptable", entiteId: etablissementId, nouvelleValeur: { ajoutes: manquants.map((c) => c.numero) },
    });
  });
}

function paramsDe(i: {
  valeurBrute: number; valeurResiduelle: number; dureeMois: number;
  dateMiseEnService: Date | null; amortissable: boolean;
}): ParamsAmortissement {
  return {
    valeurBrute: i.valeurBrute,
    valeurResiduelle: i.valeurResiduelle,
    dureeMois: i.dureeMois,
    dateMiseEnService: i.dateMiseEnService?.toISOString() ?? null,
    amortissable: i.amortissable,
  };
}

/** Charge l'onglet Immobilisations : passeports complets + tableau de bord. */
export async function chargerImmobilisations(etablissementId: string): Promise<DonneesImmobilisationsVue> {
  const maintenant = new Date();
  const anneeCourante = maintenant.getUTCFullYear();
  const brutes = await prisma.immobilisation.findMany({
    where: { etablissementId, annuleLe: null },
    orderBy: { creeLe: "desc" },
    take: 300,
    include: {
      fournisseur: { select: { raisonSociale: true } },
      dotations: { where: { annuleLe: null }, orderBy: { periode: "asc" } },
      maintenances: { where: { annuleLe: null }, orderBy: { creeLe: "desc" } },
      evenements: { orderBy: { date: "desc" }, take: 40 },
    },
  });

  const immobilisations: ImmobilisationVue[] = brutes.map((i) => {
    const params = paramsDe(i);
    const plan = planAmortissement(params);
    const amortiComptabilise = i.dotations.reduce((s, d) => s + d.montant, 0);
    const amortiTheo = amortissementCumuleTheorique(params, maintenant);
    const sorti = i.dateSortie !== null;
    // Une dotation est DUE si l'actif est en service, amortissable, non sorti, non totalement
    // amorti, et qu'un exercice échu (≤ année courante) reste à comptabiliser.
    const dernierExercicePlan = plan.length > 0 ? plan[plan.length - 1].annee : 0;
    const exercicesComptabilises = new Set(i.dotations.map((d) => d.periode));
    const dotationDue =
      !sorti && i.amortissable && i.dateMiseEnService !== null &&
      plan.some((l) => l.annee <= anneeCourante && !exercicesComptabilises.has(String(l.annee))) &&
      amortiComptabilise < i.valeurBrute - i.valeurResiduelle &&
      dernierExercicePlan > 0;
    const garantieExpire =
      i.garantieEcheance !== null &&
      (i.garantieEcheance.getTime() - maintenant.getTime()) / JOUR_MS <= SEUIL_ALERTE_GARANTIE_JOURS &&
      !sorti;
    return {
      id: i.id, code: i.code, designation: i.designation, description: i.description,
      categorie: i.categorie, sousCategorie: i.sousCategorie, numeroSerie: i.numeroSerie,
      dateAcquisition: i.dateAcquisition.toISOString(),
      dateMiseEnService: i.dateMiseEnService?.toISOString() ?? null,
      fournisseurNom: i.fournisseur?.raisonSociale ?? null, factureReference: i.factureReference,
      coutAcquisition: i.coutAcquisition, valeurBrute: i.valeurBrute,
      valeurResiduelle: i.valeurResiduelle, dureeMois: i.dureeMois,
      modeAmortissement: i.modeAmortissement, amortissable: i.amortissable,
      modeAcquisition: i.modeAcquisition, compteImmo: i.compteImmo, compteAmort: i.compteAmort,
      garantieFournisseur: i.garantieFournisseur,
      garantieEcheance: i.garantieEcheance?.toISOString() ?? null,
      localisation: i.localisation, responsableNom: i.responsableNom,
      statut: i.statut, typeSortie: i.typeSortie, motifSortie: i.motifSortie,
      dateSortie: i.dateSortie?.toISOString() ?? null, valeurCession: i.valeurCession,
      origineArticleId: i.origineArticleId, creeParId: i.creeParId, version: i.version,
      amortiComptabilise,
      vncComptable: i.valeurBrute - amortiComptabilise,
      amortiTheorique: amortiTheo,
      vncTheorique: vncTheorique(params, maintenant),
      dotationDue,
      garantieExpire,
      plan,
      dotations: i.dotations.map((d) => ({
        id: d.id, periode: d.periode, montant: d.montant, cumulApres: d.cumulApres,
        vncApres: d.vncApres, date: d.dateComptabilisation.toISOString(), version: 0,
      })),
      maintenances: i.maintenances.map((m) => ({
        id: m.id, type: m.type, description: m.description, prestataire: m.prestataire,
        datePrevue: m.datePrevue?.toISOString() ?? null,
        dateRealisee: m.dateRealisee?.toISOString() ?? null,
        coutPrevu: m.coutPrevu, coutReel: m.coutReel, statut: m.statut, version: m.version,
      })),
      evenements: i.evenements.map((e) => ({
        id: e.id, type: e.type, description: e.description, montant: e.montant,
        parNom: e.parNom, date: e.date.toISOString(),
      })),
    };
  });

  const actifs = immobilisations.filter((i) => !i.dateSortie && i.statut !== "archive");
  const parCategorie = new Map<string, { nombre: number; valeurBrute: number; vnc: number }>();
  for (const i of actifs) {
    const e = parCategorie.get(i.categorie) ?? { nombre: 0, valeurBrute: 0, vnc: 0 };
    e.nombre += 1;
    e.valeurBrute += i.valeurBrute;
    e.vnc += i.vncComptable;
    parCategorie.set(i.categorie, e);
  }
  const tableauBord: TableauBordImmoVue = {
    nbActifs: actifs.length,
    valeurBrute: actifs.reduce((s, i) => s + i.valeurBrute, 0),
    amortissementsCumules: actifs.reduce((s, i) => s + i.amortiComptabilise, 0),
    valeurNette: actifs.reduce((s, i) => s + i.vncComptable, 0),
    enMaintenance: actifs.filter((i) => i.statut === "maintenance").length,
    horsService: actifs.filter((i) => i.statut === "hors_service").length,
    garantiesExpirant: actifs.filter((i) => i.garantieExpire).length,
    dotationsDues: actifs.filter((i) => i.dotationDue).length,
    parCategorie: [...parCategorie.entries()]
      .map(([categorie, v]) => ({ categorie, libelle: LIBELLE_CATEGORIE_IMMO[categorie] ?? categorie, ...v }))
      .sort((a, b) => b.valeurBrute - a.valeurBrute),
  };

  return { immobilisations, tableauBord };
}

/** Dotations annuelles DUES non encore comptabilisées (exercices échus ≤ année cible). */
export function dotationsDues(
  params: ParamsAmortissement,
  dejaComptabilisees: Set<string>,
  anneeCible: number,
): { annee: number; dotation: number; cumul: number; vnc: number }[] {
  return planAmortissement(params).filter(
    (l) => l.annee <= anneeCible && !dejaComptabilisees.has(String(l.annee)) && l.dotation > 0,
  );
}

/** Type de transaction Prisma (réutilisé par les actions). */
export type TxClient = Prisma.TransactionClient;
