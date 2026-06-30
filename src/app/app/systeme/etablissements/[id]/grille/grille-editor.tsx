"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";
import { enregistrerGrilleNiveau, type EtatForm } from "./actions";

const initial: EtatForm = { ok: false };

interface LigneDiscipline {
  disciplineId: string;
  nom: string;
  couleur: string | null;
  valeur: number | "";
  surcharge: boolean;
}

function BoutonSave() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-700 px-5 text-xs font-semibold text-cream-50 transition-colors hover:bg-forest-600 disabled:opacity-60"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      Enregistrer
    </button>
  );
}

export function GrilleNiveauForm({
  etablissementId,
  niveauId,
  niveauNom,
  lignes,
}: {
  etablissementId: string;
  niveauId: string;
  niveauNom: string;
  lignes: LigneDiscipline[];
}) {
  const [etat, action] = useActionState(enregistrerGrilleNiveau, initial);

  return (
    <form
      action={action}
      className="rounded-2xl border border-cream-200 bg-white p-5 shadow-soft"
    >
      <input type="hidden" name="etablissementId" value={etablissementId} />
      <input type="hidden" name="niveauId" value={niveauId} />

      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-forest-900">{niveauNom}</h3>
        {etat.message && (
          <span className={`text-xs ${etat.ok ? "text-forest-700" : "text-red-600"}`}>
            {etat.message}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {lignes.map((l) => (
          <label key={l.disciplineId} className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-800">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: l.couleur ?? "#999" }}
              />
              <span className="truncate">{l.nom}</span>
              {l.surcharge && (
                <span className="text-[0.6rem] text-gold-700" title="Surcharge établissement">
                  ●
                </span>
              )}
            </span>
            <input
              type="number"
              name={`heures_${l.disciplineId}`}
              min={0}
              step={0.5}
              defaultValue={l.valeur}
              className="h-9 w-full rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[0.7rem] text-ink-700/55">
          Heures / semaine. Laisser vide = revenir au modèle national. ● = valeur propre à
          l'établissement.
        </p>
        <BoutonSave />
      </div>
    </form>
  );
}
