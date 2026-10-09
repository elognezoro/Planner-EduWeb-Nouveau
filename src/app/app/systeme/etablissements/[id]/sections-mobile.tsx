"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, List, Sparkles } from "lucide-react";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";

/** Événement émis quand une section est choisie : le bloc visé s'ouvre (blocs repliés sur
 *  téléphone, voir Bloc dans config-blocks.tsx). */
export const EVENEMENT_OUVRIR_BLOC = "config:ouvrir-bloc";

/** Toutes les sections de la console, DANS L'ORDRE DE LA PAGE (y compris les salles, les salles
 *  ressources et les enseignants imposés, absents de la barre « Aller à » de l'ordinateur). */
const SECTIONS: { id: string; label: string; essentiel?: boolean }[] = [
  { id: "categorie", label: "Catégorie pédagogique", essentiel: true },
  { id: "pays", label: "Pays & en-tête" },
  { id: "infos", label: "Informations générales" },
  { id: "chef", label: "Chef & documents officiels" },
  { id: "rapport", label: "Rapport d'établissement" },
  { id: "champs", label: "Champs enseignants", essentiel: true },
  { id: "effectifs", label: "Effectifs par niveau", essentiel: true },
  { id: "salles", label: "Salles & affectation aux classes", essentiel: true },
  { id: "salles-ressources", label: "Salles ressources" },
  { id: "contraintes", label: "Contraintes supplémentaires", essentiel: true },
  { id: "volumes", label: "Volumes horaires", essentiel: true },
  { id: "enseignants-effectifs", label: "Effectifs enseignants", essentiel: true },
  { id: "utilisateurs", label: "Utilisateurs" },
  { id: "competences", label: "Compétences enseignants", essentiel: true },
  { id: "epingles-enseignants", label: "Enseignant imposé par classe" },
];

/**
 * NAVIGATION DE LA CONSOLE SUR TÉLÉPHONE — remplace la barre collante « Aller à » (12 pastilles
 * qui couvraient la moitié de l'écran) par un bouton « Aller à une section » ouvrant une feuille
 * montante. Le saut a lieu APRÈS la fermeture de la feuille : la feuille rend le focus à son
 * déclencheur en se refermant, ce qui ramènerait sinon la page en haut.
 */
export function SectionsMobile() {
  const [ouvert, setOuvert] = useState(false);

  function aller(id: string) {
    setOuvert(false);
    // Durée de fermeture de la feuille (220 ms) + marge : le focus est rendu au bouton avant le saut.
    window.setTimeout(() => {
      const cible = document.getElementById(id);
      if (!cible) return;
      if (cible instanceof HTMLDetailsElement) cible.open = true;
      window.dispatchEvent(new CustomEvent(EVENEMENT_OUVRIR_BLOC, { detail: id }));
      const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      cible.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "start" });
    }, 280);
  }

  return (
    <div className="lg:hidden print:hidden">
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-cream-300 bg-white px-4 text-left font-semibold text-forest-800 shadow-soft active:bg-cream-100"
      >
        <List aria-hidden size={18} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Aller à une section</span>
        <ChevronDown aria-hidden size={18} className="shrink-0 text-ink-700/60" />
      </button>
      <FeuilleBas ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Sections de la configuration">
        {ouvert && (
          <div className="pb-2">
            <ul className="px-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => aller(s.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-forest-900 active:bg-cream-100"
                  >
                    <span
                      aria-hidden
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        s.essentiel ? "bg-gold-100 text-gold-700" : "bg-cream-200/70 text-ink-700/50"
                      }`}
                    >
                      {s.essentiel ? <Sparkles size={15} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    <span className="min-w-0 flex-1 font-medium">{s.label}</span>
                    {s.essentiel && <span className="sr-only"> (essentiel pour l&apos;emploi du temps)</span>}
                    <ChevronRight aria-hidden size={16} className="shrink-0 text-ink-700/40" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mx-3 mt-2 flex items-start gap-2 text-xs text-ink-700/70">
              <Sparkles aria-hidden size={14} className="mt-0.5 shrink-0 text-gold-600" />
              Sections dorées : paramètres essentiels à la génération des emplois du temps — à ne pas omettre.
            </p>
          </div>
        )}
      </FeuilleBas>
    </div>
  );
}
