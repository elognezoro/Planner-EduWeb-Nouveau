import "server-only";
import { prisma } from "@/lib/prisma";
import { allouerPaiements } from "./generation";
import type {
  CompteEleveVue, CreanceVue, DetailSolde, RecouvrementVue, StatutCreance, StatutCreanceAffiche,
} from "./types";

/**
 * SOLDE de l'élève (06) — formule officielle :
 *   Montant facturé − Paiements − Remises − Exonérations − Bourses + Pénalités = Solde restant.
 *
 * Conventions V1 (documentées) :
 * - « facturé » = créances non annulées et non suspendues de l'exercice ;
 * - « paiements » = paiements valides − remboursements PAYÉS (l'argent restitué n'est plus un
 *   paiement) ;
 * - remises/exonérations en pourcentage : base = créances du frais ciblé (ou tout le facturé si
 *   globales) ; bourses : appliquées quand leur période égale l'exercice ;
 * - le solde peut être négatif (crédit de l'élève) ; les avances non imputées sont exposées à
 *   part (avancesDisponibles), elles n'entrent pas dans la formule.
 */

interface CreanceCalc {
  id: string;
  fraisId: string;
  libelle: string;
  montant: number;
  devise: string;
  dateEcheance: Date | null;
  statut: StatutCreance;
  creeLe: Date;
  version: number;
}

export interface EntreesSolde {
  exercice: string;
  maintenant: Date;
  creances: CreanceCalc[]; // toutes créances non annulées de l'exercice (y compris suspendues)
  paiements: { fraisId: string | null; montant: number }[]; // valides uniquement
  remboursementsPayes: number;
  remises: { fraisId: string | null; montant: number | null; pourcentage: number | null }[];
  exonerations: { fraisId: string | null; type: string; taux: number | null; montant: number | null; debut: Date; fin: Date | null }[];
  bourses: { fraisCibles: string[] | null; taux: number | null; montantFixe: number | null; periode: string }[];
  penalites: number; // Σ pénalités appliquées, non annulées
}

/** Détail du solde (pure). */
export function calculerDetailSolde(e: EntreesSolde): DetailSolde {
  const actives = e.creances.filter((c) => c.statut !== "annulee" && c.statut !== "suspendue");
  const facture = actives.reduce((s, c) => s + c.montant, 0);
  const factureParFrais = new Map<string, number>();
  for (const c of actives) factureParFrais.set(c.fraisId, (factureParFrais.get(c.fraisId) ?? 0) + c.montant);
  const base = (fraisId: string | null) => (fraisId ? factureParFrais.get(fraisId) ?? 0 : facture);

  const paye = e.paiements.reduce((s, p) => s + p.montant, 0) - e.remboursementsPayes;

  const remises = e.remises.reduce((s, r) => {
    if (r.montant) return s + r.montant;
    if (r.pourcentage) return s + Math.round((r.pourcentage * base(r.fraisId)) / 100);
    return s;
  }, 0);

  const exonerations = e.exonerations.reduce((s, x) => {
    if (x.debut > e.maintenant || (x.fin && x.fin < e.maintenant)) return s;
    if (x.type === "totale") return s + base(x.fraisId);
    if (x.montant) return s + x.montant;
    if (x.taux) return s + Math.round((x.taux * base(x.fraisId)) / 100);
    return s;
  }, 0);

  const bourses = e.bourses.reduce((s, b) => {
    if (b.periode && b.periode !== e.exercice) return s;
    if (b.montantFixe) return s + b.montantFixe;
    if (b.taux) {
      const baseBourse = b.fraisCibles
        ? b.fraisCibles.reduce((t, id) => t + (factureParFrais.get(id) ?? 0), 0)
        : facture;
      return s + Math.round((b.taux * baseBourse) / 100);
    }
    return s;
  }, 0);

  const solde = facture - paye - remises - exonerations - bourses + e.penalites;
  return { facture, paye, remises, exonerations, bourses, penalites: e.penalites, solde };
}

/** Statut d'affichage d'une créance : « en_retard » si échéance dépassée et non soldée. */
export function statutAffiche(c: { statut: StatutCreance; dateEcheance: Date | null }, paye: number, montant: number, maintenant: Date): StatutCreanceAffiche {
  if (c.statut === "annulee" || c.statut === "suspendue") return c.statut;
  if (paye >= montant) return "soldee";
  if (c.dateEcheance && c.dateEcheance < maintenant) return "en_retard";
  return paye > 0 ? "partiellement_payee" : "generee";
}

const nomPersonne = (p: { nom: string | null; prenoms: string | null }) =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—";

