// Terme local désignant les « CAFOP » selon le pays (ex. « IFM », « CRFPE »). Utilitaire pur,
// utilisable côté client comme serveur. La lecture en base est dans cafop-terme-serveur.ts.

export const TERME_CAFOP_DEFAUT = "CAFOP";

/** Remplace « CAFOP » par le terme local dans un texte (invariant si terme vide ou par défaut). */
export function appliquerTerme(texte: string, terme: string | null | undefined): string {
  const t = (terme ?? "").trim();
  return !t || t === TERME_CAFOP_DEFAUT ? texte : texte.replaceAll("CAFOP", t);
}
