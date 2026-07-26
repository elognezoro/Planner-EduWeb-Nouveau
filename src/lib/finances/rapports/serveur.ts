import "server-only";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "../categories";
import { chargerComptabilite } from "../comptabilite/serveur";
import { chargerBudget } from "../budgets/serveur";
import { chargerCaisses } from "../caisse/serveur";
import { chargerBanques } from "../banque/serveur";
import { chargerFactures } from "../facturation/serveur";
import { chargerFichesFournisseurs } from "../fournisseurs/serveur";
import { chargerStocks } from "../stocks/serveur";
import { chargerImmobilisations } from "../immobilisations/serveur";
import { chargerDepenses } from "../depenses/serveur";
import { statistiquesRecouvrement } from "../scolarite/solde";
import { CATALOGUE_RAPPORTS, LIBELLE_CATEGORIE_RAPPORT, type RapportGenere } from "./catalogue";

/**
 * Domaine RAPPORTS (18) — moteur de RESTITUTION. Aucune donnée recréée : chaque rapport est
 * DÉRIVÉ des chargeurs des sous-modules (source unique de vérité). Renvoie une structure
 * tabulaire normalisée (colonnes typées + lignes) rendue par l'UI (aperçu + impression A4/A3)
 * et exportée en CSV/JSON par la route dédiée.
 */

const libelleCategorie = (code: string) =>
  CATEGORIES_OHADA.find((c) => c.code === code)?.libelle ?? code;

function base(code: string, titre: string, sousTitre: string, colonnes: RapportGenere["colonnes"]): Omit<RapportGenere, "lignes" | "totaux"> {
  const def = CATALOGUE_RAPPORTS.find((r) => r.code === code);
  return { code, titre, sousTitre, orientation: def?.orientation ?? "portrait", colonnes, genereLe: new Date().toISOString() };
}

/** Agrégats recettes/dépenses par catégorie OHADA (opérations + scolarité + économat). */
async function agregatsNature(etablissementId: string) {
  const [ops, paiements, ventes] = await Promise.all([
    prisma.operationFinanciere.groupBy({
      by: ["sens", "categorie"],
      where: { etablissementId, annule: false },
      _sum: { montant: true },
    }),
    prisma.paiementScolarite.aggregate({ where: { etablissementId, annule: false }, _sum: { montant: true } }),
    prisma.mouvementStock.aggregate({ where: { etablissementId, type: "vente", annuleLe: null }, _sum: { montant: true } }),
  ]);
  const recettes = new Map<string, number>();
  const depenses = new Map<string, number>();
  for (const o of ops) {
    const cible = o.sens === "recette" ? recettes : depenses;
    cible.set(o.categorie, (cible.get(o.categorie) ?? 0) + (o._sum.montant ?? 0));
  }
  recettes.set("7061", (recettes.get("7061") ?? 0) + (paiements._sum.montant ?? 0));
  recettes.set("707", (recettes.get("707") ?? 0) + (ventes._sum.montant ?? 0));
  return { recettes, depenses };
}

/**
 * GÉNÈRE un rapport DÉRIVÉ. La permission est vérifiée par l'appelant (action / route) ;
 * ici on produit uniquement les données. Renvoie null si le code est inconnu (404).
 */
