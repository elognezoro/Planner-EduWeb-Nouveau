import { prisma } from "@/lib/prisma";

export type LigneInscrit = { nom: string; email: string; role: string; source: string; date: string; progression: number; statut: string };
export type ListeCours = { titre: string; slug: string; statut: string; inscrits: LigneInscrit[] };

export const SOURCES: Record<string, string> = {
  nominative: "Inscription nominative",
  auto: "Progression autonome",
  session: "Session de formation",
};

const dateCourte = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const nomComplet = (nom: string | null, prenoms: string | null, email: string) =>
  [nom, prenoms].filter(Boolean).join(" ").trim() || email;

/** Charge les listes d'inscrits pour un ensemble de cours (par slug). */
export async function chargerListes(slugs: string[]): Promise<ListeCours[]> {
  const uniques = [...new Set(slugs.filter(Boolean))].slice(0, 50);
  if (uniques.length === 0) return [];
  const cours = await prisma.cours.findMany({
    where: { slug: { in: uniques } },
    orderBy: [{ estGuide: "asc" }, { titre: "asc" }],
    select: {
      titre: true, slug: true, statut: true,
      inscriptions: {
        orderBy: [{ dateInscription: "desc" }],
        select: {
          source: true, dateInscription: true, progressionPct: true, statut: true,
          utilisateur: { select: { nom: true, prenoms: true, email: true, roleActif: { select: { libelle: true, nomTechnique: true } } } },
        },
      },
    },
  });
  return cours.map((c) => ({
    titre: c.titre,
    slug: c.slug,
    statut: c.statut,
    inscrits: c.inscriptions.map((i) => ({
      nom: nomComplet(i.utilisateur.nom, i.utilisateur.prenoms, i.utilisateur.email),
      email: i.utilisateur.email,
      role: i.utilisateur.roleActif?.libelle ?? i.utilisateur.roleActif?.nomTechnique ?? "—",
      source: SOURCES[i.source] ?? i.source,
      date: dateCourte(i.dateInscription),
      progression: i.progressionPct,
      statut: i.statut === "termine" ? "Terminé" : "En cours",
    })),
  }));
}

export const dateDuJour = () => new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
