import "server-only";
import { Prisma } from "@prisma/client";
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

/**
 * Moyenne générale (/20) des notes d'un périmètre, null si aucune note exploitable.
 * Agrégée CÔTÉ BASE (groupBy par barème « sur ») : exacte quel que soit le volume —
 * Σ(valeur)/sur×20 par barème, puis moyenne pondérée par les effectifs de chaque barème.
 * Les notes au barème invalide (sur ≤ 0) sont exclues.
 */
export async function moyenneGenerale(whereEtab: Prisma.EtablissementWhereInput): Promise<{ moyenne: number | null; nb: number }> {
  const g = await prisma.note.groupBy({
    by: ["sur"],
    where: { classe: { etablissement: whereEtab }, sur: { gt: 0 } },
    _sum: { valeur: true },
    _count: { _all: true },
  });
  const nb = g.reduce((s, x) => s + x._count._all, 0);
  if (nb === 0) return { moyenne: null, nb: 0 };
  const somme = g.reduce((s, x) => s + ((x._sum.valeur ?? 0) / x.sur) * 20, 0);
  return { moyenne: Math.round((somme / nb) * 100) / 100, nb };
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

interface StatsPresence {
  pointages: number;
  presents: number;
  absentsNJ: number;
}
const tauxDe = (s: StatsPresence | undefined): number | null =>
  s && s.pointages > 0 ? Math.round((s.presents / s.pointages) * 1000) / 10 : null;

/**
 * Statistiques PAR CLASSE d'un établissement (alimentent le rapport d'établissement) :
 * effectif inscrit, assiduité (taux, absences non justifiées) et moyenne /20 — le tout
 * agrégé côté base (groupBy + jointure SQL), sur l'ensemble des données de la classe.
 */
export interface LigneClasse {
  classeId: string;
  nom: string;
  niveau: string;
  ordre: number;
  eleves: number;
  tauxPresence: number | null;
  absentsNJ: number;
  moyenne: number | null;
  nbNotes: number;
}
export async function statsParClasse(etablissementId: string): Promise<LigneClasse[]> {
  const [classes, pointages, notes] = await Promise.all([
    prisma.classe.findMany({
      where: { etablissementId },
      include: { niveau: { select: { nom: true, ordre: true } }, _count: { select: { inscriptions: true } } },
    }),
    prisma.$queryRaw<{ classeId: string; statut: string; justifie: boolean; nb: bigint }[]>`
      SELECT a."classeId", p."statut"::text AS "statut", p."justifie", COUNT(*)::bigint AS nb
      FROM "presences" p
      JOIN "appels" a ON a."id" = p."appelId"
      JOIN "classes" c ON c."id" = a."classeId"
      WHERE c."etablissementId" = ${etablissementId}
      GROUP BY 1, 2, 3`,
    prisma.note.groupBy({
      by: ["classeId", "sur"],
      where: { classe: { etablissementId }, sur: { gt: 0 } },
      _sum: { valeur: true },
      _count: { _all: true },
    }),
  ]);
  const presences = new Map<string, StatsPresence>();
  for (const p of pointages) {
    const s = presences.get(p.classeId) ?? { pointages: 0, presents: 0, absentsNJ: 0 };
    const nb = Number(p.nb);
    s.pointages += nb;
    if (p.statut === "present" || p.statut === "retard") s.presents += nb;
    if (p.statut === "absent" && !p.justifie) s.absentsNJ += nb;
    presences.set(p.classeId, s);
  }
  const moyennes = new Map<string, { somme: number; nb: number }>();
  for (const g of notes) {
    const m = moyennes.get(g.classeId) ?? { somme: 0, nb: 0 };
    m.somme += ((g._sum.valeur ?? 0) / g.sur) * 20;
    m.nb += g._count._all;
    moyennes.set(g.classeId, m);
  }
  return classes
    .map((c) => {
      const m = moyennes.get(c.id);
      return {
        classeId: c.id,
        nom: c.nom,
        niveau: c.niveau.nom,
        ordre: c.niveau.ordre,
        eleves: c._count.inscriptions,
        tauxPresence: tauxDe(presences.get(c.id)),
        absentsNJ: presences.get(c.id)?.absentsNJ ?? 0,
        moyenne: m ? Math.round((m.somme / m.nb) * 100) / 100 : null,
        nbNotes: m?.nb ?? 0,
      };
    })
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));
}

