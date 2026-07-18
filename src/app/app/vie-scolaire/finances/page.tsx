import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CATEGORIES_OHADA } from "@/lib/finances/categories";
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
} from "./types";

export const metadata: Metadata = { title: "Finances de l'établissement" };
export const dynamic = "force-dynamic";

/** Gestion financière de l'établissement : Économe + direction (Chef/ACE) + admins (cf. navigation.ts). */
const ROLES_AUTORISES = ["admin", "chef_etablissement", "adjoint_chef_etablissement", "econome", "etablissements_admin"] as const;
const MODES = ["especes", "mobile_money", "cheque", "virement"] as const;

const nomPersonne = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

const capitaliser = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default async function FinancesPage() {
  const u = await requireRole([...ROLES_AUTORISES]);
  const etablissementId = u.portee.etablissementId;

  if (!etablissementId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          titre="Finances de l'établissement"
          description="Scolarité, caisse & banque et économat : encaissements, dépenses, remises, stocks et rapports financiers."
        />
        <Card>
          <p className="text-sm text-ink-700/70">
            Rattachez votre compte à un établissement pour gérer ses finances.
          </p>
        </Card>
      </div>
    );
  }

  const peutEcrire = !u.apercuActif;

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
  ] = await Promise.all([
    prisma.fraisScolarite.findMany({
      where: { etablissementId },
      orderBy: [{ actif: "desc" }, { libelle: "asc" }],
      select: { id: true, libelle: true, montant: true, niveauId: true, obligatoire: true, actif: true, tranches: true },
    }),
    prisma.remiseEleve.findMany({
      where: { etablissementId },
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
        date: true, annule: true, motifAnnulation: true,
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
      select: { id: true, sens: true, categorie: true, libelle: true, montant: true, mode: true, reference: true, date: true, annule: true },
    }),
    prisma.articleEconomat.findMany({
      where: { etablissementId },
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      select: { id: true, nom: true, categorie: true, prixVente: true, prixAchat: true, stock: true, seuilAlerte: true, actif: true },
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
  ]);

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titre="Finances de l'établissement"
        description="Scolarité, caisse & banque et économat : encaissements, dépenses, remises, stocks et rapports financiers."
      />
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
        peutEcrire={peutEcrire}
      />
    </div>
  );
}
