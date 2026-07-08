import "server-only";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { TERME_CAFOP_DEFAUT } from "./cafop-terme";

/** Terme local des CAFOP pour un pays (défaut « CAFOP » si non configuré ou en cas d'erreur). */
export async function libelleCafop(pays: string): Promise<string> {
  try {
    const p = await prisma.parametreCafopPays.findUnique({ where: { pays }, select: { terme: true } });
    return p?.terme?.trim() || TERME_CAFOP_DEFAUT;
  } catch (e) {
    console.error("[cafop-terme] lecture :", e);
    return TERME_CAFOP_DEFAUT;
  }
}

/** Terme local des CAFOP pour le pays consulté (cookie), pratique pour les pages et `generateMetadata`. */
export async function termeCafopCourant(): Promise<string> {
  return libelleCafop(await paysConsulte());
}
