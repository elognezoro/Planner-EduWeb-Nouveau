"use client";

import { useActionState } from "react";
import { Calculator } from "lucide-react";
import { calculerClasses, type EtatForm } from "./config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

interface LigneNiveau {
  niveauId: string;
  nom: string;
  effectif: number;
  vacation: string;
  nbClasses: number;
}

export function NiveauxForm({
  etablissementId,
  lignes,
}: {
  etablissementId: string;
  lignes: LigneNiveau[];
}) {
  const [etat, action] = useActionState(calculerClasses, initial);
  const total = lignes.reduce((acc, l) => acc + l.nbClasses, 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left">
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Niveau</th>
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Effectif élèves</th>
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Vacation</th>
              <th className="py-2.5 text-right font-semibold text-ink-700/70">Classes</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.niveauId} className="border-b border-cream-100 last:border-0">
                <td className="py-2 pr-4 font-medium text-forest-900">{l.nom}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    name={`effectif_${l.niveauId}`}
                    min={0}
                    defaultValue={l.effectif || ""}
                    placeholder="0"
                    className="h-9 w-28 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </td>
                <td className="py-2 pr-4">
                  <select
                    name={`vacation_${l.niveauId}`}
                    defaultValue={l.vacation}
                    className="h-9 w-28 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  >
                    <option value="simple">Simple</option>
                    <option value="double">Double</option>
                  </select>
                </td>
                <td className="py-2 text-right font-semibold text-forest-800">
                  {l.nbClasses || "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-cream-200">
              <td colSpan={3} className="py-2.5 pr-4 text-right text-sm font-medium text-ink-700/70">
                Total des divisions
              </td>
              <td className="py-2.5 text-right font-display text-lg font-bold text-forest-900">
                {total}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <SubmitButton className="w-auto px-6">
        <Calculator size={16} /> Calculer les classes pédagogiques
      </SubmitButton>
      <p className="text-xs text-ink-700/55">
        Le nombre de classes = effectif du niveau ÷ effectif souhaité par classe (arrondi au
        supérieur). Les classes manquantes sont créées automatiquement (A, B, C…).
      </p>
    </form>
  );
}
