"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleAccordeon = {
  id: string;
  titre: string;
  sousTitre?: string | null;
  fait: boolean;
  /** Icône du type de leçon, rendue côté serveur. */
  icone: ReactNode;
  /** Contenu complet de la leçon, rendu côté serveur. */
  contenu: ReactNode;
};

/**
 * Modules du cours en ACCORDÉON exclusif : ouvrir une leçon replie automatiquement
 * les autres ; la leçon ouverte est ramenée en haut de l'écran (navigation fluide).
 */
export function AccordeonModules({ modules, ouvertParDefaut }: { modules: ModuleAccordeon[]; ouvertParDefaut?: string | null }) {
  const [ouvert, setOuvert] = useState<string | null>(ouvertParDefaut ?? modules[0]?.id ?? null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const basculer = (id: string) => {
    setOuvert((cur) => {
      const prochain = cur === id ? null : id;
      if (prochain) {
        setTimeout(() => refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
      return prochain;
    });
  };

  return (
    <div className="space-y-3">
      {modules.map((m, i) => {
        const estOuvert = ouvert === m.id;
        return (
          <div
            key={m.id}
            ref={(el) => { refs.current[m.id] = el; }}
            className={cn(
              "scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-soft transition-colors",
              estOuvert ? "border-forest-300 ring-1 ring-forest-100" : m.fait ? "border-forest-200" : "border-cream-200",
            )}
          >
            <button
              type="button"
              onClick={() => basculer(m.id)}
              aria-expanded={estOuvert}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-cream-50/70 sm:px-5"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", m.fait ? "bg-forest-600 text-white" : "bg-forest-50 text-forest-700")}>
                {m.icone}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-forest-900">
                  <span className="text-ink-700/40">{i + 1}.</span> {m.titre}
                </span>
                {m.sousTitre && <span className="block text-xs text-ink-700/55">{m.sousTitre}</span>}
              </span>
              {m.fait && (
                <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700 sm:inline-flex">
                  <CheckCircle2 size={14} /> Validé
                </span>
              )}
              {m.fait && <CheckCircle2 size={16} className="shrink-0 text-forest-600 sm:hidden" />}
              <ChevronDown size={19} className={cn("shrink-0 text-forest-500 transition-transform duration-200", estOuvert && "rotate-180")} />
            </button>
            {estOuvert && <div className="border-t border-cream-100 px-4 py-4 sm:px-6 sm:py-5">{m.contenu}</div>}
          </div>
        );
      })}
    </div>
  );
}
