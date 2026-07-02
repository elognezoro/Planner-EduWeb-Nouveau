import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ROLE_IDS, type RoleId } from "./roles";
import { NAVIGATION, TOUS, tousLesItems, type ItemNav, type SectionNav } from "./navigation";

/**
 * Matrice des droits DYNAMIQUE (éditable depuis « Niveaux d'accès »).
 *
 * La carte de navigation (item.roles) reste la valeur PAR DÉFAUT ; la table
 * `permissions_role` stocke uniquement les surcharges décidées par l'administrateur.
 * Cette couche est la source unique de résolution : elle pilote le menu, la garde
 * centrale du layout /app et l'extension de requireRole — jamais dupliquée par page.
 */

/** Items qu'aucune surcharge ne peut retirer (évite de bricker un compte). */
export const ITEMS_VERROUILLES = new Set(["tableau-de-bord", "mon-identification", "mon-profil", "notifications"]);
/** L'administrateur système garde toujours tous les droits. */
export const ROLE_VERROUILLE: RoleId = "admin";

export type Surcharges = Map<string, boolean>; // clé `${itemId}:${role}`

/** Charge les surcharges une seule fois par requête (cache React). */
export const chargerSurcharges = cache(async (): Promise<Surcharges> => {
  try {
    const lignes = await prisma.permissionRole.findMany({
      select: { itemId: true, role: true, accorde: true },
    });
    return new Map(lignes.map((l) => [`${l.itemId}:${l.role}`, l.accorde]));
  } catch (e) {
    // Repli : en cas d'indisponibilité, on retombe sur la matrice par défaut (jamais de blocage).
    console.error("[permissions] chargement des surcharges impossible :", e);
    return new Map();
  }
});

/** Valeur par défaut d'un item pour un rôle (carte de navigation). */
export function accesParDefaut(item: ItemNav, role: RoleId): boolean {
  return item.roles === TOUS || item.roles.includes(role);
}

/** Accès effectif = surcharge si présente, sinon défaut. Items vitaux et admin verrouillés. */
export function accesEffectif(item: ItemNav, role: RoleId, surcharges: Surcharges): boolean {
  if (role === ROLE_VERROUILLE) return true;
  if (ITEMS_VERROUILLES.has(item.id)) return accesParDefaut(item, role);
  return surcharges.get(`${item.id}:${role}`) ?? accesParDefaut(item, role);
}

/** Navigation filtrée par les permissions effectives d'un rôle. */
export async function navigationEffective(role: RoleId): Promise<SectionNav[]> {
  const surcharges = await chargerSurcharges();
  return NAVIGATION.map((section) => ({
    ...section,
    items: section.items.filter((item) => accesEffectif(item, role, surcharges)),
  })).filter((section) => section.items.length > 0);
}

/**
 * Résout l'item de navigation correspondant à un chemin /app/… (préfixe de segment le plus
 * long : « systeme/comptes » couvre aussi « systeme/comptes/[id] »). Null si hors carte.
 */
export function resoudreItemParChemin(pathname: string): ItemNav | null {
  if (!pathname.startsWith("/app")) return null;
  const segment = pathname.replace(/^\/app\/?/, "").replace(/\/+$/, "");
  if (segment === "") return tousLesItems().find((i) => i.segment === "") ?? null;
  let meilleur: ItemNav | null = null;
  for (const item of tousLesItems()) {
    if (!item.segment) continue;
    if (segment === item.segment || segment.startsWith(`${item.segment}/`)) {
      if (!meilleur || item.segment.length > meilleur.segment.length) meilleur = item;
    }
  }
  return meilleur;
}

/**
 * Le rôle a-t-il accès à ce chemin ? (garde centrale du layout /app).
 * Un chemin hors carte de navigation reste soumis aux gardes propres de sa page.
 */
export async function accesCheminAutorise(pathname: string, role: RoleId): Promise<boolean> {
  const item = resoudreItemParChemin(pathname);
  if (!item) return true;
  const surcharges = await chargerSurcharges();
  return accesEffectif(item, role, surcharges);
}

/** Grille complète (pour la page Niveaux d'accès) : item × rôle → accordé + verrouillage. */
export async function grilleDroits() {
  const surcharges = await chargerSurcharges();
  return NAVIGATION.map((section) => ({
    id: section.id,
    libelle: section.libelle,
    items: section.items.map((item) => ({
      id: item.id,
      libelle: item.libelle,
      verrouille: ITEMS_VERROUILLES.has(item.id),
      acces: Object.fromEntries(
        ROLE_IDS.map((r) => [r, accesEffectif(item, r, surcharges)]),
      ) as Record<RoleId, boolean>,
      surcharges: Object.fromEntries(
        ROLE_IDS.map((r) => [r, surcharges.has(`${item.id}:${r}`)]),
      ) as Record<RoleId, boolean>,
    })),
  }));
}
