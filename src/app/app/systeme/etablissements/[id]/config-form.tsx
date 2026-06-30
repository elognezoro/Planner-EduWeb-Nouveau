"use client";

import { useActionState } from "react";
import { sauvegarderConfiguration, type EtatForm } from "./config-actions";
import { Input, Label, Select, SubmitButton, FormAlert } from "@/components/ui/form";

const initial: EtatForm = { ok: false };

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

export interface ValeursConfig {
  nom: string;
  type: string;
  statut: string;
  code: string;
  ville: string;
  regionId: string;
  pays: string;
  sloganBulletin: string;
  ministere: string;
  anneeScolaire: string;
  fonctionChef: string;
  nomChef: string;
  planRapport: string;
  presentationRapport: string;
  effectifSouhaiteParClasse: number;
  nbSallesDisponibles: number;
  creneauxParJour: number;
  horaireDebutMatin: string;
  horairePauseMatinDebut: string;
  horairePauseMatinFin: string;
  horairePauseMidiDebut: string;
  horaireRepriseApresMidi: string;
  horaireFinJournee: string;
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-white p-6 shadow-soft">
      <h2 className="mb-4 font-display text-lg font-bold text-forest-900">{titre}</h2>
      {children}
    </div>
  );
}

export function ConfigForm({
  etablissementId,
  valeurs,
  regions,
  regimeLibelle,
}: {
  etablissementId: string;
  valeurs: ValeursConfig;
  regions: { id: string; nom: string }[];
  regimeLibelle: string;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  const v = valeurs;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && (
        <div className="rounded-2xl">
          <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>
        </div>
      )}

      {/* Étape 1 — Paramétrage institutionnel */}
      <Section titre="Paramétrage institutionnel & en-tête du bulletin">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pays">Pays</Label>
            <Input id="pays" name="pays" defaultValue={v.pays} />
          </div>
          <div>
            <Label htmlFor="sloganBulletin">Slogan national officiel</Label>
            <Input id="sloganBulletin" name="sloganBulletin" defaultValue={v.sloganBulletin} />
          </div>
          <div>
            <Label htmlFor="anneeScolaire">Année scolaire</Label>
            <Input id="anneeScolaire" name="anneeScolaire" defaultValue={v.anneeScolaire} placeholder="2025-2026" />
          </div>
          <div>
            <Label htmlFor="regionId">Direction régionale</Label>
            <Select id="regionId" name="regionId" defaultValue={v.regionId}>
              <option value="">— Non rattaché —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="ministere">Ministère (en-tête du bulletin)</Label>
            <Input id="ministere" name="ministere" defaultValue={v.ministere} placeholder="Ministère de l'Éducation Nationale…" />
          </div>
        </div>
      </Section>

      {/* Informations générales */}
      <Section titre="Informations générales">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nom">Nom de l'établissement</Label>
            <Input id="nom" name="nom" defaultValue={v.nom} required />
          </div>
          <div>
            <Label htmlFor="type">Type d'établissement</Label>
            <Select id="type" name="type" defaultValue={v.type}>
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="statut">Statut</Label>
            <Select id="statut" name="statut" defaultValue={v.statut}>
              {STATUTS.map((st) => (
                <option key={st.v} value={st.v}>
                  {st.l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="code">Code de l'établissement</Label>
            <Input id="code" name="code" defaultValue={v.code} />
          </div>
          <div>
            <Label htmlFor="ville">Localité</Label>
            <Input id="ville" name="ville" defaultValue={v.ville} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="regime-display">Régime de notation</Label>
            <Input id="regime-display" value={regimeLibelle} disabled readOnly />
            <p className="mt-1.5 text-xs text-ink-700/55">
              Le régime (trimestre/semestre) se règle dans Système → Configuration générale.
            </p>
          </div>
        </div>
      </Section>

      {/* Chef d'établissement (texte ; documents gérés à part) */}
      <Section titre="Chef d'établissement">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fonctionChef">Fonction</Label>
            <Input id="fonctionChef" name="fonctionChef" defaultValue={v.fonctionChef} placeholder="Proviseur, Principal…" />
          </div>
          <div>
            <Label htmlFor="nomChef">Nom et prénoms</Label>
            <Input id="nomChef" name="nomChef" defaultValue={v.nomChef} />
          </div>
        </div>
      </Section>

      {/* Rapport d'établissement */}
      <Section titre="Rapport d'établissement">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="planRapport">Plan du rapport</Label>
            <Input id="planRapport" name="planRapport" defaultValue={v.planRapport} placeholder="Plan officiel (M.E.N.A.)" />
          </div>
          <div>
            <Label htmlFor="presentationRapport">Présentation par défaut</Label>
            <Select id="presentationRapport" name="presentationRapport" defaultValue={v.presentationRapport || "Accordéon"}>
              <option value="Accordéon">Accordéon</option>
              <option value="Liste">Liste</option>
              <option value="Onglets">Onglets</option>
            </Select>
          </div>
        </div>
      </Section>

      {/* Étape 2 — Dimensionnement */}
      <Section titre="Dimensionnement (contraintes physiques & temporelles)">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="effectifSouhaiteParClasse">Effectif souhaité / classe</Label>
            <Input id="effectifSouhaiteParClasse" name="effectifSouhaiteParClasse" type="number" min={1} defaultValue={v.effectifSouhaiteParClasse} />
          </div>
          <div>
            <Label htmlFor="nbSallesDisponibles">Salles de classe disponibles</Label>
            <Input id="nbSallesDisponibles" name="nbSallesDisponibles" type="number" min={0} defaultValue={v.nbSallesDisponibles} />
          </div>
          <div>
            <Label htmlFor="creneauxParJour">Créneaux horaires / jour</Label>
            <Input id="creneauxParJour" name="creneauxParJour" type="number" min={1} defaultValue={v.creneauxParJour} />
          </div>
        </div>
      </Section>

      {/* Horaires journaliers */}
      <Section titre="Horaires journaliers">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="horaireDebutMatin">Début des cours (matin)</Label>
            <Input id="horaireDebutMatin" name="horaireDebutMatin" type="time" defaultValue={v.horaireDebutMatin} />
          </div>
          <div>
            <Label htmlFor="horairePauseMatinDebut">Pause mi-matinée (début)</Label>
            <Input id="horairePauseMatinDebut" name="horairePauseMatinDebut" type="time" defaultValue={v.horairePauseMatinDebut} />
          </div>
          <div>
            <Label htmlFor="horairePauseMatinFin">Reprise mi-matinée (fin pause)</Label>
            <Input id="horairePauseMatinFin" name="horairePauseMatinFin" type="time" defaultValue={v.horairePauseMatinFin} />
          </div>
          <div>
            <Label htmlFor="horairePauseMidiDebut">Pause méridienne (début)</Label>
            <Input id="horairePauseMidiDebut" name="horairePauseMidiDebut" type="time" defaultValue={v.horairePauseMidiDebut} />
          </div>
          <div>
            <Label htmlFor="horaireRepriseApresMidi">Reprise après-midi</Label>
            <Input id="horaireRepriseApresMidi" name="horaireRepriseApresMidi" type="time" defaultValue={v.horaireRepriseApresMidi} />
          </div>
          <div>
            <Label htmlFor="horaireFinJournee">Fin des cours (après-midi)</Label>
            <Input id="horaireFinJournee" name="horaireFinJournee" type="time" defaultValue={v.horaireFinJournee} />
          </div>
        </div>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <SubmitButton className="w-auto px-10 shadow-lg">Enregistrer la configuration</SubmitButton>
      </div>
    </form>
  );
}
