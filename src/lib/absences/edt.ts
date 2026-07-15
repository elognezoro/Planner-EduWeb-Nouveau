import "server-only";
import { prisma } from "@/lib/prisma";
import type { CycleNiveau } from "@prisma/client";

/**
 * Outils de dérivation des CLASSES PÉDAGOGIQUES AFFECTÉES et des SUPPLÉANTS possibles à partir
 * de l'emploi du temps (modèle Creneau) pour une demande d'autorisation d'absence.
 *
 * Convention `Creneau.jour` : 0 = lundi … 5 = samedi (le dimanche n'existe pas). Une date se
 * convertit en jour via jourModele() ci-dessous (aligné sur EXTRACT(ISODOW)-1 côté SQL).
 */

export const LIBELLE_JOUR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;
export const LIBELLE_CYCLE: Record<string, string> = {
  prescolaire: "Préscolaire",
  primaire: "Primaire",
  college: "Collège",
  lycee: "Lycée",
};

/** Jour de semaine (0 = lundi … 5 = samedi) d'une date UTC ; null pour le dimanche. */
export function jourModele(d: Date): number | null {
  const dow = d.getUTCDay(); // 0 = dimanche … 6 = samedi
  if (dow === 0) return null;
  return dow - 1; // lundi = 0 … samedi = 5
}

/** Nombre de jours ouvrables (hors dimanche) d'une plage inclusive [debut, fin]. */
export function nbJoursOuvrables(debut: Date, fin: Date): number {
  let n = 0;
  const cur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate()));
  const stop = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate()));
  let garde = 0;
  while (cur <= stop && garde < 400) {
    if (jourModele(cur) !== null) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
    garde++;
  }
  return n;
}

/** Jours de semaine (0..5) DISTINCTS couverts par la plage inclusive [debut, fin]. */
export function joursCouverts(debut: Date, fin: Date): number[] {
  const jours = new Set<number>();
  const cur = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate()));
  const stop = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate()));
  let garde = 0;
  while (cur <= stop && garde < 400) {
    const j = jourModele(cur);
    if (j !== null) jours.add(j);
    if (jours.size === 6) break;
    cur.setUTCDate(cur.getUTCDate() + 1);
    garde++;
  }
  return [...jours].sort((a, b) => a - b);
}

export interface ClasseAffectee {
  classeId: string;
  classeNom: string;
  disciplineId: string;
  disciplineNom: string;
  jours: number[];
  nbSeances: number;
}

/**
 * Classes/disciplines pédagogiques d'un enseignant tombant sur les `jours` d'absence, avec le
 * nombre de séances (créneaux) affectées. Agrégation côté base (groupBy) : jamais de chargement
 * de toutes les lignes.
 */
export async function classesAffectees(
  enseignantId: string,
  etablissementId: string,
  jours: number[],
): Promise<ClasseAffectee[]> {
  if (jours.length === 0) return [];
  const groupes = await prisma.creneau.groupBy({
    by: ["classeId", "classeNom", "disciplineId", "disciplineNom", "jour"],
    where: { enseignantId, etablissementId, jour: { in: jours } },
    _count: { _all: true },
    _sum: { duree: true },
  });
  const parClasseDiscipline = new Map<string, ClasseAffectee>();
  for (const g of groupes) {
    const cle = `${g.classeId}|${g.disciplineId}`;
    const existant = parClasseDiscipline.get(cle);
    if (existant) {
      if (!existant.jours.includes(g.jour)) existant.jours.push(g.jour);
      existant.nbSeances += g._count._all;
    } else {
      parClasseDiscipline.set(cle, {
        classeId: g.classeId,
        classeNom: g.classeNom,
        disciplineId: g.disciplineId,
        disciplineNom: g.disciplineNom,
        jours: [g.jour],
        nbSeances: g._count._all,
      });
    }
  }
  const liste = [...parClasseDiscipline.values()];
  for (const c of liste) c.jours.sort((a, b) => a - b);
  liste.sort((a, b) => a.classeNom.localeCompare(b.classeNom, "fr") || a.disciplineNom.localeCompare(b.disciplineNom, "fr"));
  return liste;
}

/** Cycles (college, lycee, …) des classes affectées — via Classe.niveau.cycle. */
export async function cyclesDesClasses(classeIds: string[]): Promise<CycleNiveau[]> {
  if (classeIds.length === 0) return [];
  const classes = await prisma.classe.findMany({
    where: { id: { in: classeIds } },
    select: { niveau: { select: { cycle: true } } },
  });
  return [...new Set(classes.map((c) => c.niveau.cycle))];
}

export interface Suppleant {
  id: string;
  nom: string;
  disciplines: string[];
  cycles: string[];
}

/**
 * Collègues pouvant suppléer : MÊME établissement, rôle enseignant, DIFFÉRENT du demandeur,
 * compétents sur au moins une des `disciplineIds` affectées ET intervenant dans au moins un des
 * `cycles` des classes affectées (conjonction stricte demandée par le cahier des charges).
 */
export async function suppleantsPossibles(
  etablissementId: string,
  demandeurId: string,
  disciplineIds: string[],
  cycles: CycleNiveau[],
): Promise<Suppleant[]> {
  if (disciplineIds.length === 0 || cycles.length === 0) return [];
  const colleagues = await prisma.utilisateur.findMany({
    where: {
      id: { not: demandeurId },
      etablissementId,
      roleActif: { is: { nomTechnique: "enseignant" } },
      competences: { some: { disciplineId: { in: disciplineIds } } },
      niveauxIntervention: { some: { niveau: { is: { cycle: { in: cycles } } } } },
    },
    select: {
      id: true,
      nom: true,
      prenoms: true,
      email: true,
      competences: {
        where: { disciplineId: { in: disciplineIds } },
        select: { discipline: { select: { nom: true } } },
      },
      niveauxIntervention: {
        where: { niveau: { cycle: { in: cycles } } },
        select: { niveau: { select: { cycle: true } } },
      },
    },
    orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
  });

  return colleagues.map((c) => ({
    id: c.id,
    nom: [c.prenoms, c.nom].filter(Boolean).join(" ").trim() || c.email,
    disciplines: [...new Set(c.competences.map((x) => x.discipline.nom))],
    cycles: [...new Set(c.niveauxIntervention.map((x) => LIBELLE_CYCLE[x.niveau.cycle] ?? x.niveau.cycle))],
  }));
}
