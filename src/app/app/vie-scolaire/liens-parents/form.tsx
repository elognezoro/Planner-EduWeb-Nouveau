"use client";

import { useActionState } from "react";
import { creerLien, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function LienForm() {
  const [etat, action] = useActionState(creerLien, initial);
  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="parentEmail">E-mail du parent</Label>
          <Input id="parentEmail" name="parentEmail" type="email" required placeholder="parent@exemple.ci" />
        </div>
        <div>
          <Label htmlFor="eleveEmail">E-mail de l'élève</Label>
          <Input id="eleveEmail" name="eleveEmail" type="email" required placeholder="eleve@exemple.ci" />
        </div>
        <div>
          <Label htmlFor="lien">Lien</Label>
          <Select id="lien" name="lien" defaultValue="">
            <option value="">— Préciser —</option>
            <option value="père">Père</option>
            <option value="mère">Mère</option>
            <option value="tuteur légal">Tuteur légal</option>
          </Select>
        </div>
      </div>
      <SubmitButton className="w-auto px-8">Créer le lien</SubmitButton>
    </form>
  );
}
