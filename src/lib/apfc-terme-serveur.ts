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
