import { prisma } from "@/lib/prisma";
import { ROLES, type RoleId } from "@/lib/rbac/roles";

/** Une leçon d'un module du manuel. */
export type LeconManuel = { titre: string; type: string; contenu: string | null; dureeMinutes: number | null };

/** Un module du manuel = un guide de rôle réel de la plateforme. */
export type ModuleManuel = {
  code: string; // « M01 », « M02 »…
  roleId: string | null;
  titre: string; // libellé du rôle (ou titre du guide)
  description: string;
  portee: string | null;
  slug: string;
  dureeMinutes: number;
  lecons: LeconManuel[];
};

export type ManuelData = {
  reference: string;
  version: string;
  nbModules: number;
  totalLecons: number;
  dureeTotale: number;
  modules: ModuleManuel[];
};

const REFERENCE = "EDUWEB-FORM-2026-01";

/**
 * Assemble le manuel académique à partir des rôles RÉELS de la plateforme :
 * chaque module correspond au guide (`estGuide`) publié d'un rôle, dans l'ordre
 * hiérarchique (rang décroissant). Le contenu se met donc à jour automatiquement
 * à mesure que les guides évoluent.
 */
export async function chargerManuel(): Promise<ManuelData> {
  const guides = await prisma.cours.findMany({
    where: { estGuide: true, statut: "publie" },
    select: {
      titre: true, slug: true, description: true, dureeMinutes: true,
      modules: { orderBy: { ordre: "asc" }, select: { titre: true, type: true, contenu: true, dureeMinutes: true } },
    },
  });

  const rang = (slug: string): number => {
    const rid = slug.startsWith("guide-") ? slug.slice(6) : "";
    return rid in ROLES ? ROLES[rid as RoleId].rang : -1;
  };

  const tries = [...guides].sort((a, b) => rang(b.slug) - rang(a.slug) || a.titre.localeCompare(b.titre, "fr"));

  const modules: ModuleManuel[] = tries.map((g, i) => {
    const rid = g.slug.startsWith("guide-") ? g.slug.slice(6) : null;
    const def = rid && rid in ROLES ? ROLES[rid as RoleId] : null;
    const dureeLecons = g.modules.reduce((s, m) => s + (m.dureeMinutes ?? 0), 0);
    return {
      code: `M${String(i + 1).padStart(2, "0")}`,
      roleId: rid,
      titre: def?.libelle ?? g.titre,
      description: def?.description ?? g.description ?? "",
      portee: def?.portee ?? null,
      slug: g.slug,
      dureeMinutes: g.dureeMinutes ?? dureeLecons,
      lecons: g.modules.map((m) => ({ titre: m.titre, type: m.type, contenu: m.contenu, dureeMinutes: m.dureeMinutes })),
    };
  });

  const totalLecons = modules.reduce((s, m) => s + m.lecons.length, 0);
  const dureeTotale = modules.reduce((s, m) => s + m.dureeMinutes, 0);

  return { reference: REFERENCE, version: "1.0", nbModules: modules.length, totalLecons, dureeTotale, modules };
}
