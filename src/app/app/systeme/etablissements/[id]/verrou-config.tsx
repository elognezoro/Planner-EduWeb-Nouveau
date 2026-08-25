"use client";

import { useActionState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { basculerVerrouConfig, type EtatForm } from "./config-actions";
import { SubmitButton, FormAlert } from "@/components/ui/form";

/**
 * VERROU de la configuration d'établissement. Quand la configuration est jugée terminée,
 * l'administrateur SYSTÈME la verrouille : toute modification est refusée (côté serveur) jusqu'au
 * déverrouillage. Seul l'admin système voit et actionne le bouton ; les autres rôles voient un
 * bandeau en lecture seule quand c'est verrouillé.
 */
export function VerrouConfig({
  etablissementId,
  verrouillee,
  estAdminSysteme,
  verrouilleeLe,
}: {
  etablissementId: string;
  verrouillee: boolean;
  estAdminSysteme: boolean;
  verrouilleeLe: string | null;
}) {
  const [etat, action] = useActionState(basculerVerrouConfig, { ok: false } as EtatForm);

  // Rôles non-système : bandeau en lecture seule uniquement lorsque c'est verrouillé.
  if (!estAdminSysteme) {
    if (!verrouillee) return null;
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-900">
        <Lock size={16} className="shrink-0" />
        <span>
          <strong>Configuration verrouillée</strong> par l&apos;administrateur système
          {verrouilleeLe ? ` le ${verrouilleeLe}` : ""} — les modifications sont désactivées.
        </span>
      </div>
    );
  }

  // Administrateur système : bandeau + bouton verrouiller / déverrouiller.
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        verrouillee ? "border-gold-300 bg-gold-50" : "border-cream-200 bg-cream-50/60"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          {verrouillee ? (
            <Lock size={18} className="mt-0.5 shrink-0 text-gold-700" />
          ) : (
            <LockOpen size={18} className="mt-0.5 shrink-0 text-forest-700" />
          )}
          <div className="text-sm">
            <p className={`font-semibold ${verrouillee ? "text-gold-900" : "text-forest-900"}`}>
              {verrouillee ? "Configuration verrouillée" : "Configuration modifiable"}
            </p>
            <p className="mt-0.5 text-ink-700/65">
              {verrouillee
                ? `Toute modification est refusée${verrouilleeLe ? ` (verrouillée le ${verrouilleeLe})` : ""}. La génération de l'emploi du temps reste possible.`
                : "Quand la configuration est terminée, verrouillez-la pour la protéger contre toute modification. Seul l'administrateur système peut la déverrouiller ensuite."}
            </p>
          </div>
        </div>
        <form action={action} className="shrink-0">
          <input type="hidden" name="etablissementId" value={etablissementId} />
          <input type="hidden" name="verrouiller" value={verrouillee ? "0" : "1"} />
          <SubmitButton
            className={`w-auto px-5 ${verrouillee ? "" : "!bg-gradient-to-br !from-gold-300 !to-gold-500 !text-forest-950"}`}
          >
            {verrouillee ? (
              <>
                <LockOpen size={16} /> Déverrouiller
              </>
            ) : (
              <>
                <Lock size={16} /> Verrouiller la configuration
              </>
            )}
          </SubmitButton>
        </form>
      </div>
      {etat.message && (
        <div className="mt-2">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}
    </div>
  );
}
