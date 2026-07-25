import "server-only";

/**
 * Verrouillage OPTIMISTE (RM-019) — patron officiel du module Finance.
 *
 * Chaque opération critique modifiable porte une colonne `version Int @default(0)`. Le
 * formulaire transmet la version courante en champ caché ; la modification s'écrit avec :
 *
 *   const maj = await tx.<modele>.updateMany({
 *     where: { id, version: versionAttendue, ... },
 *     data: { ...donnees, version: { increment: 1 } },
 *   });
 *   if (maj.count === 0) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
 *
 * `updateMany` permet de tester le compte de lignes touchées : 0 = la version a changé entre
 * la lecture et l'écriture (ou l'enregistrement a disparu) → l'utilisateur doit recharger.
 */

export const MESSAGE_CONFLIT_VERSION =
  "Cette opération a été modifiée par un autre utilisateur — rechargez la page.";

/**
 * Lit la version transmise par le formulaire (champ caché « version »).
 * Retourne null si absente ou invalide — à traiter comme un conflit (client périmé).
 */
export function versionDepuisFormulaire(valeur: FormDataEntryValue | null): number | null {
  const n = Number(String(valeur ?? "").trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Délégué Prisma minimal acceptant un updateMany conditionné par la version. */
interface DelegueVersionne<TDonnees> {
  updateMany(args: {
    where: { id: string; version: number };
    data: TDonnees & { version: { increment: number } };
  }): Promise<{ count: number }>;
}

/**
 * Helper générique du patron ci-dessus : applique `donnees` sur l'enregistrement `id` SI sa
 * version vaut encore `versionAttendue` (version incrémentée atomiquement). Retourne false en
 * cas de conflit — l'action renvoie alors MESSAGE_CONFLIT_VERSION.
 */
export async function modifierAvecVersion<TDonnees>(
  delegue: DelegueVersionne<TDonnees>,
  id: string,
  versionAttendue: number,
  donnees: TDonnees,
): Promise<boolean> {
  const resultat = await delegue.updateMany({
    where: { id, version: versionAttendue },
    data: { ...donnees, version: { increment: 1 } },
  });
  return resultat.count === 1;
}
