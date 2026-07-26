import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "../categories";
import { controleDisponibleBudget, executionParCategorie } from "../budgets/serveur";
import type {
  BonCommandeVue, DemandeAchatVue, DonneesAchatsVue, EngagementCategorieVue,
  FactureFournisseurVue, RetourVue, TableauBordAchatsVue,
} from "./types";
import { SEUIL_APPROBATION_DIRECTION_ACHAT } from "./types";

/**
 * Domaine ACHATS (12) — chargeurs d'états et contrôle budgétaire du cycle Procure-to-Pay.
 * Tous les statuts d'avancement (reçu/partiel, facturé, payé, en retard, engagements) sont
 * DÉRIVÉS en lecture — jamais stockés. Frontières : référentiel fournisseurs complet → 13 ;
 * valorisation de stock avancée (CUMP, lots) → 14 ; circuit général des dépenses → 17.
 */

const libelleCategorie = (code: string) =>
  CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? code;

/**
 * SITUATION BUDGÉTAIRE des achats par catégorie OHADA dépense — DÉLÈGUE au domaine 16-Budgets
 * (source unique de vérité, VOTÉ révisé + engagements manuels + dépenses directes). Conserve
 * la forme historique { prevu, consomme, engage } attendue par chargerAchats.
 */
export async function situationBudgetAchats(
  db: Prisma.TransactionClient,
  etablissementId: string,
  exercice: string,
): Promise<Map<string, { prevu: number | null; consomme: number; engage: number }>> {
  const execution = await executionParCategorie(db, etablissementId, exercice);
  const carte = new Map<string, { prevu: number | null; consomme: number; engage: number }>();
  for (const [categorie, a] of execution) {
    carte.set(categorie, {
      prevu: a.vote > 0 ? a.vote : null,
      consomme: a.consomme,
      engage: a.engageBC + a.engageManuel,
    });
  }
  return carte;
}

/**
 * CONTRÔLE BUDGÉTAIRE (12 « Budget insuffisant ») — DÉLÈGUE au 16 (RM-1300) : bloquant
 * seulement si un crédit est voté pour la catégorie ; sans budget, l'achat passe.
 */
export async function controleBudgetAchat(
  db: Prisma.TransactionClient,
  params: { etablissementId: string; exercice: string; categorie: string; montant: number },
): Promise<string | null> {
  return controleDisponibleBudget(db, params);
}

