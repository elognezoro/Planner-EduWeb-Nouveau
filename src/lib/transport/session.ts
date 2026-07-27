import "server-only";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { type Caller, TransportError } from "./transport-auth";

/**
 * Résout l'ÉTABLISSEMENT de rattachement transport de l'utilisateur (périmètre du paywall).
 *  - Personnel : l'établissement de son périmètre.
 *  - Parent : l'établissement de son (premier) enfant, via LienParentEleve → Inscription → Classe.
 *  - Élève : son propre établissement via son inscription.
 *  - Sinon : null (« Général »).
 */
export async function resoudreEtablissementTransport(
  u: UtilisateurCourant,
): Promise<string | null> {
  if (u.portee.etablissementId) return u.portee.etablissementId;

  let eleveId: string | null = null;
  if (u.roleReel === "parent") {
    const lien = await prisma.lienParentEleve.findFirst({
      where: { parentId: u.id },
      select: { eleveId: true },
    });
    eleveId = lien?.eleveId ?? null;
  } else if (u.roleReel === "eleve") {
    eleveId = u.id;
  }
  if (!eleveId) return null;

  const inscription = await prisma.inscription.findFirst({
    where: { eleveId },
    orderBy: { creeLe: "desc" },
    select: { classe: { select: { etablissementId: true } } },
  });
  return inscription?.classe.etablissementId ?? null;
}

/** Construit le Caller à partir de l'utilisateur courant. */
async function construireCaller(u: UtilisateurCourant): Promise<Caller> {
  return {
    userId: u.id,
    role: u.roleReel,
    etablissementId: await resoudreEtablissementTransport(u),
    isAdmin: u.roleReel === "admin",
  };
}

/** Appelant pour une LECTURE (autorise le mode aperçu). Lève si non authentifié. */
export async function getCaller(): Promise<Caller> {
  const u = await getUtilisateurCourant();
  if (!u) throw new TransportError("Vous devez être connecté.");
  return construireCaller(u);
}

/**
 * Appelant pour une ÉCRITURE : refuse le mode aperçu (lecture seule transverse de la
 * plateforme — un admin qui prévisualise/incarne un rôle ne peut jamais écrire).
 */
export async function getCallerEcriture(): Promise<Caller> {
  const u = await getUtilisateurCourant();
  if (!u) throw new TransportError("Vous devez être connecté.");
  if (u.apercuActif) throw new TransportError("Mode aperçu : action en lecture seule.");
  return construireCaller(u);
}
