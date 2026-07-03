import "server-only";
import { cookies } from "next/headers";

/** Pays affiché par défaut tant que l'utilisateur n'a rien sélectionné dans la barre. */
export const PAYS_DEFAUT = "Côte d'Ivoire";

/**
 * Pays consulté via le sélecteur de la barre supérieure (cookie « eduweb_pays »,
 * posé par src/app/app/barre-actions.ts). Toutes les listes d'établissements des
 * sélecteurs d'interface sont filtrées sur ce pays.
 */
export async function paysConsulte(): Promise<string> {
  const store = await cookies();
  return store.get("eduweb_pays")?.value ?? PAYS_DEFAUT;
}
