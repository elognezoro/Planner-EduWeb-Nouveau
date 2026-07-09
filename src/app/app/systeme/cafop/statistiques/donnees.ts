import "server-only";
import { prisma } from "@/lib/prisma";

// ── Types du tableau de bord Statistiques CAFOP ──
export interface RangAcademique { nom: string; drena: string; moyenne: number; effectif: number }
export interface RangFeminin { nom: string; taux: number; effectif: number }
export interface Mention { libelle: string; nb: number; pct: number }
export interface CentreStat { nom: string; drena: string; effectif: number }
export interface GroupeStat { nom: string; moyenne: number; reussite: number; filles: number; garcons: number; effectif: number }
export interface GroupeCentre { centre: string; groupes: GroupeStat[] }
export interface Point { label: string; valeur: number }

export interface StatsCafop {
  pays: string;
  nbCentres: number;
  totalEleves: number;
  moyenneGenerale: number;
  tauxReussite: number;
  progressionMoyenne: number;
  tauxParticipation: number;
  cohortesActives: number;
  /** Nombre de séances (cahier de texte) ayant communiqué un lien CFPL (https://cfpl2.eduweb.ci) en Exercices. */
  liensCfplExercices: number;
  genre: { total: number; filles: number; garcons: number; pctFilles: number; pctGarcons: number };
  classementAcademique: RangAcademique[];
  classementFeminin: RangFeminin[];
  mentions: Mention[];
  parPays: { pays: string; nbCentres: number; totalEleves: number }[];
  centres: CentreStat[];
  groupeClasse: GroupeCentre[];
  effectifsParCentre: Point[];
  progressionParPromotion: Point[];
  participationMensuelle: Point[];
  effectifsParCohorte: { label: string; scolaires: number; promotions: number }[];
}

