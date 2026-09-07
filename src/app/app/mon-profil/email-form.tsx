"use client";

import { useActionState, useEffect, useRef } from "react";
import { changerEmail, type EtatForm } from "./actions";
import { Input, Label, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

/**
 * Changement de l'ADRESSE E-MAIL = l'IDENTIFIANT DE CONNEXION.
 * Destiné en premier lieu aux comptes créés en masse (Convertisseur CSV / import
 * « Enseignants ») dont l'adresse est générique : l'utilisateur y met une adresse qu'il
 * consulte réellement. Le mot de passe actuel est exigé.
 */
export function EmailForm({ emailActuel }: { emailActuel: string }) {
  const [etat, action] = useActionState(changerEmail, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const err = etat.erreurs ?? {};

  useEffect(() => {
    if (etat.ok) formRef.current?.reset();
  }, [etat]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div>
        <Label htmlFor="emailActuel">Identifiant actuel</Label>
        <Input id="emailActuel" value={emailActuel} disabled readOnly />
        <p className="mt-1.5 text-xs text-ink-700/60">
          C&apos;est l&apos;adresse avec laquelle vous vous connectez aujourd&apos;hui.
        </p>
      </div>

      <div>
        <Label htmlFor="email">Nouvelle adresse e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.com"
        />
        <FieldError messages={err.email} />
        <p className="mt-1.5 text-xs text-ink-700/60">
          Choisissez une adresse que vous consultez régulièrement : elle deviendra votre
          identifiant de connexion et recevra vos notifications ainsi que les liens de
          réinitialisation de mot de passe.
        </p>
      </div>

      <div>
        <Label htmlFor="confirmationEmail">Confirmation de l&apos;adresse</Label>
        <Input
          id="confirmationEmail"
          name="confirmation"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.com"
        />
        <FieldError messages={err.confirmation} />
      </div>

      <div>
        <Label htmlFor="actuelEmailMdp">Mot de passe actuel</Label>
        <Input
          id="actuelEmailMdp"
          name="actuel"
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError messages={err.actuel} />
      </div>

      <div className="pt-1">
        <SubmitButton className="w-auto px-8">Changer mon identifiant</SubmitButton>
      </div>
    </form>
  );
}
