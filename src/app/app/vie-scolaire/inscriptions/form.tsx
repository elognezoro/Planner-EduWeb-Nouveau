"use client";

import { useActionState } from "react";
import { inscrireEleve, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function InscriptionForm({
  etablissementId,
  classes,
}: {
  etablissementId: string;
  classes: { id: string; nom: string }[];
}) {
  const [etat, action] = useActionState(inscrireEleve, initial);

  if (classes.length === 0) {
    return (
      <p className="text-sm text-ink-700/65">
        Créez d&apos;abord au moins une classe (Système → Établissements → fiche établissement).
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="email">E-mail de l&apos;élève</Label>
          <Input id="email" name="email" type="email" required placeholder="eleve@exemple.ci" />
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
      </div>
      <SubmitButton className="w-auto px-8">Inscrire l&apos;élève</SubmitButton>
    </form>
  );
}
