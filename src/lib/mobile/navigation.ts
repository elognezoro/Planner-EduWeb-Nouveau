/**
 * NAVIGATION EN COURS (téléphone) — petit magasin de module.
 *
 * L'App Router garde l'ancienne page à l'écran tant que la nouvelle n'est pas arrivée du
 * serveur : sur un réseau mobile, l'utilisateur touche un lien et… rien ne bouge pendant une
 * ou deux secondes. Ce magasin retient la DESTINATION dès l'appui, pour que la coquille mobile
 * affiche aussitôt des zones grisées et allume le bon onglet.
 *
 * Pourquoi pas « loading.tsx » ? Il s'applique à toutes les largeurs : sur ordinateur, il
 * remplacerait l'ancienne page par un écran de chargement — un changement de comportement que
 * la règle du chantier interdit. Ce magasin n'est alimenté que par le suivi mobile.
 */
export interface EtatNavigation {
  /** Numéro de la navigation : chaque demande en reçoit un nouveau (minuteries, messages). */
  id: number;
  /** Chemin demandé (ex. « /app/vie-scolaire/registre-appel »), ou null si rien n'est en cours. */
  destination: string | null;
  /** Vrai quand la navigation a été refusée faute de réseau. */
  horsLigne: boolean;
}

const INITIAL: EtatNavigation = { id: 0, destination: null, horsLigne: false };
let etat: EtatNavigation = INITIAL;
let compteur = 0;
const abonnes = new Set<() => void>();

function publier(suivant: EtatNavigation) {
  etat = suivant;
  for (const prevenir of abonnes) prevenir();
}

export function demarrerNavigation(destination: string): void {
  publier({ id: ++compteur, destination, horsLigne: false });
}

export function signalerHorsLigne(destination: string): void {
  publier({ id: ++compteur, destination, horsLigne: true });
}

export function terminerNavigation(): void {
  if (etat.destination === null) return;
  publier({ id: etat.id, destination: null, horsLigne: false });
}

export function sabonnerNavigation(prevenir: () => void): () => void {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
}

export function lireNavigation(): EtatNavigation {
  return etat;
}

/** Instantané serveur : aucune navigation en cours (référence stable). */
export function navigationServeur(): EtatNavigation {
  return INITIAL;
}
