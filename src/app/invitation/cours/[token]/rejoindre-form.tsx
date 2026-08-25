"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn, Loader2, AlertCircle } from "lucide-react";
import { rejoindreCoursParInvitation } from "@/app/app/aide-formation/invitation-cours-actions";

/**
 * Bouton d'adhésion : le participant (connecté) ouvre le lien d'invitation et rejoint le cours
 * en un clic. Sur succès, on l'emmène directement dans le lecteur du cours.
 */
export function RejoindreCours({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [etat, setEtat] = useState<{ ok: boolean; message: string; slug?: string } | null>(null);

  const rejoindre = () => {
    startTransition(async () => {
      const r = await rejoindreCoursParInvitation(token);
      setEtat({ ok: r.ok, message: r.message, slug: r.slug });
      if (r.ok && r.slug) {
        router.push(`/app/aide-formation/cours/${r.slug}`);
        router.refresh();
      }
    });
  };

  if (etat && etat.ok) {
    return (
      <div className="rounded-2xl border border-forest-200 bg-forest-50/60 p-4 text-center">
        <CheckCircle2 size={30} className="mx-auto mb-2 text-forest-600" />
        <p className="text-sm font-semibold text-forest-900">{etat.message}</p>
        <p className="mt-1 text-xs text-ink-700/65">Ouverture du cours…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {etat && !etat.ok && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {etat.message}
        </p>
      )}
      <button
        type="button"
        onClick={rejoindre}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-700 disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {pending ? "Inscription…" : "Rejoindre ce cours"}
      </button>
    </div>
  );
}
