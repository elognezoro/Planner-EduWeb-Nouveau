import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { nbJoursOuvrables } from "./edt";

/**
 * Statistiques des absences AUTORISÉES et des séances de RATTRAPAGE, agrégées sur un ensemble de
 * demandes défini par un filtre Prisma (demandeur, établissement, région, réseau catholique…).
 * L'agrégation ne porte que sur des lignes de demandes (bornées), jamais sur les élèves/notes.
 */

export interface StatsAbsences {
  total: number;
  enAttente: number;
  approuvees: number;
  refusees: number;
  /** Jours ouvrables d'absence cumulés (demandes approuvées). */
  joursAbsence: number;
  /** Séances pédagogiques affectées (demandes approuvées). */
  seancesAffectees: number;
  /** Demandes approuvées couvertes par une suppléance. */
  avecSuppleance: number;
  /** Demandes approuvées à couvrir par rattrapage (pas de suppléance). */
  sansSuppleance: number;
  /** Séances à rattraper (somme des séances affectées des demandes approuvées sans suppléance). */
  seancesARattraper: number;
  /** Dates de rattrapage planifiées (demandes approuvées sans suppléance). */
  datesRattrapagePrevues: number;
}

const VIDE: StatsAbsences = {
  total: 0, enAttente: 0, approuvees: 0, refusees: 0, joursAbsence: 0,
  seancesAffectees: 0, avecSuppleance: 0, sansSuppleance: 0, seancesARattraper: 0, datesRattrapagePrevues: 0,
};

function longueurTableau(v: Prisma.JsonValue | null): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Agrège les statistiques d'absences pour un périmètre donné (filtre sur DemandeAbsence). */
export async function statsAbsences(where: Prisma.DemandeAbsenceWhereInput): Promise<StatsAbsences> {
  const [parStatut, approuvees] = await Promise.all([
    prisma.demandeAbsence.groupBy({ by: ["statut"], where, _count: { _all: true } }),
    prisma.demandeAbsence.findMany({
      where: { ...where, statut: "approuvee" },
      select: { dateDebut: true, dateFin: true, nbSeancesAffectees: true, avecSuppleance: true, datesRattrapage: true },
    }),
  ]);

  const stats: StatsAbsences = { ...VIDE };
  for (const g of parStatut) {
    stats.total += g._count._all;
    if (g.statut === "en_attente") stats.enAttente = g._count._all;
    else if (g.statut === "approuvee") stats.approuvees = g._count._all;
    else if (g.statut === "refusee") stats.refusees = g._count._all;
  }
  for (const d of approuvees) {
    stats.joursAbsence += nbJoursOuvrables(d.dateDebut, d.dateFin);
    stats.seancesAffectees += d.nbSeancesAffectees;
    if (d.avecSuppleance) {
      stats.avecSuppleance += 1;
    } else {
      stats.sansSuppleance += 1;
      stats.seancesARattraper += d.nbSeancesAffectees;
      stats.datesRattrapagePrevues += longueurTableau(d.datesRattrapage);
    }
  }
  return stats;
}

export interface StatsParEtab {
  etablissementId: string;
  nom: string;
  diocese: string | null;
  stats: StatsAbsences;
}

/**
 * Ventilation des statistiques d'absences PAR établissement, sur un ensemble d'établissements
 * (défini par un filtre Prisma Etablissement — issu de filtreEtablissements du périmètre).
 * Utilisé par les espaces dédiés du directeur régional, du SEDEC et du SENEC.
 */
export async function statsAbsencesParEtablissement(
  etabWhere: Prisma.EtablissementWhereInput,
): Promise<{ global: StatsAbsences; parEtablissement: StatsParEtab[] }> {
  const etablissements = await prisma.etablissement.findMany({
    where: etabWhere,
    select: { id: true, nom: true, diocese: true },
    orderBy: { nom: "asc" },
  });
  if (etablissements.length === 0) return { global: { ...VIDE }, parEtablissement: [] };

  const ids = etablissements.map((e) => e.id);
  const demandes = await prisma.demandeAbsence.findMany({
    where: { etablissementId: { in: ids } },
    select: {
      etablissementId: true, statut: true, dateDebut: true, dateFin: true,
      nbSeancesAffectees: true, avecSuppleance: true, datesRattrapage: true,
    },
  });

  const parEtab = new Map<string, StatsAbsences>();
  for (const e of etablissements) parEtab.set(e.id, { ...VIDE });
  const global: StatsAbsences = { ...VIDE };

  for (const d of demandes) {
    const s = parEtab.get(d.etablissementId);
    if (!s) continue;
    s.total += 1; global.total += 1;
    if (d.statut === "en_attente") { s.enAttente += 1; global.enAttente += 1; }
    else if (d.statut === "refusee") { s.refusees += 1; global.refusees += 1; }
    else if (d.statut === "approuvee") {
      s.approuvees += 1; global.approuvees += 1;
      const jours = nbJoursOuvrables(d.dateDebut, d.dateFin);
      s.joursAbsence += jours; global.joursAbsence += jours;
      s.seancesAffectees += d.nbSeancesAffectees; global.seancesAffectees += d.nbSeancesAffectees;
      if (d.avecSuppleance) { s.avecSuppleance += 1; global.avecSuppleance += 1; }
      else {
        s.sansSuppleance += 1; global.sansSuppleance += 1;
        s.seancesARattraper += d.nbSeancesAffectees; global.seancesARattraper += d.nbSeancesAffectees;
        const dr = longueurTableau(d.datesRattrapage);
        s.datesRattrapagePrevues += dr; global.datesRattrapagePrevues += dr;
      }
    }
  }

  const parEtablissement: StatsParEtab[] = etablissements
    .map((e) => ({ etablissementId: e.id, nom: e.nom, diocese: e.diocese, stats: parEtab.get(e.id)! }))
    .filter((x) => x.stats.total > 0)
    .sort((a, b) => b.stats.joursAbsence - a.stats.joursAbsence || a.nom.localeCompare(b.nom, "fr"));

  return { global, parEtablissement };
}
