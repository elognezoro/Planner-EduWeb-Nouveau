import { PLANCHES, type PlancheInfo } from "./planches-data";

export { PLANCHES };
export type { PlancheInfo };

/** Titre de la collection (bouton, en-tête du lecteur, teaser). */
export const TITRE_COLLECTION = "Instants de Motivation — Shazmila et ses amis";
export const SOUS_TITRE_COLLECTION = "Shazmila & ses amis · une planche par semaine";

export const NB_PLANCHES = 52;
/** Chaque planche compte 6 cases → 6 pages dans le carnet. */
export const NB_CASES = 6;

/**
 * Ancre de calendrier : la semaine du **lundi 13 juillet 2026** (13 → 19 juillet)
 * démarre avec la **planche n°44**. Les semaines suivantes avancent d'une planche,
 * en boucle sur les 52 (après la 52 on repart à la 1).
 */
export const ANCRE = { annee: 2026, mois: 7, jour: 13, planche: 44 } as const;

const MS_PAR_SEMAINE = 7 * 24 * 60 * 60 * 1000;

/** Lundi (00:00 heure locale) de la semaine lun→dim contenant `d`. */
export function lundiDeLaSemaine(d: Date): Date {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jourLundi0 = (j.getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  j.setDate(j.getDate() - jourLundi0);
  return j;
}

/**
 * Numéro de planche (1..52) de la semaine contenant `d`, en boucle sur l'année.
 * `Math.round` sur l'écart en semaines absorbe d'éventuels décalages horaires.
 */
export function plancheDeLaSemaine(d: Date = new Date()): number {
  const ancreLundi = new Date(ANCRE.annee, ANCRE.mois - 1, ANCRE.jour);
  const lundi = lundiDeLaSemaine(d);
  const semaines = Math.round((lundi.getTime() - ancreLundi.getTime()) / MS_PAR_SEMAINE);
  const idx0 = (((ANCRE.planche - 1 + semaines) % NB_PLANCHES) + NB_PLANCHES) % NB_PLANCHES;
  return idx0 + 1;
}

/** Infos (n + titre) d'une planche donnée. */
export function infoPlanche(n: number): PlancheInfo {
  return PLANCHES[n - 1] ?? { n, titre: `Semaine ${n}` };
}

/** Chemin du SVG d'une planche (il embarque ses 6 fragments de vue `#c0`..`#c5`). */
export function cheminPlanche(n: number): string {
  return `/bd/shazmila/planche-${String(n).padStart(2, "0")}.svg`;
}

/** URL d'affichage d'une case (0..5) via fragment de vue SVG : `…svg#cK`. */
export function cheminCase(n: number, caseIndex: number): string {
  return `${cheminPlanche(n)}#c${caseIndex}`;
}

/** Libellé « du 13 au 19 juillet » de la semaine contenant `d`. */
export function libelleSemaine(d: Date = new Date()): string {
  const lundi = lundiDeLaSemaine(d);
  const dim = new Date(lundi);
  dim.setDate(dim.getDate() + 6);
  const memeMois = lundi.getMonth() === dim.getMonth();
  const jour = (x: Date) => x.toLocaleDateString("fr-FR", { day: "numeric" });
  const jourMois = (x: Date) => x.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return memeMois ? `du ${jour(lundi)} au ${jourMois(dim)}` : `du ${jourMois(lundi)} au ${jourMois(dim)}`;
}
