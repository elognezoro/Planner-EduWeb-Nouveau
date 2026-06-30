"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarCog, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { genererEmploiDuTemps, type EtatGeneration } from "./actions";

const initial: EtatGeneration = { ok: false };

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-8 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : <CalendarCog size={18} />}
      {pending ? "Génération en cours…" : "Lancer la génération"}
    </button>
  );
}

export function GenerationButton({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(genererEmploiDuTemps, initial);

  return (
    <div className="space-y-4">
      <form action={action}>
        <input type="hidden" name="etablissementId" value={etablissementId} />
        <Btn />
      </form>

      {etat.ok && etat.message && (
        <div className="flex items-start gap-2.5 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{etat.message}</span>
        </div>
      )}

      {!etat.ok && etat.message && (
        <div className="rounded-xl border border-gold-300/70 bg-gold-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold-900">
            <AlertTriangle size={17} /> {etat.message}
          </p>
          {etat.blocages && etat.blocages.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-7 text-sm text-gold-900/85">
              {etat.blocages.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-gold-900/70">
            Le système ne produit jamais d'emploi du temps incomplet : ajustez les points
            ci-dessus puis relancez.
          </p>
        </div>
      )}
    </div>
  );
}
