"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Loader2, Sparkles, Pin, PinOff, Lock, LockOpen, Pencil, Send } from "lucide-react";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import { EditeurRiche } from "@/components/ui/editeur-riche";
import {
  creerSujetForum,
  posterMessageForum,
  modifierMessageForum,
  supprimerMessageForum,
  supprimerSujetForum,
  moderationSujetForum,
  genererSyntheseForum,
} from "../../../forum-actions";

const initial = { ok: false } as { ok: boolean; message?: string };
const champ = "h-10 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";
const label = "mb-1 block text-sm font-medium text-forest-900";

function useSucces(etat: { ok: boolean }, cb: () => void) {
  const vu = useRef<{ ok: boolean } | null>(null);
  useEffect(() => { if (etat.ok && vu.current !== etat) { vu.current = etat; cb(); } }, [etat, cb]);
}

export function FormNouveauSujet({ coursId }: { coursId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(creerSujetForum, initial);
  const [ouvert, setOuvert] = useState(false);
  useSucces(etat, () => { setOuvert(false); router.refresh(); });

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-forest-600 px-5 text-sm font-semibold text-white hover:bg-forest-700">
        <Plus size={16} /> Nouveau fil
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-forest-200 bg-white p-4 text-left shadow-soft">
      <input type="hidden" name="coursId" value={coursId} />
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-forest-900">Ouvrir un fil de discussion</h3>
        <button type="button" onClick={() => setOuvert(false)} className="rounded-lg p-1 text-ink-700/40 hover:bg-cream-100"><X size={16} /></button>
      </div>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div><label className={label}>Titre du fil</label><input name="titre" required placeholder="Ex : Comment organiser la passation de service ?" className={champ} /></div>
      <div><label className={label}>Contexte <span className="text-ink-700/50">(facultatif)</span></label><input name="description" placeholder="Une phrase pour préciser la question posée" className={champ} /></div>
      <div>
        <label className={label}>Votre premier message</label>
        <EditeurRiche name="premierMessage" minHauteur={130} aide="Partagez votre expérience, une question ou une bonne pratique. Restez courtois et constructif." />
      </div>
      <div className="flex justify-end"><SubmitButton className="w-auto px-5">Publier le fil</SubmitButton></div>
    </form>
  );
}

export function FormMessage({ sujetId }: { sujetId: string }) {
  const router = useRouter();
  const [etat, action] = useActionState(posterMessageForum, initial);
  const [cle, setCle] = useState(0);
  useSucces(etat, () => { setCle((c) => c + 1); router.refresh(); });
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
      <input type="hidden" name="sujetId" value={sujetId} />
      <label className={label}>Répondre au fil</label>
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <EditeurRiche key={cle} name="contenu" minHauteur={110} aide="Votre message est nominatif et horodaté." />
      <div className="flex justify-end"><SubmitButton className="w-auto px-5"><Send size={15} /> Publier</SubmitButton></div>
    </form>
  );
}

export function FormModifierMessage({ message }: { message: { id: string; contenu: string } }) {
  const router = useRouter();
  const [etat, action] = useActionState(modifierMessageForum, initial);
  const [ouvert, setOuvert] = useState(false);
  useSucces(etat, () => { setOuvert(false); router.refresh(); });
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex items-center gap-1 text-xs font-medium text-forest-700 hover:underline">
        <Pencil size={12} /> Modifier
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 space-y-2 rounded-xl border border-forest-200 bg-cream-50/50 p-3">
      <input type="hidden" name="messageId" value={message.id} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <EditeurRiche name="contenu" initial={message.contenu} minHauteur={100} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOuvert(false)} className="rounded-full border border-cream-300 px-3 py-1 text-xs font-medium text-ink-700/70">Annuler</button>
        <SubmitButton className="w-auto px-4">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

export function BoutonSupprimerMessage({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => { if (window.confirm("Supprimer ce message ?")) start(async () => { await supprimerMessageForum(messageId); router.refresh(); }); }}
      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer
    </button>
  );
}

export function BoutonSupprimerSujet({ sujetId }: { sujetId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => { if (window.confirm("Supprimer ce fil et tous ses messages ?")) start(async () => { await supprimerSujetForum(sujetId); router.push("../"); router.refresh(); }); }}
      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer le fil
    </button>
  );
}

/** Modération réservée au formateur/tuteur/admin : épingler + fermer un fil. */
export function BoutonsModerationSujet({ sujetId, epingle, ferme }: { sujetId: string; epingle: boolean; ferme: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = (champ: "epingle" | "ferme", valeur: boolean) => start(async () => { await moderationSujetForum(sujetId, champ, valeur); router.refresh(); });
  const cls = "inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => toggle("epingle", !epingle)} className={cls}>
        {epingle ? <PinOff size={13} /> : <Pin size={13} />} {epingle ? "Désépingler" : "Épingler"}
      </button>
      <button type="button" disabled={pending} onClick={() => toggle("ferme", !ferme)} className={cls}>
        {ferme ? <LockOpen size={13} /> : <Lock size={13} />} {ferme ? "Rouvrir" : "Clore"}
      </button>
    </div>
  );
}

/** Synthèse des échanges par EduWeb Planner (formateur/tuteur/admin). */
export function BoutonSyntheseForum({ sujetId, nbMessages }: { sujetId: string; nbMessages: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={pending || nbMessages === 0}
        onClick={() => start(async () => { const r = await genererSyntheseForum(sujetId); setMsg(r.message ?? null); router.refresh(); })}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 px-5 py-2 text-sm font-semibold text-forest-950 shadow-[var(--shadow-gold)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Synthèse des échanges par EduWeb Planner
      </button>
      {msg && <p className="text-xs text-ink-700/60">{msg}</p>}
      {nbMessages === 0 && <p className="text-xs text-ink-700/50">Aucun message à synthétiser pour l&apos;instant.</p>}
    </div>
  );
}
