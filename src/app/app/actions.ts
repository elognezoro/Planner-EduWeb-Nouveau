"use server";

import { signOut } from "@/lib/auth";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { journaliserSecurite } from "@/lib/audit/journal";

export async function seDeconnecter() {
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
  await signOut({ redirectTo: "/connexion" });
}
