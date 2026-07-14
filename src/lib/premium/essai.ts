/**
 * Période d'essai d'un utilisateur (fixée par l'admin système à l'affectation à un établissement).
 * Pendant l'essai : seul l'espace « Emplois du temps » est éditable ; le reste de la plateforme
 * reste accessible mais en LECTURE SEULE. Un bandeau rouge affiche un compte à rebours et invite
 * à l'abonnement pour un accès complet sur l'année académique en cours.
 *
 * Module framework-agnostique (utilisable côté serveur ET client — pas d'import server-only).
 */

/** Contact officiel affiché dans les rappels et le bandeau d'essai. */
export const CONTACT_WHATSAPP = "(+225) 01 5263 3030";
/** Lien vers l'offre d'abonnement (page existante). */
export const LIEN_ACADEMIE_PREMIUM = "/app/vie-scolaire/academie-premium";

/** Durées d'essai rapides proposées à l'admin (en jours). */
export const DUREES_ESSAI_JOURS = [7, 14, 30, 60, 90] as const;
export const DUREE_ESSAI_DEFAUT = 30;
/** Borne de sécurité (en jours) — laisse la place aux unités mois/années (≈ 3 ans). */
export const DUREE_ESSAI_MAX = 1095;

/** Unités de durée pour le paramétrage du défaut global. */
export type UniteEssai = "jour" | "mois" | "annee";
export const UNITES_ESSAI: { id: UniteEssai; label: string }[] = [
  { id: "jour", label: "jours" },
  { id: "mois", label: "mois" },
  { id: "annee", label: "années" },
];
export const DEFAUT_ESSAI = { valeur: 7, unite: "jour" as UniteEssai, heure: null as string | null };

/** Ajoute `valeur` unités à `debut` (arithmétique de dates réelle pour mois/années). */
export function ajouterDuree(debut: Date, valeur: number, unite: UniteEssai): Date {
  const d = new Date(debut.getTime());
  const v = Math.max(1, Math.floor(Number.isFinite(valeur) ? valeur : DEFAUT_ESSAI.valeur));
  if (unite === "annee") d.setFullYear(d.getFullYear() + v);
  else if (unite === "mois") d.setMonth(d.getMonth() + v);
  else d.setDate(d.getDate() + v);
  return d;
}

/** Applique une heure de fin « HH:mm » à une date (sinon renvoie la date inchangée). */
export function appliquerHeure(d: Date, heure: string | null | undefined): Date {
  if (heure && /^\d{2}:\d{2}$/.test(heure)) {
    const [h, m] = heure.split(":").map(Number);
    const r = new Date(d.getTime());
    r.setHours(h, m, 0, 0);
    return r;
  }
  return d;
}

/** Fin d'essai = début + durée (valeur × unité), heure de fin appliquée si fournie. */
export function calculerFinEssai(debut: Date, valeur: number, unite: UniteEssai, heure?: string | null): Date {
  return appliquerHeure(ajouterDuree(debut, valeur, unite), heure);
}

const JOUR_MS = 86_400_000;

/** Vrai si la date de fin d'essai est dans le futur (essai en cours). `maintenant` injectable pour les tests. */
export function enEssai(essaiFinLe: Date | null | undefined, maintenant: number = Date.now()): boolean {
  return essaiFinLe != null && essaiFinLe.getTime() > maintenant;
}

/** Nombre de jours entiers restants avant la fin de l'essai (0 si terminé ou absent). */
export function joursRestantsEssai(essaiFinLe: Date | null | undefined, maintenant: number = Date.now()): number {
  if (!essaiFinLe) return 0;
  const ms = essaiFinLe.getTime() - maintenant;
  return ms <= 0 ? 0 : Math.ceil(ms / JOUR_MS);
}

/**
 * L'espace « Emplois du temps » est le SEUL espace éditable pendant l'essai. Couvre l'élaboration
 * des EDT côté établissement comme la vue emploi du temps de la vie scolaire.
 */
export function estCheminEmploiDuTemps(chemin: string | null | undefined): boolean {
  if (!chemin) return false;
  return (
    /\/emploi-du-temps(\/|$|\?)/.test(chemin) ||
    /\/emplois-du-temps(\/|$|\?)/.test(chemin) ||
    /\/edt(\/|$|\?)/.test(chemin)
  );
}
