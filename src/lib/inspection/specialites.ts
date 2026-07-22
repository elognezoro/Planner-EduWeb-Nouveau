import type { RoleId } from "@/lib/rbac";

/**
 * Spécialité(s) d'encadrement pédagogique (Utilisateur.specialites, JSON) — consigne client
 * 2026-07-22. Les rôles d'ENCADREMENT (inspecteur, conseiller pédagogique) renseignent leurs
 * spécialités au bloc « Ma spécialité » de Mon Profil, parmi les disciplines SIMPLES du
 * référentiel (jamais les couples « X / Y »). À la planification d'une visite de classe ou de
 * suivi, la liste des enseignants proposés est RESTREINTE à ceux dont une spécialité
 * (CompetenceEnseignant) correspond à l'une des spécialités de l'encadreur ; sans spécialité
 * renseignée, la liste n'est pas restreinte et une aide invite à compléter Mon Profil.
 */

/** Rôles d'encadrement pédagogique concernés par le bloc « Ma spécialité ». */
export const ROLES_ENCADREMENT_PEDAGOGIQUE: readonly RoleId[] = ["inspecteur", "conseiller_pedagogique"];

export function estEncadreurPedagogique(roleId: RoleId): boolean {
  return ROLES_ENCADREMENT_PEDAGOGIQUE.includes(roleId);
}

/** Lit le champ JSON `specialites` en tableau de noms — tolérant (jamais d'exception). */
export function lireSpecialites(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/**
 * Spécialités ÉLÉMENTAIRES d'un nom de discipline : un couple « Histoire / Géographie »
 * se décompose en ses deux disciplines simples (même convention que le bloc Compétences
 * de la console d'établissement).
 */
export function specialitesElementaires(nomDiscipline: string): string[] {
  return [...new Set(nomDiscipline.split("/").map((s) => s.trim()).filter(Boolean))];
}

const cle = (s: string) => s.trim().toLowerCase();

/**
 * Une des disciplines de l'enseignant (éventuellement des couples) correspond-elle à
 * l'une des spécialités de l'encadreur ? Comparaison sans casse, sur les composantes
 * élémentaires — un professeur d'« Histoire / Géographie » correspond à un inspecteur
 * d'« Histoire ».
 */
export function correspondSpecialites(
  disciplinesEnseignant: string[],
  specialitesEncadreur: string[],
): boolean {
  if (specialitesEncadreur.length === 0) return true; // pas de spécialité → pas de restriction
  const cibles = new Set(specialitesEncadreur.map(cle));
  return disciplinesEnseignant.some((d) => specialitesElementaires(d).some((e) => cibles.has(cle(e))));
}
