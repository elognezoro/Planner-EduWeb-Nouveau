"use server";

import { signOut } from "@/lib/auth";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { journaliserSecurite } from "@/lib/audit/journal";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";

/**
 * Déconnexion canonique de l'application (bouton du menu ET veilleur d'inactivité).
 *
 * `retour` (optionnel) : chemin de la page où se trouvait l'utilisateur — transmis par le
 * veilleur d'inactivité pour qu'à la RECONNEXION, cette page s'affiche directement.
 * Typé `unknown` car le bouton du menu appelle l'action en `<form action=…>` (le premier
 * argument est alors un FormData, ignoré par la validation) ; seul un chemin interne de la
 * liste blanche de cheminRetourSur est propagé (anti open-redirect).
 */
export async function seDeconnecter(retour?: unknown) {
  // Trace l'évènement AVANT de fermer la session (l'acteur est encore résoluble).
  const u = await getUtilisateurCourant();
  if (u) {
    await journaliserSecurite("deconnexion", {
      utilisateurId: u.id,
      acteurEmail: u.email,
      acteurRole: u.roleActif,
      cible: `Utilisateur:${u.id}`,
    });
  }
  const chemin = cheminRetourSur(retour);
  await signOut({ redirectTo: avecRetour("/connexion", chemin) });
}
