/**
 * Chemin de RETOUR après reconnexion : l'utilisateur revient directement sur la page où il
 * était. Alimenté par (1) le veilleur d'inactivité (déconnexion automatique), (2) la garde
 * requireUtilisateur (session expirée — en-tête x-pathname posé par le proxy) et (3) la page
 * publique d'invitation à une formation (/invitation/<jeton>).
 *
 * SÉCURITÉ (anti open-redirect, durci par revue adversariale) : seul un chemin INTERNE de
 * l'application est accepté — « /app » exactement, « /app/… » / « /app?… », ou
 * « /invitation/<jeton> » (jeton opaque cuid/UUID, motif strict, éventuel « ?code=… »).
 * Refusés : URL absolue, « //hote », antislash, caractère de contrôle ou espace, segments
 * « . » / « .. » (le navigateur normaliserait hors du sous-arbre autorisé), longueur
 * excessive. Toute valeur douteuse est simplement ignorée (repli : /app).
 */
export function cheminRetourSur(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const c = brut.trim();
  // Interne à l'application uniquement — préfixe ancré au segment (« /apple » : refusé).
  const estApp = c === "/app" || c.startsWith("/app/") || c.startsWith("/app?");
  // Page publique d'invitation : exactement UN segment de jeton (cuid ou UUID — lettres,
  // chiffres, « - », « _ »), suivi au plus du seul « ?code=… » que la page émet (valeur
  // percent-encodée : alphabet de sortie d'encodeURIComponent). Rien d'autre.
  // « /invitation/<jeton> » (session, éventuel « ?code=… ») OU « /invitation/cours/<jeton> »
  // (inscription directe à un cours, sans code).
  const estInvitation =
    /^\/invitation\/[A-Za-z0-9_-]+(?:\?code=[A-Za-z0-9_.!~*'()%-]*)?$/.test(c) ||
    /^\/invitation\/cours\/[A-Za-z0-9_-]+$/.test(c);
  if (!estApp && !estInvitation) return null;
  if (c.includes("\\")) return null; // antislash : refusé (variantes « /app\… »)
  if (c.length > 600) return null;
  // Espaces et caractères de contrôle : refusés (les chemins encodés n'en contiennent pas).
  // Y compris les contrôles C1 (0x80-0x9F) et les séparateurs de ligne Unicode U+2028/U+2029
  // (la valeur arrive DÉJÀ décodée : « %E2%80%A8 » de l'URL d'origine serait présent ici).
  for (const ch of c) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f) return null;
    if ((code >= 0x80 && code <= 0x9f) || code === 0x2028 || code === 0x2029) return null;
  }
  // Traversée de chemin : aucun segment « . » ou « .. » (sinon la normalisation RFC 3986 du
  // navigateur ferait sortir du sous-arbre autorisé — tout en restant sur le site).
  for (const segment of c.split("?")[0].split("/")) {
    if (segment === "." || segment === "..") return null;
  }
  return c;
}

/**
 * Ajoute le chemin de retour (déjà validé par cheminRetourSur) à un lien interne — « ?retour=… »
 * ou « &retour=… » selon que le lien porte déjà une chaîne de requête. L'UNIQUE façon de
 * propager le retour d'un saut à l'autre du flux d'authentification : tout lien construit à la
 * main risque d'oublier le paramètre (perte silencieuse, repli /app). Lien inchangé si nul.
 */
export function avecRetour(lien: string, retour: string | null): string {
  if (!retour) return lien;
  return `${lien}${lien.includes("?") ? "&" : "?"}retour=${encodeURIComponent(retour)}`;
}