/** Charge l'onglet Achats : fournisseurs, demandes (+devis), bons (+lignes/réceptions), factures (+paiements), retours, engagements, KPI. */
export async function chargerAchats(etablissementId: string, exercice: string): Promise<DonneesAchatsVue> {
  const maintenant = new Date();
  const [fournisseursBruts, demandesBrutes, bonsBruts, facturesBrutes, retoursBruts, situation] =
    await Promise.all([
      prisma.fournisseur.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { raisonSociale: "asc" },
        select: {
          id: true, code: true, raisonSociale: true, nomCommercial: true, type: true,
          contactNom: true, contactFonction: true, telephone: true, email: true, adresse: true,
          ville: true, numeroRccm: true, numeroFiscal: true, statut: true, notes: true, version: true,
        },
      }),
      prisma.demandeAchat.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: {
          devis: {
            where: { annuleLe: null },
            orderBy: { montant: "asc" },
            include: { fournisseur: { select: { raisonSociale: true } } },
          },
        },
      }),
      prisma.bonCommande.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: {
          demande: { select: { numero: true, objet: true, categorieBudget: true } },
          fournisseur: { select: { raisonSociale: true } },
          lignes: {
            where: { annuleLe: null },
            orderBy: { ordre: "asc" },
            include: {
              lignesReception: {
                where: { reception: { annuleLe: null } },
                select: { quantiteRecue: true },
              },
              retours: { where: { annuleLe: null }, select: { quantite: true } },
            },
          },
          receptions: {
            where: { annuleLe: null },
            orderBy: { creeLe: "desc" },
            include: {
              lignes: {
                select: {
                  quantiteRecue: true, quantiteRefusee: true, observation: true,
                  ligneBonCommande: { select: { designation: true } },
                },
              },
            },
          },
          factures: {
            where: { annuleLe: null },
            select: { montant: true, statut: true, paiements: { where: { annuleLe: null }, select: { montant: true } } },
          },
        },
      }),
      prisma.factureFournisseur.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: {
          bonCommande: {
            select: {
              numero: true,
              lignes: { where: { annuleLe: null }, select: { quantite: true, prixUnitaire: true } },
            },
          },
          fournisseur: { select: { raisonSociale: true } },
          paiements: { where: { annuleLe: null }, orderBy: { creeLe: "desc" } },
        },
      }),
      prisma.retourFournisseur.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 50,
        include: {
          bonCommande: { select: { numero: true } },
          ligneBonCommande: { select: { designation: true } },
        },
      }),
      situationBudgetAchats(prisma, etablissementId, exercice),
    ]);

  const demandes: DemandeAchatVue[] = demandesBrutes.map((d) => ({
    id: d.id,
    numero: d.numero,
    typeAchat: d.typeAchat,
    objet: d.objet,
    justification: d.justification,
    service: d.service,
    centreCout: d.centreCout,
    urgence: d.urgence,
    categorieBudget: d.categorieBudget,
    categorieLibelle: libelleCategorie(d.categorieBudget),
    montantEstime: d.montantEstime,
    pieceJustificative: d.pieceJustificative,
    statut: d.statut,
    demandeurId: d.demandeurId,
    demandeurNom: d.demandeurNom,
    decideParNom: d.decideParNom,
    dateDecision: d.dateDecision?.toISOString() ?? null,
    motifRefus: d.motifRefus,
    approbationDirectionRequise: d.montantEstime > SEUIL_APPROBATION_DIRECTION_ACHAT,
    date: d.creeLe.toISOString(),
    version: d.version,
    devis: d.devis.map((v) => ({
      id: v.id, fournisseurId: v.fournisseurId, fournisseurNom: v.fournisseur.raisonSociale,
      montant: v.montant, delaiJours: v.delaiJours, conditions: v.conditions,
      pieceReference: v.pieceReference, retenu: v.retenu, version: v.version,
    })),
  }));

  const bonsCommande: BonCommandeVue[] = bonsBruts.map((bc) => {
    const lignes = bc.lignes.map((l) => ({
      id: l.id,
      articleId: l.articleId,
      designation: l.designation,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      total: l.quantite * l.prixUnitaire,
      quantiteRecue: l.lignesReception.reduce((s, r) => s + r.quantiteRecue, 0),
      quantiteRetournee: l.retours.reduce((s, r) => s + r.quantite, 0),
    }));
    const totalCommande = lignes.reduce((s, l) => s + l.total, 0);
    const totalRecu = lignes.reduce((s, l) => s + l.quantiteRecue, 0);
    const receptionTotale = lignes.length > 0 && lignes.every((l) => l.quantiteRecue >= l.quantite);
    const etatReception = receptionTotale ? "totale" : totalRecu > 0 ? "partielle" : "aucune";
    return {
      id: bc.id,
      numero: bc.numero,
      statut: bc.statut,
      demandeId: bc.demandeId,
      demandeNumero: bc.demande.numero,
      demandeObjet: bc.demande.objet,
      categorieBudget: bc.demande.categorieBudget,
      fournisseurId: bc.fournisseurId,
      fournisseurNom: bc.fournisseur.raisonSociale,
      conditionsPaiement: bc.conditionsPaiement,
      lieuLivraison: bc.lieuLivraison,
      dateLivraisonPrevue: bc.dateLivraisonPrevue?.toISOString() ?? null,
      dateEmission: bc.dateEmission?.toISOString() ?? null,
      emisParNom: bc.emisParNom,
      motifAnnulation: bc.motifAnnulation,
      totalCommande,
      totalFacture: bc.factures.reduce((s, f) => s + f.montant, 0),
      totalFactureValidee: bc.factures.filter((f) => f.statut === "validee").reduce((s, f) => s + f.montant, 0),
      totalPaye: bc.factures.reduce((s, f) => s + f.paiements.reduce((x, p) => x + p.montant, 0), 0),
      etatReception,
      enRetard:
        bc.statut === "emise" && !receptionTotale &&
        bc.dateLivraisonPrevue !== null && bc.dateLivraisonPrevue < maintenant,
      date: bc.creeLe.toISOString(),
      version: bc.version,
      lignes,
      receptions: bc.receptions.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        receptionnaireNom: r.receptionnaireNom,
        observations: r.observations,
        version: r.version,
        lignes: r.lignes.map((lr) => ({
          designation: lr.ligneBonCommande.designation,
          quantiteRecue: lr.quantiteRecue,
          quantiteRefusee: lr.quantiteRefusee,
          observation: lr.observation,
        })),
      })),
    };
  });

  const factures: FactureFournisseurVue[] = facturesBrutes.map((f) => {
    const totalPaye = f.paiements.reduce((s, p) => s + p.montant, 0);
    const totalBc = f.bonCommande.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    const reste = f.montant - totalPaye;
    return {
      id: f.id,
      bonCommandeId: f.bonCommandeId,
      bonCommandeNumero: f.bonCommande.numero,
      fournisseurNom: f.fournisseur.raisonSociale,
      numeroFournisseur: f.numeroFournisseur,
      date: f.date.toISOString(),
      montant: f.montant,
      taxes: f.taxes,
      dateEcheance: f.dateEcheance?.toISOString() ?? null,
      pieceJustificative: f.pieceJustificative,
      statut: f.statut,
      valideeParNom: f.valideeParNom,
      motifAnnulation: f.motifAnnulation,
      totalPaye,
      reste,
      enRetard: f.statut === "validee" && reste > 0 && f.dateEcheance !== null && f.dateEcheance < maintenant,
      ecartCommande: f.montant - totalBc,
      version: f.version,
      paiements: f.paiements.map((p) => ({
        id: p.id, montant: p.montant, mode: p.mode, reference: p.reference,
        date: p.date.toISOString(), payeParNom: p.payeParNom, version: p.version,
      })),
    };
  });

  const retours: RetourVue[] = retoursBruts.map((r) => ({
    id: r.id,
    numero: r.numero,
    bonCommandeNumero: r.bonCommande.numero,
    designation: r.ligneBonCommande.designation,
    quantite: r.quantite,
    motif: r.motif,
    retourneParNom: r.retourneParNom,
    date: r.date.toISOString(),
  }));

  const engagements: EngagementCategorieVue[] = [...situation.entries()]
    .map(([categorie, s]) => ({
      categorie,
      libelle: libelleCategorie(categorie),
      prevu: s.prevu,
      consomme: s.consomme,
      engage: s.engage,
      disponible: s.prevu === null ? null : s.prevu - s.consomme - s.engage,
    }))
    .filter((e) => e.consomme > 0 || e.engage > 0 || e.prevu !== null)
    .sort((a, b) => a.categorie.localeCompare(b.categorie));

  const tableauBord: TableauBordAchatsVue = {
    demandesEnValidation: demandes.filter((d) => d.statut === "soumise").length,
    bonsEnCours: bonsCommande.filter((b) => b.statut === "emise" && b.etatReception !== "totale").length,
    bonsEnRetard: bonsCommande.filter((b) => b.enRetard).length,
    facturesAValider: factures.filter((f) => f.statut === "saisie").length,
    facturesEchues: factures.filter((f) => f.enRetard).length,
    montantAchatsExercice: [...situation.values()].reduce((s, e) => s + e.consomme, 0),
    totalEngage: [...situation.values()].reduce((s, e) => s + e.engage, 0),
  };

  return { fournisseurs: fournisseursBruts, demandes, bonsCommande, factures, retours, engagements, tableauBord };
}
