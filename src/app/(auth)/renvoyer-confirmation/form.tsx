"use client";

import { useActionState } from "react";
import { renvoyerConfirmation, type EtatForm } from "../actions";
import { Input, Label, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function RenvoyerConfirmationForm({ retour = null }: { retour?: string | null }) {
  const [etat, action] = useActionState(renvoyerConfirmation, initial);

  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      {/* Page à retrouver après confirmation puis connexion — déjà validée par la page ;
          re-validée côté serveur dans renvoyerConfirmation. */}
      {retour && <input type="hidden" name="retour" value={retour} />}
      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.ci"
        />
      </div>
      <SubmitButton>Renvoyer le lien de confirmation</SubmitButton>
    </form>
  );
}
