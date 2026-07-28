"use client";

/**
 * FILE D'ATTENTE HORS LIGNE — socle générique, volontairement sans connaissance du métier.
 *
 * Principe : une saisie faite sans réseau n'est pas perdue, elle est mise en file dans le
 * navigateur et rejouée automatiquement au retour de la connexion. Ajouter un nouvel écran hors
 * ligne consiste alors à déclarer UN gestionnaire, pas à réécrire la plomberie.
 *
 * Trois règles de conception, posées dès maintenant parce qu'elles seraient coûteuses à ajouter
 * après coup :
 *  1. CLÉ D'IDEMPOTENCE portée par chaque entrée : un rejeu ne doit jamais créer de doublon
 *     (une même saisie peut être renvoyée si la réponse du serveur s'est perdue).
 *  2. HORODATAGE D'ORIGINE conservé : c'est l'heure du GESTE, pas celle de la synchronisation.
 *     Sans cela, toutes les saisies d'une journée apparaîtraient faites au moment du retour réseau.
 *  3. Le serveur reste seul juge : une entrée rejouée repasse par les mêmes gardes RBAC. La file
 *     ne contourne aucune autorisation, elle ne fait que différer l'envoi.
 */

const CLE = "eduweb_file_hors_ligne";
const EVENEMENT = "eduweb-file-maj";

export interface EntreeFile {
  /** Identifiant unique de la saisie : sert de clé d'idempotence côté serveur. */
  id: string;
  /** Nom du gestionnaire déclaré via `enregistrerGestionnaire`. */
  action: string;
  donnees: unknown;
  /** Heure du GESTE (et non de l'envoi). */
  creeLe: number;
  /** Nombre de tentatives d'envoi déjà effectuées. */
  essais: number;
  /** Libellé lisible affiché à l'utilisateur (« Appel de 6ème A du 12/08 »). */
  libelle: string;
}

type Gestionnaire = (donnees: unknown, entree: EntreeFile) => Promise<{ ok: boolean; message?: string }>;
const gestionnaires = new Map<string, Gestionnaire>();

/** Déclare comment rejouer une action. À appeler au montage de l'écran concerné. */
export function enregistrerGestionnaire(action: string, fn: Gestionnaire): void {
  gestionnaires.set(action, fn);
}

function lire(): EntreeFile[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as EntreeFile[]) : [];
  } catch {
    return [];
  }
}

function ecrire(entrees: EntreeFile[]): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(entrees));
    window.dispatchEvent(new Event(EVENEMENT));
  } catch {
    // Quota dépassé ou stockage indisponible : on ne casse pas la saisie en cours.
  }
}

/** Nombre de saisies en attente d'envoi. */
export function nombreEnAttente(): number {
  return lire().length;
}

/** S'abonner aux changements de la file (montée/descente du compteur). */
export function surChangementFile(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENEMENT, cb);
  window.addEventListener("storage", cb); // autre onglet
  return () => {
    window.removeEventListener(EVENEMENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Met une saisie en file. Renvoie son identifiant (clé d'idempotence). */
export function mettreEnFile(action: string, donnees: unknown, libelle: string): string {
  const id = `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  ecrire([...lire(), { id, action, donnees, creeLe: Date.now(), essais: 0, libelle }]);
  return id;
}

/**
 * Rejoue la file, dans l'ORDRE de saisie (une correction doit s'appliquer après la saisie
 * initiale). Une entrée en échec est CONSERVÉE et bloque les suivantes de la même action, pour ne
 * pas appliquer une correction sur une donnée absente.
 */
export async function synchroniser(): Promise<{ envoyees: number; restantes: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { envoyees: 0, restantes: nombreEnAttente() };
  }
  let envoyees = 0;
  const bloquees = new Set<string>();
  const restantes: EntreeFile[] = [];

  for (const entree of lire()) {
    const gestionnaire = gestionnaires.get(entree.action);
    if (!gestionnaire || bloquees.has(entree.action)) {
      restantes.push(entree);
      continue;
    }
    try {
      const r = await gestionnaire(entree.donnees, entree);
      if (r.ok) {
        envoyees += 1;
      } else {
        // Refus MÉTIER (droit retiré, donnée supprimée entre-temps) : inutile de réessayer sans
        // fin. Au-delà de 5 tentatives, l'entrée est conservée mais cesse de bloquer les autres.
        const essais = entree.essais + 1;
        restantes.push({ ...entree, essais });
        if (essais < 5) bloquees.add(entree.action);
      }
    } catch {
      // Échec RÉSEAU : on garde tout et on retentera au prochain retour de connexion.
      restantes.push({ ...entree, essais: entree.essais + 1 });
      bloquees.add(entree.action);
    }
  }
  ecrire(restantes);
  return { envoyees, restantes: restantes.length };
}
