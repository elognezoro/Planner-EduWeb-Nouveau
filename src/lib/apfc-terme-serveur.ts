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
 * imprimable…) : celui de SA région si elle en a une — la région prime TOUJOURS, quel que soit
 * le pays actuellement consulté dans la barre du haut — sinon (APFC sans région propre) le pays
 * consulté, quel qu'il soit (jamais un pays par défaut figé). Règle centralisée ici pour être
 * appliquée IDENTIQUEMENT partout (fiche de configuration ET documents officiels APFC).
 */
export async function paysEffectifApfc(regionPays: string | null | undefined): Promise<string> {
  return regionPays ?? (await paysConsulte());
}
