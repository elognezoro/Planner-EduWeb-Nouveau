import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sensMouvementBancaire,
  type ChequeVue, type CompteBancaireVue, type MouvementBancaireVue,
  type TableauBordBanqueVue, type VersementEnAttenteVue,
} from "./types";

/**
 * Domaine BANQUE (10) — calculs et chargeurs serveur (aucune action ici, cf. 02B).
 *
 * Le SOLDE d'un compte est CALCULÉ : soldeInitial + Σ mouvements actifs signés (jamais
 * stocké). Le rapprochement PAR COMPTE compare le solde POINTÉ (mouvements rapprochés) au
 * dernier RELEVÉ saisi du compte — les opérations non pointées sont « en attente », l'écart
 * est identifié automatiquement (10). Le rapprochement GLOBAL historique (paiements/
 * opérations ↔ relevé mensuel) reste inchangé dans l'onglet Rapprochement.
 */

/** Solde signé d'une liste d'agrégats (groupBy type) de mouvements bancaires. */
function soldeDepuisAgregats(soldeInitial: number, rangs: { type: string; _sum: { montant: number | null } }[]): number {
  return rangs.reduce(
    (s, r) => s + sensMouvementBancaire(r.type) * (r._sum.montant ?? 0),
    soldeInitial,
  );
}

/** Solde THÉORIQUE d'un compte, calculé DANS une transaction (contrôles de sortie). */
export async function soldeCompte(
  db: Prisma.TransactionClient,
  compteId: string,
  soldeInitial: number,
): Promise<number> {
  const rangs = await db.mouvementBancaire.groupBy({
    by: ["type"],
    where: { compteId, annuleLe: null },
    _sum: { montant: true },
  });
  return soldeDepuisAgregats(soldeInitial, rangs);
}

