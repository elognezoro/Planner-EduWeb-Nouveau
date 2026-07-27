"use client";

import { useActionState } from "react";
import { reinitialiserMotDePasse, type EtatForm } from "../actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { ChampMotDePasse } from "@/components/ui/champ-mot-de-passe";

const initial: EtatForm = { ok: false };

export function ReinitialiserForm({ token }: { token: string }) {
  const [etat, action] = useActionState(reinitialiserMotDePasse, initial);
  const err = etat.erreurs ?? {};

  return (
    <form action={action} className="space-y-4">
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <input type="hidden" name="token" value={token} />

      <ChampMotDePasse
        id="motDePasse"
        name="motDePasse"
        label="Nouveau mot de passe"
        required
        messages={err.motDePasse}
      />

      <ChampMotDePasse
        id="confirmation"
        name="confirmation"
        label="Confirmer le mot de passe"
        required
        avecCriteres={false}
        messages={err.confirmation}
      />

      <SubmitButton>Réinitialiser le mot de passe</SubmitButton>
    </form>
  );
}