/**
 * Assiduité et moyenne PAR ÉTABLISSEMENT d'un périmètre (alimentent le rapport de
 * SEDEC — un établissement par ligne — et, regroupées par diocèse, le rapport de SENEC).
 */
export interface StatsEtablissement {
  tauxPresence: number | null;
  absentsNJ: number;
  moyenne: number | null;
  nbNotes: number;
  /** Bruts (pour ré-agréger exactement par diocèse dans le rapport du SENEC). */
  pointages: number;
  presents: number;
  sommeSur20: number;
}
export async function statsParEtablissement(whereEtab: Prisma.EtablissementWhereInput): Promise<Map<string, StatsEtablissement>> {
  const etabs = await prisma.etablissement.findMany({ where: whereEtab, select: { id: true } });
  const ids = etabs.map((e) => e.id);
  const resultat = new Map<string, StatsEtablissement>();
  if (ids.length === 0) return resultat;

  const [pointages, classes, notes] = await Promise.all([
    prisma.$queryRaw<{ etablissementId: string; statut: string; justifie: boolean; nb: bigint }[]>(Prisma.sql`
      SELECT c."etablissementId", p."statut"::text AS "statut", p."justifie", COUNT(*)::bigint AS nb
      FROM "presences" p
      JOIN "appels" a ON a."id" = p."appelId"
      JOIN "classes" c ON c."id" = a."classeId"
      WHERE c."etablissementId" IN (${Prisma.join(ids)})
      GROUP BY 1, 2, 3`),
    prisma.classe.findMany({ where: { etablissementId: { in: ids } }, select: { id: true, etablissementId: true } }),
    prisma.note.groupBy({
      by: ["classeId", "sur"],
      where: { classe: { etablissementId: { in: ids } }, sur: { gt: 0 } },
      _sum: { valeur: true },
      _count: { _all: true },
    }),
  ]);

  const presences = new Map<string, StatsPresence>();
  for (const p of pointages) {
    const s = presences.get(p.etablissementId) ?? { pointages: 0, presents: 0, absentsNJ: 0 };
    const nb = Number(p.nb);
    s.pointages += nb;
    if (p.statut === "present" || p.statut === "retard") s.presents += nb;
    if (p.statut === "absent" && !p.justifie) s.absentsNJ += nb;
    presences.set(p.etablissementId, s);
  }
  const etabDeClasse = new Map(classes.map((c) => [c.id, c.etablissementId]));
  const moyennes = new Map<string, { somme: number; nb: number }>();
  for (const g of notes) {
    const etabId = etabDeClasse.get(g.classeId);
    if (!etabId) continue;
    const m = moyennes.get(etabId) ?? { somme: 0, nb: 0 };
    m.somme += ((g._sum.valeur ?? 0) / g.sur) * 20;
    m.nb += g._count._all;
    moyennes.set(etabId, m);
  }
  for (const id of ids) {
    const m = moyennes.get(id);
    const p = presences.get(id);
    resultat.set(id, {
      tauxPresence: tauxDe(p),
      absentsNJ: p?.absentsNJ ?? 0,
      moyenne: m ? Math.round((m.somme / m.nb) * 100) / 100 : null,
      nbNotes: m?.nb ?? 0,
      pointages: p?.pointages ?? 0,
      presents: p?.presents ?? 0,
      sommeSur20: m?.somme ?? 0,
    });
  }
  return resultat;
}

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

export interface Heatmap {
  slots: string[];
  rangees: { libelle: string; cellules: (number | null)[] }[];
  /** Valeur max des cellules (pour l'échelle de couleur). */
  max: number;
}

/**
 * Heatmap d'assiduité des ÉLÈVES : taux de présence (%) par jour de semaine × créneau,
 * agrégé côté base sur toutes les séances horodatées (facultativement d'une classe).
 */
