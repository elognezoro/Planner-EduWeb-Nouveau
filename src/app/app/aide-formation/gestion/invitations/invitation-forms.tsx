"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, RefreshCw, Trash2, Power, Ticket, UserCheck, UserX } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import {
  creerInvitation, basculerInvitation, regenererTokenInvitation, supprimerInvitation,
  validerInscriptionSession, refuserInscriptionSession,
} from "@/app/app/aide-formation/invitation-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-xs font-medium text-forest-900";

export function FormNouvelleInvitation({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(creerInvitation, initial);
  const vu = useRef<typeof initial>(initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; formRef.current?.reset(); router.refresh(); } }, [etat, router]);

  return (
    <form ref={formRef} action={action} className="grid gap-2 sm:grid-cols-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="sm:col-span-2">
        <label className={label}>Code d&apos;auto-validation <span className="font-normal text-ink-700/50">(facultatif)</span></label>
        <input name="code" placeholder="Ex : DHFC2026" className={champ} />
      </div>
      <div>
        <label className={label}>Places max</label>
        <input name="placesMax" type="number" min={1} placeholder="∞" className={champ} />
      </div>
      <div>
        <label className={label}>Expiration</label>
        <input name="expiration" type="datetime-local" className={champ} />
      </div>
      {etat.message && <div className="sm:col-span-4"><FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert></div>}
      <div className="sm:col-span-4"><SubmitButton className="w-auto px-4"><Ticket size={14} /> Générer un lien</SubmitButton></div>
    </form>
  );
}

export function LigneInvitation({ inv }: { inv: { id: string; token: string; code: string | null; actif: boolean; placesMax: number | null; expiration: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copie, setCopie] = useState(false);
  const exec = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  const lien = (avecCode: boolean) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/invitation/${inv.token}`;
    return avecCode && inv.code ? `${url}?code=${encodeURIComponent(inv.code)}` : url;
  };
  const copier = async (avecCode: boolean) => {
    try { await navigator.clipboard.writeText(lien(avecCode)); setCopie(true); setTimeout(() => setCopie(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className={`rounded-xl border p-3 ${inv.actif ? "border-cream-200 bg-white" : "border-cream-200 bg-cream-50/60 opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link2 size={14} className="text-forest-600" />
        <code className="max-w-[16rem] truncate rounded bg-cream-100 px-2 py-0.5 text-forest-800">/invitation/{inv.token.slice(0, 12)}…</code>
        {inv.code && <span className="rounded-full bg-gold-100 px-2 py-0.5 font-semibold text-gold-800">code : {inv.code}</span>}
        {!inv.actif && <span className="rounded-full bg-ink-700/10 px-2 py-0.5 font-semibold text-ink-700/60">désactivé</span>}
        {inv.placesMax != null && <span className="text-ink-700/55">{inv.placesMax} place(s)</span>}
        {inv.expiration && <span className="text-ink-700/55">exp. {new Date(inv.expiration).toLocaleDateString("fr-FR")}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => copier(false)} className="inline-flex items-center gap-1 rounded-lg border border-forest-200 px-2 py-1 text-xs font-semibold text-forest-800 hover:bg-forest-50">
          {copie ? <Check size={13} /> : <Copy size={13} />} Copier le lien
        </button>
        {inv.code && (
          <button type="button" onClick={() => copier(true)} className="inline-flex items-center gap-1 rounded-lg border border-gold-200 px-2 py-1 text-xs font-semibold text-gold-800 hover:bg-gold-50">
            <Copy size={13} /> Lien + code (auto-validé)
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => exec(() => basculerInvitation(inv.id))} className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2 py-1 text-xs font-semibold text-forest-800 hover:bg-cream-100 disabled:opacity-50">
          <Power size={13} /> {inv.actif ? "Désactiver" : "Réactiver"}
        </button>
        <button type="button" disabled={pending} onClick={() => exec(() => regenererTokenInvitation(inv.id))} className="inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2 py-1 text-xs font-semibold text-forest-800 hover:bg-cream-100 disabled:opacity-50">
          <RefreshCw size={13} /> Nouveau lien
        </button>
        <button type="button" disabled={pending} onClick={() => { if (confirm("Supprimer ce lien d'invitation ?")) exec(() => supprimerInvitation(inv.id)); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
          <Trash2 size={13} /> Supprimer
        </button>
      </div>
    </div>
  );
}

export function BoutonsDemande({ inscriptionId }: { inscriptionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const exec = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="flex shrink-0 gap-1.5">
      <button type="button" disabled={pending} onClick={() => exec(() => validerInscriptionSession(inscriptionId))} className="inline-flex items-center gap-1 rounded-lg bg-forest-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-forest-700 disabled:opacity-50">
        <UserCheck size={13} /> Valider
      </button>
      <button type="button" disabled={pending} onClick={() => exec(() => refuserInscriptionSession(inscriptionId))} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
        <UserX size={13} /> Refuser
      </button>
    </div>
  );
}
