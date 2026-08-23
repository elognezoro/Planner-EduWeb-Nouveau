/** Fenêtres d'observation de la présence (« Utilisateurs connectés » : liste + détail).
 *  « Temps réel » = 2 minutes : le pouls de présence est rafraîchi au plus une fois par
 *  minute, un utilisateur actif est donc toujours vu dans ce délai. */
export const FENETRES = [
  { cle: "temps-reel", libelle: "Temps réel", ms: 2 * 60_000 },
  { cle: "5min", libelle: "5 minutes", ms: 5 * 60_000 },
  { cle: "24h", libelle: "24 heures", ms: 24 * 3_600_000 },
  { cle: "semaine", libelle: "Semaine", ms: 7 * 24 * 3_600_000 },
  { cle: "mois", libelle: "Mois", ms: 30 * 24 * 3_600_000 },
  { cle: "annee", libelle: "Année", ms: 365 * 24 * 3_600_000 },
] as const;

export type CleFenetre = (typeof FENETRES)[number]["cle"];

/** Fenêtre valide depuis un paramètre d'URL (un paramètre répété arrive en tableau). */
export function fenetreDepuisParam(brut: string | string[] | undefined): CleFenetre {
  const valeur = typeof brut === "string" ? brut : "";
  return (FENETRES.find((f) => f.cle === valeur)?.cle ?? "temps-reel") as CleFenetre;
}

export function tempsRelatif(d: Date, maintenant: number): string {
  const s = Math.max(0, Math.floor((maintenant - d.getTime()) / 1000));
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 31) return `il y a ${j} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/** Rôles habilités à consulter la présence (famille « administration ») — la LISTE reste
 *  cloisonnée au périmètre de chacun via filtreUtilisateurs (fail-closed). */
export const ROLES_PRESENCE = [
  "admin",
  "superviseur_international",
  "representant_pays",
  "super_admin_etablissements",
  "super_admin_cafop",
  "super_admin_apfc",
] as const;
