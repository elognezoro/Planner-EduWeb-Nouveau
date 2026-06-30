"use client";

import { useActionState } from "react";
import { Trash2, Users } from "lucide-react";
import { viderEnseignants, supprimerUtilisateur, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

export function ViderEnseignants({ etablissementId, nb }: { etablissementId: string; nb: number }) {
  const [etat, action] = useActionState(viderEnseignants, initial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Supprimer TOUS les ${nb} enseignant(s) de cet établissement ? Action irréversible.`)) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <button
        type="submit"
        disabled={nb === 0}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        <Users size={14} /> Vider les enseignants
      </button>
      {etat.message && (
        <span className={`text-xs ${etat.ok ? "text-forest-700" : "text-red-600"}`}>{etat.message}</span>
      )}
    </form>
  );
}

export function SupprimerUtilisateur({
  utilisateurId,
  etablissementId,
}: {
  utilisateurId: string;
  etablissementId: string;
}) {
  return (
    <form
      action={supprimerUtilisateur}
      onSubmit={(e) => {
        if (!confirm("Supprimer cet utilisateur ?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="utilisateurId" value={utilisateurId} />
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <button
        type="submit"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/45 transition-colors hover:bg-red-50 hover:text-red-600"
        aria-label="Supprimer"
      >
        <Trash2 size={14} />
      </button>
    </form>
  );
}
