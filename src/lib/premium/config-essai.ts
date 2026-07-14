import "server-only";
import { prisma } from "@/lib/prisma";
import { calculerFinEssai, DEFAUT_ESSAI, type UniteEssai } from "@/lib/premium/essai";

/** Lit le paramétrage d'essai par défaut (singleton Configuration), avec repli 7 jours. */
export async function lireDefautEssai(): Promise<{ valeur: number; unite: UniteEssai; heure: string | null }> {
  try {
    const cfg = await prisma.configuration.findUnique({
      where: { id: "global" },
      select: { essaiDureeValeur: true, essaiDureeUnite: true, essaiHeureFin: true },
    });
    if (!cfg) return { ...DEFAUT_ESSAI };
    const unite = (["jour", "mois", "annee"].includes(cfg.essaiDureeUnite) ? cfg.essaiDureeUnite : "jour") as UniteEssai;
    return {
      valeur: cfg.essaiDureeValeur > 0 ? cfg.essaiDureeValeur : DEFAUT_ESSAI.valeur,
      unite,
      heure: cfg.essaiHeureFin ?? null,
    };
  } catch {
    return { ...DEFAUT_ESSAI };
  }
}

/** Date de fin d'essai par défaut à partir de `debut` (= maintenant par défaut). */
export async function finEssaiParDefaut(debut: Date = new Date()): Promise<Date> {
  const d = await lireDefautEssai();
  return calculerFinEssai(debut, d.valeur, d.unite, d.heure);
}
