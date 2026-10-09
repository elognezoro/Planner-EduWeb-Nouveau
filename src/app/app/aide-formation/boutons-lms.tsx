"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Loader2, PlayCircle, CalendarPlus, CalendarX, Lock } from "lucide-react";
import { sinscrireCours, marquerModule, basculerInscriptionSession } from "./actions";

/** Bouton « Commencer / Continuer » un cours (inscrit puis navigue vers le cours). */
export function BoutonInscription({ coursId, slug, inscrit, clos = false }: { coursId: string; slug: string; inscrit: boolean; clos?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Inscriptions closes et non déjà inscrit : plus de nouvelle inscription possible (cohérent avec le serveur).
  if (!inscrit && clos) {
    return (
      <span className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-5 text-sm font-semibold text-ink-700/60 mobile:h-11 mobile:w-full mobile:justify-center" title="La date de clôture des inscriptions est dépassée.">
        <Lock size={15} /> Inscriptions closes
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!inscrit) await sinscrireCours(coursId);
          router.push(`/app/aide-formation/cours/${slug}`);
        })
      }
      // Téléphone : appel à l'action pleine largeur de 44 px en pied de carte du catalogue.
      className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60 mobile:h-11 mobile:w-full mobile:justify-center"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={16} />}
      {inscrit ? "Continuer" : "Commencer"}
    </button>
  );
}

/** Case à cocher « leçon terminée ». */
export function BoutonLecon({ moduleId, termine }: { moduleId: string; termine: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await marquerModule(moduleId, !termine); router.refresh(); })}
      // Téléphone : cible de 44 px. Le « ! » est nécessaire : « .cours-agrandi .text-xs », hors
      // couche, battrait sinon mobile:text-sm (le bouton est rendu dans .cours-agrandi).
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 mobile:min-h-11 mobile:text-sm! ${
        termine ? "bg-forest-600 text-white hover:bg-forest-700" : "border border-cream-300 text-ink-700/70 hover:bg-cream-100"
      }`}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : termine ? <Check size={14} /> : <Circle size={14} />}
      {termine ? "Terminé" : "Marquer terminé"}
    </button>
  );
}

/** Bouton d'inscription / désinscription à une session. */
export function BoutonSession({ sessionId, inscrit, complet }: { sessionId: string; inscrit: boolean; complet: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const desactive = pending || (!inscrit && complet);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={desactive}
        onClick={() =>
          start(async () => {
            const r = await basculerInscriptionSession(sessionId);
            if (!r.ok) setMessage(r.message ?? "Action impossible.");
            else { setMessage(null); router.refresh(); }
          })
        }
        className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60 mobile:h-11 ${
          inscrit ? "border border-cream-300 text-ink-700/70 hover:bg-cream-100" : "bg-forest-600 text-white hover:bg-forest-700"
        }`}
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : inscrit ? <CalendarX size={15} /> : <CalendarPlus size={15} />}
        {inscrit ? "Se désinscrire" : complet ? "Complet" : "S'inscrire"}
      </button>
      {message && <span className="text-[0.7rem] text-red-600">{message}</span>}
    </div>
  );
}
