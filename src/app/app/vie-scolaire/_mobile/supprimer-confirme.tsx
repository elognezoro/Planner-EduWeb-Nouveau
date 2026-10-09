"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";

/**
 * SUPPRESSION CONFIRMÉE EN LIGNE — TÉLÉPHONE UNIQUEMENT.
 *
 * Au pouce, une corbeille collée à un autre bouton se touche par erreur, et la suppression
 * part sans confirmation. Ici, le premier appui révèle « Annuler / Supprimer » à la place de la
 * corbeille ; seul le second envoie le formulaire (même action serveur, même champ « id »).
 *
 * L'appelant le monte dans « lg:hidden print:hidden », FRÈRE de sa corbeille d'ordinateur
 * (masquée par « mobile:hidden ») : l'ordinateur garde son bouton, inchangé.
 */
export function SupprimerConfirmeMobile({
  action,
  id,
  libelle,
}: {
  /** Action serveur de suppression (lit le champ « id »). */
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  /** Libellé accessible de la corbeille (ex. « Supprimer l'affectation »). */
  libelle: string;
}) {
  const [confirmer, setConfirmer] = useState(false);
  if (!confirmer) {
    return (
      <button
        type="button"
        onClick={() => setConfirmer(true)}
        aria-label={libelle}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-700/60 active:bg-red-50 active:text-red-600"
      >
        <Trash2 size={17} aria-hidden />
      </button>
    );
  }
  // Confirmation sur SA PROPRE LIGNE (basis-full, rangée appelante en flex-wrap), alignée à
  // droite : le libellé de la ligne garde toute sa largeur au moment de confirmer.
  return (
    <form action={action} className="flex shrink-0 basis-full items-center justify-end gap-1.5">
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        onClick={() => setConfirmer(false)}
        className="h-11 rounded-full px-3 text-sm font-medium text-ink-700/75 active:bg-cream-100"
      >
        Annuler
      </button>
      <BoutonConfirmer />
    </form>
  );
}

function BoutonConfirmer() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-60"
    >
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
      Supprimer
    </button>
  );
}
