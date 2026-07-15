import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Agrégats de consultation du réseau catholique (SEDEC/SENEC) : chiffres par
 * établissement et par périmètre (diocèse, pays). Lecture seule — aucune écriture.
 */

export interface AgregatsEtablissement {
  eleves: number;
  enseignants: number;
  classes: number;
  salles: number;
  appels: number;
  /** % de présence (présents + retards / total pointages), null si aucun pointage. */
  tauxPresence: number | null;
  /** Moyenne générale des notes ramenées sur 20, null si aucune note. */
  moyenneGenerale: number | null;
  nbNotes: number;
}

/** Taux de présence (%) sur un périmètre d'établissements, null si aucun pointage. */
export async function tauxPresence(whereEtab: Prisma.EtablissementWhereInput): Promise<{ taux: number | null; total: number }> {
  const g = await prisma.presence.groupBy({
    by: ["statut"],
    where: { appel: { classe: { etablissement: whereEtab } } },
    _count: { _all: true },
  });
  const total = g.reduce((s, x) => s + x._count._all, 0);
  if (total === 0) return { taux: null, total: 0 };
  const presents = g.filter((x) => x.statut === "present" || x.statut === "retard").reduce((s, x) => s + x._count._all, 0);
  return { taux: Math.round((presents / total) * 1000) / 10, total };
}

/** Moyenne générale (/20) des notes d'un périmètre, null si aucune note. Notes ramenées sur 20 (valeur/sur). */
export async function moyenneGenerale(whereEtab: Prisma.EtablissementWhereInput): Promise<{ moyenne: number | null; nb: number }> {
  const notes = await prisma.note.findMany({
    where: { classe: { etablissement: whereEtab } },
    select: { valeur: true, sur: true },
    take: 50_000,
  });
  if (notes.length === 0) return { moyenne: null, nb: 0 };
  const somme = notes.reduce((s, n) => s + (n.sur > 0 ? (n.valeur / n.sur) * 20 : 0), 0);
  return { moyenne: Math.round((somme / notes.length) * 100) / 100, nb: notes.length };
}

/** Chiffres clés d'un établissement donné. */
export async function agregatsEtablissement(etablissementId: string): Promise<AgregatsEtablissement> {
  const whereEtab: Prisma.EtablissementWhereInput = { id: etablissementId };
  const [eleves, enseignants, classes, salles, appels, presence, notes] = await Promise.all([
    prisma.utilisateur.count({ where: { etablissementId, roleActif: { nomTechnique: "eleve" } } }),
    prisma.utilisateur.count({ where: { etablissementId, roleActif: { nomTechnique: "enseignant" } } }),
    prisma.classe.count({ where: { etablissementId } }),
    prisma.salle.count({ where: { etablissementId } }),
    prisma.appel.count({ where: { classe: { etablissementId } } }),
    tauxPresence(whereEtab),
    moyenneGenerale(whereEtab),
  ]);
  return {
    eleves, enseignants, classes, salles, appels,
    tauxPresence: presence.taux,
    moyenneGenerale: notes.moyenne,
    nbNotes: notes.nb,
  };
}

export interface LigneEtablissementReseau {
  id: string;
  nom: string;
  ville: string | null;
  diocese: string | null;
  eleves: number;
  enseignants: number;
  classes: number;
}

/** Une ligne par établissement du périmètre, avec effectifs (élèves, enseignants, classes). */
export async function lignesReseau(whereEtab: Prisma.EtablissementWhereInput): Promise<LigneEtablissementReseau[]> {
  const etabs = await prisma.etablissement.findMany({
    where: whereEtab,
    select: { id: true, nom: true, ville: true, diocese: true },
    orderBy: [{ diocese: "asc" }, { nom: "asc" }],
  });
  const ids = etabs.map((e) => e.id);
  if (ids.length === 0) return [];
  const [gEleves, gEnseignants, gClasses] = await Promise.all([
    prisma.utilisateur.groupBy({
      by: ["etablissementId"],
      where: { etablissementId: { in: ids }, roleActif: { nomTechnique: "eleve" } },
      _count: { _all: true },
    }),
    prisma.utilisateur.groupBy({
      by: ["etablissementId"],
      where: { etablissementId: { in: ids }, roleActif: { nomTechnique: "enseignant" } },
      _count: { _all: true },
    }),
    prisma.classe.groupBy({ by: ["etablissementId"], where: { etablissementId: { in: ids } }, _count: { _all: true } }),
  ]);
  const carte = (g: { etablissementId: string | null; _count: { _all: number } }[]) =>
    new Map(g.map((x) => [x.etablissementId, x._count._all]));
  const mEleves = carte(gEleves);
  const mEnseignants = carte(gEnseignants);
  const mClasses = carte(gClasses);
  return etabs.map((e) => ({
    ...e,
    eleves: mEleves.get(e.id) ?? 0,
    enseignants: mEnseignants.get(e.id) ?? 0,
    classes: mClasses.get(e.id) ?? 0,
  }));
}

/** Échappement HTML pour les documents Word générés (HTML servi en application/msword). */
export function echapperHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const dateFrLongue = (d: Date = new Date()) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
