"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import {
  mettreAJourConfiguration,
  enregistrerEssaiDefaut,
  enregistrerDeconnexionInactivite,
  creerAnneeScolaire,
  creerRegion,
  creerDiscipline,
  renommerDiscipline,
  supprimerDiscipline,
  type EtatForm,
} from "./actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
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
      <SubmitButton className="w-auto px-8 mobile:w-full">Enregistrer</SubmitButton>
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
      <SubmitButton className="w-auto px-8 mobile:w-full">Enregistrer le défaut d&apos;essai</SubmitButton>
    </form>
  );
}

/**
 * Déconnexion automatique après inactivité : interrupteur + délai (minutes) + préavis d'alerte
 * (secondes). L'alerte est VISUELLE ET SONORE, avec un bouton « Rester connecté ».
 */
export function DeconnexionInactiviteForm({
  active,
  delaiMinutes,
  avertissementSecondes,
}: {
  active: boolean;
  delaiMinutes: number;
  avertissementSecondes: number;
}) {
  const [etat, action] = useActionState(enregistrerDeconnexionInactivite, initial);
  return (
    <form action={action} className="space-y-4">
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <p className="text-sm text-ink-700/70">
        Après ce temps <strong>sans aucune action</strong> (ni clic, ni frappe au clavier),
        l&apos;utilisateur est déconnecté pour protéger son compte. Une <strong>alerte visuelle et
        sonore</strong> le prévient avant la coupure, avec un compte à rebours et un bouton
        « Rester connecté ». S&apos;applique à tous les utilisateurs, à leur prochain
        chargement de page.
      </p>
      <label className="flex items-center gap-2 text-sm text-ink-800 mobile:min-h-11">
        <input
          type="checkbox"
          name="inactiviteActive"
          defaultChecked={active}
          className="h-4 w-4 rounded border-cream-300"
        />
        Activer la déconnexion automatique après inactivité
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="inactiviteDelai">Délai d&apos;inactivité (minutes)</Label>
          <Input id="inactiviteDelai" name="inactiviteDelai" type="number" min={5} max={480} defaultValue={delaiMinutes} />
          <p className="mt-1 text-xs text-ink-700/55">Entre 5 et 480 minutes.</p>
        </div>
        <div>
          <Label htmlFor="inactiviteAvertissement">Alerte avant la coupure (secondes)</Label>
          <Input id="inactiviteAvertissement" name="inactiviteAvertissement" type="number" min={15} max={300} defaultValue={avertissementSecondes} />
          <p className="mt-1 text-xs text-ink-700/55">Entre 15 et 300 secondes — au moins 30 s de moins que le délai.</p>
        </div>
      </div>
      <SubmitButton className="w-auto px-8 mobile:w-full">Enregistrer</SubmitButton>
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

/**
 * Ajout d'une région au PAYS COURANT de la page (filtre « Pays ») : transmis en champ caché,
 * le pays est revalidé côté serveur contre le référentiel (creerRegion).
 */
export function RegionForm({ pays }: { pays: string }) {
  const [etat, action] = useActionState(creerRegion, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="pays" value={pays} />
      <div className="flex-1">
        <Label htmlFor="nomRegion">Nouvelle région — {pays}</Label>
        {/* Exemple ivoirien conservé ; ailleurs, rappel neutre du découpage (départements, provinces…). */}
        <Input
          id="nomRegion"
          name="nom"
          placeholder={pays === "Côte d'Ivoire" ? "Ex : Gagnoa" : "Nom de la région (département, province…)"}
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
  // Téléphone : crayon et × (cibles de 17 à 20 px, à 8 px de la pastille voisine) cèdent la place
  // à un appui sur toute la pastille, qui ouvre une feuille montante « Renommer / Supprimer ».
  const [feuille, setFeuille] = useState(false);
  const [nomFeuille, setNomFeuille] = useState(nom);
  const [confirmeFeuille, setConfirmeFeuille] = useState(false);

  function ouvrirFeuille() {
    setNomFeuille(nom);
    setConfirmeFeuille(false);
    setMessage(null);
    setFeuille(true);
  }

  function renommerFeuille() {
    const propre = nomFeuille.trim();
    if (!propre || propre === nom) {
      setFeuille(false);
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("disciplineId", id);
      fd.set("nom", propre);
      const res = await renommerDiscipline({ ok: false }, fd);
      if (res.ok) {
        setMessage(null);
        setFeuille(false);
      } else {
        setMessage(res.message ?? "Erreur technique.");
      }
    });
  }

  function supprimerFeuille() {
    start(async () => {
      const fd = new FormData();
      fd.set("disciplineId", id);
      const res = await supprimerDiscipline({ ok: false }, fd);
      setConfirmeFeuille(false);
      if (res.ok) {
        setMessage(null);
        setFeuille(false);
      } else {
        setMessage(res.message ?? "Erreur technique.");
      }
    });
  }

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
        {message && <span className="mt-1 max-w-64 text-[0.65rem] leading-tight text-red-600 mobile:text-xs">{message}</span>}
      </li>
    );
  }

  return (
    <li className="inline-flex flex-col mobile:relative">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-200 py-1 pl-3 pr-1.5 text-sm text-forest-800 mobile:min-h-11 mobile:pr-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleur ?? "#999" }} />
        {nom}
        {!pending && !confirme && (
          <button
            type="button"
            onClick={() => {
              // Resynchronise avec le nom COURANT (il a pu changer depuis le montage) avant
              // d'ouvrir l'édition — sinon un état périmé pourrait réécrire l'ancien nom.
              setNouveauNom(nom);
              setEdition(true);
              setMessage(null);
            }}
            aria-label={`Renommer ${nom}`}
            title={`Renommer ${nom}`}
            className="rounded-full p-0.5 text-ink-700/45 hover:bg-forest-50 hover:text-forest-700 mobile:hidden"
          >
            <Pencil size={12} />
          </button>
        )}
        {pending ? (
          <Loader2 size={13} className="animate-spin text-forest-600" />
        ) : confirme ? (
          <span className="inline-flex items-center gap-1 mobile:hidden">
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
            className="rounded-full p-0.5 text-ink-700/45 hover:bg-red-50 hover:text-red-600 mobile:hidden"
          >
            <X size={13} />
          </button>
        )}
      </span>
      {message && <span className="mt-1 max-w-64 text-[0.65rem] leading-tight text-red-600 mobile:text-xs">{message}</span>}
      {/* Téléphone : toute la pastille est la cible (44 px de haut). */}
      <button
        type="button"
        onClick={ouvrirFeuille}
        aria-haspopup="dialog"
        aria-label={`Renommer ou supprimer ${nom}`}
        className="absolute inset-0 rounded-full lg:hidden print:hidden"
      />
      <FeuilleBas ouvert={feuille} onFermer={() => setFeuille(false)} titre={nom}>
        <div className="space-y-4 px-2 pb-2">
          {message && <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-forest-900">Renommer la discipline</span>
            <input
              value={nomFeuille}
              onChange={(e) => setNomFeuille(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") renommerFeuille();
              }}
              className="h-12 w-full rounded-2xl border border-cream-300 bg-white px-3.5 text-base text-forest-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
            />
          </label>
          <button
            type="button"
            onClick={renommerFeuille}
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest-800 font-semibold text-cream-50 active:bg-forest-700 disabled:opacity-60"
          >
            {pending && !confirmeFeuille ? <Loader2 size={17} className="animate-spin" /> : <Pencil size={16} />} Renommer
          </button>
          <div className="border-t border-cream-200 pt-4">
            {confirmeFeuille ? (
              <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-700">
                  Supprimer « {nom} » ? Refusé si la discipline est utilisée (affectations, notes, cahier de texte).
                </p>
                <button
                  type="button"
                  onClick={supprimerFeuille}
                  disabled={pending}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-red-600 font-semibold text-white active:bg-red-700 disabled:opacity-60"
                >
                  {pending ? <Loader2 size={17} className="animate-spin" /> : <X size={17} />} Confirmer la suppression
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmeFeuille(false)}
                  className="flex min-h-12 w-full items-center justify-center rounded-full border border-cream-300 bg-white font-medium text-ink-700/80 active:bg-cream-100"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmeFeuille(true);
                  setMessage(null);
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white font-semibold text-red-600 active:bg-red-50"
              >
                <X size={17} /> Supprimer la discipline…
              </button>
            )}
          </div>
        </div>
      </FeuilleBas>
    </li>
  );
}
