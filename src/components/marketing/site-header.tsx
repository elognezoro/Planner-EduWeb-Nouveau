"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const liens = [
  { libelle: "La plateforme", href: "#plateforme" },
  { libelle: "Modules", href: "#modules" },
  { libelle: "Emplois du temps", href: "#solveur" },
  { libelle: "Départements", href: "#departements" },
  { libelle: "Pour qui ?", href: "#public" },
];

/**
 * En-tête « pilule flottante » : verre teinté au-dessus du hero sombre, puis crème clair
 * au défilement. Navigation centrée, actions à droite — style institutionnel premium.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const surHero = !scrolled;

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-3 sm:pt-4">
        <div
          className={cn(
            "relative flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition-all duration-300 sm:rounded-full sm:px-4",
            scrolled
              ? "border-cream-200/80 bg-cream-50/85 shadow-[0_14px_50px_-18px_rgba(15,53,39,0.45)] backdrop-blur-xl"
              : "border-white/12 bg-forest-950/25 shadow-[0_10px_40px_-18px_rgba(7,31,23,0.6)] backdrop-blur-md",
          )}
        >
          <Logo tone={surHero ? "light" : "dark"} size={38} />

          {/* Navigation (desktop) — dans le flux : justify-between répartit logo / nav / actions
              avec des espaces équilibrés (pas d'absolu qui chevauchait les actions). */}
          <nav className="hidden items-center gap-1 lg:flex">
            {liens.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                className={cn(
                  // Barre de navigation = « chrome » : on la garde à 14 px (text-[0.875rem],
                  // insensible à l'agrandissement global +2 pt) pour préserver l'en-tête sur
                  // une seule ligne à toutes les largeurs desktop (exigence antérieure).
                  "whitespace-nowrap rounded-full px-3.5 py-2 text-[0.875rem] font-medium transition-colors",
                  surHero
                    ? "text-cream-100/85 hover:bg-white/10 hover:text-white"
                    : "text-forest-800/80 hover:bg-forest-50 hover:text-forest-900",
                )}
              >
                {lien.libelle}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              href="/connexion"
              variant="ghost"
              size="sm"
              className={cn(surHero && "text-cream-50 hover:bg-white/10 hover:text-white")}
            >
              Connexion
            </Button>
            <Button href="/inscription" variant={surHero ? "gold" : "primary"} size="sm">
              Créer un compte
              <ArrowRight size={15} />
            </Button>
          </div>

          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setMenuOuvert((v) => !v)}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors lg:hidden",
              surHero ? "text-cream-50 hover:bg-white/10" : "text-forest-800 hover:bg-forest-50",
            )}
          >
            {menuOuvert ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOuvert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 w-full max-w-6xl px-4 lg:hidden"
          >
            <div className="overflow-hidden rounded-3xl border border-cream-200 bg-cream-50/97 p-2 shadow-[0_20px_60px_-20px_rgba(15,53,39,0.5)] backdrop-blur-xl">
              {liens.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  onClick={() => setMenuOuvert(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-forest-800 hover:bg-forest-50"
                >
                  {lien.libelle}
                </Link>
              ))}
              <div className="mt-1 flex flex-col gap-2 p-1">
                <Button href="/connexion" variant="outline" size="md">Connexion</Button>
                <Button href="/inscription" variant="primary" size="md">Créer un compte</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
