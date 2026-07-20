// Terme local désignant les « APFC » selon le pays (ex. « ADEN », « ANFEC »). Utilitaire pur,
// utilisable côté client comme serveur. La lecture en base est dans apfc-terme-serveur.ts.
// Miroir exact de cafop-terme.ts, pour la même mécanique appliquée aux APFC.

export const TERME_APFC_DEFAUT = "APFC";

/** Remplace « APFC » par le terme local dans un texte (invariant si terme vide ou par défaut). */
export function appliquerTermeApfc(texte: string, terme: string | null | undefined): string {
  const t = (terme ?? "").trim();
  return !t || t === TERME_APFC_DEFAUT ? texte : texte.replaceAll("APFC", t);
}
