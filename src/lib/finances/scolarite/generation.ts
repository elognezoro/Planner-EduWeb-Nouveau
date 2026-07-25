import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { journaliserFinance } from "../commun/audit";
import type { StatutCreance } from "./types";

/**
 * GÉNÉRATION des créances (06-Scolarite) — domaine pur + chargeurs serveur.
 *
 * Règles :
 * - seuls les frais OBLIGATOIRES, actifs, non annulés et dans leur fenêtre de validité
 *   génèrent des créances (les frais facultatifs restent encaissables librement) ;
 * - applicabilité : niveau (barème existant), cycle, série (appariée au nom du niveau/classe),
 *   dates ; un frais ciblant un statut d'hébergement (interne/externe/demi-pensionnaire) n'est
 *   PAS généré tant que l'inscription ne porte pas ce statut (specs 07/08) ;
 * - IDEMPOTENCE : jamais deux créances pour le même élève × frais × exercice (clé de dédoublonnage
 *   sur les créances non annulées) ;
 * - un frais à tranches (ou à mode mensuel/trimestriel/semestriel) génère UNE créance PAR échéance.
 */

/** Catégories par défaut (06) — semées à la première utilisation par établissement. */
export const CATEGORIES_DEFAUT = [
  { nom: "Frais administratifs", code: "ADM", ordreImputation: 1 },
  { nom: "Frais pédagogiques", code: "PED", ordreImputation: 2 },
  { nom: "Frais de services", code: "SRV", ordreImputation: 3 },
  { nom: "Frais exceptionnels", code: "EXC", ordreImputation: 4 },
] as const;

/** Sème les 4 catégories par défaut si l'établissement n'en a AUCUNE (idempotent, audité). */
export async function assurerCategoriesDefaut(etablissementId: string, utilisateurId: string | null): Promise<void> {
  const existantes = await prisma.categorieFrais.count({ where: { etablissementId, annuleLe: null } });
  if (existantes > 0) return;
  await prisma.$transaction(async (tx) => {
    await tx.categorieFrais.createMany({
      data: CATEGORIES_DEFAUT.map((c) => ({ etablissementId, ...c })),
      skipDuplicates: true,
    });
    await journaliserFinance(tx, {
      etablissementId, utilisateurId, action: "categorie.semis",
      entite: "CategorieFrais", entiteId: etablissementId,
      nouvelleValeur: { categories: CATEGORIES_DEFAUT.map((c) => c.nom) },
    });
  });
}

export interface ContexteEleveGeneration {
  eleveId: string;
  niveauId: string | null;
  niveauNom: string | null;
  cycle: string | null; // CycleNiveau du niveau de la classe
  classeNom: string | null;
}

export interface FraisPourGeneration {
  id: string;
  libelle: string;
  montant: number;
  devise: string;
  niveauId: string | null;
  serie: string | null;
  cycle: string | null;
  statutEleve: string | null;
  dateDebut: Date | null;
  dateFin: Date | null;
  modeCalcul: string;
  tranches: unknown;
}

interface EcheanceGeneree {
  libelle: string;
  montant: number;
  dateEcheance: Date | null;
}

/** Un frais est-il applicable à cet élève (contexte de classe) aujourd'hui ? */
export function fraisApplicable(frais: FraisPourGeneration, ctx: ContexteEleveGeneration, maintenant: Date): boolean {
  if (frais.statutEleve) return false; // statut d'hébergement non porté par l'inscription (07/08)
  if (frais.niveauId && frais.niveauId !== ctx.niveauId) return false;
  if (frais.cycle && frais.cycle !== ctx.cycle) return false;
  if (frais.serie) {
    const serie = frais.serie.trim().toLowerCase();
    const jetons = `${ctx.niveauNom ?? ""} ${ctx.classeNom ?? ""}`.toLowerCase().split(/[\s-]+/).filter(Boolean);
    if (!jetons.includes(serie)) return false;
  }
  if (frais.dateDebut && maintenant < frais.dateDebut) return false;
  if (frais.dateFin && maintenant > frais.dateFin) return false;
  return true;
}

/** Échéances d'un frais : tranches JSON si présentes, sinon répartition selon le mode de calcul. */
export function echeancesDuFrais(frais: FraisPourGeneration): EcheanceGeneree[] {
  const tranches = Array.isArray(frais.tranches)
    ? (frais.tranches as { libelle?: string; montant?: number; dateLimite?: string }[])
        .map((t) => ({
          libelle: String(t?.libelle ?? "").trim(),
          montant: Math.trunc(Number(t?.montant)) || 0,
          dateLimite: String(t?.dateLimite ?? "").trim(),
        }))
        .filter((t) => t.libelle && t.montant > 0)
    : [];
  if (tranches.length > 0) {
    return tranches.map((t) => {
      const d = t.dateLimite ? new Date(t.dateLimite) : null;
      return {
        libelle: `${frais.libelle} — ${t.libelle}`,
        montant: t.montant,
        dateEcheance: d && !Number.isNaN(d.getTime()) ? d : null,
      };
    });
  }
  const NB: Record<string, { n: number; terme: string }> = {
    mensuel: { n: 9, terme: "Mensualité" },
    trimestriel: { n: 3, terme: "Trimestre" },
    semestriel: { n: 2, terme: "Semestre" },
  };
  const rep = NB[frais.modeCalcul];
  if (!rep || rep.n <= 1) {
    return [{ libelle: frais.libelle, montant: frais.montant, dateEcheance: null }];
  }
  // Répartition en parts égales (la dernière part absorbe l'arrondi) — dates non inventées.
  const part = Math.floor(frais.montant / rep.n);
  return Array.from({ length: rep.n }, (_, i) => ({
    libelle: `${frais.libelle} — ${rep.terme} ${i + 1}/${rep.n}`,
    montant: i === rep.n - 1 ? frais.montant - part * (rep.n - 1) : part,
    dateEcheance: null,
  }));
}

