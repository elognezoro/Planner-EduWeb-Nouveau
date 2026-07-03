"use client";

import { useActionState, useState } from "react";
import { mettreAJourProfil, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";
import { SelecteurPays } from "@/components/app/selecteur-pays";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";

interface ValeursProfil {
  prenoms: string;
  nom: string;
  telephone: string;
  pays: string;
  langue: string;
  email: string;
}

const initial: EtatForm = { ok: false };

export function ProfilForm({ valeurs }: { valeurs: ValeursProfil }) {
  const [etat, action] = useActionState(mettreAJourProfil, initial);
  const [pays, setPays] = useState(valeurs.pays);
  const err = etat.erreurs ?? {};

  return (
    <form action={action} className="space-y-5">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="prenoms">Prénoms</Label>
          <Input
            id="prenoms"
            name="prenoms"
            defaultValue={valeurs.prenoms}
            required
            onInput={(e) => {
              e.currentTarget.value = capitaliserPrenoms(e.currentTarget.value);
            }}
          />
          <FieldError messages={err.prenoms} />
        </div>
        <div>
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            name="nom"
            defaultValue={valeurs.nom}
            required
            onInput={(e) => {
              e.currentTarget.value = majusculesNom(e.currentTarget.value);
            }}
          />
          <FieldError messages={err.nom} />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" value={valeurs.email} disabled readOnly />
        <p className="mt-1.5 text-xs text-ink-700/55">
          L'adresse e-mail ne peut pas être modifiée ici.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="telephone">Téléphone</Label>
          <Input
            id="telephone"
            name="telephone"
            type="tel"
            defaultValue={valeurs.telephone}
            placeholder="+225 ..."
          />
        </div>
        <div>
          <Label htmlFor="pays">Pays</Label>
          <SelecteurPays name="pays" valeur={pays} onSelect={(p) => setPays(p.nom)} />
          <FieldError messages={err.pays} />
          <p className="mt-1.5 text-xs text-ink-700/55">
            Détecté à la création du compte — modifiable à tout moment.
          </p>
        </div>
        <div>
          <Label htmlFor="langue">Langue d'affichage</Label>
          <Select id="langue" name="langue" defaultValue={valeurs.langue}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </div>
      </div>

      <div className="pt-1">
        <SubmitButton className="w-auto px-8">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
