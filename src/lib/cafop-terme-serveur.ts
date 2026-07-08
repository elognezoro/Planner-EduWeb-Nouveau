import "server-only";
import { prisma } from "@/lib/prisma";
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
