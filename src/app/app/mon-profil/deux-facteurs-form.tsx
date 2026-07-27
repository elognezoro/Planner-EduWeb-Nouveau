"use client";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import {
  activerDeuxFacteurs,
  confirmerDeuxFacteurs,
  desactiverDeuxFacteurs,
  type EtatForm,
} from "./actions";
import { Input, Label, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

/**
 * Réglage de la double authentification (2FA) — opt-in, canal e-mail.
 * Trois états : inactive → (envoi d'un code) → saisie du code → active.
 * L'activation exige la confirmation d'un code reçu par e-mail (preuve que le canal marche).
 */
export function DeuxFacteursForm({ actif, email }: { actif: boolean; email: string }) {
  const [etatActiver, actionActiver] = useActionState(activerDeuxFacteurs, initial);
  const [etatConfirmer, actionConfirmer] = useActionState(confirmerDeuxFacteurs, initial);
  const [etatDesactiver, actionDesactiver] = useActionState(desactiverDeuxFacteurs, initial);

  // Phase « saisie du code » : ouverte dès qu'un code a été envoyé, fermée après confirmation.
  const [enAttenteCode, setEnAttenteCode] = useState(false);
  useEffect(() => {
    if (etatActiver.ok) setEnAttenteCode(true);
  }, [etatActiver]);
  useEffect(() => {
    if (etatConfirmer.ok) setEnAttenteCode(false);
  }, [etatConfirmer]);

  // ── 2FA déjà active ──────────────────────────────────────────────────────────
  if (actif) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest-600" />
          <span>
            La double authentification est <strong>active</strong> (par e-mail). À chaque
            connexion, un code à 6&nbsp;chiffres est envoyé à <strong>{email}</strong>.
          </span>
        </div>
        {etatDesactiver.message && (
          <FormAlert ton={etatDesactiver.ok ? "succes" : "erreur"}>
            {etatDesactiver.message}
          </FormAlert>
        )}
        <form action={actionDesactiver}>
          <SubmitButton className="w-auto bg-red-600 px-6 hover:bg-red-700">
            Désactiver la double authentification
          </SubmitButton>
        </form>
      </div>
    );
  }

  // ── 2FA inactive : proposer l'activation ─────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-ink-700">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-gold-600" />
        <span>
          La double authentification ajoute une étape de sécurité : à la connexion, un code à
          6&nbsp;chiffres vous est envoyé par e-mail. <strong>Facultative</strong>, vous pouvez
          l'activer ou la désactiver à tout moment.
        </span>
      </div>

      {!enAttenteCode ? (
        <>
          {etatActiver.message && !etatActiver.ok && (
            <FormAlert ton="erreur">{etatActiver.message}</FormAlert>
          )}
          {etatConfirmer.ok && <FormAlert ton="succes">{etatConfirmer.message}</FormAlert>}
          <form action={actionActiver}>
            <SubmitButton className="w-auto px-6">
              Activer la double authentification
            </SubmitButton>
          </form>
        </>
      ) : (
        <form action={actionConfirmer} className="space-y-3">
          {etatActiver.ok && !etatConfirmer.message && (
            <FormAlert ton="info">{etatActiver.message}</FormAlert>
          )}
          {etatConfirmer.message && !etatConfirmer.ok && (
            <FormAlert ton="erreur">{etatConfirmer.message}</FormAlert>
          )}
          <div>
            <Label htmlFor="code2fa">Code de vérification (6 chiffres)</Label>
            <Input
              id="code2fa"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="••••••"
              className="max-w-[12rem] text-center text-lg tracking-[0.5em]"
            />
            <FieldError messages={etatConfirmer.erreurs?.code} />
          </div>
          <SubmitButton className="w-auto px-6">Confirmer l'activation</SubmitButton>
          <p className="text-xs text-ink-700/70">
            Vous n'avez rien reçu ?{" "}
            <button
              type="button"
              onClick={() => setEnAttenteCode(false)}
              className="font-semibold text-gold-700 hover:underline"
            >
              Revenir en arrière et renvoyer un code
            </button>
          </p>
        </form>
      )}
    </div>
  );
}
