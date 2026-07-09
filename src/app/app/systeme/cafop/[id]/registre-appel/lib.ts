/**
 * Registre d'appel CAFOP — constantes et fonctions pures partagées (page serveur,
 * composant client, actions). Aucune dépendance serveur ici. Mêmes fonctions que le
 * registre d'appel établissement, adaptées aux élèves-maîtres.
 */

/** Absences non justifiées à partir desquelles une alerte SMS est proposée. */
export const SEUIL_ALERTE_SMS = 3;

export type StatutAppelCafop = "present" | "absent" | "retard";

export const STATUTS_CAFOP: {
  v: StatutAppelCafop;
  libelle: string;
  court: string;
  on: string;
  off: string;
}[] = [
  { v: "present", libelle: "Présent", court: "P", on: "bg-forest-600 text-white", off: "text-forest-700 hover:bg-forest-50" },
  { v: "absent", libelle: "Absent", court: "A", on: "bg-red-600 text-white", off: "text-red-600 hover:bg-red-50" },
  { v: "retard", libelle: "Retard", court: "R", on: "bg-amber-500 text-white", off: "text-amber-600 hover:bg-amber-50" },
];

export type TypeEvenementCafop = "encouragement" | "observation" | "infirmerie";

export const TYPES_EVENEMENT_CAFOP: { v: TypeEvenementCafop; libelle: string }[] = [
  { v: "encouragement", libelle: "Encouragement" },
  { v: "observation", libelle: "Observation" },
  { v: "infirmerie", libelle: "Infirmerie" },
];

/** Barème de conduite (points par événement). */
export interface BaremeConduite {
  absenceNj: number;
  retardNj: number;
  observation: number;
  encouragement: number;
}

export const BAREME_DEFAUT: BaremeConduite = {
  absenceNj: 0.5,
  retardNj: 0.25,
  observation: 0.5,
  encouragement: 0.25,
};

/**
 * Note de conduite sur 20, dérivée de l'assiduité et des événements (bornée 0..20 ;
 * l'infirmerie est neutre).
 */
export function conduiteSur20(
  absencesNonJustifiees: number,
  retardsNonJustifies: number,
  observations = 0,
  encouragements = 0,
  bareme: BaremeConduite = BAREME_DEFAUT,
): number {
  const note =
    20 -
    bareme.absenceNj * absencesNonJustifiees -
    bareme.retardNj * retardsNonJustifies -
    bareme.observation * observations +
    bareme.encouragement * encouragements;
  return Math.min(20, Math.max(0, Math.round(note * 100) / 100));
}

/** Créneaux de séance d'une heure (les CAFOP n'ont pas d'horaires configurables : liste fixe). */
export const CRENEAUX_CAFOP = [
  "07h30 - 08h30",
  "08h30 - 09h30",
  "09h30 - 10h30",
  "10h30 - 11h30",
  "15h00 - 16h00",
  "16h00 - 17h00",
  "17h00 - 18h00",
] as const;

export const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;
