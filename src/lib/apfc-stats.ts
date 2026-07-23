import "server-only";
import type { Prisma, StatutCohorte } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CATEGORIES_PEDAGOGIQUES,
  deriveCategoriePedagogique,
  estCategoriePedagogiqueValide,
} from "@/lib/referentiels/etablissement";

/**
 * Statistiques d'encadrement, de couverture et d'inspection des antennes APFC —
 * agrégations Prisma partagées par la page « Supervision APFC » : les statistiques
 * GÉNÉRALES du réseau et le bloc DÉTAILLÉ d'une antenne utilisent le même moteur,
 * seul le filtre `whereApfc` change (`{ region: { pays } }` vs `{ id }`).
 *
 * AUCUNE logique RBAC ici : l'appelant fournit un `where` DÉJÀ cloisonné (pays
 * consulté / région DRENA / antenne du périmètre) — ne jamais appeler ces
 * fonctions avec un filtre plus large que celui de la page.
 */

/** Paire libellé → effectif (répartitions par discipline, catégorie, localité…). */
export type RepartitionApfc = { libelle: string; nombre: number };

/** Visites des encadreurs rattachés aux antennes (utilisateurs avec `apfcId`). */
export type StatsInspectionApfc = {
  visitesTotal: number;
  visitesRealisees: number;
  visitesPlanifiees: number;
  /** Moyenne des notes globales /20 des visites notées (null si aucune note). */
  noteMoyenne: number | null;
  grillesRemplies: number;
};

export type StatsReseauApfc = {
  personnelTotal: number;
  /** Répartition du personnel par discipline (une personne peut compter dans plusieurs). */
  personnelParDiscipline: RepartitionApfc[];
  couvertureTotal: number;
  /** Répartition des établissements couverts par catégorie pédagogique (ordre du référentiel). */
  couvertureParCategorie: RepartitionApfc[];
  inspection: StatsInspectionApfc;
};

/** Dernière session de formation continue d'une antenne (liste courte du bloc détaillé). */
export type SessionRecenteApfc = {
  id: string;
  libelle: string;
  statut: StatutCohorte;
  apprenants: number;
};

/** Disciplines d'un PersonnelApfc (champ Json : tableau de chaînes, toléré sale à l'import). */
function disciplinesDePersonnel(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((d): d is string => typeof d === "string" && d.trim().length > 0);
}

/**
 * Statistiques agrégées d'un ensemble d'antennes (`whereApfc` cloisonné par l'appelant) :
 * personnel + disciplines, couverture par catégorie pédagogique, inspection des encadreurs.
 * 5 requêtes d'agrégation quel que soit le nombre d'antennes (pas de N+1).
 */
export async function statsReseauApfc(whereApfc: Prisma.ApfcWhereInput): Promise<StatsReseauApfc> {
  const [personnel, groupesCategorie, visitesParStatut, agregatNote, grillesRemplies] = await Promise.all([
    prisma.personnelApfc.findMany({
      where: { apfc: whereApfc },
      select: { disciplines: true },
    }),
    prisma.etablissement.groupBy({
      by: ["categoriePedagogique", "type"],
      where: { couvertureApfc: { is: { apfc: whereApfc } } },
      _count: { _all: true },
    }),
    prisma.visite.groupBy({
      by: ["statut"],
      where: { inspecteur: { apfc: whereApfc } },
      _count: { _all: true },
    }),
    prisma.visite.aggregate({
      _avg: { noteGlobale: true },
      where: { inspecteur: { apfc: whereApfc }, noteGlobale: { not: null } },
    }),
    prisma.grilleSupervision.count({
      where: { visite: { inspecteur: { apfc: whereApfc } } },
    }),
  ]);

  // Personnel par discipline (tri : effectif décroissant puis alphabétique).
  const parDiscipline = new Map<string, number>();
  for (const p of personnel) {
    for (const d of disciplinesDePersonnel(p.disciplines)) {
      parDiscipline.set(d, (parDiscipline.get(d) ?? 0) + 1);
    }
  }
  const personnelParDiscipline = [...parDiscipline.entries()]
    .map(([libelle, nombre]) => ({ libelle, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.libelle.localeCompare(b.libelle, "fr"));

  // Couverture par catégorie pédagogique : catégorie déclarée si valide, sinon dérivée
  // du type Prisma (même règle que la console de configuration — deriveCategoriePedagogique).
  const parCategorie = new Map<string, number>();
  for (const g of groupesCategorie) {
    const brut = g.categoriePedagogique;
    const cat = brut && estCategoriePedagogiqueValide(brut) ? brut : deriveCategoriePedagogique(g.type);
    parCategorie.set(cat, (parCategorie.get(cat) ?? 0) + g._count._all);
  }
  const couvertureParCategorie = CATEGORIES_PEDAGOGIQUES.filter((c) => (parCategorie.get(c.v) ?? 0) > 0).map(
    (c) => ({ libelle: c.l, nombre: parCategorie.get(c.v) ?? 0 }),
  );

  const nbVisites = (statut: string) => visitesParStatut.find((v) => v.statut === statut)?._count._all ?? 0;

  return {
    personnelTotal: personnel.length,
    personnelParDiscipline,
    couvertureTotal: groupesCategorie.reduce((s, g) => s + g._count._all, 0),
    couvertureParCategorie,
    inspection: {
      visitesTotal: visitesParStatut.reduce((s, v) => s + v._count._all, 0),
      visitesRealisees: nbVisites("realisee"),
      visitesPlanifiees: nbVisites("planifiee"),
      noteMoyenne: agregatNote._avg.noteGlobale,
      grillesRemplies,
    },
  };
}

/** Dernières sessions de formation continue d'UNE antenne (id déjà revalidé par l'appelant). */
export async function dernieresSessionsApfc(apfcId: string, limite = 5): Promise<SessionRecenteApfc[]> {
  const cohortes = await prisma.cohorte.findMany({
    where: { apfcId },
    orderBy: [{ creeLe: "desc" }],
    take: limite,
    select: { id: true, libelle: true, statut: true, _count: { select: { apprenants: true } } },
  });
  return cohortes.map((c) => ({
    id: c.id,
    libelle: c.libelle,
    statut: c.statut,
    apprenants: c._count.apprenants,
  }));
}

/** Localités (villes) les plus couvertes par UNE antenne (id déjà revalidé par l'appelant). */
export async function topLocalitesApfc(apfcId: string, limite = 5): Promise<RepartitionApfc[]> {
  const groupes = await prisma.etablissement.groupBy({
    by: ["ville"],
    where: { couvertureApfc: { is: { apfcId } }, ville: { not: null } },
    _count: { _all: true },
    orderBy: [{ _count: { ville: "desc" } }, { ville: "asc" }],
    take: limite,
  });
  return groupes.flatMap((g) => (g.ville && g.ville.trim() ? [{ libelle: g.ville, nombre: g._count._all }] : []));
}
