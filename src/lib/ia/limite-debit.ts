import "server-only";

/**
 * Limiteur de débit best-effort PAR UTILISATEUR pour les surfaces IA payantes
 * (chatbot, synthèse vocale) — protège contre l'abus de coût / « déni de portefeuille »
 * (CWE-770 / OWASP LLM10).
 *
 * ⚠️ En mémoire du processus : sur un hébergement sans état (Vercel serverless), le compteur
 * est PAR INSTANCE et se réinitialise à froid — c'est une première ligne de défense, à
 * compléter par un quota PERSISTANT (table dédiée ou Upstash/Redis) et un plafond global.
 * Combiné à la garde « accès complet » (les comptes en attente n'y accèdent pas), il élève
 * significativement le coût d'un abus.
 */

const seaux = new Map<string, number[]>();
const MAX_CLES = 5000; // borne mémoire : purge grossière au-delà.

/**
 * Autorise l'action si l'utilisateur a fait moins de `max` requêtes dans la fenêtre glissante.
 * Renvoie true si autorisé (et enregistre l'appel), false si le quota est atteint.
 */
export function limiteDebitOk(cle: string, max: number, fenetreMs: number): boolean {
  const maintenant = Date.now();
  const depuis = maintenant - fenetreMs;

  if (seaux.size > MAX_CLES) {
    // Purge grossière pour éviter une croissance non bornée de la Map.
    for (const [k, ts] of seaux) if (ts.length === 0 || ts[ts.length - 1] < depuis) seaux.delete(k);
  }

  const recents = (seaux.get(cle) ?? []).filter((t) => t >= depuis);
  if (recents.length >= max) {
    seaux.set(cle, recents);
    return false;
  }
  recents.push(maintenant);
  seaux.set(cle, recents);
  return true;
}
