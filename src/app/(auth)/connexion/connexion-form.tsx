"use client";

import { useActionState } from "react";
import Link from "next/link";
import { seConnecter, type EtatForm } from "../actions";
import { Input, Label, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function ConnexionForm() {
  const [etat, action] = useActionState(seConnecter, initial);
  // Deuxième temps de la connexion : le compte a la double authentification active et
  // un code à 6 chiffres vient d'être envoyé. On révèle le champ de saisie du code et on
  // verrouille l'e-mail/mot de passe (dont les valeurs sont renvoyées telles quelles).
  const etape2fa = etat.etape === "2fa";

  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etape2fa ? "info" : "erreur"}>{etat.message}</FormAlert>
      )}

      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.ci"
          readOnly={etape2fa}
        />
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
          readOnly={etape2fa}
        />
      </div>

      {etape2fa && (
        <div>
          <Label htmlFor="code">Code de vérification (6 chiffres)</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="••••••"
            className="text-center text-lg tracking-[0.5em]"
          />
          <p className="mt-1.5 text-xs text-ink-700/70">
            Saisissez le code reçu par e-mail. Valable 10&nbsp;minutes.
          </p>
        </div>
      )}

      <SubmitButton>{etape2fa ? "Valider le code" : "Se connecter"}</SubmitButton>
    </form>
  );
}
