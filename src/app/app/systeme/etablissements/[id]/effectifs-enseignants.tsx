"use client";

import { useActionState } from "react";
import { enregistrerEffectifsEnseignants, type EtatForm } from "./config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function EffectifsEnseignantsForm({
  etablissementId,
  disciplines,
  valeurs,
}: {
  etablissementId: string;
  disciplines: { id: string; nom: string }[];
  valeurs: Record<string, number>;
}) {
  const [etat, action] = useActionState(enregistrerEffectifsEnseignants, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-cream-200 text-left">
              <th className="py-2.5 pr-4 font-semibold text-ink-700/70">Discipline</th>
              <th className="px-3 py-2.5 text-center font-semibold text-ink-700/70">Collège</th>
              <th className="px-3 py-2.5 text-center font-semibold text-ink-700/70">Lycée</th>
            </tr>
          </thead>
          <tbody>
            {disciplines.map((d) => (
              <tr key={d.id} className="border-b border-cream-100 last:border-0">
                <td className="py-2 pr-4 font-medium text-forest-900">{d.nom}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    name={`eff_college_${d.id}`}
                    min={0}
                    defaultValue={valeurs[`college:${d.id}`] || ""}
                    placeholder="0"
                    className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    name={`eff_lycee_${d.id}`}
                    min={0}
                    defaultValue={valeurs[`lycee:${d.id}`] || ""}
                    placeholder="0"
                    className="h-9 w-20 rounded-lg border border-cream-300 bg-white px-2 text-center text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SubmitButton className="w-auto px-6">Enregistrer les effectifs enseignants</SubmitButton>
      <p className="text-xs text-ink-700/55">
        Nombre d'enseignants disponibles par discipline et par cycle. Le solveur répartit ces
        enseignants (anonymes) sur les classes sans jamais les mettre en double sur un même créneau.
      </p>
    </form>
  );
}
