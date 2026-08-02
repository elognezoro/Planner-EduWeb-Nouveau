/**
 * Horodatage de DERNIÈRE ACTIVITÉ partagé entre les onglets (localStorage) — socle de la
 * déconnexion automatique après inactivité. Module CLIENT-SAFE (aucune dépendance serveur) :
 * utilisé par le veilleur de l'espace connecté ET par le formulaire de connexion, qui horodate
 * la connexion pour qu'une session toute fraîche ne soit jamais jugée expirée au montage
 * (le stockage peut contenir l'horodatage périmé d'une session précédente).
 */
export const CLE_ACTIVITE = "eduweb.derniere-activite";

export function lireActivitePartagee(): number {
  try {
    const t = Number(window.localStorage.getItem(CLE_ACTIVITE)) || 0;
    // Plafonné au PRÉSENT : une valeur future (forgée en console, horloge déréglée) ne peut
    // jamais repousser l'échéance au-delà de « maintenant ».
    return Math.min(t, Date.now());
  } catch {
    return 0; // stockage indisponible (navigation privée…) : l'onglet reste autonome
  }
}

export function ecrireActivitePartagee(t: number): void {
  try {
    window.localStorage.setItem(CLE_ACTIVITE, String(t));
  } catch {
    /* idem : silencieux */
  }
}
