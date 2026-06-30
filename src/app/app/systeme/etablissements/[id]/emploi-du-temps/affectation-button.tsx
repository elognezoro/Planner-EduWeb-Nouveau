"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Users, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { affecterAutomatiquement, type EtatGeneration } from "./actions";

const initial: EtatGeneration = { ok: false };

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-forest-700 bg-white px-6 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-70"
    >
      {pending ? <Loader2 size={17} className="animate-spin" /> : <Users size={17} />}
      {pending ? "Répartition en cours…" : "Répartir les enseignants dans les classes"}
    </button>
  );
}

export function AffectationButton({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(affecterAutomatiquement, initial);
  return (
    <div className="space-y-3">
      <form action={action}>
        <input type="hidden" name="etablissementId" value={etablissementId} />
        <Btn />
      </form>
      {etat.message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${etat.ok ? "border-forest-200 bg-forest-50 text-forest-800" : "border-gold-300/70 bg-gold-50 text-gold-900"}`}>
          <p className="flex items-center gap-2 font-medium">
            {etat.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {etat.message}
          </p>
          {etat.blocages && etat.blocages.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-7 text-xs text-gold-900/80">
              {etat.blocages.slice(0, 8).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
