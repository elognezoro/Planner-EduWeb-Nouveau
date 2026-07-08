import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { paysConsulte } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { anneeScolaireCourante } from "@/lib/annee-scolaire";
import { chargerPlanFormation } from "@/lib/formation/plan-formation-data";
import { VuePlanFormation } from "./vue-plan-formation";

export const metadata: Metadata = { title: "Plan de formation" };
export const dynamic = "force-dynamic";

export default async function PlanFormationPage() {
  const u = await requireRole(["admin", "cafop_admin", "drena", "apfc_admin"]);
  const pays = await paysConsulte();
  const terme = await libelleCafop(pays);
  const estAdmin = u.roleReel === "admin" && !u.apercuActif;
  const plan = await chargerPlanFormation(pays); // admin/staff : plans publiés ou non

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
