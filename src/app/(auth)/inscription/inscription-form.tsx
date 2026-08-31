"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { GraduationCap } from "lucide-react";
import { sinscrire, type EtatForm } from "../actions";
import { Input, Label, SubmitButton, FormAlert, FieldError } from "@/components/ui/form";
import { ChampMotDePasse } from "@/components/ui/champ-mot-de-passe";
import { ComboboxRecherche } from "@/components/app/combobox-recherche";
import { SelecteurPays } from "@/components/app/selecteur-pays";
import { ROLES_ORDONNES } from "@/lib/rbac";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";
import type { PaysDetecte } from "@/lib/geo";
import { RattachementCascade } from "./rattachement-cascade";

/** Astérisque des champs obligatoires. */
function Requis() {
  return <span className="text-red-500"> *</span>;
}

const initial: EtatForm = { ok: false };

// Rôles proposés à l'inscription (admin exclu : compte d'amorçage interne), ordonnés par
// groupe (pilotage → formation → établissement → famille), présentés en liste recherchable.
const GROUPES_ROLE = ["pilotage", "formation", "etablissement", "famille"] as const;
const roleOptions = GROUPES_ROLE.flatMap((g) =>
  ROLES_ORDONNES.filter((r) => r.groupe === g && r.id !== "admin").map((r) => ({
    value: r.id,
    label: r.libelle,
  })),
);

export function InscriptionForm({
  pays,
  parrain = null,
  retour = null,
  modeFormation = false,
}: {
  pays: PaysDetecte;
  parrain?: string | null;
  retour?: string | null;
  /** Inscription via un LIEN DE FORMATION : aucun rôle à valider, aucun établissement — pays seul. */
  modeFormation?: boolean;
}) {
  const [etat, action] = useActionState(sinscrire, initial);
  const err = etat.erreurs ?? {};
  // Pays du participant en mode formation (le champ caché `paysChoisi` est posé par SelecteurPays).
  const [paysNom, setPaysNom] = useState(pays.nom);

  return (
    <form action={action} className="space-y-4">
      {/* Code de parrainage (lien d'invitation) transmis tel quel ; résolu et validé côté serveur. */}
      {parrain && <input type="hidden" name="parrain" value={parrain} />}
      {/* Page à retrouver après confirmation puis connexion (ex. invitation à une formation) —
          déjà validée par la page ; re-validée côté serveur dans sinscrire. */}
      {retour && <input type="hidden" name="retour" value={retour} />}
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

      {modeFormation ? (
        // Mode FORMATION : ni rôle, ni établissement — seul le pays est demandé.
        <div>
          <Label>
            Pays
            <Requis />
          </Label>
          <SelecteurPays name="paysChoisi" valeur={paysNom} onSelect={(p) => setPaysNom(p.nom)} />
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-forest-700">
            <GraduationCap size={14} className="mt-px shrink-0" />
            <span>Vous rejoignez une formation : le choix du pays suffit, aucune validation ni établissement n&apos;est requis.</span>
          </p>
        </div>
      ) : (
        <>
          <div>
            <Label>
              Rôle souhaité
              <Requis />
            </Label>
            <ComboboxRecherche
              name="roleSouhaite"
              options={roleOptions}
              placeholder="Sélectionnez votre rôle…"
              rechercheLabel="Rechercher un rôle…"
            />
            <FieldError messages={err.roleSouhaite} />
          </div>

          <RattachementCascade paysDetecte={pays} />
        </>
      )}

      <ChampMotDePasse
        id="motDePasse"
        name="motDePasse"
        label={<>Mot de passe<Requis /></>}
        required
        messages={err.motDePasse}
      />

      <ChampMotDePasse
        id="confirmation"
        name="confirmation"
        label={<>Confirmation<Requis /></>}
        required
        avecCriteres={false}
        messages={err.confirmation}
      />

      <SubmitButton>Créer mon compte</SubmitButton>

      <p className="text-center text-xs leading-relaxed text-ink-700/60">
        {modeFormation
          ? "En créant un compte, vous accédez directement à la formation — aucune validation d'administrateur n'est nécessaire."
          : "En créant un compte, vous recevez le rôle par défaut « Élève » ; votre rôle souhaité est soumis à l'approbation d'un administrateur."}
      </p>
    </form>
  );
}