const nomPersonne = (p: { nom: string | null; prenoms: string | null } | null) =>
  p ? [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—" : "—";

/** Charge comptes (soldes calculés, rapprochement, alertes), mouvements, chèques, versements en attente. */
export async function chargerBanques(etablissementId: string): Promise<{
  comptes: CompteBancaireVue[];
  mouvements: MouvementBancaireVue[];
  cheques: ChequeVue[];
  versementsEnAttente: VersementEnAttenteVue[];
  tableauBord: TableauBordBanqueVue;
}> {
  const maintenant = new Date();
  const debutJour = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  const debutAnnee = new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));

  const [comptesBruts, agregats, agregatsPointes, mouvementsBruts, chequesBruts, relevesComptes, versementsCaisse, confirmes, fraisAnnee, virementsJour] =
    await Promise.all([
      prisma.compteBancaire.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { nom: "asc" },
        include: { responsable: { select: { nom: true, prenoms: true } } },
      }),
      prisma.mouvementBancaire.groupBy({
        by: ["compteId", "type"],
        where: { etablissementId, annuleLe: null },
        _sum: { montant: true },
      }),
      prisma.mouvementBancaire.groupBy({
        by: ["compteId", "type"],
        where: { etablissementId, annuleLe: null, pointeLe: { not: null } },
        _sum: { montant: true },
      }),
      prisma.mouvementBancaire.findMany({
        where: { etablissementId },
        orderBy: { dateOperation: "desc" },
        take: 200,
        include: { compte: { select: { nom: true } } },
      }),
      prisma.cheque.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 100,
        include: { compte: { select: { nom: true } } },
      }),
      prisma.releveBancaire.findMany({
        where: { etablissementId, compteId: { not: null }, annuleLe: null },
        orderBy: { mois: "desc" },
        select: { compteId: true, mois: true, solde: true },
      }),
      prisma.mouvementCaisse.findMany({
        where: { etablissementId, type: "versement_banque", annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 100,
        select: {
          id: true, montant: true, motif: true, creeLe: true,
          session: { select: { caisse: { select: { nom: true } }, caissier: { select: { nom: true, prenoms: true } } } },
        },
      }),
      prisma.mouvementBancaire.findMany({
        where: { etablissementId, mouvementCaisseId: { not: null }, annuleLe: null },
        select: { mouvementCaisseId: true },
      }),
      prisma.mouvementBancaire.aggregate({
        where: { etablissementId, type: "frais_bancaires", annuleLe: null, dateOperation: { gte: debutAnnee } },
        _sum: { montant: true },
      }),
      prisma.mouvementBancaire.aggregate({
        where: {
          etablissementId, annuleLe: null, dateOperation: { gte: debutJour },
          type: { in: ["virement_entrant", "virement_sortant", "virement_interne_entree", "virement_interne_sortie"] },
        },
        _sum: { montant: true },
      }),
    ]);

  // Regroupements par compte.
  const parCompte = new Map<string, { type: string; _sum: { montant: number | null } }[]>();
  for (const r of agregats) {
    const liste = parCompte.get(r.compteId) ?? [];
    liste.push(r);
    parCompte.set(r.compteId, liste);
  }
  const pointesParCompte = new Map<string, { type: string; _sum: { montant: number | null } }[]>();
  for (const r of agregatsPointes) {
    const liste = pointesParCompte.get(r.compteId) ?? [];
    liste.push(r);
    pointesParCompte.set(r.compteId, liste);
  }
  const dernierReleveParCompte = new Map<string, { mois: string; solde: number }>();
  for (const r of relevesComptes) {
    if (r.compteId && !dernierReleveParCompte.has(r.compteId)) {
      dernierReleveParCompte.set(r.compteId, { mois: r.mois, solde: r.solde });
    }
  }
  const nonPointesParCompte = new Map<string, number>();
  for (const m of mouvementsBruts) {
    if (!m.annuleLe && !m.pointeLe) {
      nonPointesParCompte.set(m.compteId, (nonPointesParCompte.get(m.compteId) ?? 0) + 1);
    }
  }
  const chequesEnCirculation = chequesBruts.filter((c) => c.statut === "en_circulation").length;

  const comptes: CompteBancaireVue[] = comptesBruts.map((c) => {
    const solde = soldeDepuisAgregats(c.soldeInitial, parCompte.get(c.id) ?? []);
    const soldePointe = soldeDepuisAgregats(c.soldeInitial, pointesParCompte.get(c.id) ?? []);
    const dernierReleve = dernierReleveParCompte.get(c.id) ?? null;
    const ecartReleve = dernierReleve ? dernierReleve.solde - soldePointe : null;
    const alertes: string[] = [];
    if (c.seuilAlerte !== null && solde < c.seuilAlerte) {
      alertes.push(`Solde faible (seuil ${c.seuilAlerte.toLocaleString("fr-FR")} F)`);
    }
    if (solde < 0) alertes.push("Solde négatif");
    if (ecartReleve !== null && ecartReleve !== 0) {
      alertes.push(`Écart de rapprochement : ${ecartReleve > 0 ? "+" : ""}${ecartReleve.toLocaleString("fr-FR")} F`);
    }
    return {
      id: c.id, nom: c.nom, code: c.code, type: c.type, banque: c.banque, agence: c.agence,
      numeroCompte: c.numeroCompte, iban: c.iban, swift: c.swift,
      responsableId: c.responsableId, responsableNom: c.responsable ? nomPersonne(c.responsable) : null,
      soldeInitial: c.soldeInitial, seuilAlerte: c.seuilAlerte, statut: c.statut, devise: c.devise,
      solde, soldePointe,
      nonPointes: nonPointesParCompte.get(c.id) ?? 0,
      dernierReleve, ecartReleve, alertes,
      version: c.version,
    };
  });

  const idsConfirmes = new Set(confirmes.map((m) => m.mouvementCaisseId).filter((id): id is string => !!id));
  const versementsEnAttente: VersementEnAttenteVue[] = versementsCaisse
    .filter((v) => !idsConfirmes.has(v.id))
    .map((v) => ({
      mouvementCaisseId: v.id,
      caisseNom: v.session.caisse.nom,
      caissierNom: nomPersonne(v.session.caissier),
      montant: v.montant,
      date: v.creeLe.toISOString(),
      motif: v.motif,
    }));

  return {
    comptes,
    mouvements: mouvementsBruts.map((m) => ({
      id: m.id, compteId: m.compteId, compteNom: m.compte.nom, type: m.type, montant: m.montant,
      libelle: m.libelle, reference: m.reference, pieceJustificative: m.pieceJustificative,
      beneficiaire: m.beneficiaire, mouvementCaisseId: m.mouvementCaisseId, chequeId: m.chequeId,
      dateOperation: m.dateOperation.toISOString(),
      pointe: m.pointeLe !== null, annule: m.annuleLe !== null, version: m.version,
    })),
    cheques: chequesBruts.map((c) => ({
      id: c.id, sens: c.sens, numero: c.numero, banque: c.banque, montant: c.montant,
      dateEmission: c.dateEmission.toISOString(), emetteur: c.emetteur, beneficiaire: c.beneficiaire,
      paiementId: c.paiementId, compteNom: c.compte?.nom ?? null, statut: c.statut,
      motifStatut: c.motifStatut, version: c.version,
    })),
    versementsEnAttente,
    tableauBord: {
      soldeGlobal: comptes.filter((c) => c.statut !== "ferme").reduce((s, c) => s + c.solde, 0),
      comptesActifs: comptes.filter((c) => c.statut === "actif").length,
      depotsEnAttente: versementsEnAttente.reduce((s, v) => s + v.montant, 0),
      virementsDuJour: virementsJour._sum.montant ?? 0,
      fraisAnnee: fraisAnnee._sum.montant ?? 0,
      chequesEnCirculation,
    },
  };
}