export async function heatmapPresenceEleves(etablissementId: string, classeId?: string): Promise<Heatmap | null> {
  const rows = await prisma.$queryRaw<{ dow: number; heure: string; presents: bigint; total: bigint }[]>(Prisma.sql`
    SELECT EXTRACT(ISODOW FROM a."date")::int AS dow, a."heureSeance" AS heure,
           COUNT(*) FILTER (WHERE p."statut" <> 'absent')::bigint AS presents,
           COUNT(*)::bigint AS total
    FROM "presences" p
    JOIN "appels" a ON a."id" = p."appelId"
    JOIN "classes" c ON c."id" = a."classeId"
    WHERE c."etablissementId" = ${etablissementId}
      AND a."heureSeance" IS NOT NULL
      ${classeId ? Prisma.sql`AND a."classeId" = ${classeId}` : Prisma.empty}
    GROUP BY 1, 2`);
  if (rows.length === 0) return null;
  // ISODOW : 1 = lundi … 7 = dimanche → 0..5 (samedi), on ignore le dimanche.
  const cellule = new Map<string, { presents: number; total: number }>();
  const slotsSet = new Set<string>();
  const joursSet = new Set<number>();
  for (const r of rows) {
    const jour = r.dow - 1;
    if (jour < 0 || jour > 5) continue;
    const heure = (r.heure ?? "").split(" - ")[0].trim() || "?";
    slotsSet.add(heure);
    joursSet.add(jour);
    const cle = `${jour}|${heure}`;
    const c = cellule.get(cle) ?? { presents: 0, total: 0 };
    c.presents += Number(r.presents);
    c.total += Number(r.total);
    cellule.set(cle, c);
  }
  const slots = [...slotsSet].sort();
  const jours = [...joursSet].sort((a, b) => a - b);
  if (slots.length === 0 || jours.length === 0) return null;
  return {
    slots,
    max: 100,
    rangees: jours.map((j) => ({
      libelle: JOURS_SEMAINE[j],
      cellules: slots.map((s) => {
        const c = cellule.get(`${j}|${s}`);
        return c && c.total > 0 ? Math.round((c.presents / c.total) * 100) : null;
      }),
    })),
  };
}

/**
 * Heatmap des ABSENCES des enseignants : nombre de demi-journées d'absence
 * par enseignant (lignes) × mois (colonnes), sur l'année/les 12 derniers mois.
 */
export async function heatmapAbsencesEnseignants(etablissementId: string): Promise<Heatmap | null> {
  const rows = await prisma.absenceEnseignant.findMany({
    where: { etablissementId },
    select: { enseignantId: true, date: true, demiJournee: true, enseignant: { select: { nom: true, prenoms: true, email: true } } },
  });
  if (rows.length === 0) return null;
  const moisSet = new Set<string>();
  const parEns = new Map<string, { nom: string; parMois: Map<string, number> }>();
  for (const r of rows) {
    const mois = `${r.date.getUTCFullYear()}-${String(r.date.getUTCMonth() + 1).padStart(2, "0")}`;
    moisSet.add(mois);
    const nom = [r.enseignant.prenoms, r.enseignant.nom].filter(Boolean).join(" ").trim() || r.enseignant.email;
    const e = parEns.get(r.enseignantId) ?? { nom, parMois: new Map() };
    const demi = r.demiJournee === "journee" ? 2 : 1;
    e.parMois.set(mois, (e.parMois.get(mois) ?? 0) + demi);
    parEns.set(r.enseignantId, e);
  }
  const mois = [...moisSet].sort();
  const enseignants = [...parEns.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  let max = 0;
  for (const e of enseignants) for (const m of mois) max = Math.max(max, e.parMois.get(m) ?? 0);
  const libelleMois = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(y, mo - 1, 1)));
  };
  return {
    slots: mois.map(libelleMois),
    max: Math.max(1, max),
    rangees: enseignants.map((e) => ({
      libelle: e.nom,
      cellules: mois.map((m) => e.parMois.get(m) ?? 0),
    })),
  };
}

/** Échappement HTML pour les documents Word générés (HTML servi en application/msword). */
export function echapperHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const dateFrLongue = (d: Date = new Date()) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
