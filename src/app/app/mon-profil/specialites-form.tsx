"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { mettreAJourSpecialites, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

/**
 * Bloc « Ma spécialité (encadrement pédagogique) » — rôles inspecteur / conseiller
 * pédagogique. Choix MULTIPLES parmi les disciplines SIMPLES du référentiel (les couples
 * « X / Y » sont exclus côté serveur), sur le même patron de liste déroulante cochable que
 * le bloc Compétences des enseignants de la console d'établissement.
 */
export function SpecialitesForm({
  disciplines,
  specialites,
}: {
  /** Noms des disciplines SIMPLES du référentiel, triés. */
  disciplines: string[];
  /** Spécialités actuellement enregistrées. */
  specialites: string[];
}) {
  const [etat, action] = useActionState(mettreAJourSpecialites, initial);
  const [selection, setSelection] = useState<Set<string>>(() => new Set(specialites));
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement | null>(null);

  // Fermeture de la liste déroulante au clic extérieur / Échap (même patron qu'ailleurs).
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (ev: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(ev.target as Node)) setOuvert(false);
    };
    const surTouche = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("keydown", surTouche);
    };
  }, [ouvert]);

  function basculer(nom: string) {
    setSelection((prev) => {
      const s = new Set(prev);
      if (s.has(nom)) s.delete(nom);
      else s.add(nom);
      return s;
    });
  }

  const actives = [...selection].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <form action={action} className="space-y-4">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <input type="hidden" name="specialites" value={JSON.stringify(actives)} />

      <div ref={conteneur} className="relative max-w-md">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={ouvert}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-cream-300 bg-white px-3 text-left text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        >
          <span className={`truncate ${actives.length ? "text-ink-900" : "text-ink-700/50"}`}>
            {actives.length ? actives.join(" / ") : "Choisir ma ou mes spécialités…"}
          </span>
          <ChevronDown
            size={15}
            className={`shrink-0 text-ink-700/45 transition-transform ${ouvert ? "rotate-180" : ""}`}
          />
        </button>
        {ouvert && (
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-cream-200 bg-white py-1 shadow-soft"
          >
            {disciplines.map((nom) => {
              const active = selection.has(nom);
              return (
                <li key={nom}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => basculer(nom)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-forest-50 ${
                      active ? "font-semibold text-forest-900" : "text-ink-800"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        active ? "border-forest-600 bg-forest-600 text-white" : "border-cream-300 bg-white"
                      }`}
                    >
                      {active && <Check size={11} />}
                    </span>
                    {nom}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-700/55">
        À la planification d&apos;une visite de classe ou de suivi, la liste des enseignants proposés
        est restreinte à ceux dont une spécialité correspond à la vôtre. Sans spécialité renseignée,
        la liste n&apos;est pas restreinte.
      </p>

      <SubmitButton className="w-auto px-8">Enregistrer mes spécialités</SubmitButton>
    </form>
  );
}
