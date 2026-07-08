import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { anneeScolaireCourante } from "@/lib/annee-scolaire";
import { VuePlanFormation, type PlanVue, type SectionVue } from "./vue-plan-formation";

export const metadata: Metadata = { title: "Plan de formation" };
export const dynamic = "force-dynamic";

export default async function PlanFormationPage() {
  const u = await requireRole(["admin", "cafop_admin", "drena", "apfc_admin"]);
  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const estAdmin = u.roleReel === "admin" && !u.apercuActif;

  let plan: PlanVue | null = null;
  try {
    // Le plan le plus récent du pays (par année scolaire décroissante).
    const p = await prisma.planFormation.findFirst({
      where: { pays },
      orderBy: { anneeScolaire: "desc" },
      include: {
        sections: {
          orderBy: [{ ordre: "asc" }, { id: "asc" }],
          include: { lignes: { orderBy: [{ ordre: "asc" }, { id: "asc" }] } },
        },
      },
    });
    if (p) {
      plan = {
        id: p.id,
        pays: p.pays,
        anneeScolaire: p.anneeScolaire,
        titre: p.titre,
        intro: p.intro,
        signataire: p.signataire,
        signataireFonction: p.signataireFonction,
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
    }
  } catch (e) {
    console.error("[plan-formation] chargement :", e);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <VuePlanFormation
        plan={plan}
        pays={pays}
        terme={terme}
        estAdmin={estAdmin}
        anneeDefaut={anneeScolaireCourante()}
      />
    </div>
  );
}
