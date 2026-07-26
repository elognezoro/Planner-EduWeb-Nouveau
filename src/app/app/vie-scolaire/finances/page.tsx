import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
import { assurerCategoriesDefaut } from "@/lib/finances/scolarite/generation";
import { statistiquesRecouvrement } from "@/lib/finances/scolarite/solde";
import {
  droitsUiPourRole, permissionsDuRole, ROLES_FINANCE, type DelegationVue, type PersonnelVue,
} from "@/lib/finances/commun/permissions";
import { chargerFactures } from "@/lib/finances/facturation/serveur";
import { statistiquesEncaissements } from "@/lib/finances/encaissements/serveur";
import { chargerCaisses } from "@/lib/finances/caisse/serveur";
import { chargerBanques } from "@/lib/finances/banque/serveur";
import { assurerPlanComptable, chargerComptabilite } from "@/lib/finances/comptabilite/serveur";
import type { RegistreComptableVue } from "@/lib/finances/comptabilite/types";
import { chargerAchats } from "@/lib/finances/achats/serveur";
import type { DonneesAchatsVue } from "@/lib/finances/achats/types";
import { chargerFichesFournisseurs } from "@/lib/finances/fournisseurs/serveur";
import type { DonneesFournisseursVue } from "@/lib/finances/fournisseurs/types";
import { chargerStocks } from "@/lib/finances/stocks/serveur";
import type { DonneesStocksVue } from "@/lib/finances/stocks/types";
import { chargerImmobilisations } from "@/lib/finances/immobilisations/serveur";
import type { DonneesImmobilisationsVue } from "@/lib/finances/immobilisations/types";
import { paysConsulte } from "@/lib/pays-consulte";
import { SelecteurEtablissementFinances } from "./selecteur-etablissement";
import type {
  ApercuBlocageVue, BourseVue, CategorieFraisVue, ExonerationVue, RecouvrementVue,
  RegleBlocageVue, ReglePenaliteVue, RemboursementVue,
} from "@/lib/finances/scolarite/types";
import { PageHeader, Card } from "@/components/app/ui";
import { FinancesVue } from "./finances-vue";
import type {
  FraisVue,
  EleveVue,
  PaiementVue,
  RemiseVue,
  ImpayeVue,
  OperationVue,
  ArticleVue,
  MouvementVue,
  ReleveVue,
  BudgetVue,
  RealiseVue,
  ClotureVue,
} from "./types";

export const metadata: Metadata = { title: "Finances de l'établissement" };
export const dynamic = "force-dynamic";

// Accès à la page : rôles de la FAMILLE FINANCE (04-Profils) + direction + admins — la liste
// vit dans le registre central (src/lib/finances/commun/permissions.ts, cf. navigation.ts) ;
// chaque écriture est ensuite bornée par sa permission atomique, côté serveur.
const MODES = ["especes", "mobile_money", "cheque", "virement", "carte"] as const;

const nomPersonne = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

