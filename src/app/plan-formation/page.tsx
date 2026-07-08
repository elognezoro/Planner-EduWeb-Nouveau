import type { Metadata } from "next";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";
import { libelleCafop } from "@/lib/cafop-terme-serveur";
import { chargerPlanFormation } from "@/lib/formation/plan-formation-data";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { VuePlanFormation } from "@/app/app/systeme/cafop/plan-formation/vue-plan-formation";

export const metadata: Metadata = {
  title: "Plan de formation — Formation Initiale des Maîtres",
  description: "Plan de formation initiale des maîtres (CAFOP) : volumes horaires et calendrier des trois années.",
};
export const dynamic = "force-dynamic";

// Page PUBLIQUE : consultable par tout visiteur, sans connexion. Ne montre que les plans publiés.
export default async function PlanFormationPublicPage({
  searchParams,
}: {
  searchParams: Promise<{ pays?: string }>;
}) {
  const sp = await searchParams;
  const pays = sp.pays?.trim() || PAYS_DEFAUT;
  const terme = await libelleCafop(pays);
  const plan = await chargerPlanFormation(pays, { publieUniquement: true });

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-cream-50 px-4 pb-20 pt-28">
        <div className="mx-auto max-w-6xl">
          <VuePlanFormation plan={plan} pays={pays} terme={terme} estAdmin={false} anneeDefaut="" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
