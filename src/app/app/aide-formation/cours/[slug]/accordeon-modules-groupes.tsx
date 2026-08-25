"use client";

import { useRef, useState } from "react";
import { ChevronDown, CheckCircle2, Lock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleAccordeon } from "./accordeon-modules";

export type GroupeAccordeon = {
  cle: string;
  titre: string;
  /** Activités (leçon, quiz, atelier…) du module, dans l'ordre. */
  activites: ModuleAccordeon[];
};

/**
 * Modules du cours en accordéon à DEUX niveaux : tuiles de 1er rang = MODULES ; à l'intérieur d'un
 * module ouvert, ses activités (leçon, quiz, atelier) apparaissent en SECTIONS (sous-accordéon).
 * Ouverture exclusive à chaque niveau ; le module ouvert est ramené en haut de l'écran.
 */
export function AccordeonModulesGroupes({
  groupes, groupeOuvertParDefaut, activiteOuverteParDefaut,
}: {
  groupes: GroupeAccordeon[];
  groupeOuvertParDefaut?: string | null;
  activiteOuverteParDefaut?: string | null;
}) {
  const [groupeOuvert, setGroupeOuvert] = useState<string | null>(groupeOuvertParDefaut ?? groupes[0]?.cle ?? null);
  const [activiteOuverte, setActiviteOuverte] = useState<string | null>(activiteOuverteParDefaut ?? null);
  const refsGroupe = useRef<Record<string, HTMLDivElement | null>>({});
  const refsActivite = useRef<Record<string, HTMLDivElement | null>>({});

  const premiereActiviteOuvrable = (g: GroupeAccordeon): string | null => {
    const dispo = g.activites.filter((a) => !(a.verrouille && !a.fait));
    return (dispo.find((a) => !a.fait) ?? dispo[0])?.id ?? null;
  };

  const basculerGroupe = (g: GroupeAccordeon) => {
    setGroupeOuvert((cur) => {
      const prochain = cur === g.cle ? null : g.cle;
      if (prochain) {
        setActiviteOuverte(premiereActiviteOuvrable(g));
        setTimeout(() => refsGroupe.current[g.cle]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
      return prochain;
    });
  };

  const basculerActivite = (id: string, verrouille?: boolean) => {
    if (verrouille) return;
    setActiviteOuverte((cur) => {
      const prochain = cur === id ? null : id;
      if (prochain) setTimeout(() => refsActivite.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 90);
      return prochain;
    });
  };

  return (
    <div className="space-y-3">
      {groupes.map((g, gi) => {
        const total = g.activites.length;
        const faits = g.activites.filter((a) => a.fait).length;
        const toutFait = total > 0 && faits === total;
        const estOuvert = groupeOuvert === g.cle;
        return (
          <div
            key={g.cle}
            ref={(el) => { refsGroupe.current[g.cle] = el; }}
            className={cn(
              "scroll-mt-24 overflow-hidden rounded-2xl border shadow-soft transition-colors",
              estOuvert ? "border-forest-300 ring-1 ring-forest-100" : toutFait ? "border-forest-200" : "border-cream-200",
              "bg-white",
            )}
          >
            {/* En-tête du MODULE */}
            <button
              type="button"
              onClick={() => basculerGroupe(g)}
              aria-expanded={estOuvert}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-cream-50/70 sm:px-5"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toutFait ? "bg-forest-600 text-white" : "bg-forest-50 text-forest-700")}>
                {toutFait ? <CheckCircle2 size={18} /> : <Layers size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-bold text-forest-900 sm:text-lg">
                  <span className="text-ink-700/40">{gi + 1}.</span> {g.titre}
                </span>
                <span className="block text-xs text-ink-700/55">{total} activité{total > 1 ? "s" : ""}{faits > 0 ? ` · ${faits}/${total} validée${faits > 1 ? "s" : ""}` : ""}</span>
              </span>
              {toutFait && (
                <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-forest-50 px-3 py-1 text-xs font-semibold text-forest-700 sm:inline-flex">
                  <CheckCircle2 size={14} /> Terminé
                </span>
              )}
              <ChevronDown size={20} className={cn("shrink-0 text-forest-500 transition-transform duration-200", estOuvert && "rotate-180")} />
            </button>

            {/* SECTIONS d'activités du module */}
            {estOuvert && (
              <div className="space-y-2 border-t border-cream-100 bg-cream-50/40 p-3 sm:p-4">
                {g.activites.map((a, ai) => {
                  const verrouille = !!a.verrouille && !a.fait;
                  const ouvert = activiteOuverte === a.id && !verrouille;
                  return (
                    <div
                      key={a.id}
                      ref={(el) => { refsActivite.current[a.id] = el; }}
                      className={cn(
                        "scroll-mt-24 overflow-hidden rounded-xl border bg-white transition-colors",
                        ouvert ? "border-forest-300" : verrouille ? "border-cream-200 bg-cream-50/60" : a.fait ? "border-forest-200" : "border-cream-200",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => basculerActivite(a.id, verrouille)}
                        aria-expanded={ouvert}
                        aria-disabled={verrouille}
                        className={cn("flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors sm:px-4", verrouille ? "cursor-not-allowed" : "hover:bg-cream-50/70")}
                      >
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", verrouille ? "bg-cream-200 text-ink-700/40" : a.fait ? "bg-forest-600 text-white" : "bg-forest-50 text-forest-700")}>
                          {verrouille ? <Lock size={15} /> : a.icone}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-semibold", verrouille ? "text-ink-700/50" : "text-forest-900")}>
                            <span className="text-ink-700/40">{gi + 1}.{ai + 1}</span> {a.titre}
                          </span>
                          {verrouille
                            ? <span className="block text-xs text-ink-700/50">Terminez l&apos;activité précédente pour déverrouiller</span>
                            : a.sousTitre && <span className="block text-xs text-ink-700/55">{a.sousTitre}</span>}
                        </span>
                        {a.fait && <CheckCircle2 size={15} className="shrink-0 text-forest-600" />}
                        {!verrouille && <ChevronDown size={17} className={cn("shrink-0 text-forest-500 transition-transform duration-200", ouvert && "rotate-180")} />}
                        {verrouille && <Lock size={14} className="shrink-0 text-ink-700/35" />}
                      </button>
                      {ouvert && <div className="border-t border-cream-100 px-3 py-3.5 sm:px-5 sm:py-4">{a.contenu}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
