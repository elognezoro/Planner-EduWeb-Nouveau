/**
 * Heures de service OFFICIELLES dues par un enseignant, par cycle (norme nationale).
 * Ce sont les heures « dues » de référence — maintenues quelle que soit la configuration :
 * au-delà, ce sont des HEURES SUPPLÉMENTAIRES. Le plafond de service (Etablissement.volumeHoraire*)
 * borne le maximum atteignable, heures supplémentaires comprises ; l'IA peut le relever pour
 * débloquer une génération quand le facteur bloquant est le volume horaire dû (voir corrections-auto).
 */

export const HEURES_DUES_1ER_CYCLE = 21; // collège
export const HEURES_DUES_2ND_CYCLE = 18; // lycée (compétent sur les deux cycles)

/** Heures dues officielles pour un cycle donné (« lycee » = 2nd cycle, sinon 1er cycle). */
export function heuresDuesOfficielles(cycle: string): number {
  return cycle === "lycee" ? HEURES_DUES_2ND_CYCLE : HEURES_DUES_1ER_CYCLE;
}
