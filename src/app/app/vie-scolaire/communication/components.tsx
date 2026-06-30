"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { envoyerMessage, marquerConversationLue, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

export function NouveauMessageForm() {
  const [etat, action] = useActionState(envoyerMessage, initial);
  const router = useRouter();
  useEffect(() => {
    if (etat.ok && etat.avec) router.push(`/app/vie-scolaire/communication?avec=${etat.avec}`);
  }, [etat, router]);

  return (
    <form action={action} className="space-y-3">
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Destinataire (e-mail)</label>
        <input
          name="email"
          type="email"
          required
          placeholder="prenom.nom@exemple.ci"
          className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Message</label>
        <textarea
          name="contenu"
          rows={3}
          required
          placeholder="Votre message…"
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
        />
      </div>
      <SubmitButton className="w-auto px-6">
        <Send size={15} /> Envoyer
      </SubmitButton>
    </form>
  );
}

export function RepondreForm({ destinataireId }: { destinataireId: string }) {
  const [etat, action] = useActionState(envoyerMessage, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (etat.ok) ref.current?.reset();
  }, [etat]);

  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      {etat.message && !etat.ok && (
        <div className="w-full">
          <FormAlert ton="erreur">{etat.message}</FormAlert>
        </div>
      )}
      <input type="hidden" name="destinataireId" value={destinataireId} />
      <textarea
        name="contenu"
        rows={2}
        required
        placeholder="Écrire une réponse…"
        className="flex-1 rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      <SubmitButton className="w-auto px-5">
        <Send size={15} />
      </SubmitButton>
    </form>
  );
}

/** Marque la conversation ouverte comme lue (effet au chargement). */
export function MarquerLue({ avec }: { avec: string }) {
  const router = useRouter();
  useEffect(() => {
    let actif = true;
    marquerConversationLue(avec).then(() => {
      if (actif) router.refresh();
    });
    return () => {
      actif = false;
    };
  }, [avec, router]);
  return null;
}
