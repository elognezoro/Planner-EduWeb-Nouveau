import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";

const colonnes = [
  {
    titre: "Plateforme",
    liens: [
      { libelle: "La plateforme", href: "#plateforme" },
      { libelle: "Modules", href: "#modules" },
      { libelle: "Emplois du temps", href: "#solveur" },
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
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-cream-200 bg-forest-950 text-cream-200/80">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo tone="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream-200/65">
              Plateforme nationale de gestion et de planification scolaire pour le système
              éducatif ivoirien. Une interface unique, adaptée à chaque rôle.
            </p>
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
                      className="text-sm text-cream-200/70 transition-colors hover:text-gold-300"
                    >
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
