"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Clock, ArrowRight } from "lucide-react";
import { accepterInvitation, type ResultatInvitation } from "@/app/app/aide-formation/invitation-actions";

const champ = "h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function AccepterInvitation({ token, aCode, codeInitial }: { token: string; aCode: boolean; codeInitial: string }) {
  const [code, setCode] = useState(codeInitial);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ResultatInvitation | null>(null);

  const accepter = () => start(async () => setRes(await accepterInvitation(token, code)));

  if (res?.ok) {
    return (
      <div className={`rounded-2xl border p-4 text-center ${res.statut === "inscrit" ? "border-forest-200 bg-forest-50/60" : "border-gold-200 bg-gold-50/60"}`}>
        {res.statut === "inscrit"
          ? <Check size={28} className="mx-auto mb-2 text-forest-600" />
          : <Clock size={28} className="mx-auto mb-2 text-gold-600" />}
        <p className="text-sm font-semibold text-forest-900">{res.message}</p>
        <Link href="/app/aide-formation/formations" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
          Aller à mes formations <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {aCode && (
        <div>
          <label className="mb-1 block text-sm font-medium text-forest-900">Code d&apos;accès <span className="font-normal text-ink-700/50">(facultatif — pour une inscription immédiate)</span></label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Saisissez le code fourni" className={champ} />
          <p className="mt-1 text-xs text-ink-700/55">Sans code valide, votre demande sera soumise à validation par l&apos;administrateur.</p>
        </div>
      )}
      {res && !res.ok && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{res.message}</p>}
      <button
        type="button"
        onClick={accepter}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest-600 px-5 py-3 text-sm font-bold text-white shadow-soft hover:bg-forest-700 disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Rejoindre la formation"}
      </button>
    </div>
  );
}
