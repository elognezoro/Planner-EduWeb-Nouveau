import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Déconnexion automatique après INACTIVITÉ — paramètre GLOBAL réglé par l'admin système
 * (Système › Configuration générale), appliqué à tous les utilisateurs connectés.
 *
 * Lu par le layout de l'espace connecté pour armer le veilleur côté client
 * (`<VeilleInactivite>`). Repli FAIL-SAFE : en cas d'erreur (base indisponible, ligne
 * absente), la fonction renvoie « désactivé » — une panne ne doit jamais déconnecter
 * tout le monde ni casser le layout.
 */

export interface ConfigInactivite {
  active: boolean;
  /** Délai d'inactivité avant déconnexion (minutes, borné 5–480). */
  delaiMinutes: number;
  /** Préavis de l'alerte visuelle et sonore avant la coupure (secondes, borné 15–300). */
  avertissementSecondes: number;
}

export const INACTIVITE_DEFAUT: ConfigInactivite = {
  active: false,
  delaiMinutes: 30,
  avertissementSecondes: 60,
};

export async function lireConfigInactivite(): Promise<ConfigInactivite> {
  try {
    const cfg = await prisma.configuration.findUnique({
      where: { id: "global" },
      select: {
        inactiviteDeconnexionActive: true,
        inactiviteDelaiMinutes: true,
        inactiviteAvertissementSecondes: true,
      },
    });
    if (!cfg) return { ...INACTIVITE_DEFAUT };
    // Bornage défensif (l'action serveur valide déjà, mais la donnée peut avoir été altérée) :
    // le préavis reste STRICTEMENT plus court que le délai, sinon l'alerte serait permanente.
    const delaiMinutes = Math.min(480, Math.max(5, cfg.inactiviteDelaiMinutes));
    const plafondAvertissement = Math.min(300, delaiMinutes * 60 - 30);
    const avertissementSecondes = Math.min(
      plafondAvertissement,
      Math.max(15, cfg.inactiviteAvertissementSecondes),
    );
    return { active: cfg.inactiviteDeconnexionActive, delaiMinutes, avertissementSecondes };
  } catch (e) {
    console.error("[inactivite] configuration illisible :", e);
    return { ...INACTIVITE_DEFAUT };
  }
}
