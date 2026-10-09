"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { SubmitButton, FormAlert } from "@/components/ui/form";
import { useEcranMobile } from "@/lib/mobile/appareil";
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
          className="h-11 w-full rounded-xl border border-cream-300 bg-white px-3 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Message</label>
        <textarea
          name="contenu"
          rows={3}
          required
          placeholder="Votre message…"
          className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:text-base"
        />
      </div>
      <SubmitButton className="w-auto px-6 mobile:w-full">
        <Send size={15} /> Envoyer
      </SubmitButton>
    </form>
  );
}

export function RepondreForm({ destinataireId }: { destinataireId: string }) {
  const [etat, action] = useActionState(envoyerMessage, initial);
  const ref = useRef<HTMLFormElement>(null);
  // Nom accessible du bouton réservé au téléphone : faux au rendu serveur, sur ordinateur et à l'impression.
  const ecranMobile = useEcranMobile();
  useEffect(() => {
    if (etat.ok) ref.current?.reset();
  }, [etat]);

  return (
    // Téléphone : l'alerte d'erreur passe sur sa propre ligne au lieu d'écraser la zone de saisie.
    <form ref={ref} action={action} className="flex items-end gap-2 mobile:flex-wrap">
      {etat.message && !etat.ok && (
        <div className="w-full mobile:basis-full">
          <FormAlert ton="erreur">{etat.message}</FormAlert>
        </div>
      )}
      <input type="hidden" name="destinataireId" value={destinataireId} />
      <textarea
        name="contenu"
        rows={2}
        required
        placeholder="Écrire une réponse…"
        className="flex-1 rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:min-h-11 mobile:min-w-0 mobile:text-base"
      />
      <SubmitButton className="w-auto px-5">
        <Send size={15} />
        {ecranMobile && <span className="sr-only">Envoyer</span>}
      </SubmitButton>
    </form>
  );
}

/**
 * Téléphone : à l'ouverture d'une conversation (et à chaque nouveau message), amène le bas du
 * fil à l'écran — la page se rechargeait en haut, loin des derniers messages. Ne fait rien sur
 * ordinateur ni à l'impression (useEcranMobile est faux).
 */
export function DefilerAuDernierMessage({ nbMessages }: { nbMessages: number }) {
  const ecranMobile = useEcranMobile();
  useEffect(() => {
    if (!ecranMobile) return;
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [ecranMobile, nbMessages]);
  return null;
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
