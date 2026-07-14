"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import {
  mettreAJourConfiguration,
  enregistrerEssaiDefaut,
  creerAnneeScolaire,
  creerRegion,
  creerDiscipline,
  renommerDiscipline,
  supprimerDiscipline,
  type EtatForm,
} from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";
import { UNITES_ESSAI } from "@/lib/premium/essai";

const initial: EtatForm = { ok: false };

export function ConfigForm({
  regimeNotation,
  anneeCourante,
  annees,
}: {
  regimeNotation: string;
  anneeCourante: string | null;
  annees: string[];
}) {
  const [etat, action] = useActionState(mettreAJourConfiguration, initial);
  return (
    <form action={action} className="space-y-4">
      {etat.message && (
        <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="anneeScolaireCourante">Année scolaire en cours</Label>
          <Select
            id="anneeScolaireCourante"
            name="anneeScolaireCourante"
            defaultValue={anneeCourante ?? ""}
          >
            <option value="">— Aucune —</option>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="regimeNotation">Régime de notation</Label>
          <Select id="regimeNotation" name="regimeNotation" defaultValue={regimeNotation}>
            <option value="trimestre">Trimestre</option>
            <option value="semestre">Semestre</option>
          </Select>
        </div>
      </div>
      <SubmitButton className="w-auto px-8">Enregistrer</SubmitButton>
    </form>
  );
}

export function EssaiDefautForm({
  valeur,
  unite,
  heure,
}: {
  valeur: number;
  unite: string;
  heure: string | null;
}) {
  const [etat, action] = useActionState(enregistrerEssaiDefaut, initial);
  return (
    <form action={action} className="space-y-4">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <p className="text-sm text-ink-700/70">
        Durée attribuée <strong>automatiquement à l&apos;approbation d&apos;un rôle</strong>, et proposée par défaut
        aux affectations en « Période d&apos;essai ».
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="essaiValeur">Durée</Label>
          <Input id="essaiValeur" name="essaiValeur" type="number" min={1} max={999} defaultValue={valeur} />
        </div>
        <div>
          <Label htmlFor="essaiUnite">Unité</Label>
          <Select id="essaiUnite" name="essaiUnite" defaultValue={unite}>
            {UNITES_ESSAI.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="essaiHeure">Heure de fin (facultatif)</Label>
          <Input id="essaiHeure" name="essaiHeure" type="time" defaultValue={heure ?? ""} />
        </div>
      </div>
      <SubmitButton className="w-auto px-8">Enregistrer le défaut d&apos;essai</SubmitButton>
    </form>
  );
}

export function AnneeForm() {
  const [etat, action] = useActionState(creerAnneeScolaire, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <Label htmlFor="libelle">Nouvelle année (AAAA-AAAA)</Label>
        <Input id="libelle" name="libelle" placeholder="2026-2027" />
      </div>
      <SubmitButton className="w-auto px-5">Ajouter</SubmitButton>
      {etat.message && (
        <span className={`w-full text-xs ${etat.ok ? "text-forest-700" : "text-red-600"}`}>
          {etat.message}
        </span>
      )}
    </form>
  );
}

export function RegionForm() {
  const [etat, action] = useActionState(creerRegion, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <Label htmlFor="nomRegion">Nouvelle région</Label>
        <Input id="nomRegion" name="nom" placeholder="Ex : Gagnoa" />
      </div>
      <SubmitButton className="w-auto px-5">Ajouter</SubmitButton>
      {etat.message && (
        <span className={`w-full text-xs ${etat.ok ? "text-forest-700" : "text-red-600"}`}>
          {etat.message}
        </span>
      )}
    </form>
  );
}

/** Ajout d'une discipline au référentiel national (nom + couleur d'affichage). */
export function DisciplineForm() {
  const [etat, action] = useActionState(creerDiscipline, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[10rem] flex-1">
        <Label htmlFor="nomDiscipline">Nouvelle discipline</Label>
        <Input id="nomDiscipline" name="nom" placeholder="Ex : LV2, Allemand, Arts plastiques…" />
      </div>
      <div>
        <Label htmlFor="couleurDiscipline">Couleur</Label>
        <input
          id="couleurDiscipline"
          name="couleur"
          type="color"
          defaultValue="#2f7d5e"
          className="h-11 w-14 cursor-pointer rounded-xl border border-cream-300 bg-white p-1"
        />
      </div>
      <SubmitButton className="w-auto px-5">Ajouter</SubmitButton>
      {etat.message && (
        <span className={`w-full text-xs ${etat.ok ? "text-forest-700" : "text-red-600"}`}>
          {etat.message}
        </span>
      )}
    </form>
  );
}

/**
 * Pastille d'une discipline : renommage inline (crayon) et suppression en deux temps
 * (clic sur ×, puis confirmation) — refusée côté serveur si la discipline est utilisée.
 */
export function DisciplineChip({ id, nom, couleur }: { id: string; nom: string; couleur: string | null }) {
  const [confirme, setConfirme] = useState(false);
  const [edition, setEdition] = useState(false);
  const [nouveauNom, setNouveauNom] = useState(nom);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function supprimer() {
    start(async () => {
      const fd = new FormData();
      fd.set("disciplineId", id);
      const res = await supprimerDiscipline({ ok: false }, fd);
      setConfirme(false);
      setMessage(res.ok ? null : res.message ?? "Erreur technique.");
    });
  }

  function renommer() {
    const propre = nouveauNom.trim();
    if (!propre || propre === nom) {
      setEdition(false);
      setNouveauNom(nom);
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("disciplineId", id);
      fd.set("nom", propre);
      const res = await renommerDiscipline({ ok: false }, fd);
      if (res.ok) {
        setEdition(false);
        setMessage(null);
      } else {
        setMessage(res.message ?? "Erreur technique.");
      }
    });
  }

  if (edition) {
    return (
      <li className="inline-flex flex-col">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 py-1 pl-3 pr-1.5 text-sm text-forest-800">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleur ?? "#999" }} />
          <input
            value={nouveauNom}
            onChange={(e) => setNouveauNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") renommer();
              if (e.key === "Escape") {
                setEdition(false);
                setNouveauNom(nom);
                setMessage(null);
              }
            }}
            autoFocus
            aria-label={`Nouveau nom pour ${nom}`}
            className="h-6 w-40 rounded-lg border border-forest-300 bg-white px-2 text-sm outline-none focus:ring-1 focus:ring-forest-300"
          />
          {pending ? (
            <Loader2 size={13} className="animate-spin text-forest-600" />
          ) : (
            <>
              <button
                type="button"
                onClick={renommer}
                aria-label="Valider le nouveau nom"
                className="rounded-full p-0.5 text-forest-700 hover:bg-forest-100"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEdition(false);
                  setNouveauNom(nom);
                  setMessage(null);
                }}
                aria-label="Annuler le renommage"
                className="rounded-full p-0.5 text-ink-700/45 hover:bg-cream-100"
              >
                <X size={13} />
              </button>
            </>
          )}
        </span>
        {message && <span className="mt-1 max-w-64 text-[0.65rem] leading-tight text-red-600">{message}</span>}
      </li>
    );
  }

  return (
    <li className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 py-1 pl-3 pr-1.5 text-sm text-forest-800">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleur ?? "#999" }} />
        {nom}
        {!pending && !confirme && (
          <button
            type="button"
            onClick={() => {
              setEdition(true);
              setMessage(null);
            }}
            aria-label={`Renommer ${nom}`}
            title={`Renommer ${nom}`}
            className="rounded-full p-0.5 text-ink-700/45 hover:bg-forest-50 hover:text-forest-700"
          >
            <Pencil size={12} />
          </button>
        )}
        {pending ? (
          <Loader2 size={13} className="animate-spin text-forest-600" />
        ) : confirme ? (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={supprimer}
              className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-semibold text-white hover:bg-red-500"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirme(false)}
              className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-700/60 hover:bg-cream-100"
            >
              Annuler
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirme(true);
              setMessage(null);
            }}
            aria-label={`Supprimer ${nom}`}
            title={`Supprimer ${nom}`}
            className="rounded-full p-0.5 text-ink-700/45 hover:bg-red-50 hover:text-red-600"
          >
            <X size={13} />
          </button>
        )}
      </span>
      {message && <span className="mt-1 max-w-64 text-[0.65rem] leading-tight text-red-600">{message}</span>}
    </li>
  );
}