/** Charge le COMPTE FINANCIER complet d'un élève (06) — sérialisable pour le client. */
export async function chargerCompteEleve(
  etablissementId: string,
  eleveId: string,
  exercice: string,
  anneeScolaireActiveId: string | null,
): Promise<CompteEleveVue | null> {
  const maintenant = new Date();
  const [eleve, creancesBrutes, paiementsBruts, remisesBrutes, exonerations, bourses, plans, penalites, avances, remboursements] =
    await Promise.all([
      prisma.utilisateur.findFirst({
        where: { id: eleveId, etablissementId },
        select: {
          id: true, nom: true, prenoms: true,
          inscriptions: {
            where: anneeScolaireActiveId ? { anneeScolaireId: anneeScolaireActiveId } : undefined,
            take: 1, select: { classe: { select: { nom: true } } },
          },
        },
      }),
      prisma.creanceEleve.findMany({
        where: { etablissementId, eleveId, exercice, annuleLe: null },
        orderBy: [{ dateEcheance: "asc" }, { creeLe: "asc" }],
        select: { id: true, fraisId: true, libelle: true, montant: true, devise: true, dateEcheance: true, statut: true, creeLe: true, version: true },
      }),
      prisma.paiementScolarite.findMany({
        where: { etablissementId, eleveId },
        orderBy: { date: "desc" },
        take: 200,
        select: { id: true, numeroRecu: true, libelle: true, montant: true, mode: true, date: true, annule: true, fraisId: true },
      }),
      prisma.remiseEleve.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        select: { id: true, type: true, libelle: true, montant: true, pourcentage: true, fraisId: true },
      }),
      prisma.exonerationEleve.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, eleveId: true, fraisId: true, type: true, taux: true, montant: true, decision: true, debut: true, fin: true, version: true },
      }),
      prisma.bourseEleve.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, eleveId: true, type: true, organisme: true, taux: true, montantFixe: true, fraisCibles: true, periode: true, version: true },
      }),
      prisma.planPaiement.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, eleveId: true, creanceId: true, libelle: true, echeances: true, statut: true, version: true },
      }),
      prisma.penaliteEleve.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, creanceId: true, montant: true, statut: true, version: true, creance: { select: { libelle: true } } },
      }),
      prisma.avanceEleve.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, eleveId: true, montant: true, solde: true, mode: true, reference: true, version: true },
      }),
      prisma.demandeRemboursement.findMany({
        where: { etablissementId, eleveId, annuleLe: null },
        orderBy: { creeLe: "desc" },
        select: { id: true, eleveId: true, paiementId: true, montant: true, motif: true, statut: true, dateValidation: true, version: true },
      }),
    ]);
  if (!eleve) return null;
  const eleveNom = nomPersonne(eleve);

  const creancesCalc: CreanceCalc[] = creancesBrutes.map((c) => ({
    id: c.id, fraisId: c.fraisId, libelle: c.libelle, montant: Number(c.montant), devise: c.devise,
    dateEcheance: c.dateEcheance, statut: c.statut as StatutCreance, creeLe: c.creeLe, version: c.version,
  }));

  // Allocation des paiements valides par frais → payé par créance (ordre des échéances).
  const paiementsValides = paiementsBruts.filter((p) => !p.annule);
  const payeParFrais = new Map<string, number>();
  for (const p of paiementsValides) {
    if (!p.fraisId) continue;
    payeParFrais.set(p.fraisId, (payeParFrais.get(p.fraisId) ?? 0) + p.montant);
  }
  const payeParCreance = new Map<string, number>();
  const parFrais = new Map<string, CreanceCalc[]>();
  for (const c of creancesCalc) {
    if (c.statut === "annulee" || c.statut === "suspendue") continue;
    const liste = parFrais.get(c.fraisId) ?? [];
    liste.push(c);
    parFrais.set(c.fraisId, liste);
  }
  for (const [fraisId, liste] of parFrais) {
    const alloc = allouerPaiements(liste, payeParFrais.get(fraisId) ?? 0);
    for (const [id, m] of alloc) payeParCreance.set(id, m);
  }

  const penalitesActives = penalites.filter((p) => p.statut === "appliquee");
  const remboursementsPayes = remboursements.filter((r) => r.statut === "payee").reduce((s, r) => s + r.montant, 0);

  const detail = calculerDetailSolde({
    exercice, maintenant,
    creances: creancesCalc,
    paiements: paiementsValides.map((p) => ({ fraisId: p.fraisId, montant: p.montant })),
    remboursementsPayes,
    remises: remisesBrutes,
    exonerations,
    bourses: bourses.map((b) => ({
      fraisCibles: Array.isArray(b.fraisCibles) ? (b.fraisCibles as string[]) : null,
      taux: b.taux, montantFixe: b.montantFixe, periode: b.periode,
    })),
    penalites: penalitesActives.reduce((s, p) => s + p.montant, 0),
  });

  const creances: CreanceVue[] = creancesCalc.map((c) => {
    const paye = payeParCreance.get(c.id) ?? 0;
    return {
      id: c.id, fraisId: c.fraisId, libelle: c.libelle, montant: c.montant, devise: c.devise,
      dateEcheance: c.dateEcheance ? c.dateEcheance.toISOString() : null,
      statut: c.statut,
      statutAffiche: statutAffiche(c, paye, c.montant, maintenant),
      paye, version: c.version,
    };
  });

  return {
    eleveId: eleve.id,
    eleveNom,
    classe: eleve.inscriptions[0]?.classe?.nom ?? null,
    exercice,
    creances,
    paiements: paiementsBruts.map((p) => ({
      id: p.id, numeroRecu: p.numeroRecu, libelle: p.libelle, montant: p.montant, mode: p.mode,
      date: p.date.toISOString(), annule: p.annule,
    })),
    remises: remisesBrutes.map((r) => ({ id: r.id, type: r.type, libelle: r.libelle, montant: r.montant, pourcentage: r.pourcentage })),
    exonerations: exonerations.map((x) => ({
      id: x.id, eleveId: x.eleveId, eleveNom, fraisId: x.fraisId, type: x.type, taux: x.taux, montant: x.montant,
      decision: x.decision, debut: x.debut.toISOString(), fin: x.fin ? x.fin.toISOString() : null, version: x.version,
    })),
    bourses: bourses.map((b) => ({
      id: b.id, eleveId: b.eleveId, eleveNom, type: b.type, organisme: b.organisme, taux: b.taux,
      montantFixe: b.montantFixe, fraisCibles: Array.isArray(b.fraisCibles) ? (b.fraisCibles as string[]) : null,
      periode: b.periode, version: b.version,
    })),
    plans: plans.map((p) => ({
      id: p.id, eleveId: p.eleveId, eleveNom, creanceId: p.creanceId, libelle: p.libelle,
      echeances: Array.isArray(p.echeances) ? (p.echeances as { date: string; montant: number }[]) : [],
      statut: p.statut, version: p.version,
    })),
    penalites: penalitesActives.concat(penalites.filter((p) => p.statut !== "appliquee")).map((p) => ({
      id: p.id, creanceId: p.creanceId, creanceLibelle: p.creance.libelle, montant: p.montant, statut: p.statut, version: p.version,
    })),
    avances: avances.map((a) => ({
      id: a.id, eleveId: a.eleveId, eleveNom, montant: a.montant, solde: a.solde, mode: a.mode,
      reference: a.reference, version: a.version,
    })),
    remboursements: remboursements.map((r) => ({
      id: r.id, eleveId: r.eleveId, eleveNom, paiementId: r.paiementId, montant: r.montant, motif: r.motif,
      statut: r.statut, dateValidation: r.dateValidation ? r.dateValidation.toISOString() : null, version: r.version,
    })),
    detail,
    avancesDisponibles: avances.reduce((s, a) => s + a.solde, 0),
  };
}