const cle = (eleveId: string, fraisId: string) => `${eleveId}:${fraisId}`;

/**
 * Calcule les LIGNES de créances à créer (pure) : élèves × frais applicables, en sautant tout
 * frais pour lequel l'élève possède déjà une créance non annulée sur l'exercice (idempotence).
 * Le statut initial tient compte des paiements déjà encaissés sur le frais (allocation dans
 * l'ordre des échéances).
 */
export function creancesAGenerer(params: {
  etablissementId: string;
  exercice: string;
  eleves: ContexteEleveGeneration[];
  frais: FraisPourGeneration[];
  clesExistantes: Set<string>; // `${eleveId}:${fraisId}` des créances non annulées de l'exercice
  payeParCle: Map<string, number>; // `${eleveId}:${fraisId}` → total payé (paiements valides)
  maintenant?: Date;
}): Prisma.CreanceEleveCreateManyInput[] {
  const maintenant = params.maintenant ?? new Date();
  const lignes: Prisma.CreanceEleveCreateManyInput[] = [];
  for (const eleve of params.eleves) {
    for (const frais of params.frais) {
      if (params.clesExistantes.has(cle(eleve.eleveId, frais.id))) continue;
      if (!fraisApplicable(frais, eleve, maintenant)) continue;
      const echeances = echeancesDuFrais(frais);
      let restePaye = params.payeParCle.get(cle(eleve.eleveId, frais.id)) ?? 0;
      for (const e of echeances) {
        const alloue = Math.min(restePaye, e.montant);
        restePaye -= alloue;
        const statut: StatutCreance =
          alloue >= e.montant ? "soldee" : alloue > 0 ? "partiellement_payee" : "generee";
        lignes.push({
          etablissementId: params.etablissementId,
          exercice: params.exercice,
          eleveId: eleve.eleveId,
          fraisId: frais.id,
          libelle: e.libelle,
          montant: e.montant,
          devise: frais.devise,
          dateEcheance: e.dateEcheance,
          statut,
          dateComptable: maintenant,
        });
      }
    }
  }
  return lignes;
}

/**
 * Alloue un total payé aux créances dans l'ordre des échéances (échéances datées d'abord,
 * puis ordre de création) — retourne le montant alloué par créance.
 */
export function allouerPaiements(
  creances: { id: string; montant: number; dateEcheance: Date | null; creeLe: Date }[],
  totalPaye: number,
): Map<string, number> {
  const tri = [...creances].sort((a, b) => {
    const da = a.dateEcheance?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.dateEcheance?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return da !== db ? da - db : a.creeLe.getTime() - b.creeLe.getTime();
  });
  const alloc = new Map<string, number>();
  let reste = Math.max(0, totalPaye);
  for (const c of tri) {
    const a = Math.min(reste, c.montant);
    alloc.set(c.id, a);
    reste -= a;
  }
  return alloc;
}

/**
 * Met à jour les statuts STOCKÉS des créances d'un élève pour un frais donné, d'après les
 * paiements valides (allocation dans l'ordre des échéances). À appeler DANS la transaction de
 * tout encaissement/annulation/imputation portant un fraisId. Les créances suspendues ou
 * annulées ne sont jamais touchées.
 */
export async function majStatutCreances(
  tx: Prisma.TransactionClient,
  params: { etablissementId: string; eleveId: string; fraisId: string },
): Promise<void> {
  const [agg, creances] = await Promise.all([
    tx.paiementScolarite.aggregate({
      where: { etablissementId: params.etablissementId, eleveId: params.eleveId, fraisId: params.fraisId, annule: false },
      _sum: { montant: true },
    }),
    tx.creanceEleve.findMany({
      where: {
        etablissementId: params.etablissementId,
        eleveId: params.eleveId,
        fraisId: params.fraisId,
        annuleLe: null,
        statut: { notIn: ["suspendue", "annulee"] },
      },
      select: { id: true, montant: true, dateEcheance: true, creeLe: true, statut: true },
    }),
  ]);
  if (creances.length === 0) return;
  const alloc = allouerPaiements(
    creances.map((c) => ({ id: c.id, montant: Number(c.montant), dateEcheance: c.dateEcheance, creeLe: c.creeLe })),
    agg._sum.montant ?? 0,
  );
  for (const c of creances) {
    const paye = alloc.get(c.id) ?? 0;
    const statut: StatutCreance = paye >= Number(c.montant) ? "soldee" : paye > 0 ? "partiellement_payee" : "generee";
    if (statut !== c.statut) {
      await tx.creanceEleve.updateMany({ where: { id: c.id }, data: { statut, version: { increment: 1 } } });
    }
  }
}

