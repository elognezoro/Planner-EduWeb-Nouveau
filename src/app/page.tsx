import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { PlatformSection } from "@/components/marketing/platform-section";
import { ModulesSection } from "@/components/marketing/modules-section";
import { SolverSection } from "@/components/marketing/solver-section";
import { AudienceSection } from "@/components/marketing/audience-section";
import { TeamSection } from "@/components/marketing/team-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function AccueilPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <PlatformSection />
        <ModulesSection />
        <SolverSection />
        <AudienceSection />
        <TeamSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
