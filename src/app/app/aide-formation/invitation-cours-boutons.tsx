"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Copy, Check, RefreshCw, Power, Trash2, Loader2, Plus, X } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import {
  creerInvitationCours,
  basculerInvitationCours,
  regenererTokenInvitationCours,
  supprimerInvitationCours,
} from "./invitation-cours-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export interface LienInvitation {
  id: string;
  token: string;
  actif: boolean;
  expiration: string | null;
  placesMax: number | null;
}

function urlDe(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invitation/cours/${token}`;
}

function LigneLien({ inv }: { inv: LienInvitation }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copie, setCopie] = useState(false);
  const url = urlDe(inv.token);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    } catch {
      /* presse-papiers indisponible : l'utilisateur peut sélectionner le champ */
    }
  };
  const agir = (fn: () => Promise<unknown>, confirmer?: string) => {
    if (confirmer && !window.confirm(confirmer)) return;
    start(async () => { await fn(); router.refresh(); });
  };

  return (
    <div className={`rounded-xl border p-3 ${inv.actif ? "border-cream-200 bg-white" : "border-cream-200 bg-cream-50/60 opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${champ} flex-1 min-w-[220px] font-mono text-xs`} />
        <button type="button" onClick={copier} className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-3 py-2 text-xs font-semibold text-white hover:bg-forest-700">
          {copie ? <Check size={14} /> : <Copy size={14} />} {copie ? "Copié" : "Copier"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-700/60">
        <span>{inv.actif ? "Actif" : "Désactivé"}</span>
        {inv.placesMax != null && <span>plafond : {inv.placesMax} place(s)</span>}
        {inv.expiration && <span>expire le {new Date(inv.expiration).toLocaleDateString("fr-FR")}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => agir(() => basculerInvitationCours(inv.id))} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-ink-800 hover:bg-cream-100 disabled:opacity-50">
          <Power size={12} /> {inv.actif ? "Désactiver" : "Réactiver"}
        </button>
        <button type="button" disabled={pending} onClick={() => agir(() => regenererTokenInvitationCours(inv.id), "Générer un nouveau lien ? L'ancien cessera de fonctionner.")} className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-ink-800 hover:bg-cream-100 disabled:opacity-50">
          <RefreshCw size={12} /> Nouveau lien
        </button>
        <button type="button" disabled={pending} onClick={() => agir(() => supprimerInvitationCours(inv.id), "Supprimer ce lien d'inscription ?")} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer
        </button>
      </div>
    </div>
  );
}

export function GestionLiensInscription({ coursId, invitations, nbInscritsViaLien }: { coursId: string; invitations: LienInvitation[]; nbInscritsViaLien: number }) {
  const router = useRouter();
  const [etat, action] = useActionState(creerInvitationCours, initial);
  const [ouvert, setOuvert] = useState(false);
  const vu = useRef<{ ok: boolean } | null>(null);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; setOuvert(false); router.refresh(); } }, [etat, router]);

  return (
    <details className="rounded-3xl border border-cream-200 bg-white p-4 shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-sm font-bold text-forest-900">
        <Link2 size={16} className="text-forest-600" /> Lien d&apos;inscription à partager {invitations.length > 0 ? `(${invitations.length})` : ""}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-ink-700/65">
          Générez un lien d&apos;inscription et partagez-le aux participants : en l&apos;ouvrant (connectés à
          EduWeb Planner), ils rejoignent directement ce cours. Vous pouvez désactiver, renouveler ou plafonner un lien.
          {nbInscritsViaLien > 0 && <> <strong className="text-forest-800">{nbInscritsViaLien} participant(s)</strong> déjà inscrit(s) via un lien.</>}
        </p>

        {invitations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-cream-300 bg-cream-50/50 px-4 py-4 text-center text-sm text-ink-700/60">
            Aucun lien pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => <LigneLien key={inv.id} inv={inv} />)}
          </div>
        )}

        {!ouvert ? (
          <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-2 rounded-full bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700">
            <Plus size={15} /> Générer un lien d&apos;inscription
          </button>
        ) : (
          <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-cream-50/40 p-4">
            <input type="hidden" name="coursId" value={coursId} />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-forest-900">Nouveau lien d&apos;inscription</h3>
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
            </div>
            {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-forest-900">Nombre de places <span className="text-ink-700/50">(facultatif)</span></span>
                <input name="placesMax" type="number" min={1} placeholder="illimité" className={champ} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-forest-900">Expiration <span className="text-ink-700/50">(facultatif)</span></span>
                <input name="expiration" type="date" className={champ} />
              </label>
            </div>
            <div className="flex justify-end"><SubmitButton className="w-auto px-5">Générer le lien</SubmitButton></div>
          </form>
        )}
      </div>
    </details>
  );
}
