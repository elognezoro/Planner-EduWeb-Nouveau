/**
 * Chemin de RETOUR après reconnexion : l'utilisateur revient directement sur la page où il
 * était. Alimenté par (1) le veilleur d'inactivité (déconnexion automatique) et (2) la garde
 * requireUtilisateur (session expirée — en-tête x-pathname posé par le proxy).
 *
 * SÉCURITÉ (anti open-redirect, durci par revue adversariale) : seul un chemin INTERNE de
 * l'application est accepté — « /app » exactement, ou « /app/… » / « /app?… ». Refusés :
 * URL absolue, « //hote », antislash, caractère de contrôle ou espace, segments « . » / « .. »
 * (le navigateur normaliserait hors du sous-arbre /app), longueur excessive. Toute valeur
 * douteuse est simplement ignorée (repli : /app).
 */
export function cheminRetourSur(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const c = brut.trim();
  // Interne à l'application uniquement — préfixe ancré au segment (« /apple » : refusé).
  if (c !== "/app" && !c.startsWith("/app/") && !c.startsWith("/app?")) return null;
  if (c.includes("\\")) return null; // antislash : refusé (variantes « /app\… »)
  if (c.length > 600) return null;
  // Espaces et caractères de contrôle : refusés (les chemins encodés n'en contiennent pas).
  for (const ch of c) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return null;
  }
  // Traversée de chemin : aucun segment « . » ou « .. » (sinon la normalisation RFC 3986 du
  // navigateur ferait sortir du sous-arbre /app — tout en restant sur le site).
  for (const segment of c.split("?")[0].split("/")) {
    if (segment === "." || segment === "..") return null;
  }
  return c;
}
