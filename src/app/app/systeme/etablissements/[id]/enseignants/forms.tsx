"use client";

import { useActionState } from "react";
import { UsersRound } from "lucide-react";
import { ajouterEnseignant, importerEnseignantsCSV, genererComptesEnseignants, type EtatForm } from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

const ROLES_UTIL = [
  { v: "enseignant", l: "Enseignant" },
  { v: "educateur", l: "Éducateur" },
  { v: "chef_etablissement", l: "Chef d'établissement" },
  { v: "adjoint_chef_etablissement", l: "Adjoint au Chef d'Établissement (ACE)" },
  { v: "inspecteur_orientation", l: "Inspecteur d'Orientation" },
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
      <SubmitButton className="w-auto px-6">Ajouter l&apos;utilisateur</SubmitButton>
    </form>
  );
}

export function GenererComptesEnseignantsForm({ etablissementId }: { etablissementId: string }) {
  const [etat, action] = useActionState(genererComptesEnseignants, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <p className="text-sm text-ink-700/70">
        Crée automatiquement un compte enseignant nominatif pour chaque effectif déclaré ci-dessus
        (compétence = discipline, niveaux du cycle). Les enseignants apparaîtront alors par leur nom
        sur l&apos;emploi du temps et pourront ensuite modifier leurs coordonnées. Opération sans
        risque : elle ne crée que les comptes manquants.
      </p>
      <SubmitButton className="inline-flex w-auto items-center gap-2 px-6">
        <UsersRound size={16} /> Générer les comptes depuis les effectifs
      </SubmitButton>
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
