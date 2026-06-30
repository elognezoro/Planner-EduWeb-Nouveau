"use client";

import { useActionState } from "react";
import { creerAffectation, type EtatForm } from "./actions";
import { Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function AffectationForm({
  etablissementId,
  enseignants,
  classes,
  disciplines,
}: {
  etablissementId: string;
  enseignants: { id: string; nom: string }[];
  classes: { id: string; nom: string }[];
  disciplines: { id: string; nom: string }[];
}) {
  const [etat, action] = useActionState(creerAffectation, initial);

  if (enseignants.length === 0 || classes.length === 0) {
    return (
      <p className="text-sm text-ink-700/65">
        Pour créer une affectation, il faut au moins un enseignant rattaché à l'établissement
        (via une demande de rôle approuvée) et une classe.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="enseignantId">Enseignant</Label>
          <Select id="enseignantId" name="enseignantId" defaultValue="" required>
            <option value="" disabled>
              Choisir…
            </option>
            {enseignants.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="classeId">Classe</Label>
          <Select id="classeId" name="classeId" defaultValue="" required>
            <option value="" disabled>
              Choisir…
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="disciplineId">Discipline</Label>
          <Select id="disciplineId" name="disciplineId" defaultValue="" required>
            <option value="" disabled>
              Choisir…
            </option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <SubmitButton className="w-auto px-8">Affecter</SubmitButton>
    </form>
  );
}
