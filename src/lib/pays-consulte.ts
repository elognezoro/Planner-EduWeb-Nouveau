import "server-only";
import { cookies } from "next/headers";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { typePortee } from "@/lib/rbac/scope";

/** Pays affiché par défaut tant que l'utilisateur n'a rien sélectionné dans la barre. */
export const PAYS_DEFAUT = "Côte d'Ivoire";

/**
 * Pays consulté via le sélecteur de la barre supérieure (cookie « eduweb_pays »,
 * posé par src/app/app/barre-actions.ts). Toutes les listes d'établissements des
 * sélecteurs d'interface sont filtrées sur ce pays.
 *
 * ⚠️ Sécurité : un rôle à périmètre « pays » (superviseur national, représentant-pays) est
 * VERROUILLÉ sur son propre pays — le sélecteur de la barre ne peut pas lui faire consulter
 * un autre pays. Les rôles globaux (admin, superviseur international) gardent le libre choix.
 */
export async function paysConsulte(): Promise<string> {
  const u = await getUtilisateurCourant();
  if (u && typePortee(u.portee.roleId) === "pays" && u.portee.pays) {
    return u.portee.pays;
  }
  const store = await cookies();
  return store.get("eduweb_pays")?.value ?? PAYS_DEFAUT;
}
