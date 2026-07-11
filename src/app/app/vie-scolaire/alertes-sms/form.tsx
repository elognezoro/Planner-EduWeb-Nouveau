"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { envoyerAlerte, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };
const inputCls =
  "h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function AlerteForm({
  classes,
  etabId,
}: {
  classes: { id: string; nom: string }[];
  etabId: string | null;
}) {
  const [etat, action] = useActionState(envoyerAlerte, initial);
  return (
    <form action={action} className="space-y-4">
      {/* Établissement de travail : rattache l'alerte pour le cloisonnement (validé côté serveur). */}
      <input type="hidden" name="etablissementId" value={etabId ?? ""} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            Classe <span className="font-normal text-ink-700/50">(parents des élèves)</span>
          </label>
          <select name="classeId" defaultValue="" className={inputCls} disabled={classes.length === 0}>
            <option value="">—</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">
            Ou numéro direct <span className="font-normal text-ink-700/50">(optionnel)</span>
          </label>
          <input name="telephone" type="tel" placeholder="+225 0X XX XX XX XX" className={inputCls} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Type</label>
        <select name="type" defaultValue="info" className={inputCls}>
          <option value="absence">Absence</option>
          <option value="note">Note</option>
          <option value="convocation">Convocation</option>
          <option value="info">Information</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Message</label>
        <textarea
          name="contenu"
          rows={3}
          required
          maxLength={320}
          placeholder="Ex : Votre enfant a été absent ce jour. Merci de justifier."
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>

      <SubmitButton className="w-auto px-8">
        <Send size={15} /> Envoyer l&apos;alerte
      </SubmitButton>
    </form>
  );
}
