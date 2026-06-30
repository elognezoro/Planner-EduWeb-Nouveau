"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RotateCcw, Loader2, Save } from "lucide-react";
import { sauvegarderConfiguration, type EtatForm } from "./config-actions";
import { Input, Label, Select, FormAlert } from "@/components/ui/form";
import { ApercuBulletin } from "./apercu-bulletin";

const initial: EtatForm = { ok: false };
const SLOGAN_DEFAUT = "Union – Discipline – Travail";

const TYPES = [
  { v: "college", l: "Collège" },
  { v: "lycee", l: "Lycée" },
  { v: "groupe_scolaire", l: "Groupe scolaire" },
  { v: "primaire", l: "Primaire" },
  { v: "prescolaire", l: "Préscolaire" },
  { v: "autre", l: "Autre" },
];
const STATUTS = [
  { v: "public", l: "Public" },
  { v: "prive", l: "Privé" },
  { v: "confessionnel", l: "Confessionnel" },
  { v: "autre", l: "Autre" },
];

function SaveBtn({ label = "Enregistrer" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-800 px-5 text-xs font-semibold text-cream-50 transition-colors hover:bg-forest-700 disabled:opacity-60"
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      {label}
    </button>
  );
}

export function Bloc({
  id,
  titre,
  sousTitre,
  children,
}: {
  id: string;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-cream-200 bg-white p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-forest-900">{titre}</h2>
      {sousTitre && <p className="mt-1 mb-4 text-sm text-ink-700/65">{sousTitre}</p>}
      {!sousTitre && <div className="mb-4" />}
      {children}
    </section>
  );
}

