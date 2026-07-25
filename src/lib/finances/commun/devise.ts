import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Devises et taux de change HISTORISÉS (RM-007) : chaque opération financière porte sa devise
 * (« XOF » par défaut) ; les conversions utilisent le dernier taux dont la date d'effet est
 * antérieure ou égale à la date de l'opération. JAMAIS de taux inventé : taux inconnu = null.
 */

export const DEVISES = [
  { code: "XOF", libelle: "Franc CFA (UEMOA)" },
  { code: "XAF", libelle: "Franc CFA (CEMAC)" },
  { code: "EUR", libelle: "Euro" },
  { code: "USD", libelle: "Dollar américain" },
  { code: "GBP", libelle: "Livre sterling" },
] as const;

export type CodeDevise = (typeof DEVISES)[number]["code"];

export const DEVISE_DEFAUT: CodeDevise = "XOF";

/** Code de devise sûr : la valeur si elle est connue, sinon la devise par défaut. */
export function deviseValide(code: FormDataEntryValue | null | undefined): CodeDevise {
  const c = String(code ?? "").trim().toUpperCase();
  return (DEVISES.find((d) => d.code === c)?.code as CodeDevise | undefined) ?? DEVISE_DEFAUT;
}

/**
 * Taux effectif de `deviseSource` vers `deviseCible` à la date donnée : dernier taux historisé
 * dont dateEffet <= date. 1 si même devise ; null si aucun taux connu (jamais d'invention).
 */
export async function tauxEffectif(
  deviseSource: string,
  deviseCible: string,
  date: Date,
): Promise<number | null> {
  if (deviseSource === deviseCible) return 1;
  const dernier = await prisma.tauxChange.findFirst({
    where: { deviseSource, deviseCible, dateEffet: { lte: date } },
    orderBy: { dateEffet: "desc" },
    select: { taux: true },
  });
  if (!dernier) return null;
  const taux = Number(dernier.taux);
  return Number.isFinite(taux) && taux > 0 ? taux : null;
}