const capitaliser = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ etablissement?: string }>;
}) {
  const u = await requireRole([...ROLES_FINANCE]);
  let etablissementId = u.portee.etablissementId;

  // ── Sélecteur d'établissement pour l'ADMIN GLOBAL non rattaché (ergonomie 09) ──
  // Liste bornée au PAYS CONSULTÉ (cloisonnement pays, cf. règle « RBAC écriture nationale ») ;
  // le searchParam `?etablissement=` n'est accepté QUE si l'établissement appartient à ce
  // périmètre. AUCUN élargissement de droits : la garde exigerPermissionFinance acceptait déjà
  // l'admin sur tout établissement — seule l'ergonomie de sélection est ajoutée. Pour tous les
  // autres rôles, comportement STRICTEMENT inchangé (rattachement de session).
  let etablissementsSelecteur: { id: string; nom: string; ville: string | null }[] = [];
  const modeSelecteur = !etablissementId && u.roleReel === "admin";
  if (modeSelecteur) {
    const pays = await paysConsulte();
    etablissementsSelecteur = await prisma.etablissement.findMany({
      where: { pays },
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, ville: true },
    });
    const demande = String((await searchParams).etablissement ?? "").trim();
    if (demande && etablissementsSelecteur.some((e) => e.id === demande)) {
      etablissementId = demande; // CONTRÔLE SERVEUR STRICT : uniquement dans le périmètre pays
    }
  }

  if (!etablissementId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          titre="Finances de l'établissement"
          description="Scolarité, caisse & banque et économat : encaissements, dépenses, remises, stocks et rapports financiers."
        />
        {modeSelecteur ? (
          <SelecteurEtablissementFinances etablissements={etablissementsSelecteur} valeur={null} />
        ) : (
          <Card>
            <p className="text-sm text-ink-700/70">
              Rattachez votre compte à un établissement pour gérer ses finances.
            </p>
          </Card>
        )}
      </div>
    );
  }

  const peutEcrire = !u.apercuActif;
  // Droits GROSSIERS d'affichage par onglet (matrice rôle → permissions) — le serveur reste
  // seul juge : chaque action vérifie sa permission atomique (exigerPermissionFinance).
  const droits = droitsUiPourRole(u.roleActif);
  // 12-Achats : l'onglet distingue la GESTION du cycle (gestionnaire/économe/direction) de
  // la seule RÉCEPTION (magasinier — 04 P-008). Affichage seulement : le serveur reste juge
  // (une délégation active peut élargir les droits — les actions la prennent en compte).
  const permsRole = permissionsDuRole(u.roleActif);
  const droitsAchats = {
    gestion: permsRole.has("finance.achats.demander"),
    reception: permsRole.has("finance.achats.receptionner"),
  };
  // 14-Stocks : drapeaux fins du volet « Magasins & stocks » (serveur seul juge).
  const droitsStocks = {
    mouvementer: permsRole.has("finance.stocks.mouvementer"),
    gerer: permsRole.has("finance.stocks.gerer"),
    inventorier: permsRole.has("finance.stocks.inventorier"),
    valider: permsRole.has("finance.stocks.valider"),
  };
  // 15-Immobilisations : drapeaux fins de l'onglet patrimoine (serveur seul juge).
  const droitsImmo = {
    gerer: permsRole.has("finance.immobilisations.gerer"),
    amortir: permsRole.has("finance.immobilisations.amortir"),
    sortir: permsRole.has("finance.immobilisations.sortir"),
  };

  // 06-Scolarite : semis idempotent des 4 catégories de frais par défaut (première utilisation).
  if (peutEcrire && droits.scolarite) {
    try {
      await assurerCategoriesDefaut(etablissementId, u.id);
    } catch (e) {
      console.error("[finances] semis catégories :", e);
    }
  }

  // 11-Comptabilité : semis idempotent du plan comptable OHADA simplifié + 7 journaux
  // (première utilisation — le 11A affinera le plan par AJOUT de comptes, sans reprise).
  if (peutEcrire && droits.comptabilite) {
    try {
      await assurerPlanComptable(etablissementId, u.id);
    } catch (e) {
      console.error("[finances] semis plan comptable :", e);
    }
  }

  const [etablissement, anneeActive, niveaux] = await Promise.all([
    prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: {
        nom: true, pays: true, ministere: true, anneeScolaire: true, emblemeUrl: true, sloganBulletin: true,
        fonctionChef: true, nomChef: true, prenomsChef: true,
      },
    }),
    prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } }),
    prisma.niveau.findMany({ orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
  ]);

  const filtreInscriptionAnnee = anneeActive ? { anneeScolaireId: anneeActive.id } : undefined;
  const niveauxMap = new Map(niveaux.map((n) => [n.id, n.nom]));
  const maintenant = new Date();
  const debutMois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  const exercice = etablissement?.anneeScolaire ?? String(maintenant.getFullYear());

  const [
    fraisBruts,
    remisesBrutes,
    elevesBruts,
    paiementsBruts,
    operationsBrutes,
    articlesBruts,
    mouvementsBruts,
    paiementsParMode,
    ventesParMode,
    operationsParModeSens,
    paiementsParEleve,
    operationsParCategorieAnnee,
    operationsParCategorieMois,
    paiementsMoisAgg,
    ventesMoisAgg,
    relevesBruts,
    budgetsBruts,
    cloturesBrutes,
  ] = await Promise.all([
    prisma.fraisScolarite.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: [{ actif: "desc" }, { libelle: "asc" }],
      select: {
        id: true, libelle: true, montant: true, niveauId: true, obligatoire: true, actif: true, tranches: true, version: true,
        code: true, description: true, categorieId: true, serie: true, cycle: true, statutEleve: true,
        dateDebut: true, dateFin: true, modeCalcul: true,
      },
    }),
    // RM-004 : les remises ANNULÉES (retirées) restent en base mais disparaissent des lectures.
    prisma.remiseEleve.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: { creeLe: "desc" },
      select: {
        id: true, eleveId: true, type: true, libelle: true, montant: true, pourcentage: true, fraisId: true,
        eleve: { select: { nom: true, prenoms: true } },
      },
    }),
    prisma.utilisateur.findMany({
      where: { etablissementId, roleActif: { nomTechnique: "eleve" }, statutCompte: "actif" },
      orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
      select: {
        id: true, nom: true, prenoms: true, matricule: true,
        inscriptions: { where: filtreInscriptionAnnee, take: 1, select: { classe: { select: { nom: true, niveauId: true } } } },
      },
    }),
    prisma.paiementScolarite.findMany({
      where: { etablissementId },
      orderBy: { date: "desc" },
      take: 300,
      select: {
        id: true, numeroRecu: true, eleveId: true, libelle: true, montant: true, mode: true, reference: true,
        date: true, annule: true, motifAnnulation: true, pointeLe: true, version: true,
        eleve: {
          select: {
            nom: true, prenoms: true,
            inscriptions: { where: filtreInscriptionAnnee, take: 1, select: { classe: { select: { nom: true } } } },
          },
        },
      },
    }),
    prisma.operationFinanciere.findMany({
      where: { etablissementId },
      orderBy: { date: "desc" },
      take: 300,
      select: { id: true, sens: true, categorie: true, libelle: true, montant: true, mode: true, reference: true, date: true, annule: true, pointeLe: true, version: true },
    }),
    prisma.articleEconomat.findMany({
      where: { etablissementId },
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      select: { id: true, nom: true, categorie: true, prixVente: true, prixAchat: true, stock: true, seuilAlerte: true, actif: true, version: true },
    }),
    // Pas de relation Prisma « eleve » sur MouvementStock (eleveId est une référence libre,
    // non contrainte) : le nom de l'acheteur élève est résolu séparément ci-dessous.
    prisma.mouvementStock.findMany({
      where: { etablissementId },
      orderBy: { date: "desc" },
      take: 100,
      select: {
        id: true, type: true, quantite: true, montant: true, mode: true, acheteur: true, date: true, eleveId: true,
        article: { select: { nom: true } },
      },
    }),
    // ── Agrégats KPI (portent sur TOUT l'historique, pas seulement les listes plafonnées ci-dessus) ──
    prisma.paiementScolarite.groupBy({ by: ["mode"], where: { etablissementId, annule: false }, _sum: { montant: true } }),
    prisma.mouvementStock.groupBy({ by: ["mode"], where: { etablissementId, type: "vente" }, _sum: { montant: true } }),
    prisma.operationFinanciere.groupBy({ by: ["mode", "sens"], where: { etablissementId, annule: false }, _sum: { montant: true } }),
    prisma.paiementScolarite.groupBy({ by: ["eleveId"], where: { etablissementId, annule: false }, _sum: { montant: true } }),
    prisma.operationFinanciere.groupBy({ by: ["categorie", "sens"], where: { etablissementId, annule: false }, _sum: { montant: true } }),
    prisma.operationFinanciere.groupBy({
      by: ["categorie", "sens"],
      where: { etablissementId, annule: false, date: { gte: debutMois } },
      _sum: { montant: true },
    }),
    prisma.paiementScolarite.aggregate({ where: { etablissementId, annule: false, date: { gte: debutMois } }, _sum: { montant: true } }),
    prisma.mouvementStock.aggregate({ where: { etablissementId, type: "vente", date: { gte: debutMois } }, _sum: { montant: true } }),
    prisma.releveBancaire.findMany({
      where: { etablissementId },
      orderBy: { mois: "desc" },
      take: 24,
      select: { mois: true, solde: true },
    }),
    prisma.budgetLigne.findMany({
      where: { etablissementId, exercice },
      select: { categorie: true, sens: true, montantPrevu: true },
    }),
    // RM-004 : les clôtures ANNULÉES (exercices rouverts) restent en base mais disparaissent des lectures.
    prisma.clotureExercice.findMany({
      where: { etablissementId, annuleLe: null },
      orderBy: { finPeriode: "desc" },
      select: { id: true, exercice: true, finPeriode: true, resultat: true, soldes: true, notes: true },
    }),
  ]);

  // ── Sous-module Scolarité (06) : catégories, règles, recouvrement, aides ──
  const [categoriesBrutes, reglesPenalitesBrutes, reglesBlocageBrutes, classesBrutes, remboursementsBruts, exonerationsBrutes, boursesBrutes, recStats] =
    await Promise.all([
      prisma.categorieFrais.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: [{ ordreImputation: "asc" }, { nom: "asc" }],
        select: { id: true, nom: true, code: true, ordreImputation: true, actif: true, version: true },
      }),
      prisma.reglePenalite.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "asc" },
        select: { id: true, declencheur: true, type: true, valeur: true, delaiJours: true, actif: true, version: true },
      }),
      prisma.regleBlocage.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { type: "asc" },
        select: { id: true, type: true, seuilImpaye: true, actif: true, version: true },
      }),
      prisma.classe.findMany({
        where: { etablissementId, ...(anneeActive ? { anneeScolaireId: anneeActive.id } : {}) },
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      prisma.demandeRemboursement.findMany({
        where: { etablissementId, annuleLe: null, statut: { in: ["demandee", "validee"] } },
        orderBy: { creeLe: "desc" },
        take: 100,
        select: {
          id: true, eleveId: true, paiementId: true, montant: true, motif: true, statut: true,
          dateValidation: true, version: true, eleve: { select: { nom: true, prenoms: true } },
        },
      }),
      prisma.exonerationEleve.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 50,
        select: {
          id: true, eleveId: true, fraisId: true, type: true, taux: true, montant: true, decision: true,
          debut: true, fin: true, version: true, eleve: { select: { nom: true, prenoms: true } },
        },
      }),
      prisma.bourseEleve.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        take: 50,
        select: {
          id: true, eleveId: true, type: true, organisme: true, taux: true, montantFixe: true,
          fraisCibles: true, periode: true, version: true, eleve: { select: { nom: true, prenoms: true } },
        },
      }),
      statistiquesRecouvrement(etablissementId, exercice),
    ]);

  const categories: CategorieFraisVue[] = categoriesBrutes;
  const reglesPenalites: ReglePenaliteVue[] = reglesPenalitesBrutes.map((r) => ({
    id: r.id, declencheur: r.declencheur, type: r.type, valeur: Number(r.valeur),
    delaiJours: r.delaiJours, actif: r.actif, version: r.version,
  }));
  const reglesBlocage: RegleBlocageVue[] = reglesBlocageBrutes.map((r) => ({
    id: r.id, type: r.type, seuilImpaye: r.seuilImpaye != null ? Number(r.seuilImpaye) : null,
    actif: r.actif, version: r.version,
  }));
  const remboursements: RemboursementVue[] = remboursementsBruts.map((r) => ({
    id: r.id, eleveId: r.eleveId, eleveNom: nomPersonne(r.eleve), paiementId: r.paiementId,
    montant: r.montant, motif: r.motif, statut: r.statut,
    dateValidation: r.dateValidation ? r.dateValidation.toISOString() : null, version: r.version,
  }));
  const exonerations: ExonerationVue[] = exonerationsBrutes.map((x) => ({
    id: x.id, eleveId: x.eleveId, eleveNom: nomPersonne(x.eleve), fraisId: x.fraisId, type: x.type,
    taux: x.taux, montant: x.montant, decision: x.decision, debut: x.debut.toISOString(),
    fin: x.fin ? x.fin.toISOString() : null, version: x.version,
  }));
  const bourses: BourseVue[] = boursesBrutes.map((b) => ({
    id: b.id, eleveId: b.eleveId, eleveNom: nomPersonne(b.eleve), type: b.type, organisme: b.organisme,
    taux: b.taux, montantFixe: b.montantFixe,
    fraisCibles: Array.isArray(b.fraisCibles) ? (b.fraisCibles as string[]) : null,
    periode: b.periode, version: b.version,
  }));
  const recouvrement: RecouvrementVue = recStats.vue;

  // Aperçu des élèves actuellement BLOQUABLES par chaque règle (consultation V1 — l'application
  // effective dans bulletins/compositions/réinscriptions viendra avec les specs suivantes).
  const nomsEleves = new Map(elevesBruts.map((e) => [e.id, nomPersonne(e)]));
  const blocages: ApercuBlocageVue[] = reglesBlocage.map((r) => {
    const bloques = [...recStats.restesParEleve.entries()].filter(([, reste]) =>
      r.seuilImpaye === null ? reste > 0 : reste >= r.seuilImpaye,
    );
    bloques.sort((a, b) => b[1] - a[1]);
    return {
      regleId: r.id, type: r.type, seuilImpaye: r.seuilImpaye, actif: r.actif,
      nombreBloquables: bloques.length,
      exemples: bloques.slice(0, 10).map(([id, reste]) => ({ eleveNom: nomsEleves.get(id) ?? "—", reste })),
    };
  });

  // ── Facturation (07) : factures + tableau de bord (payé alloué via les créances du 06) ──
  const { factures, stats: statsFacturation } = await chargerFactures(etablissementId, anneeActive?.id ?? null);

  // ── Encaissements (08) : tableau de bord (jour/mois/année, modes, caissiers, avances) ──
  const statsEncaissements = await statistiquesEncaissements(etablissementId);

  // ── Caisses (09) : caisses, sessions (ouvertes + récentes), tableau de bord ──
  const donneesCaisses = await chargerCaisses(etablissementId);

  // ── Banque (10) : comptes, mouvements, chèques, versements en attente, tableau de bord ──
  const donneesBanques = await chargerBanques(etablissementId);

  // ── Comptabilité (11) : registre FORMEL (plan, journaux, écritures, balances, clôtures de
  // période) pour les habilités de l'onglet — les états CALCULÉS existants restent chargés
  // pour tous plus haut (zéro régression).
  let registreCompta: RegistreComptableVue | null = null;
  if (droits.comptabilite) {
    try {
      registreCompta = await chargerComptabilite(etablissementId, exercice);
    } catch (e) {
      console.error("[finances] chargement comptabilité :", e);
    }
  }

  // ── Achats (12) : cycle P2P pour les habilités de l'onglet (gestion OU réception). ──
  let donneesAchats: DonneesAchatsVue | null = null;
  // ── Fournisseurs (13) : référentiel complet (fiches, documents, contrats, évaluations…). ──
  let donneesFournisseurs: DonneesFournisseursVue | null = null;
  if (droits.achats) {
    try {
      donneesAchats = await chargerAchats(etablissementId, exercice);
      donneesFournisseurs = await chargerFichesFournisseurs(etablissementId);
    } catch (e) {
      console.error("[finances] chargement achats/fournisseurs :", e);
    }
  }

  // ── Stocks (14) : magasins, situations, lots, réservations, inventaires (onglet Économat). ──
  let donneesStocks: DonneesStocksVue | null = null;
  if (droits.economat) {
    try {
      donneesStocks = await chargerStocks(etablissementId);
    } catch (e) {
      console.error("[finances] chargement stocks :", e);
    }
  }

  // ── Immobilisations (15) : patrimoine, amortissements, maintenance. ──
  let donneesImmobilisations: DonneesImmobilisationsVue | null = null;
  if (droits.immobilisations) {
    try {
      donneesImmobilisations = await chargerImmobilisations(etablissementId);
    } catch (e) {
      console.error("[finances] chargement immobilisations :", e);
    }
  }
  // RM-1104 : articles de stock « immobilisables » proposés à la mise en service (onglet Immo).
  const articlesImmobilisables: ArticleVue[] = donneesImmobilisations
    ? (
        await prisma.articleEconomat.findMany({
          where: { etablissementId, annuleLe: null, actif: true, typeArticle: "immobilisable", stock: { gt: 0 } },
          orderBy: { nom: "asc" },
          select: {
            id: true, nom: true, categorie: true, prixVente: true, prixAchat: true,
            stock: true, seuilAlerte: true, actif: true, version: true,
          },
        })
      ).map((a) => ({
        id: a.id, nom: a.nom, categorie: a.categorie, prixVente: a.prixVente,
        prixAchat: a.prixAchat, stock: a.stock, seuilAlerte: a.seuilAlerte, actif: a.actif, version: a.version,
      }))
    : [];

  // ── Droits & délégations (97-RBAC) : liste + personnel éligible, pour les habilités ──
  let delegations: DelegationVue[] = [];
  let personnel: PersonnelVue[] = [];
  // Personnel chargé pour les délégations ET pour le paramétrage des caisses (responsable) ;
  // la LISTE des délégations reste réservée à ses habilités (droits.delegations).
  if (droits.delegations || droits.caisses) {
    const maintenant = new Date();
    const [delegationsBrutes, personnelBrut] = await Promise.all([
      droits.delegations
        ? prisma.delegationFinance.findMany({
            where: { etablissementId },
            orderBy: { creeLe: "desc" },
            take: 100,
            select: {
              id: true, beneficiaireId: true, permissions: true, motif: true, debut: true, fin: true,
              annuleLe: true, version: true,
              beneficiaire: { select: { nom: true, prenoms: true } },
              accordePar: { select: { nom: true, prenoms: true } },
            },
          })
        : Promise.resolve([]),
      prisma.utilisateur.findMany({
        where: {
          etablissementId,
          statutCompte: "actif",
          roleActif: { nomTechnique: { notIn: ["eleve", "parent"] } },
        },
        orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
        take: 300,
        select: { id: true, nom: true, prenoms: true, roleActif: { select: { libelle: true } } },
      }),
    ]);
    delegations = delegationsBrutes.map((d) => ({
      id: d.id,
      beneficiaireId: d.beneficiaireId,
      beneficiaireNom: nomPersonne(d.beneficiaire),
      accordeParNom: d.accordePar ? nomPersonne(d.accordePar) : "—",
      permissions: Array.isArray(d.permissions) ? (d.permissions as string[]) : [],
      motif: d.motif,
      debut: d.debut.toISOString(),
      fin: d.fin.toISOString(),
      statut: d.annuleLe
        ? "revoquee"
        : d.fin < maintenant
          ? "expiree"
          : d.debut > maintenant
            ? "a_venir"
            : "active",
      version: d.version,
    }));
    personnel = personnelBrut.map((p) => ({
      id: p.id,
      nom: nomPersonne(p),
      role: p.roleActif.libelle,
    }));
  }

  // ── Établissement (en-tête officiel) ──
  const entete = {
    nom: etablissement?.nom ?? "",
    pays: etablissement?.pays ?? null,
    ministere: etablissement?.ministere ?? null,
    anneeScolaire: etablissement?.anneeScolaire ?? null,
    emblemeUrl: etablissement?.emblemeUrl ?? null,
    sloganBulletin: etablissement?.sloganBulletin ?? null,
    fonctionChef: etablissement?.fonctionChef ?? null,
    nomChef: etablissement?.nomChef ?? null,
    prenomsChef: etablissement?.prenomsChef ?? null,
  };

  // ── Barème de frais ──
  const frais: FraisVue[] = fraisBruts.map((f) => ({
    id: f.id,
    libelle: f.libelle,
    montant: f.montant,
    niveauId: f.niveauId,
    niveauNom: f.niveauId ? niveauxMap.get(f.niveauId) ?? null : null,
    obligatoire: f.obligatoire,
    actif: f.actif,
    tranches: Array.isArray(f.tranches)
      ? (f.tranches as unknown as { libelle: string; montant: number; dateLimite?: string }[])
      : [],
    version: f.version,
    code: f.code,
    description: f.description,
    categorieId: f.categorieId,
    serie: f.serie,
    cycle: f.cycle,
    statutEleve: f.statutEleve,
    dateDebut: f.dateDebut ? f.dateDebut.toISOString().slice(0, 10) : null,
    dateFin: f.dateFin ? f.dateFin.toISOString().slice(0, 10) : null,
    modeCalcul: f.modeCalcul,
  }));

  // ── Élèves actifs de l'établissement ──
  const eleves: EleveVue[] = elevesBruts.map((e) => ({
    id: e.id,
    nom: nomPersonne(e),
    classe: e.inscriptions[0]?.classe?.nom ?? null,
    matricule: e.matricule,
  }));

  // ── Remises & bourses ──
  const remises: RemiseVue[] = remisesBrutes.map((r) => ({
    id: r.id,
    eleveId: r.eleveId,
    eleveNom: nomPersonne(r.eleve),
    type: r.type,
    libelle: r.libelle,
    montant: r.montant,
    pourcentage: r.pourcentage,
  }));

  // ── Encaissements de scolarité (reçus) ──
  const paiements: PaiementVue[] = paiementsBruts.map((p) => ({
    id: p.id,
    numeroRecu: p.numeroRecu,
    eleveId: p.eleveId,
    eleveNom: nomPersonne(p.eleve),
    classe: p.eleve.inscriptions[0]?.classe?.nom ?? null,
    libelle: p.libelle,
    montant: p.montant,
    mode: p.mode,
    reference: p.reference,
    date: p.date.toISOString(),
    annule: p.annule,
    motifAnnulation: p.motifAnnulation,
    pointeLe: p.pointeLe ? p.pointeLe.toISOString() : null,
    version: p.version,
  }));

  // ── Journal de caisse & banque ──
  const operations: OperationVue[] = operationsBrutes.map((o) => ({
    id: o.id,
    sens: o.sens,
    categorie: o.categorie,
    libelle: o.libelle,
    montant: o.montant,
    mode: o.mode,
    reference: o.reference,
    date: o.date.toISOString(),
    annule: o.annule,
    pointeLe: o.pointeLe ? o.pointeLe.toISOString() : null,
    version: o.version,
  }));

  // ── Économat : articles + mouvements ──
  const articles: ArticleVue[] = articlesBruts.map((a) => ({
    id: a.id,
    nom: a.nom,
    categorie: a.categorie,
    prixVente: a.prixVente,
    prixAchat: a.prixAchat,
    stock: a.stock,
    seuilAlerte: a.seuilAlerte,
    actif: a.actif,
    version: a.version,
  }));
  const eleveIdsMouvements = [...new Set(mouvementsBruts.map((m) => m.eleveId).filter((id): id is string => !!id))];
  const elevesMouvementsBruts = eleveIdsMouvements.length
    ? await prisma.utilisateur.findMany({ where: { id: { in: eleveIdsMouvements } }, select: { id: true, nom: true, prenoms: true } })
    : [];
  const nomEleveMouvementMap = new Map(elevesMouvementsBruts.map((e) => [e.id, nomPersonne(e)]));

  const mouvements: MouvementVue[] = mouvementsBruts.map((m) => ({
    id: m.id,
    articleNom: m.article.nom,
    type: m.type,
    quantite: m.quantite,
    montant: m.montant,
    mode: m.mode,
    acheteur: m.eleveId ? nomEleveMouvementMap.get(m.eleveId) ?? m.acheteur : m.acheteur,
    date: m.date.toISOString(),
  }));

  // ── Impayés : dû (frais actifs obligatoires du niveau) − remises − payé, par élève ──
  const fraisMontantParId = new Map(fraisBruts.map((f) => [f.id, f.montant]));
  const remisesParEleve = new Map<string, typeof remisesBrutes>();
  for (const r of remisesBrutes) {
    const liste = remisesParEleve.get(r.eleveId) ?? [];
    liste.push(r);
    remisesParEleve.set(r.eleveId, liste);
  }
  const payeParEleve = new Map(paiementsParEleve.map((p) => [p.eleveId, p._sum.montant ?? 0]));

  const impayes: ImpayeVue[] = elevesBruts
    .map((e) => {
      const niveauId = e.inscriptions[0]?.classe?.niveauId ?? null;
      const du = fraisBruts
        .filter((f) => f.actif && f.obligatoire && (f.niveauId === null || f.niveauId === niveauId))
        .reduce((s, f) => s + f.montant, 0);
      const remise = (remisesParEleve.get(e.id) ?? []).reduce((s, r) => {
        if (r.montant) return s + r.montant;
        if (r.pourcentage) {
          const base = r.fraisId ? fraisMontantParId.get(r.fraisId) ?? 0 : du;
          return s + Math.round((r.pourcentage * base) / 100);
        }
        return s;
      }, 0);
      const paye = payeParEleve.get(e.id) ?? 0;
      const reste = Math.max(0, du - remise - paye);
      return {
        eleveId: e.id,
        eleveNom: nomPersonne(e),
        classe: e.inscriptions[0]?.classe?.nom ?? null,
        du,
        remise,
        paye,
        reste,
      };
    })
    .filter((i) => i.reste > 0)
    .sort((a, b) => b.reste - a.reste);

  // ── KPI : encaissements/dépenses agrégés + soldes par mode de paiement ──
  // `mode` peut être nul sur MouvementStock (entrées/ajustements) : nul → espèces.
  const totauxParMode = (rows: { mode: string | null; _sum: { montant: number | null } }[]) => {
    const carte = new Map<string, number>();
    for (const r of rows) {
      const mode = r.mode ?? "especes";
      carte.set(mode, (carte.get(mode) ?? 0) + (r._sum.montant ?? 0));
    }
    return carte;
  };
  const paiementsMap = totauxParMode(paiementsParMode);
  const ventesMap = totauxParMode(ventesParMode);
  const opRecetteMap = new Map<string, number>();
  const opDepenseMap = new Map<string, number>();
  for (const r of operationsParModeSens) {
    const montant = r._sum.montant ?? 0;
    const carte = r.sens === "recette" ? opRecetteMap : opDepenseMap;
    carte.set(r.mode, (carte.get(r.mode) ?? 0) + montant);
  }
  const somme = (carte: Map<string, number>) => [...carte.values()].reduce((s, n) => s + n, 0);

  const soldes = MODES.map((mode) => ({
    mode,
    recettes: (paiementsMap.get(mode) ?? 0) + (ventesMap.get(mode) ?? 0) + (opRecetteMap.get(mode) ?? 0),
    depenses: opDepenseMap.get(mode) ?? 0,
  }));

  const categorieLibelle = (code: string, sens: string) =>
    CATEGORIES_OHADA.find((c) => c.code === code && c.sens === sens)?.libelle ?? code;
  const versCategories = (rows: { categorie: string; sens: string; _sum: { montant: number | null } }[]) =>
    rows.map((r) => ({ code: r.categorie, libelle: categorieLibelle(r.categorie, r.sens), sens: r.sens, total: r._sum.montant ?? 0 }));

  const kpi = {
    totalEncaisse: somme(paiementsMap),
    ventesEconomat: somme(ventesMap),
    totalDepenses: somme(opDepenseMap),
    totalRecettesDiverses: somme(opRecetteMap),
    soldes,
    categoriesOhada: versCategories(operationsParCategorieAnnee),
  };

  // ── Rapport financier : période « mois en cours » (le cumul annuel réutilise le KPI ci-dessus) ──
  const rapportMois = {
    libelle: capitaliser(new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(maintenant)),
    recettesScolarite: paiementsMoisAgg._sum.montant ?? 0,
    recettesEconomat: ventesMoisAgg._sum.montant ?? 0,
    categoriesOhada: versCategories(operationsParCategorieMois),
  };

  // ── Rapprochement bancaire : relevés mensuels enregistrés ──
  const releves: ReleveVue[] = relevesBruts.map((r) => ({ mois: r.mois, solde: r.solde }));

  // ── Budget prévisionnel : lignes de l'exercice courant ──
  const budgets: BudgetVue[] = budgetsBruts.map((b) => ({ categorie: b.categorie, sens: b.sens, montantPrevu: b.montantPrevu }));

  // ── Réalisé de l'exercice : agrégats OHADA (kpi.categoriesOhada) + scolarité/économat (comptes virtuels 7061/707) ──
  const realises: RealiseVue[] = [
    ...kpi.categoriesOhada.map((c) => ({ categorie: c.code, sens: c.sens, total: c.total })),
    { categorie: "7061", sens: "recette", total: kpi.totalEncaisse },
    { categorie: "707", sens: "recette", total: kpi.ventesEconomat },
  ];

  // ── Clôtures d'exercice : historique + à-nouveaux (soldes de la PLUS RÉCENTE clôture) ──
  const clotures: ClotureVue[] = cloturesBrutes.map((c) => ({
    id: c.id,
    exercice: c.exercice,
    finPeriode: c.finPeriode.toISOString(),
    resultat: c.resultat,
    soldes: (c.soldes as { compte: string; libelle: string; solde: number }[] | null) ?? [],
    notes: c.notes,
  }));
  const aNouveaux = clotures[0]?.soldes ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Finances de l'établissement"
        description="Scolarité, caisse & banque et économat : encaissements, dépenses, remises, stocks et rapports financiers."
      />
      {modeSelecteur && (
        <SelecteurEtablissementFinances etablissements={etablissementsSelecteur} valeur={etablissementId} />
      )}
      <FinancesVue
        etablissementId={etablissementId}
        entete={entete}
        frais={frais}
        remises={remises}
        impayes={impayes}
        eleves={eleves}
        niveaux={niveaux}
        paiements={paiements}
        operations={operations}
        articles={articles}
        mouvements={mouvements}
        kpi={kpi}
        rapportMois={rapportMois}
        releves={releves}
        budgets={budgets}
        realises={realises}
        clotures={clotures}
        aNouveaux={aNouveaux}
        exercice={exercice}
        peutEcrire={peutEcrire}
        classes={classesBrutes}
        categories={categories}
        reglesPenalites={reglesPenalites}
        reglesBlocage={reglesBlocage}
        recouvrement={recouvrement}
        blocages={blocages}
        remboursements={remboursements}
        exonerations={exonerations}
        bourses={bourses}
        droits={droits}
        delegations={delegations}
        personnel={personnel}
        factures={factures}
        statsFacturation={statsFacturation}
        statsEncaissements={statsEncaissements}
        caisses={donneesCaisses.caisses}
        sessionsCaisseRecentes={donneesCaisses.sessionsRecentes}
        tableauBordCaisses={donneesCaisses.tableauBord}
        comptesBancaires={donneesBanques.comptes}
        mouvementsBancaires={donneesBanques.mouvements}
        chequesBancaires={donneesBanques.cheques}
        versementsEnAttente={donneesBanques.versementsEnAttente}
        tableauBordBanque={donneesBanques.tableauBord}
        registreCompta={registreCompta}
        donneesAchats={donneesAchats}
        droitsAchats={droitsAchats}
        donneesFournisseurs={donneesFournisseurs}
        donneesStocks={donneesStocks}
        droitsStocks={droitsStocks}
        donneesImmobilisations={donneesImmobilisations}
        droitsImmo={droitsImmo}
        articlesImmobilisables={articlesImmobilisables}
      />
    </div>
  );
}
