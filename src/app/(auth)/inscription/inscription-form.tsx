"use client";

import { useActionState } from "react";
import Image from "next/image";
import { sinscrire, type EtatForm } from "../actions";
import { Input, Label, Select, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";
import { ROLES_ORDONNES } from "@/lib/rbac";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";
import type { PaysDetecte } from "@/lib/geo";

/** Astérisque des champs obligatoires. */
function Requis() {
  return <span className="text-red-500"> *</span>;
}

const initial: EtatForm = { ok: false };

const groupesLibelle: Record<string, string> = {
  pilotage: "Pilotage & administration",
  formation: "Structures de formation",
  etablissement: "Établissement",
  famille: "Famille",
};

// Rôles proposés à l'inscription (admin exclu : compte d'amorçage interne).
const rolesParGroupe = (["pilotage", "formation", "etablissement", "famille"] as const).map(
  (g) => ({
    groupe: g,
    roles: ROLES_ORDONNES.filter((r) => r.groupe === g && r.id !== "admin"),
  }),
);

export function InscriptionForm({ pays }: { pays: PaysDetecte }) {
  const [etat, action] = useActionState(sinscrire, initial);
  const err = etat.erreurs ?? {};

  return (
    <form action={action} className="space-y-4">
      {etat.message && !etat.ok && <FormAlert ton="erreur">{etat.message}</FormAlert>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="prenoms">
            Prénoms
            <Requis />
          </Label>
          <Input
            id="prenoms"
            name="prenoms"
            autoComplete="given-name"
            required
            placeholder="Ex : Jean-Marc"
            onInput={(e) => {
              // Première lettre de chaque prénom en majuscule, le reste en minuscules.
              e.currentTarget.value = capitaliserPrenoms(e.currentTarget.value);
            }}
          />
          <FieldError messages={err.prenoms} />
        </div>
        <div>
          <Label htmlFor="nom">
            Nom
            <Requis />
          </Label>
          <Input
            id="nom"
            name="nom"
            autoComplete="family-name"
            required
            placeholder="Ex : KOUASSI"
            onInput={(e) => {
              // NOM automatiquement en MAJUSCULES.
              e.currentTarget.value = majusculesNom(e.currentTarget.value);
            }}
          />
          <FieldError messages={err.nom} />
        </div>
      </div>

      <div>
        <Label htmlFor="email">
          Adresse e-mail
          <Requis />
        </Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.ci" />
        <FieldError messages={err.email} />
      </div>

      <div>
        <Label htmlFor="telephone">Téléphone (facultatif)</Label>
        <div className="relative">
          {/* Drapeau coloré du pays supposé de l'utilisateur (géolocalisation) */}
          <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            <Image
              src={pays.drapeau}
              alt={pays.nom}
              title={pays.nom}
              width={20}
              height={14}
              unoptimized
              className="h-3.5 w-5 rounded-[3px] object-cover"
            />
            {pays.indicatif && <span className="text-sm text-ink-700/60">{pays.indicatif}</span>}
          </span>
          <Input
            id="telephone"
            name="telephone"
            type="tel"
            autoComplete="tel"
            placeholder="07 00 00 00 00"
            className="pl-[4.75rem]"
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-700/60">
          Pays détecté : {pays.nom} — modifiable à tout moment dans Mon Profil.
        </p>
      </div>

      <div>
        <Label htmlFor="roleSouhaite">Rôle souhaité</Label>
        <Select id="roleSouhaite" name="roleSouhaite" defaultValue="" required>
          <option value="" disabled>
            Sélectionnez votre rôle…
          </option>
          {rolesParGroupe.map(({ groupe, roles }) => (
            <optgroup key={groupe} label={groupesLibelle[groupe]}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.libelle}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <FieldError messages={err.roleSouhaite} />
      </div>

      <div>
        <Label htmlFor="structureDeclaree">Établissement / structure de rattachement (facultatif)</Label>
        <Input
          id="structureDeclaree"
          name="structureDeclaree"
          placeholder="Ex : Lycée Moderne de Cocody"
        />
        <p className="mt-1.5 text-xs text-ink-700/60">
          À la validation de votre compte, ce nom sera automatiquement rapproché de
          l'établissement correspondant déjà présent sur la plateforme (dans votre pays).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="motDePasse">Mot de passe</Label>
          <Input
            id="motDePasse"
            name="motDePasse"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={err.motDePasse} />
        </div>
        <div>
          <Label htmlFor="confirmation">Confirmation</Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={err.confirmation} />
        </div>
      </div>

      <SubmitButton>Créer mon compte</SubmitButton>

      <p className="text-center text-xs leading-relaxed text-ink-700/60">
        En créant un compte, vous recevez le rôle par défaut « Élève » ; votre rôle souhaité est
        soumis à l'approbation d'un administrateur.
      </p>
    </form>
  );
}
