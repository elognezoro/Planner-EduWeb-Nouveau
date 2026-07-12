import { BarChart3, ArrowUpRight, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Bande « ressource en accès libre » : met en avant le module interactif DHFC-EBiS,
 * consultable SANS connexion (fichier statique public /dhfc/module-maitre.html).
 * Donne un point d'entrée public au cours, jusque-là seulement lié depuis le LMS.
 */
export function RessourceLibreSection() {
  return (
    <section id="ressource" className="scroll-mt-24 py-8 sm:py-12">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-cream-200 bg-cream-50/70 p-6 shadow-soft sm:p-8">
          {/* Filet doré supérieur, cohérent avec les autres blocs */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent"
            aria-hidden
          />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-800 text-cream-50">
                <BarChart3 size={22} />
              </span>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-forest-600">
                  <Unlock size={12} /> Ressource en accès libre · sans connexion
                </p>
                <h2 className="mt-1.5 font-display text-xl font-bold text-forest-900 sm:text-2xl">
                  Module maître interactif — Analyse des besoins DHFC-EBiS
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700/70">
                  Rapport navigable : contexte, 5 critères objectifs, besoins par population,
                  graphiques interactifs et quiz de maîtrise.
                </p>
              </div>
            </div>
            <Button
              href="/dhfc/module-maitre.html"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              variant="gold"
              size="lg"
              className="shrink-0"
            >
              Consulter le module
              <ArrowUpRight size={18} />
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
