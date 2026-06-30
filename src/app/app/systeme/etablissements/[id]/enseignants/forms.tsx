"use client";

import { useActionState } from "react";
import { ajouterEnseignant, importerEnseignantsCSV, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

const ROLES_UTIL = [
  { v: "enseignant", l: "Enseignant" },
  { v: "educateur", l: "Éducateur" },
  { v: "chef_etablissement", l: "Chef d'établissement" },
  { v: "parent", l: "Parent" },
  { v: "eleve", l: "Élève" },
];

export function AjoutEnseignantForm({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(ajouterEnseignant, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="prenoms">Prénoms</Label>
          <Input id="prenoms" name="prenoms" required />
        </div>
        <div>
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" required />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required placeholder="prof@exemple.ci" />
        </div>
        <div>
          <Label htmlFor="role">Rôle</Label>
          <Select id="role" name="role" defaultValue="enseignant">
            {ROLES_UTIL.map((r) => (
              <option key={r.v} value={r.v}>{r.l}</option>
            ))}
          </Select>
        </div>
      </div>
      <SubmitButton className="w-auto px-6">Ajouter l'utilisateur</SubmitButton>
    </form>
  );
}

export function ImportCSVForm({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(importerEnseignantsCSV, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <input
        type="file"
        name="fichier"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-forest-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-forest-800"
      />
      <SubmitButton className="w-auto px-6">Importer la cohorte</SubmitButton>
    </form>
  );
}
