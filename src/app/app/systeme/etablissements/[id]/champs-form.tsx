"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { ajouterChamp, type EtatForm } from "./config-actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

export function ChampsForm({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(ajouterChamp, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto]">
        <div>
          <Label htmlFor="etiquette">Étiquette du champ</Label>
          <Input id="etiquette" name="etiquette" required placeholder="1ère prise de service" />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue="text">
            <option value="text">Texte</option>
            <option value="date">Date</option>
            <option value="number">Nombre</option>
            <option value="select">Liste</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="placeholder">Placeholder</Label>
          <Input id="placeholder" name="placeholder" />
        </div>
        <div className="flex flex-col justify-end">
          <label className="mb-2 flex items-center gap-2 text-sm text-forest-900">
            <input type="checkbox" name="requis" className="h-4 w-4 rounded border-cream-300" />
            Requis
          </label>
        </div>
      </div>
      <SubmitButton className="w-auto px-5">
        <Plus size={15} /> Ajouter un champ personnalisé
      </SubmitButton>
    </form>
  );
}
