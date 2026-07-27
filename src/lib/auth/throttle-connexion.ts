import "server-only";
import { prismaBase } from "@/lib/prisma";

/**
 * Anti-force-brute de la connexion (fenêtre glissante par e-mail).
 *
 * Seuil VOLONTAIREMENT HAUT pour ne jamais gêner un usage légitime : un utilisateur normal ne
 * rate pas 10 fois son mot de passe en 15 minutes. Au-delà, le compte est bloqué 15 minutes
 * (ralentit une attaque par force brute à ~10 essais / 15 min). Réinitialisé dès la 1re réussite.
 *
 * Écrit via le client de BASE (non tracé, pas de récursion d'audit). Jamais bloquant en cas
 * d'erreur technique : on ne verrouille pas un utilisateur légitime à cause d'un incident base.
 */
const SEUIL = 10;
const FENETRE_MS = 15 * 60 * 1000;
const BLOCAGE_MS = 15 * 60 * 1000;

/** La connexion de ce compte est-elle temporairement bloquée (trop d'échecs récents) ? */
export async function connexionBloquee(email: string): Promise<boolean> {
  try {
    const t = await prismaBase.tentativeConnexion.findUnique({ where: { email } });
    return !!t?.bloqueJusqua && t.bloqueJusqua.getTime() > Date.now();
  } catch {
    return false; // en cas d'incident base, ne jamais bloquer un utilisateur légitime
  }
}

/** Enregistre un échec de connexion et arme le blocage si le seuil est atteint dans la fenêtre. */
export async function enregistrerEchecConnexion(email: string): Promise<void> {
  try {
    const maintenant = new Date();
    const t = await prismaBase.tentativeConnexion.findUnique({ where: { email } });
    const dansFenetre = !!t && maintenant.getTime() - t.fenetreDebut.getTime() < FENETRE_MS;
    const echecs = dansFenetre ? t!.echecs + 1 : 1;
    const bloqueJusqua = echecs >= SEUIL ? new Date(maintenant.getTime() + BLOCAGE_MS) : null;
    await prismaBase.tentativeConnexion.upsert({
      where: { email },
      create: { email, echecs, fenetreDebut: maintenant, bloqueJusqua },
      update: { echecs, fenetreDebut: dansFenetre ? t!.fenetreDebut : maintenant, bloqueJusqua },
    });
  } catch {
    /* la traçabilité de sécurité ne doit pas casser la connexion */
  }
}

/** Réinitialise le compteur (connexion réussie). */
export async function reinitialiserConnexion(email: string): Promise<void> {
  try {
    await prismaBase.tentativeConnexion.deleteMany({ where: { email } });
  } catch {
    /* sans effet fonctionnel si l'effacement échoue */
  }
}
