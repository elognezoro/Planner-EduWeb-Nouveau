/**
 * Registre d'appel — constantes et fonctions pures, partagées entre la page serveur,
 * le composant client et les actions. Aucune dépendance serveur ici.
 */

/** Nombre d'absences non justifiées à partir duquel une alerte SMS est proposée. */
export const SEUIL_ALERTE_SMS = 3;

export type StatutAppel = "present" | "absent" | "retard" | "excuse";

export const STATUTS_APPEL: { v: StatutAppel; libelle: string; court: string }[] = [
  { v: "present", libelle: "Présent", court: "P" },
  { v: "absent", libelle: "Absent", court: "A" },
  { v: "retard", libelle: "Retard", court: "R" },
  { v: "excuse", libelle: "Excusé", court: "E" },
];

/**
 * Note de conduite sur 20, dérivée de l'assiduité et des événements du registre :
 * −0,5 par absence non justifiée, −0,25 par retard non justifié,
 * −0,5 par observation disciplinaire, +0,25 par encouragement (bornée 0..20).
 * L'infirmerie est neutre. Règle simple V1, affichée en légende.
 */
export function conduiteSur20(
  absencesNonJustifiees: number,
  retardsNonJustifies: number,
  observations = 0,
  encouragements = 0,
): number {
  const note =
    20 - 0.5 * absencesNonJustifiees - 0.25 * retardsNonJustifies - 0.5 * observations + 0.25 * encouragements;
  return Math.min(20, Math.max(0, Math.round(note * 100) / 100));
}

function minutes(hhmm: string | null | undefined, defaut: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? defaut).trim());
  if (!m) return minutes(defaut, defaut);
  return Number(m[1]) * 60 + Number(m[2]);
}

function libelleHeure(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const mn = totalMin % 60;
  return `${String(h).padStart(2, "0")}h${String(mn).padStart(2, "0")}`;
}

/**
 * Créneaux de séance d'une heure, générés depuis les horaires de l'établissement
 * (matin : début → pause méridienne ; après-midi : reprise → fin de journée).
 * Ex : « 07h30 - 08h30 », « 08h30 - 09h30 », …
 */
export function creneauxSeance(horaires: {
  horaireDebutMatin?: string | null;
  horairePauseMidiDebut?: string | null;
  horaireRepriseApresMidi?: string | null;
  horaireFinJournee?: string | null;
}): string[] {
  const debut = minutes(horaires.horaireDebutMatin, "07:30");
  const pause = minutes(horaires.horairePauseMidiDebut, "12:00");
  const reprise = minutes(horaires.horaireRepriseApresMidi, "15:00");
  const fin = minutes(horaires.horaireFinJournee, "18:00");

  const slots: string[] = [];
  for (let t = debut; t + 60 <= pause; t += 60) slots.push(`${libelleHeure(t)} - ${libelleHeure(t + 60)}`);
  for (let t = reprise; t + 60 <= fin; t += 60) slots.push(`${libelleHeure(t)} - ${libelleHeure(t + 60)}`);
  return slots;
}

export const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;
