import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  ContratFrsVue, DocumentFrsVue, DonneesFournisseursVue, EvaluationFrsVue,
  FicheFournisseurVue, TableauBordFournisseursVue,
} from "./types";
import { SEUIL_ALERTE_CONTRAT_JOURS, SEUIL_ALERTE_DOCUMENT_JOURS } from "./types";

/**
 * Domaine FOURNISSEURS (13) — chargeur du référentiel unique : fiches complètes (identité,
 * contacts, comptes bancaires, documents avec expirations DÉRIVÉES RM-1003, contrats avec
 * états dérivés, évaluations avec score global DÉRIVÉ RM-1004, litiges) + historique
 * achats/paiements agrégé depuis le 12 + tableau de bord et alertes.
 */

const JOUR_MS = 86_400_000;

/** Score global d'une évaluation (RM-1004) : moyenne des 5 critères, arrondie au dixième. */
export function scoreGlobalDe(e: {
  scoreQualite: number; scoreDelais: number; scorePrix: number; scoreService: number; scoreConformite: number;
}): number {
  return Math.round(((e.scoreQualite + e.scoreDelais + e.scorePrix + e.scoreService + e.scoreConformite) / 5) * 10) / 10;
}

function etatContrat(dateDebut: Date, dateFin: Date | null, maintenant: Date): string {
  if (dateDebut > maintenant) return "a_venir";
  if (!dateFin) return "en_cours";
  if (dateFin < maintenant) return "expire";
  const jours = Math.floor((dateFin.getTime() - maintenant.getTime()) / JOUR_MS);
  return jours <= SEUIL_ALERTE_CONTRAT_JOURS ? "echeance_proche" : "en_cours";
}