/**
 * Tableau de bord RECOUVREMENT (06) — agrégation serveur sur tout l'établissement pour
 * l'exercice : rien de tout ceci n'est envoyé au client en dehors des totaux.
 */
export async function statistiquesRecouvrement(
  etablissementId: string,
  exercice: string,
): Promise<{ vue: RecouvrementVue; restesParEleve: Map<string, number> }> {
  const maintenant = new Date();
  const [creances, paiementsParEleveFrais, remises, exonerations, bourses, penalitesParEleve, remboursementsPayes] =
    await Promise.all([
      prisma.creanceEleve.findMany({
        where: { etablissementId, exercice, annuleLe: null },
        select: { id: true, eleveId: true, fraisId: true, montant: true, statut: true, dateEcheance: true, creeLe: true },
      }),
      prisma.paiementScolarite.groupBy({
        by: ["eleveId", "fraisId"],
        where: { etablissementId, annule: false },
        _sum: { montant: true },
      }),
      prisma.remiseEleve.findMany({
        where: { etablissementId, annuleLe: null },
        select: { eleveId: true, fraisId: true, montant: true, pourcentage: true },
      }),
      prisma.exonerationEleve.findMany({
        where: { etablissementId, annuleLe: null },
        select: { eleveId: true, fraisId: true, type: true, taux: true, montant: true, debut: true, fin: true },
      }),
      prisma.bourseEleve.findMany({
        where: { etablissementId, annuleLe: null },
        select: { eleveId: true, fraisCibles: true, taux: true, montantFixe: true, periode: true },
      }),
      prisma.penaliteEleve.groupBy({
        by: ["eleveId"],
        where: { etablissementId, statut: "appliquee", annuleLe: null },
        _sum: { montant: true },
      }),
      prisma.demandeRemboursement.groupBy({
        by: ["eleveId"],
        where: { etablissementId, statut: "payee", annuleLe: null },
        _sum: { montant: true },
      }),
    ]);

  // Regroupements par élève.
  const eleveIds = new Set<string>(creances.map((c) => c.eleveId));
  const grpCreances = new Map<string, typeof creances>();
  for (const c of creances) {
    const l = grpCreances.get(c.eleveId) ?? [];
    l.push(c);
    grpCreances.set(c.eleveId, l);
  }
  const payeParEleve = new Map<string, number>();
  const payeParEleveFrais = new Map<string, number>();
  for (const p of paiementsParEleveFrais) {
    const m = p._sum.montant ?? 0;
    payeParEleve.set(p.eleveId, (payeParEleve.get(p.eleveId) ?? 0) + m);
    if (p.fraisId) payeParEleveFrais.set(`${p.eleveId}:${p.fraisId}`, m);
  }
  const grp = <T extends { eleveId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const l = m.get(r.eleveId) ?? [];
      l.push(r);
      m.set(r.eleveId, l);
    }
    return m;
  };
  const grpRemises = grp(remises);
  const grpExos = grp(exonerations);
  const grpBourses = grp(bourses);
  const penMap = new Map(penalitesParEleve.map((p) => [p.eleveId, p._sum.montant ?? 0]));
  const rembMap = new Map(remboursementsPayes.map((r) => [r.eleveId, r._sum.montant ?? 0]));

  let attendu = 0, encaisse = 0, netAttenduTotal = 0, recouvreTotal = 0, reste = 0;
  let totalRemises = 0, totalExonerations = 0, totalBourses = 0, totalPenalites = 0;
  let enRetardNombre = 0, enRetardMontant = 0;
  const restesParEleve = new Map<string, number>();

  for (const eleveId of eleveIds) {
    const cs = (grpCreances.get(eleveId) ?? []).map((c) => ({
      id: c.id, fraisId: c.fraisId, libelle: "", montant: Number(c.montant), devise: "XOF",
      dateEcheance: c.dateEcheance, statut: c.statut as StatutCreance, creeLe: c.creeLe, version: 0,
    }));
    const paye = payeParEleve.get(eleveId) ?? 0;
    const detail = calculerDetailSolde({
      exercice, maintenant,
      creances: cs,
      paiements: [{ fraisId: null, montant: paye }],
      remboursementsPayes: rembMap.get(eleveId) ?? 0,
      remises: grpRemises.get(eleveId) ?? [],
      exonerations: grpExos.get(eleveId) ?? [],
      bourses: (grpBourses.get(eleveId) ?? []).map((b) => ({
        fraisCibles: Array.isArray(b.fraisCibles) ? (b.fraisCibles as string[]) : null,
        taux: b.taux, montantFixe: b.montantFixe, periode: b.periode,
      })),
      penalites: penMap.get(eleveId) ?? 0,
    });
    attendu += detail.facture;
    encaisse += detail.paye;
    totalRemises += detail.remises;
    totalExonerations += detail.exonerations;
    totalBourses += detail.bourses;
    totalPenalites += detail.penalites;
    const netAttendu = Math.max(0, detail.facture - detail.remises - detail.exonerations - detail.bourses);
    netAttenduTotal += netAttendu;
    recouvreTotal += Math.min(Math.max(0, detail.paye), netAttendu);
    const resteEleve = Math.max(0, detail.solde);
    reste += resteEleve;
    if (resteEleve > 0) restesParEleve.set(eleveId, resteEleve);

    // Créances en retard : allocation des paiements par frais, dans l'ordre des échéances.
    const actives = cs.filter((c) => c.statut !== "annulee" && c.statut !== "suspendue");
    const parFrais = new Map<string, typeof actives>();
    for (const c of actives) {
      const l = parFrais.get(c.fraisId) ?? [];
      l.push(c);
      parFrais.set(c.fraisId, l);
    }
    for (const [fraisId, liste] of parFrais) {
      const alloc = allouerPaiements(liste, payeParEleveFrais.get(`${eleveId}:${fraisId}`) ?? 0);
      for (const c of liste) {
        const p = alloc.get(c.id) ?? 0;
        if (c.dateEcheance && c.dateEcheance < maintenant && p < c.montant) {
          enRetardNombre += 1;
          enRetardMontant += c.montant - p;
        }
      }
    }
  }

  return {
    vue: {
      attendu, encaisse, reste,
      taux: netAttenduTotal > 0 ? Math.round((recouvreTotal / netAttenduTotal) * 100) : 0,
      enRetardNombre, enRetardMontant,
      totalRemises, totalExonerations, totalBourses, totalPenalites,
    },
    restesParEleve,
  };
}
