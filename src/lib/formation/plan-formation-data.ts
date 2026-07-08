import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlanVue, SectionVue } from "@/app/app/systeme/cafop/plan-formation/vue-plan-formation";

/** Charge le plan de formation le plus récent d'un pays (mapping sûr des colonnes/cellules JSON). */
export async function chargerPlanFormation(
  pays: string,
  opts: { publieUniquement?: boolean } = {},
): Promise<PlanVue | null> {
  try {
    const p = await prisma.planFormation.findFirst({
      where: { pays, ...(opts.publieUniquement ? { publie: true } : {}) },
      orderBy: { anneeScolaire: "desc" },
      include: {
        sections: {
          orderBy: [{ ordre: "asc" }, { id: "asc" }],
          include: { lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
        },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      pays: p.pays,
      anneeScolaire: p.anneeScolaire,
      titre: p.titre,
      intro: p.intro,
      signataire: p.signataire,
      signatairePrenoms: p.signatairePrenoms,
      signataireNom: p.signataireNom,
      signataireFonction: p.signataireFonction,
      cachetUrl: p.cachetUrl,
      signatureUrl: p.signatureUrl,
      publie: p.publie,
      sections: p.sections.map(
        (s): SectionVue => ({
          id: s.id,
          niveau: s.niveau,
          titre: s.titre,
          intro: s.intro,
          note: s.note,
          colonnes: Array.isArray(s.colonnes) ? (s.colonnes as string[]) : [],
          lignes: s.lignes.map((l) => ({
            id: l.id,
            type: l.type,
            cellules: Array.isArray(l.cellules) ? (l.cellules as string[]) : [],
            texte: l.texte,
            ton: l.ton,
          })),
        }),
      ),
    };
  } catch (e) {
    console.error("[plan-formation] chargement :", e);
    return null;
  }
}