/** Charge le référentiel complet + tableau de bord (l'onglet Achats, section Fournisseurs). */
export async function chargerFichesFournisseurs(etablissementId: string): Promise<DonneesFournisseursVue> {
  const maintenant = new Date();
  const [fournisseurs, bonsEmis, facturesValidees, paiements, retours] = await Promise.all([
    prisma.fournisseur.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: { raisonSociale: "asc" },
      take: 200,
      include: {
        contacts: { where: { annuleLe: null }, orderBy: [{ principal: "desc" }, { creeLe: "asc" }] },
        comptesBancaires: { where: { annuleLe: null }, orderBy: [{ principal: "desc" }, { creeLe: "asc" }] },
        documents: { where: { annuleLe: null }, orderBy: { creeLe: "desc" } },
        contrats: { where: { annuleLe: null }, orderBy: { dateDebut: "desc" } },
        evaluations: { where: { annuleLe: null }, orderBy: { creeLe: "desc" } },
        litiges: { where: { annuleLe: null }, orderBy: { creeLe: "desc" } },
      },
    }),
    prisma.bonCommande.findMany({
      where: { etablissementId, annuleLe: null, statut: "emise" },
      select: {
        fournisseurId: true,
        lignes: { where: { annuleLe: null }, select: { quantite: true, prixUnitaire: true } },
      },
    }),
    prisma.factureFournisseur.groupBy({
      by: ["fournisseurId"],
      where: { etablissementId, annuleLe: null, statut: "validee" },
      _sum: { montant: true },
    }),
    prisma.paiementFournisseur.findMany({
      where: { etablissementId, annuleLe: null },
      select: { montant: true, facture: { select: { fournisseurId: true } } },
    }),
    prisma.retourFournisseur.findMany({
      where: { etablissementId, annuleLe: null },
      select: { bonCommande: { select: { fournisseurId: true } } },
    }),
  ]);

  const commandesParFrs = new Map<string, { nb: number; total: number }>();
  for (const bc of bonsEmis) {
    const e = commandesParFrs.get(bc.fournisseurId) ?? { nb: 0, total: 0 };
    e.nb += 1;
    e.total += bc.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    commandesParFrs.set(bc.fournisseurId, e);
  }
  const factureParFrs = new Map(facturesValidees.map((f) => [f.fournisseurId, f._sum.montant ?? 0]));
  const payeParFrs = new Map<string, number>();
  for (const p of paiements) {
    payeParFrs.set(p.facture.fournisseurId, (payeParFrs.get(p.facture.fournisseurId) ?? 0) + p.montant);
  }
  const retoursParFrs = new Map<string, number>();
  for (const r of retours) {
    retoursParFrs.set(r.bonCommande.fournisseurId, (retoursParFrs.get(r.bonCommande.fournisseurId) ?? 0) + 1);
  }

  const fiches: FicheFournisseurVue[] = fournisseurs.map((f) => {
    const documents: DocumentFrsVue[] = f.documents.map((d) => {
      const expire = d.dateExpiration !== null && d.dateExpiration < maintenant;
      const expireBientot =
        !expire && d.dateExpiration !== null &&
        (d.dateExpiration.getTime() - maintenant.getTime()) / JOUR_MS <= SEUIL_ALERTE_DOCUMENT_JOURS;
      return {
        id: d.id, type: d.type, reference: d.reference,
        dateEmission: d.dateEmission?.toISOString() ?? null,
        dateExpiration: d.dateExpiration?.toISOString() ?? null,
        numeroVersion: d.numeroVersion, expire, expireBientot, version: d.version,
      };
    });
    const contrats: ContratFrsVue[] = f.contrats.map((c) => ({
      id: c.id, reference: c.reference, objet: c.objet,
      dateDebut: c.dateDebut.toISOString(), dateFin: c.dateFin?.toISOString() ?? null,
      montant: c.montant, conditionsPaiement: c.conditionsPaiement, penalites: c.penalites,
      renouvellement: c.renouvellement, documentReference: c.documentReference,
      etat: etatContrat(c.dateDebut, c.dateFin, maintenant), version: c.version,
    }));
    const evaluations: EvaluationFrsVue[] = f.evaluations.map((e) => ({
      id: e.id, periode: e.periode,
      scoreQualite: e.scoreQualite, scoreDelais: e.scoreDelais, scorePrix: e.scorePrix,
      scoreService: e.scoreService, scoreConformite: e.scoreConformite,
      scoreGlobal: scoreGlobalDe(e), commentaire: e.commentaire, evalueParNom: e.evalueParNom,
      date: e.creeLe.toISOString(), version: e.version,
    }));
    const scoreGlobal =
      evaluations.length > 0
        ? Math.round((evaluations.reduce((s, e) => s + e.scoreGlobal, 0) / evaluations.length) * 10) / 10
        : null;
    const commandes = commandesParFrs.get(f.id) ?? { nb: 0, total: 0 };
    const totalFactureValidee = factureParFrs.get(f.id) ?? 0;
    const totalPaye = payeParFrs.get(f.id) ?? 0;
    const encours = totalFactureValidee - totalPaye;
    return {
      id: f.id, code: f.code, raisonSociale: f.raisonSociale, nomCommercial: f.nomCommercial,
      type: f.type, statut: f.statut,
      contactNom: f.contactNom, contactFonction: f.contactFonction,
      telephone: f.telephone, email: f.email, adresse: f.adresse, ville: f.ville,
      region: f.region, siteWeb: f.siteWeb, formeJuridique: f.formeJuridique,
      numeroRccm: f.numeroRccm, numeroFiscal: f.numeroFiscal, numeroCnps: f.numeroCnps,
      numeroTva: f.numeroTva, secteurActivite: f.secteurActivite,
      categoriesProduits: f.categoriesProduits, niveauStrategique: f.niveauStrategique,
      niveauRisque: f.niveauRisque, delaiPaiementJours: f.delaiPaiementJours,
      remisePourcent: f.remisePourcent, minimumCommande: f.minimumCommande,
      plafondCredit: f.plafondCredit, notes: f.notes, creeParId: f.creeParId,
      approuveParNom: f.approuveParNom,
      dateApprobation: f.dateApprobation?.toISOString() ?? null,
      version: f.version,
      scoreGlobal,
      plafondDepasse: f.plafondCredit !== null && encours > f.plafondCredit,
      contacts: f.contacts.map((c) => ({
        id: c.id, nom: c.nom, fonction: c.fonction, telephone: c.telephone, email: c.email,
        principal: c.principal, version: c.version,
      })),
      comptesBancaires: f.comptesBancaires.map((c) => ({
        id: c.id, banque: c.banque, agence: c.agence, numeroCompte: c.numeroCompte,
        iban: c.iban, swift: c.swift, mobileMoney: c.mobileMoney, principal: c.principal,
        version: c.version,
      })),
      documents,
      contrats,
      evaluations,
      litiges: f.litiges.map((l) => ({
        id: l.id, type: l.type, description: l.description, gravite: l.gravite,
        responsable: l.responsable, statut: l.statut, solution: l.solution,
        dateCloture: l.dateCloture?.toISOString() ?? null,
        ouvertParNom: l.ouvertParNom, cloParNom: l.cloParNom,
        date: l.creeLe.toISOString(), version: l.version,
      })),
      historique: {
        nbBonsCommande: commandes.nb,
        totalCommande: commandes.total,
        totalFactureValidee,
        totalPaye,
        encours,
        nbRetours: retoursParFrs.get(f.id) ?? 0,
      },
    };
  });

  const notes = fiches.flatMap((f) => (f.scoreGlobal !== null ? [f.scoreGlobal] : []));
  const tableauBord: TableauBordFournisseursVue = {
    actifs: fiches.filter((f) => f.statut === "actif").length,
    prospects: fiches.filter((f) => f.statut === "prospect").length,
    sousSurveillance: fiches.filter((f) => f.statut === "surveillance").length,
    suspendus: fiches.filter((f) => f.statut === "suspendu").length,
    strategiques: fiches.filter((f) => f.niveauStrategique === "strategique" && f.statut !== "archive").length,
    contratsAEcheance: fiches.reduce(
      (s, f) => s + f.contrats.filter((c) => c.etat === "echeance_proche").length, 0,
    ),
    documentsExpirant: fiches.reduce(
      (s, f) => s + f.documents.filter((d) => d.expire || d.expireBientot).length, 0,
    ),
    litigesOuverts: fiches.reduce((s, f) => s + f.litiges.filter((l) => l.statut === "ouvert").length, 0),
    scoreMoyen:
      notes.length > 0 ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null,
    top: [...fiches]
      .filter((f) => f.historique.totalFactureValidee > 0)
      .sort((a, b) => b.historique.totalFactureValidee - a.historique.totalFactureValidee)
      .slice(0, 5)
      .map((f) => ({ raisonSociale: f.raisonSociale, total: f.historique.totalFactureValidee })),
  };

  return { fiches, tableauBord };
}