/** Hash déterministe (pour des valeurs de démonstration stables, sans Math.random). */
function h(s: string): number {
  let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = (Math.imul(n ^ s.charCodeAt(i), 16777619)) >>> 0;
  return n;
}
const arrondi = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
/** Abrège « CAFOP d'Abengourou » → « Abengourou » pour les axes. */
const court = (nom: string) => nom.replace(/^CAFOP\s+(d['’]|de\s+|du\s+)?/i, "").trim() || nom;

const MOIS = ["Oct.", "Nov.", "Déc.", "Jan.", "Fév.", "Mars", "Avr.", "Mai"];
const LIBELLES_MENTION = ["Très Bien", "Bien", "Assez Bien", "Passable", "Insuffisant"];
// Répartition indicative des mentions (démo) — somme = 100 %.
const PCT_MENTION = [0, 19, 71, 10, 0];

export async function statistiquesCafop(pays: string, cafopId?: string): Promise<StatsCafop> {
  const where = cafopId ? { id: cafopId, pays } : { pays };
  const centresBruts = await prisma.cafop.findMany({
    where,
    orderBy: { nom: "asc" },
    select: {
      nom: true,
      effectif: true,
      region: { select: { nom: true } },
      cohortes: {
        where: { type: "cafop_promotion" },
        select: { libelle: true, statut: true, progression: true, _count: { select: { apprenants: true } } },
      },
    },
  });

  // Compteur de liens « CAFOP en ligne » (https://cfpl2.eduweb.ci) communiqués au cahier de texte (Exercices).
  const liensCfplExercices = await prisma.seanceCafop.count({
    where: { cafop: where, exercicesUrl: { contains: "cfpl2.eduweb.ci", mode: "insensitive" } },
  });

  const centres: CentreStat[] = centresBruts.map((c) => ({
    nom: c.nom,
    drena: c.region?.nom ?? "—",
    effectif: c.effectif,
  }));
  const nbCentres = centres.length;
  const totalEleves = centres.reduce((s, c) => s + c.effectif, 0);

  // Cohortes (promotions) — réelles.
  const cohortes = centresBruts.flatMap((c) => c.cohortes);
  const cohortesActives = cohortes.filter((k) => k.statut === "active").length;
  const progressionMoyenne = cohortes.length ? arrondi(cohortes.reduce((s, k) => s + k.progression, 0) / cohortes.length) : 0;

  // Moyenne / mention / genre : démonstration déterministe (pas de sexe ni de notes agrégées en base).
  const moyenneDe = (nom: string) => arrondi(12.6 + (h(nom) % 190) / 100, 2); // 12.60–14.49
  const feminisationDe = (nom: string) => arrondi(48 + (h(nom + "f") % 60) / 10, 1); // 48.0–53.9 %

  const moyennes = centres.map((c) => moyenneDe(c.nom));
  const moyenneGenerale = moyennes.length ? arrondi(moyennes.reduce((a, b) => a + b, 0) / moyennes.length, 2) : 0;
  const tauxReussite = 100;

  const filles = Math.round(totalEleves * 0.501);
  const garcons = totalEleves - filles;
  const genre = {
    total: totalEleves,
    filles,
    garcons,
    pctFilles: totalEleves ? arrondi((filles / totalEleves) * 100, 1) : 0,
    pctGarcons: totalEleves ? arrondi((garcons / totalEleves) * 100, 1) : 0,
  };

  const classementAcademique: RangAcademique[] = centres
    .map((c) => ({ nom: c.nom, drena: c.drena, moyenne: moyenneDe(c.nom), effectif: c.effectif }))
    .sort((a, b) => b.moyenne - a.moyenne)
    .slice(0, 4);

  const classementFeminin: RangFeminin[] = centres
    .map((c) => ({ nom: c.nom, taux: feminisationDe(c.nom), effectif: c.effectif }))
    .sort((a, b) => b.taux - a.taux)
    .slice(0, 4);

  const mentions: Mention[] = LIBELLES_MENTION.map((libelle, i) => {
    const nb = Math.round((totalEleves * PCT_MENTION[i]) / 100);
    return { libelle, nb, pct: PCT_MENTION[i] };
  });

  const parPays = nbCentres > 0 ? [{ pays, nbCentres, totalEleves }] : [];

  // Groupes-classes (F1/F2/F3) par centre — démonstration.
  const groupeClasse: GroupeCentre[] = centres.map((c) => {
    const base = h(c.nom);
    const groupes: GroupeStat[] = ["F1", "F2", "F3"].map((nom, i) => {
      const seed = h(c.nom + nom);
      const eff = 20 + (seed % 12); // 20–31
      const fl = Math.round(eff * (0.48 + ((seed >> 3) % 8) / 100));
      return {
        nom: `Groupe ${nom}`,
        moyenne: arrondi(12.8 + ((base >> (i * 3)) % 160) / 100, 2),
        reussite: 100 - (seed % 4),
        filles: fl,
        garcons: eff - fl,
        effectif: eff,
      };
    });
    return { centre: c.nom, groupes };
  });

  const effectifsParCentre: Point[] = centres.map((c) => ({ label: court(c.nom), valeur: c.effectif }));

  // Progression moyenne par promotion (libellé) — réelle.
  const parLibelle = new Map<string, { somme: number; n: number }>();
  for (const k of cohortes) {
    const e = parLibelle.get(k.libelle) ?? { somme: 0, n: 0 };
    e.somme += k.progression;
    e.n += 1;
    parLibelle.set(k.libelle, e);
  }
  const progressionParPromotion: Point[] = [...parLibelle.entries()]
    .map(([label, v]) => ({ label: label.replace(/^Promotion\s+/i, ""), valeur: arrondi(v.somme / v.n) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Taux de participation mensuel (démo) autour d'une base stable.
  const baseP = 74 + (h(pays) % 8);
  const participationMensuelle: Point[] = MOIS.map((mois, i) => ({
    mois,
    valeur: Math.min(96, arrondi(baseP + 6 * Math.sin((i / (MOIS.length - 1)) * Math.PI))),
  })).map((p) => ({ label: p.mois, valeur: p.valeur }));
  const tauxParticipation = participationMensuelle.length
    ? arrondi(participationMensuelle.reduce((s, p) => s + p.valeur, 0) / participationMensuelle.length)
    : 0;

  // Effectifs par cohorte (démo à deux séries) par centre.
  const effectifsParCohorte = centres.map((c) => {
    const promotions = Math.max(1, Math.round(c.effectif / 60));
    return { label: court(c.nom), scolaires: c.effectif, promotions: promotions * 60 };
  });

  return {
    pays,
    nbCentres,
    totalEleves,
    moyenneGenerale,
    tauxReussite,
    progressionMoyenne,
    tauxParticipation,
    cohortesActives,
    liensCfplExercices,
    genre,
    classementAcademique,
    classementFeminin,
    mentions,
    parPays,
    centres,
    groupeClasse,
    effectifsParCentre,
    progressionParPromotion,
    participationMensuelle,
    effectifsParCohorte,
  };
}
