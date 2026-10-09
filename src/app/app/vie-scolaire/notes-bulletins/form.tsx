"use client";

import { useActionState } from "react";
import { enregistrerNotes, type EtatForm } from "./actions";
import { Input, Label, SubmitButton, FormAlert } from "@/components/ui/form";
import { useEcranMobile } from "@/lib/mobile/appareil";

const initial: EtatForm = { ok: false };

export function NotesForm({
  classeId,
  disciplineId,
  periode,
  eleves,
}: {
  classeId: string;
  disciplineId: string;
  periode: number;
  eleves: { eleveId: string; nom: string }[];
}) {
  const [etat, action] = useActionState(enregistrerNotes, initial);
  // Attributs réservés au téléphone : faux au rendu serveur, sur ordinateur et à l'impression.
  const ecranMobile = useEcranMobile();

  if (eleves.length === 0) {
    return (
      <p className="text-sm text-ink-700/65">
        Aucun élève inscrit dans cette classe.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        // Téléphone : le message est affiché près du bouton collant (plus bas), jamais hors écran.
        <div className="mobile:hidden">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}
      <input type="hidden" name="classeId" value={classeId} />
      <input type="hidden" name="disciplineId" value={disciplineId} />
      <input type="hidden" name="periode" value={periode} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="libelle">Libellé de l&apos;évaluation</Label>
          <Input id="libelle" name="libelle" required placeholder="Ex : Devoir 1" className="mobile:text-base" />
        </div>
        <div>
          <Label htmlFor="sur">Barème (note sur)</Label>
          <Input id="sur" name="sur" type="number" min={1} step={1} defaultValue={20} inputMode={ecranMobile ? "numeric" : undefined} className="mobile:text-base" />
        </div>
      </div>

      <ul className="divide-y divide-cream-100">
        {eleves.map((e) => (
          <li key={e.eleveId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm font-medium text-forest-900 mobile:min-w-0 mobile:wrap-break-word">{e.nom}</span>
            {/* Téléphone : pavé décimal (la touche « Suivant » native du clavier enchaîne les champs ;
                ne pas imposer enterKeyHint, sinon Chrome Android envoie Entrée = enregistrement) ;
                champ de 44 px en 16 px (pas de zoom iOS). Attributs absents sur ordinateur. */}
            <input
              type="number"
              name={`note_${e.eleveId}`}
              min={0}
              step="0.25"
              placeholder="—"
              inputMode={ecranMobile ? "decimal" : undefined}
              aria-label={ecranMobile ? `Note — ${e.nom}` : undefined}
              className="h-9 w-24 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 mobile:h-11 mobile:w-20 mobile:shrink-0 mobile:text-center mobile:text-base"
            />
          </li>
        ))}
      </ul>

      {/* Téléphone : message du dernier enregistrement, collé au-dessus du bouton. */}
      {etat.message && (
        <div className="sticky bottom-[calc(var(--hauteur-barre-onglets)+4rem)] z-20 lg:hidden print:hidden mobile:mr-[3.25rem]">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}
      {/* Téléphone : bouton COLLANT au-dessus des onglets, visible pendant toute la saisie ;
          3.25rem laissés libres à droite pour la bulle de l'assistant (fixe, au-dessus). */}
      <SubmitButton className="w-auto px-8 mobile:sticky mobile:bottom-[calc(var(--hauteur-barre-onglets)+0.5rem)] mobile:z-20 mobile:flex mobile:w-[calc(100%_-_3.25rem)] mobile:shadow-lg">
        Enregistrer les notes
      </SubmitButton>
    </form>
  );
}
