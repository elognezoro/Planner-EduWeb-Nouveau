import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

const colonnes = [
  {
    titre: "Plateforme",
    liens: [
      { libelle: "La plateforme", href: "#plateforme" },
      { libelle: "Modules", href: "#modules" },
      { libelle: "Emplois du temps", href: "#solveur" },
      { libelle: "Départements", href: "#departements" },
      { libelle: "Pour qui ?", href: "#public" },
      { libelle: "Plan de formation (CAFOP)", href: "/plan-formation" },
    ],
  },
  {
    titre: "Compte",
    liens: [
      { libelle: "Connexion", href: "/connexion" },
      { libelle: "Créer un compte", href: "/inscription" },
      { libelle: "Mot de passe oublié", href: "/mot-de-passe-oublie" },
      { libelle: "Renvoyer la confirmation", href: "/renvoyer-confirmation" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-forest-950 text-cream-200/80">
      {/* Filet doré + décor (évite l'effet plat) */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" aria-hidden />
      <div className="absolute inset-0 bg-grid-forest opacity-[0.12]" aria-hidden />
      <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-gold-500/8 blur-[120px]" aria-hidden />

      <Container className="relative py-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Logo tone="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream-200/65">
              Plateforme nationale de gestion et de planification scolaire pour le système
              éducatif ivoirien. Une interface unique, adaptée à chaque rôle.
            </p>
            <Link
              href="/inscription"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-5 py-2.5 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition hover:-translate-y-0.5 hover:from-gold-200 hover:to-gold-400"
            >
              Créer un compte <ArrowRight size={15} />
            </Link>
          </div>

          {colonnes.map((col) => (
            <div key={col.titre}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
                {col.titre}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.liens.map((lien) => (
                  <li key={lien.href}>
                    <Link
                      href={lien.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-cream-200/70 transition-colors hover:text-gold-300"
                    >
                      <span className="h-px w-0 bg-gold-400 transition-all duration-300 group-hover:w-4" aria-hidden />
                      {lien.libelle}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-cream-50/10 pt-8 text-xs text-cream-200/55 sm:flex-row">
          <p>© {new Date().getFullYear()} EduWeb Planner. Tous droits réservés.</p>
          <p>Conçu pour le système éducatif ivoirien · Next.js · Vercel</p>
        </div>
      </Container>
    </footer>
  );
}