export async function genererRapport(
  etablissementId: string,
  code: string,
  exercice: string,
): Promise<RapportGenere | null> {
  switch (code) {
    case "synthese-financiere": {
      const { recettes, depenses } = await agregatsNature(etablissementId);
      const totalR = [...recettes.values()].reduce((s, n) => s + n, 0);
      const totalD = [...depenses.values()].reduce((s, n) => s + n, 0);
      return {
        ...base(code, "Synthèse financière", `Exercice ${exercice}`, [
          { cle: "poste", libelle: "Poste", format: "texte" },
          { cle: "montant", libelle: "Montant", format: "fcfa" },
        ]),
        lignes: [
          { poste: "Total des recettes", montant: totalR },
          { poste: "Total des dépenses", montant: totalD },
          { poste: "Solde (recettes − dépenses)", montant: totalR - totalD },
        ],
        totaux: null,
      };
    }
    case "recettes-nature":
    case "depenses-nature": {
      const { recettes, depenses } = await agregatsNature(etablissementId);
      const carte = code === "recettes-nature" ? recettes : depenses;
      const lignes = [...carte.entries()]
        .filter(([, m]) => m !== 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([categorie, montant]) => ({ categorie, libelle: libelleCategorie(categorie), montant }));
      return {
        ...base(code, code === "recettes-nature" ? "Recettes par nature" : "Dépenses par nature", `Exercice ${exercice}`, [
          { cle: "categorie", libelle: "Compte", format: "texte" },
          { cle: "libelle", libelle: "Nature", format: "texte" },
          { cle: "montant", libelle: "Montant", format: "fcfa" },
        ]),
        lignes,
        totaux: { libelle: "Total", montant: lignes.reduce((s, l) => s + l.montant, 0) },
      };
    }
    case "balance-generale": {
      const c = await chargerComptabilite(etablissementId, exercice);
      const lignes = c.balanceFormelle.map((l) => ({
        compte: l.compteNumero, intitule: l.compteIntitule,
        debit: l.totalDebit, credit: l.totalCredit,
        soldeDebiteur: l.solde > 0 ? l.solde : 0, soldeCrediteur: l.solde < 0 ? -l.solde : 0,
      }));
      return {
        ...base(code, "Balance générale", `Registre formel — exercice ${exercice}`, [
          { cle: "compte", libelle: "Compte", format: "texte" },
          { cle: "intitule", libelle: "Intitulé", format: "texte" },
          { cle: "debit", libelle: "Total débit", format: "fcfa" },
          { cle: "credit", libelle: "Total crédit", format: "fcfa" },
          { cle: "soldeDebiteur", libelle: "Solde débiteur", format: "fcfa" },
          { cle: "soldeCrediteur", libelle: "Solde créditeur", format: "fcfa" },
        ]),
        lignes,
        totaux: {
          intitule: "Totaux",
          debit: lignes.reduce((s, l) => s + l.debit, 0),
          credit: lignes.reduce((s, l) => s + l.credit, 0),
          soldeDebiteur: lignes.reduce((s, l) => s + l.soldeDebiteur, 0),
          soldeCrediteur: lignes.reduce((s, l) => s + l.soldeCrediteur, 0),
        },
      };
    }
    case "journaux": {
      const c = await chargerComptabilite(etablissementId, exercice);
      const lignes = c.ecritures.map((e) => ({
        date: e.date, journal: e.journalCode, numero: e.numero ?? "—", libelle: e.libelle,
        piece: e.pieceJustificative, montant: e.totalDebit,
        statut: e.annulee ? "Annulée" : e.statut === "validee" ? "Validée" : "Brouillon",
      }));
      return {
        ...base(code, "Journal des écritures", `Exercice ${exercice} — ${lignes.length} écriture(s) récente(s)`, [
          { cle: "date", libelle: "Date", format: "date" },
          { cle: "journal", libelle: "Journal", format: "texte" },
          { cle: "numero", libelle: "Numéro", format: "texte" },
          { cle: "libelle", libelle: "Libellé", format: "texte" },
          { cle: "piece", libelle: "Pièce", format: "texte" },
          { cle: "montant", libelle: "Montant", format: "fcfa" },
          { cle: "statut", libelle: "Statut", format: "texte" },
        ]),
        lignes,
        totaux: null,
      };
    }
    case "balance-agee": {
      const c = await chargerComptabilite(etablissementId, exercice);
      return {
        ...base(code, "Balance âgée des créances", `Exercice ${exercice}`, [
          { cle: "tranche", libelle: "Tranche d'ancienneté", format: "texte" },
          { cle: "nombre", libelle: "Créances", format: "nombre" },
          { cle: "montant", libelle: "Reste dû", format: "fcfa" },
        ]),
        lignes: c.balanceAgee.tranches.map((t) => ({ tranche: t.libelle, nombre: t.nombre, montant: t.montant })),
        totaux: { tranche: "Total restant dû", nombre: c.balanceAgee.tranches.reduce((s, t) => s + t.nombre, 0), montant: c.balanceAgee.total },
      };
    }
    case "budget-execution": {
      const b = await chargerBudget(etablissementId, exercice);
      const lignes = b.execution.map((l) => ({
        categorie: l.categorie, libelle: l.libelle, vote: l.vote,
        engage: l.engageBC + l.engageManuel, consomme: l.consomme, disponible: l.disponible,
        taux: Math.round(l.tauxExecution * 100),
      }));
      return {
        ...base(code, "Exécution budgétaire", `Dépenses — exercice ${exercice}`, [
          { cle: "categorie", libelle: "Catégorie", format: "texte" },
          { cle: "libelle", libelle: "Libellé", format: "texte" },
          { cle: "vote", libelle: "Voté", format: "fcfa" },
          { cle: "engage", libelle: "Engagé", format: "fcfa" },
          { cle: "consomme", libelle: "Consommé", format: "fcfa" },
          { cle: "disponible", libelle: "Disponible", format: "fcfa" },
          { cle: "taux", libelle: "Taux", format: "pourcent" },
        ]),
        lignes,
        totaux: {
          libelle: "Totaux", vote: b.tableauBord.totalVote, engage: b.tableauBord.totalEngage,
          consomme: b.tableauBord.totalConsomme, disponible: b.tableauBord.totalDisponible,
          taux: Math.round(b.tableauBord.tauxExecution * 100),
        },
      };
    }
    case "budget-recettes": {
      const b = await chargerBudget(etablissementId, exercice);
      return {
        ...base(code, "Budget des recettes", `Prévu vs réalisé — exercice ${exercice}`, [
          { cle: "categorie", libelle: "Catégorie", format: "texte" },
          { cle: "libelle", libelle: "Libellé", format: "texte" },
          { cle: "vote", libelle: "Prévu", format: "fcfa" },
          { cle: "realise", libelle: "Réalisé", format: "fcfa" },
          { cle: "taux", libelle: "Taux", format: "pourcent" },
        ]),
        lignes: b.recettes.map((r) => ({ categorie: r.categorie, libelle: r.libelle, vote: r.vote, realise: r.realise, taux: Math.round(r.taux * 100) })),
        totaux: { libelle: "Totaux", vote: b.tableauBord.totalVoteRecettes, realise: b.tableauBord.totalRealiseRecettes, taux: null },
      };
    }
    case "tresorerie-caisses": {
      const c = await chargerCaisses(etablissementId);
      return {
        ...base(code, "Situation des caisses", `Au ${new Date().toLocaleDateString("fr-FR")}`, [
          { cle: "nom", libelle: "Caisse", format: "texte" },
          { cle: "type", libelle: "Type", format: "texte" },
          { cle: "statut", libelle: "Statut", format: "texte" },
          { cle: "ouverte", libelle: "Session ouverte", format: "texte" },
          { cle: "dernierSolde", libelle: "Dernier solde réel", format: "fcfa" },
        ]),
        lignes: c.caisses.map((k) => ({ nom: k.nom, type: k.type, statut: k.statut, ouverte: k.ouverte ? "Oui" : "Non", dernierSolde: k.dernierSoldeReel ?? 0 })),
        totaux: { nom: "Montant en caisse (sessions ouvertes)", dernierSolde: c.tableauBord.montantEnCaisse },
      };
    }
    case "tresorerie-banques": {
      const c = await chargerBanques(etablissementId);
      return {
        ...base(code, "Situation des comptes bancaires", `Au ${new Date().toLocaleDateString("fr-FR")}`, [
          { cle: "nom", libelle: "Compte", format: "texte" },
          { cle: "banque", libelle: "Banque", format: "texte" },
          { cle: "statut", libelle: "Statut", format: "texte" },
          { cle: "solde", libelle: "Solde calculé", format: "fcfa" },
          { cle: "soldePointe", libelle: "Solde pointé", format: "fcfa" },
          { cle: "ecart", libelle: "Écart relevé", format: "fcfa" },
        ]),
        lignes: c.comptes.map((k) => ({ nom: k.nom, banque: k.banque, statut: k.statut, solde: k.solde, soldePointe: k.soldePointe, ecart: k.ecartReleve ?? 0 })),
        totaux: { nom: "Solde global", solde: c.tableauBord.soldeGlobal },
      };
    }
    case "facturation": {
      const { factures } = await chargerFactures(etablissementId, null);
      const lignes = factures.map((f) => ({
        numero: f.numero ?? "—", eleve: f.eleveNom, objet: f.objet,
        montant: f.montantTotal, netDu: f.netDu, statut: f.statut,
      }));
      return {
        ...base(code, "Factures et créances", `${lignes.length} facture(s)`, [
          { cle: "numero", libelle: "Numéro", format: "texte" },
          { cle: "eleve", libelle: "Élève", format: "texte" },
          { cle: "objet", libelle: "Objet", format: "texte" },
          { cle: "montant", libelle: "Montant TTC", format: "fcfa" },
          { cle: "netDu", libelle: "Net dû", format: "fcfa" },
          { cle: "statut", libelle: "Statut", format: "texte" },
        ]),
        lignes,
        totaux: { objet: "Totaux", montant: lignes.reduce((s, l) => s + l.montant, 0), netDu: lignes.reduce((s, l) => s + l.netDu, 0) },
      };
    }
    case "achats-fournisseur": {
      const { fiches } = await chargerFichesFournisseurs(etablissementId);
      const lignes = fiches.map((f) => ({
        code: f.code, raisonSociale: f.raisonSociale, statut: f.statut,
        commande: f.historique.totalCommande, facture: f.historique.totalFactureValidee,
        paye: f.historique.totalPaye, encours: f.historique.encours,
      }));
      return {
        ...base(code, "Achats par fournisseur", `${lignes.length} fournisseur(s)`, [
          { cle: "code", libelle: "Code", format: "texte" },
          { cle: "raisonSociale", libelle: "Fournisseur", format: "texte" },
          { cle: "statut", libelle: "Statut", format: "texte" },
          { cle: "commande", libelle: "Commandé", format: "fcfa" },
          { cle: "facture", libelle: "Facturé", format: "fcfa" },
          { cle: "paye", libelle: "Payé", format: "fcfa" },
          { cle: "encours", libelle: "Encours", format: "fcfa" },
        ]),
        lignes,
        totaux: {
          raisonSociale: "Totaux",
          commande: lignes.reduce((s, l) => s + l.commande, 0),
          facture: lignes.reduce((s, l) => s + l.facture, 0),
          paye: lignes.reduce((s, l) => s + l.paye, 0),
          encours: lignes.reduce((s, l) => s + l.encours, 0),
        },
      };
    }
    case "stocks-valorisation": {
      const s = await chargerStocks(etablissementId);
      const lignes = s.situations.map((a) => ({
        article: a.nom, stock: a.stock, disponible: a.disponible,
        cump: a.cump ?? 0, valeur: a.valeur,
        alerte: a.rupture ? "Rupture" : a.sousSeuil ? "Sous seuil" : a.surstock ? "Surstock" : "",
      }));
      return {
        ...base(code, "Valorisation des stocks", `Au ${new Date().toLocaleDateString("fr-FR")}`, [
          { cle: "article", libelle: "Article", format: "texte" },
          { cle: "stock", libelle: "Stock", format: "nombre" },
          { cle: "disponible", libelle: "Disponible", format: "nombre" },
          { cle: "cump", libelle: "CUMP", format: "fcfa" },
          { cle: "valeur", libelle: "Valeur", format: "fcfa" },
          { cle: "alerte", libelle: "Alerte", format: "texte" },
        ]),
        lignes,
        totaux: { article: "Valeur totale", valeur: s.tableauBord.valeurTotale },
      };
    }
    case "immobilisations": {
      const i = await chargerImmobilisations(etablissementId);
      const actifs = i.immobilisations.filter((x) => !x.dateSortie && x.statut !== "archive");
      const lignes = actifs.map((x) => ({
        code: x.code, designation: x.designation, categorie: x.categorie,
        brute: x.valeurBrute, amorti: x.amortiComptabilise, vnc: x.vncComptable,
      }));
      return {
        ...base(code, "État du patrimoine et amortissements", `${lignes.length} actif(s)`, [
          { cle: "code", libelle: "Code", format: "texte" },
          { cle: "designation", libelle: "Désignation", format: "texte" },
          { cle: "categorie", libelle: "Catégorie", format: "texte" },
          { cle: "brute", libelle: "Valeur brute", format: "fcfa" },
          { cle: "amorti", libelle: "Amort. cumulé", format: "fcfa" },
          { cle: "vnc", libelle: "VNC", format: "fcfa" },
        ]),
        lignes,
        totaux: {
          designation: "Totaux",
          brute: i.tableauBord.valeurBrute, amorti: i.tableauBord.amortissementsCumules, vnc: i.tableauBord.valeurNette,
        },
      };
    }
    case "recettes-scolarite": {
      const { vue } = await statistiquesRecouvrement(etablissementId, exercice);
      return {
        ...base(code, "Recettes de scolarité (recouvrement)", `Exercice ${exercice}`, [
          { cle: "poste", libelle: "Poste", format: "texte" },
          { cle: "montant", libelle: "Montant", format: "fcfa" },
        ]),
        lignes: [
          { poste: "Attendu (créances)", montant: vue.attendu },
          { poste: "Encaissé", montant: vue.encaisse },
          { poste: "Reste à recouvrer", montant: vue.reste },
          { poste: "Remises accordées", montant: vue.totalRemises },
          { poste: "Exonérations", montant: vue.totalExonerations },
          { poste: "Bourses", montant: vue.totalBourses },
          { poste: "Pénalités appliquées", montant: vue.totalPenalites },
        ],
        totaux: { poste: `Taux de recouvrement : ${vue.taux} %`, montant: null },
      };
    }
    default:
      return null;
  }
}

/** Catégories du catalogue présentes, pour l'affichage groupé côté page. */
export function categoriesDuCatalogue(codes: string[]): { code: string; libelle: string }[] {
  const presentes = new Set(CATALOGUE_RAPPORTS.filter((r) => codes.includes(r.code)).map((r) => r.categorie));
  return [...presentes].map((code) => ({ code, libelle: LIBELLE_CATEGORIE_RAPPORT[code] ?? code }));
}
