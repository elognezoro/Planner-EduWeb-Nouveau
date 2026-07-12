import Link from "next/link";
import { ArrowLeft, CalendarCheck, ShieldCheck, Users, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const atouts = [
  { icone: CalendarCheck, texte: "Emplois du temps générés automatiquement" },
  { icone: ShieldCheck, texte: "Accès sécurisé, filtré par rôle et périmètre" },
  { icone: Users, texte: "Une interface unique pour 22 profils" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panneau de marque (masqué sur mobile) — même esprit premium que le hero. */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 p-12 text-cream-50 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-grid-forest opacity-30" aria-hidden />
        <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-gold-500/15 blur-[110px]" aria-hidden />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-forest-400/20 blur-[110px]" aria-hidden />

        <div className="relative">
          <Logo tone="light" />
        </div>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-forest-900/60 px-4 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-gold-200 backdrop-blur">
            <Sparkles size={13} /> Plateforme nationale
          </span>
          <h2 className="mt-6 font-display text-4xl font-bold leading-[1.1] text-balance">
            La gestion scolaire,{" "}
            <span className="text-gold-gradient">de la classe à la nation</span>.
          </h2>
          <ul className="mt-8 space-y-4">
            {atouts.map((a) => (
              <li key={a.texte} className="flex items-center gap-3 text-cream-200/90">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                  <a.icone size={18} />
                </span>
                {a.texte}
              </li>
            ))}
          </ul>

          {/* Puce flottante décorative (façon hero). */}
          <div className="animate-float mt-10 inline-flex items-center gap-3 rounded-2xl border border-cream-50/15 bg-forest-950/50 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-500/25 text-forest-200">
              <CalendarCheck size={17} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-cream-50">Planning généré</p>
              <p className="text-xs text-cream-200/60">55 classes · sans conflit</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-cream-200/50">
          © {new Date().getFullYear()} EduWeb Planner · Système éducatif ivoirien
        </p>
      </aside>

      {/* Zone de formulaire */}
      <main className="flex flex-col bg-background">
        <div className="flex items-center justify-between p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-cream-200 bg-white/70 px-3.5 py-2 text-sm font-medium text-forest-700 shadow-sm backdrop-blur transition-colors hover:border-forest-300 hover:text-forest-900"
          >
            <ArrowLeft size={16} />
            Accueil
          </Link>
          <div className="lg:hidden">
            <Logo withWordmark={false} size={36} />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
