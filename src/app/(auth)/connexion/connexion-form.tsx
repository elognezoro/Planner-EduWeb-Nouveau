"use client";

import { useActionState } from "react";
import Link from "next/link";
import { seConnecter, type EtatForm } from "../actions";
import { Input, Label, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function ConnexionForm() {
  const [etat, action] = useActionState(seConnecter, initial);

  return (
    <form action={action} className="space-y-4">
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}

      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.ci" />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="motDePasse">Mot de passe</Label>
          <Link
            href="/mot-de-passe-oublie"
            className="text-xs font-semibold text-gold-700 hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton>Se connecter</SubmitButton>
    </form>
  );
}
