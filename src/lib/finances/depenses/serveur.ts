import "server-only";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "../categories";
import type {
  AvanceVue, DepenseRecurrenteVue, DepenseVue, DonneesDepensesVue, TableauBordDepensesVue,
} from "./types";
import { PERIODICITES, SEUIL_APPROBATION_DIRECTION_DEPENSE } from "./types";

/**
 * Domaine DÉPENSES (17) — chargeur de l'onglet. Les consommations/engagements budgétaires
 * vivent dans le 16 (executionParCategorie) ; ici on expose les demandes, avances et
 * dépenses récurrentes avec leurs indicateurs.
 */

const libelleCategorie = (code: string) =>
  CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? code;

/** Ajoute N mois à une date (UTC). */
export function ajouterMois(date: Date, mois: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + mois, date.getUTCDate()));
}

export function moisDePeriodicite(code: string): number {
  return PERIODICITES.find((p) => p.code === code)?.mois ?? 1;
}

/** Charge l'onglet Dépenses : demandes, avances, récurrentes, tableau de bord. */
export async function chargerDepenses(etablissementId: string, exercice: string): Promise<DonneesDepensesVue> {
  const maintenant = new Date();
  const debutMois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  const [depensesBrutes, avancesBrutes, recurrentesBrutes, centres] = await Promise.all([
    prisma.demandeDepense.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: { creeLe: "desc" },
      take: 200,
    }),
    prisma.avanceFrais.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: { creeLe: "desc" },
      take: 100,
    }),
    prisma.depenseRecurrente.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: { prochaineEcheance: "asc" },
    }),
    prisma.centreCout.findMany({
      where: { etablissementId, annuleLe: null },
      select: { id: true, libelle: true },
    }),
  ]);
  const centreLibelle = new Map(centres.map((c) => [c.id, c.libelle]));

  const depenses: DepenseVue[] = depensesBrutes.map((d) => ({
    id: d.id, numero: d.numero, type: d.type, objet: d.objet, description: d.description,
    categorie: d.categorie, categorieLibelle: libelleCategorie(d.categorie),
    centreCoutLibelle: d.centreCoutId ? centreLibelle.get(d.centreCoutId) ?? null : null,
    service: d.service, projet: d.projet, beneficiaire: d.beneficiaire,
    montantEstime: d.montantEstime, montantValide: d.montantValide, urgence: d.urgence,
    pieceJustificative: d.pieceJustificative, statut: d.statut,
    demandeurId: d.demandeurId, demandeurNom: d.demandeurNom,
    decideParNom: d.decideParNom, dateDecision: d.dateDecision?.toISOString() ?? null,
    motifRefus: d.motifRefus, mode: d.mode, reference: d.reference,
    datePaiement: d.datePaiement?.toISOString() ?? null, payeParNom: d.payeParNom,
    approbationDirectionRequise: d.montantEstime > SEUIL_APPROBATION_DIRECTION_DEPENSE,
    date: d.creeLe.toISOString(), version: d.version,
  }));

  const avances: AvanceVue[] = avancesBrutes.map((a) => ({
    id: a.id, numero: a.numero, beneficiaireNom: a.beneficiaireNom, motif: a.motif, objet: a.objet,
    categorie: a.categorie, categorieLibelle: libelleCategorie(a.categorie),
    montant: a.montant, mode: a.mode, statut: a.statut,
    montantJustifie: a.montantJustifie, soldeType: a.soldeType,
    solde: a.statut === "decaissee" ? a.montant - (a.montantJustifie ?? 0) : null,
    decaisseParNom: a.decaisseParNom, dateRegularisation: a.dateRegularisation?.toISOString() ?? null,
    date: a.creeLe.toISOString(), version: a.version,
  }));

  const recurrentes: DepenseRecurrenteVue[] = recurrentesBrutes.map((r) => ({
    id: r.id, libelle: r.libelle, categorie: r.categorie, categorieLibelle: libelleCategorie(r.categorie),
    montant: r.montant, periodicite: r.periodicite, prochaineEcheance: r.prochaineEcheance.toISOString(),
    beneficiaire: r.beneficiaire, actif: r.actif,
    derniereGeneration: r.derniereGeneration?.toISOString() ?? null,
    echeanceDue: r.actif && r.prochaineEcheance <= maintenant,
    version: r.version,
  }));

  const payeesExercice = depensesBrutes.filter((d) => d.statut === "payee" && d.exercice === exercice);
  const tableauBord: TableauBordDepensesVue = {
    enAttente: depensesBrutes.filter((d) => d.statut === "soumise").length,
    approuveesNonPayees: depensesBrutes.filter((d) => d.statut === "approuvee").length,
    montantMois: payeesExercice
      .filter((d) => d.datePaiement && d.datePaiement >= debutMois)
      .reduce((s, d) => s + (d.montantValide ?? d.montantEstime), 0),
    montantExercice: payeesExercice.reduce((s, d) => s + (d.montantValide ?? d.montantEstime), 0),
    avancesEnCours: avancesBrutes.filter((a) => a.statut === "decaissee").length,
    recurrentesDues: recurrentes.filter((r) => r.echeanceDue).length,
  };

  return { exercice, depenses, avances, recurrentes, tableauBord };
}
