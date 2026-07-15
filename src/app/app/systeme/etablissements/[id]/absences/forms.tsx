"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { enregistrerAbsence, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function AjoutAbsenceForm({
  etablissementId,
  enseignants,
}: {
  etablissementId: string;
  enseignants: { id: string; nom: string }[];
}) {
  const [etat, action] = useActionState(enregistrerAbsence, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="enseignantId">Enseignant</Label>
          <Select id="enseignantId" name="enseignantId" required defaultValue="">
            <option value="" disabled>Sélectionner…</option>
            {enseignants.map((e) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" required />
        </div>
        <div>
          <Label htmlFor="demiJournee">Durée</Label>
          <Select id="demiJournee" name="demiJournee" defaultValue="journee">
            <option value="journee">Journée entière</option>
            <option value="matin">Matinée</option>
            <option value="apres_midi">Après-midi</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="statut">Statut</Label>
          <Select id="statut" name="statut" defaultValue="autorisee">
            <option value="autorisee">Autorisée</option>
            <option value="justifiee">Justifiée</option>
            <option value="non_autorisee">Non autorisée</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="motif">Motif (facultatif)</Label>
          <Input id="motif" name="motif" maxLength={240} placeholder="Ex. : convocation, maladie…" />
        </div>
      </div>
      <SubmitButton className="inline-flex w-auto items-center gap-2 px-6">
        <CalendarPlus size={16} /> Enregistrer l&apos;absence
      </SubmitButton>
    </form>
  );
}