export function PaysBlock({
  etablissementId,
  pays,
  slogan,
  ministere,
  annee,
  regionId,
  regions,
  regimeApercu,
}: {
  etablissementId: string;
  pays: string;
  slogan: string;
  ministere: string;
  annee: string;
  regionId: string;
  regions: { id: string; nom: string }[];
  regimeApercu: string;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  const [vPays, setPays] = useState(pays || "Côte d'Ivoire");
  const [vSlogan, setSlogan] = useState(slogan || SLOGAN_DEFAUT);
  const [vMin, setMin] = useState(ministere);
  const [vAnnee, setAnnee] = useState(annee);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="pays">Pays</Label>
          <Input id="pays" name="pays" value={vPays} onChange={(e) => setPays(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sloganBulletin">Slogan national officiel</Label>
          <div className="flex gap-2">
            <Input id="sloganBulletin" name="sloganBulletin" value={vSlogan} onChange={(e) => setSlogan(e.target.value)} />
            <button
              type="button"
              onClick={() => setSlogan(SLOGAN_DEFAUT)}
              title="Réinitialiser"
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-cream-300 px-3 text-xs font-medium text-forest-700 hover:bg-forest-50"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="anneeScolaire">Année scolaire</Label>
          <Input id="anneeScolaire" name="anneeScolaire" value={vAnnee} onChange={(e) => setAnnee(e.target.value)} placeholder="2025-2026" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="ministere">Ministère (en-tête du bulletin)</Label>
          <textarea
            id="ministere"
            name="ministere"
            value={vMin}
            onChange={(e) => setMin(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-cream-300 bg-white px-4 py-2.5 text-sm uppercase text-ink-900 shadow-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
        </div>
        <div>
          <Label htmlFor="regionId">Direction régionale</Label>
          <Select id="regionId" name="regionId" defaultValue={regionId}>
            <option value="">— Non rattaché —</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nom}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <ApercuBulletin ministere={vMin} regime={regimeApercu} pays={vPays} slogan={vSlogan} annee={vAnnee} />

      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}

export function InfosBlock({
  etablissementId,
  nom,
  type,
  statut,
  code,
  ville,
  regimeLibelle,
}: {
  etablissementId: string;
  nom: string;
  type: string;
  statut: string;
  code: string;
  ville: string;
  regimeLibelle: string;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="nom">Nom de l'établissement</Label>
          <Input id="nom" name="nom" defaultValue={nom} required />
        </div>
        <div>
          <Label htmlFor="type">Type d'établissement</Label>
          <Select id="type" name="type" defaultValue={type}>
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>{t.l}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="statut">Statut</Label>
          <Select id="statut" name="statut" defaultValue={statut}>
            {STATUTS.map((s) => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="code">Code de l'établissement</Label>
          <Input id="code" name="code" defaultValue={code} />
        </div>
        <div>
          <Label htmlFor="ville">Localité</Label>
          <Input id="ville" name="ville" defaultValue={ville} />
        </div>
        <div>
          <Label htmlFor="regime">Régime</Label>
          <Input id="regime" value={regimeLibelle} disabled readOnly />
          <p className="mt-1 text-[0.7rem] text-ink-700/55">Modifiable depuis Configuration générale.</p>
        </div>
      </div>
      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}

export function ChefBlock({
  etablissementId,
  fonctionChef,
  nomChef,
  children,
}: {
  etablissementId: string;
  fonctionChef: string;
  nomChef: string;
  children: React.ReactNode;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fonctionChef">Fonction</Label>
            <Input id="fonctionChef" name="fonctionChef" defaultValue={fonctionChef} placeholder="Proviseur, Principal…" />
          </div>
          <div>
            <Label htmlFor="nomChef">Nom et prénoms</Label>
            <Input id="nomChef" name="nomChef" defaultValue={nomChef} />
          </div>
        </div>
        <div className="flex justify-end">
          <SaveBtn />
        </div>
      </form>
      {/* Zones d'upload des documents (formulaires indépendants) */}
      {children}
    </div>
  );
}

export function RapportBlock({
  etablissementId,
  planRapport,
  presentationRapport,
}: {
  etablissementId: string;
  planRapport: string;
  presentationRapport: string;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="planRapport">Plan du rapport (titres et sous-titres)</Label>
          <Select id="planRapport" name="planRapport" defaultValue={planRapport || "Plan officiel (M.E.N.A.)"}>
            <option value="Plan officiel (M.E.N.A.)">Plan officiel (M.E.N.A.)</option>
            <option value="Plan synthétique">Plan synthétique</option>
            <option value="Plan personnalisé">Plan personnalisé</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="presentationRapport">Présentation par défaut</Label>
          <Select id="presentationRapport" name="presentationRapport" defaultValue={presentationRapport || "Accordéon"}>
            <option value="Accordéon">Accordéon</option>
            <option value="Liste">Liste</option>
            <option value="Onglets">Onglets</option>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}

export function DimensionnementBlock({
  etablissementId,
  effectifSouhaite,
  nbSalles,
  creneaux,
  horaires,
}: {
  etablissementId: string;
  effectifSouhaite: number;
  nbSalles: number;
  creneaux: number;
  horaires: {
    debutMatin: string;
    pauseMatinDebut: string;
    pauseMatinFin: string;
    pauseMidiDebut: string;
    repriseApresMidi: string;
    finJournee: string;
  };
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="effectifSouhaiteParClasse">Effectif souhaité / classe</Label>
          <Input id="effectifSouhaiteParClasse" name="effectifSouhaiteParClasse" type="number" min={1} defaultValue={effectifSouhaite} />
        </div>
        <div>
          <Label htmlFor="nbSallesDisponibles">Salles de classe disponibles</Label>
          <Input id="nbSallesDisponibles" name="nbSallesDisponibles" type="number" min={0} defaultValue={nbSalles} />
        </div>
        <div>
          <Label htmlFor="creneauxParJour">Créneaux horaires / jour</Label>
          <Input id="creneauxParJour" name="creneauxParJour" type="number" min={1} defaultValue={creneaux} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-forest-900">Horaires journaliers</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="horaireDebutMatin">Début des cours (matin)</Label>
            <Input id="horaireDebutMatin" name="horaireDebutMatin" type="time" defaultValue={horaires.debutMatin} />
          </div>
          <div>
            <Label htmlFor="horairePauseMatinDebut">Pause mi-matinée (début)</Label>
            <Input id="horairePauseMatinDebut" name="horairePauseMatinDebut" type="time" defaultValue={horaires.pauseMatinDebut} />
          </div>
          <div>
            <Label htmlFor="horairePauseMatinFin">Reprise mi-matinée</Label>
            <Input id="horairePauseMatinFin" name="horairePauseMatinFin" type="time" defaultValue={horaires.pauseMatinFin} />
          </div>
          <div>
            <Label htmlFor="horairePauseMidiDebut">Pause méridienne (début)</Label>
            <Input id="horairePauseMidiDebut" name="horairePauseMidiDebut" type="time" defaultValue={horaires.pauseMidiDebut} />
          </div>
          <div>
            <Label htmlFor="horaireRepriseApresMidi">Reprise après-midi</Label>
            <Input id="horaireRepriseApresMidi" name="horaireRepriseApresMidi" type="time" defaultValue={horaires.repriseApresMidi} />
          </div>
          <div>
            <Label htmlFor="horaireFinJournee">Fin des cours</Label>
            <Input id="horaireFinJournee" name="horaireFinJournee" type="time" defaultValue={horaires.finJournee} />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}