export interface CreanceOuverte {
  id: string;
  fraisId: string;
  categorieId: string | null;
  libelle: string;
  montant: number;
  paye: number;
  reste: number;
  dateEcheance: Date | null;
  creeLe: Date;
  statut: string;
  version: number;
}

/**
 * Créances OUVERTES d'un élève (actives, avec reste à payer calculé par allocation des
 * paiements valides dans l'ordre des échéances) — sert à l'imputation des avances, aux
 * pénalités, à la clôture de compte et au recalcul.
 */
export async function creancesOuvertes(
  db: Prisma.TransactionClient,
  params: { etablissementId: string; eleveId: string; exercice?: string },
): Promise<CreanceOuverte[]> {
  const [creances, paiements] = await Promise.all([
    db.creanceEleve.findMany({
      where: {
        etablissementId: params.etablissementId,
        eleveId: params.eleveId,
        ...(params.exercice ? { exercice: params.exercice } : {}),
        annuleLe: null,
        statut: { notIn: ["suspendue", "annulee"] },
      },
      select: {
        id: true, fraisId: true, libelle: true, montant: true, dateEcheance: true, creeLe: true,
        statut: true, version: true, frais: { select: { categorieId: true } },
      },
    }),
    db.paiementScolarite.groupBy({
      by: ["fraisId"],
      where: { etablissementId: params.etablissementId, eleveId: params.eleveId, annule: false },
      _sum: { montant: true },
    }),
  ]);
  const payeParFrais = new Map<string, number>();
  for (const p of paiements) if (p.fraisId) payeParFrais.set(p.fraisId, p._sum.montant ?? 0);

  const parFrais = new Map<string, typeof creances>();
  for (const c of creances) {
    const l = parFrais.get(c.fraisId) ?? [];
    l.push(c);
    parFrais.set(c.fraisId, l);
  }
  const resultat: CreanceOuverte[] = [];
  for (const [fraisId, liste] of parFrais) {
    const alloc = allouerPaiements(
      liste.map((c) => ({ id: c.id, montant: Number(c.montant), dateEcheance: c.dateEcheance, creeLe: c.creeLe })),
      payeParFrais.get(fraisId) ?? 0,
    );
    for (const c of liste) {
      const montant = Number(c.montant);
      const paye = alloc.get(c.id) ?? 0;
      resultat.push({
        id: c.id, fraisId: c.fraisId, categorieId: c.frais.categorieId, libelle: c.libelle,
        montant, paye, reste: Math.max(0, montant - paye),
        dateEcheance: c.dateEcheance, creeLe: c.creeLe, statut: c.statut, version: c.version,
      });
    }
  }
  return resultat;
}

/** Sélection Prisma des frais candidats à la génération (obligatoires, actifs, non annulés). */
export async function fraisPourGeneration(etablissementId: string): Promise<FraisPourGeneration[]> {
  const frais = await prisma.fraisScolarite.findMany({
    where: { etablissementId, actif: true, obligatoire: true, annuleLe: null },
    select: {
      id: true, libelle: true, montant: true, devise: true, niveauId: true, serie: true, cycle: true,
      statutEleve: true, dateDebut: true, dateFin: true, modeCalcul: true, tranches: true,
    },
  });
  return frais;
}

/** Contextes de génération des élèves actifs (portée : un élève, une classe ou l'établissement). */
export async function contextesEleves(
  etablissementId: string,
  anneeScolaireActiveId: string | null,
  portee: { eleveId?: string; classeId?: string },
): Promise<ContexteEleveGeneration[]> {
  const filtreInscription = {
    ...(anneeScolaireActiveId ? { anneeScolaireId: anneeScolaireActiveId } : {}),
    ...(portee.classeId ? { classeId: portee.classeId } : {}),
  };
  const eleves = await prisma.utilisateur.findMany({
    where: {
      etablissementId,
      statutCompte: "actif",
      roleActif: { nomTechnique: "eleve" },
      ...(portee.eleveId ? { id: portee.eleveId } : {}),
      ...(portee.classeId ? { inscriptions: { some: filtreInscription } } : {}),
    },
    select: {
      id: true,
      inscriptions: {
        where: filtreInscription,
        take: 1,
        select: { classe: { select: { nom: true, niveauId: true, niveau: { select: { nom: true, cycle: true } } } } },
      },
    },
  });
  return eleves.map((e) => {
    const classe = e.inscriptions[0]?.classe ?? null;
    return {
      eleveId: e.id,
      niveauId: classe?.niveauId ?? null,
      niveauNom: classe?.niveau?.nom ?? null,
      cycle: classe?.niveau?.cycle ?? null,
      classeNom: classe?.nom ?? null,
    };
  });
}
