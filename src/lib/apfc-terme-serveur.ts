import "server-only";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { TERME_APFC_DEFAUT } from "./apfc-terme";

/** Terme local des APFC pour un pays (défaut « APFC » si non configuré ou en cas d'erreur). */
export async function libelleApfc(pays: string): Promise<string> {
  try {
    const p = await prisma.parametreCafopPays.findUnique({ where: { pays }, select: { termeApfc: true } });
    return p?.termeApfc?.trim() || TERME_APFC_DEFAUT;
  } catch (e) {
    console.error("[apfc-terme] lecture :", e);
    return TERME_APFC_DEFAUT;
  }
}

/** Terme local des APFC pour le pays consulté (cookie), pratique pour les pages et `generateMetadata`. */
export async function termeApfcCourant(): Promise<string> {
  return libelleApfc(await paysConsulte());
}

/**
 * Pays EFFECTIF d'une APFC pour ses armoiries et TOUS ses documents officiels (fiche, en-tête
 * imprimable…) : le PAYS CONSULTÉ dans la barre du haut prime TOUJOURS (exigence client :
 * « l'armoirie change automatiquement selon le pays sélectionné ») ; repli sur le pays de la
 * région de l'APFC uniquement si aucun pays n'est consulté. Règle centralisée ici pour être
 * appliquée IDENTIQUEMENT partout (fiche de configuration ET documents officiels APFC).
 */
export async function paysEffectifApfc(regionPays: string | null | undefined): Promise<string> {
  return (await paysConsulte()) || regionPays || "Côte d'Ivoire";
}
