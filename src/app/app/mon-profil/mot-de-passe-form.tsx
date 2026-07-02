"use client";

import { useActionState, useEffect, useRef } from "react";
import { changerMotDePasse, type EtatForm } from "./actions";
import { Input, Label, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function MotDePasseForm() {
  const [etat, action] = useActionState(changerMotDePasse, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const err = etat.erreurs ?? {};

  // Vide les champs après un changement réussi.
  useEffect(() => {
    if (etat.ok) formRef.current?.reset();
  }, [etat]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <div>
        <Label htmlFor="actuel">Mot de passe actuel</Label>
        <Input
          id="actuel"
          name="actuel"
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError messages={err.actuel} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nouveau">Nouveau mot de passe</Label>
          <Input
            id="nouveau"
            name="nouveau"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={err.nouveau} />
        </div>
        <div>
          <Label htmlFor="confirmation">Confirmation</Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={err.confirmation} />
        </div>
      </div>
      <div className="pt-1">
        <SubmitButton className="w-auto px-8">Changer le mot de passe</SubmitButton>
      </div>
    </form>
  );
}
