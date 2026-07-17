"use client";

import { useActionState } from "react";
import { enregistrerNotes, type EtatForm } from "./actions";
import { Input, Label, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function NotesForm({
  classeId,
  disciplineId,
  periode,
  eleves,
}: {
  classeId: string;
  disciplineId: string;
  periode: number;
  eleves: { eleveId: string; nom: string }[];
}) {
  const [etat, action] = useActionState(enregistrerNotes, initial);

  if (eleves.length === 0) {
    return (
      <p className="text-sm text-ink-700/65">
        Aucun élève inscrit dans cette classe.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <input type="hidden" name="classeId" value={classeId} />
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <input type="hidden" name="periode" value={periode} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="libelle">Libellé de l&apos;évaluation</Label>
          <Input id="libelle" name="libelle" required placeholder="Ex : Devoir 1" />
        </div>
        <div>
          <Label htmlFor="sur">Barème (note sur)</Label>
          <Input id="sur" name="sur" type="number" min={1} step={1} defaultValue={20} />
        </div>
      </div>

      <ul className="divide-y divide-cream-100">
        {eleves.map((e) => (
          <li key={e.eleveId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-medium text-forest-900">{e.nom}</span>
            <input
              type="number"
              name={`note_${e.eleveId}`}
              min={0}
              step="0.25"
              placeholder="—"
              className="h-9 w-24 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
          </li>
        ))}
      </ul>

      <SubmitButton className="w-auto px-8">Enregistrer les notes</SubmitButton>
    </form>
  );
}
