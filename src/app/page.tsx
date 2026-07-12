import { prisma } from "@/lib/prisma";
import type { DepartementVue } from "@/lib/departements-ui";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { PlatformSection } from "@/components/marketing/platform-section";
import { ModulesSection } from "@/components/marketing/modules-section";
import { SolverSection } from "@/components/marketing/solver-section";
import { AudienceSection } from "@/components/marketing/audience-section";
import { DepartementsSection } from "@/components/marketing/departements-section";
import { RessourceLibreSection } from "@/components/marketing/ressource-libre-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { SiteFooter } from "@/components/marketing/site-footer";

export const dynamic = "force-dynamic";

/** Départements actifs à présenter sur la page d'accueil (gérés depuis Système › Départements). */
async function chargerDepartements(): Promise<DepartementVue[]> {
  try {
    return await prisma.departement.findMany({
      where: { actif: true },
      orderBy: [{ ordre: "asc" }, { creeLe: "asc" }],
      select: { id: true, nom: true, description: true, categorie: true, icone: true, couleur: true, ordre: true, actif: true },
    });
  } catch (e) {
    console.error("[accueil/departements] :", e);
    return [];
  }
}

export default async function AccueilPage() {
  const departements = await chargerDepartements();
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <PlatformSection />
        <ModulesSection />
        <SolverSection />
        <AudienceSection />
        <DepartementsSection departements={departements} />
        <RessourceLibreSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
