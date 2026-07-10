"use client";

import { useEffect, useState, useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { RotateCcw, Loader2, Save, Plus, Trash2, ChevronDown, Sparkles } from "lucide-react";
import { sauvegarderConfiguration, type EtatForm } from "./config-actions";
import { Input, Label, Select, FormAlert } from "@/components/ui/form";
import { ApercuBulletin } from "./apercu-bulletin";
import { SelecteurPays } from "@/components/app/selecteur-pays";
import { trouverPays, sloganOfficiel } from "@/lib/referentiels/pays";
import { TYPES_ETABLISSEMENT, RESEAUX_CONFESSIONNELS } from "@/lib/referentiels/etablissement";
import { capaciteJournee } from "@/lib/emploi-du-temps/horaires";

const initial: EtatForm = { ok: false };

const TYPES = TYPES_ETABLISSEMENT;
const STATUTS = [
  { v: "public", l: "Public" },
  { v: "prive", l: "Privé" },
  { v: "confessionnel", l: "Confessionnel" },
  { v: "autre", l: "Autre" },
];
// Fonctions proposées pour le chef d'établissement (liste déroulante à recherche rapide).
const FONCTIONS_CHEF = ["Proviseur", "Principal", "ACE", "Fondateur", "Directeur des Études", "Directeur d'École Primaire", "Directeur d'Établissement Préscolaire"];

// Casse titre « prénoms » : première lettre de chaque composante séparée par une espace en
// majuscule, le reste en minuscules (ex. « n'venonfon blandine » → « N'venonfon Blandine »).
// Volontairement sans capitale après apostrophe ou trait d'union.
function casseTitrePrenoms(s: string): string {
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase());
}

/**
 * Liste déroulante à recherche rapide (combobox maison) : plus fiable que `<datalist>` natif
 * (comportement variable selon le navigateur). Filtre les options à la frappe (sans accents),
 * autorise une saisie libre, et se referme au clic extérieur ou avec Échap.
 */
function ComboFonction({
  name,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  defaultValue: string;
  options: string[];
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [filtrer, setFiltrer] = useState(false); // vrai = l'utilisateur tape → on filtre
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(value.trim());
  // À l'ouverture (clic sur le chevron / focus), on montre TOUTES les options ; on ne filtre
  // que lorsque l'utilisateur tape réellement dans le champ.
  const liste = filtrer && q ? options.filter((o) => norm(o).includes(q)) : options;
  return (
    <div ref={ref} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setFiltrer(true);
          setOpen(true);
        }}
        onFocus={() => {
          setFiltrer(false);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 pr-10 text-sm text-ink-900 shadow-sm outline-none transition-all placeholder:text-ink-700/40 focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          setFiltrer(false);
          setOpen((o) => !o);
        }}
        aria-label="Ouvrir la liste des fonctions"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-700/50 hover:text-forest-700"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && liste.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-xl border border-cream-200 bg-white py-1 shadow-soft">
          {liste.map((o) => (
            <li key={o}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // éviter le blur avant le clic
                  setValue(o);
                  setFiltrer(false);
                  setOpen(false);
                }}
                className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-forest-50 ${
                  o === value ? "font-semibold text-forest-800" : "text-ink-800"
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  essentiel,
  children,
}: {
  id: string;
  titre: string;
  sousTitre?: string;
  /** Bloc déterminant pour la génération des emplois du temps : mis en évidence. */
  essentiel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 rounded-2xl border bg-white p-6 shadow-soft ${
        essentiel ? "border-gold-300 ring-1 ring-gold-200" : "border-cream-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold text-forest-900">{titre}</h2>
        {essentiel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gold-800 ring-1 ring-gold-300">
            <Sparkles size={12} /> Essentiel pour l&apos;emploi du temps
          </span>
        )}
      </div>
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
  emblemeUrl,
}: {
  etablissementId: string;
  pays: string;
  slogan: string;
  ministere: string;
  annee: string;
  regionId: string;
  regions: { id: string; nom: string }[];
  regimeApercu: string;
  emblemeUrl: string | null;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  const [vPays, setPays] = useState(pays || "Côte d'Ivoire");
  // Le slogan suit AUTOMATIQUEMENT la devise officielle du pays (repli : valeur stockée).
  const [vSlogan, setSlogan] = useState(sloganOfficiel(pays || "Côte d'Ivoire", slogan));
  // L'intitulé du ministère apparaît automatiquement selon le pays (modifiable ensuite).
  const [vMin, setMin] = useState(ministere || trouverPays(pays || "Côte d'Ivoire")?.ministere || "");
  const [vAnnee, setAnnee] = useState(annee);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="pays">Pays</Label>
          <SelecteurPays
            name="pays"
            valeur={vPays}
            onSelect={(p) => {
              // La sélection du pays définit automatiquement le slogan officiel
              // et l'intitulé du ministère (modifiables ensuite à la main).
              setPays(p.nom);
              setSlogan(p.devise || "");
              setMin(p.ministere);
            }}
          />
          {trouverPays(vPays)?.devise && (
            <p className="mt-1.5 text-xs italic text-ink-700/55">
              Slogan national officiel : <strong className="not-italic">{trouverPays(vPays)?.devise}</strong>
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="sloganBulletin">Slogan national officiel</Label>
          <div className="flex gap-2">
            <Input id="sloganBulletin" name="sloganBulletin" value={vSlogan} onChange={(e) => setSlogan(e.target.value)} />
            <button
              type="button"
              onClick={() => setSlogan(sloganOfficiel(vPays))}
              title="Réinitialiser sur la devise officielle du pays"
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-2xl border border-cream-300 px-3 text-xs font-medium text-forest-700 hover:bg-forest-50"
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

      <ApercuBulletin ministere={vMin} regime={regimeApercu} pays={vPays} slogan={vSlogan} annee={vAnnee} emblemeUrl={emblemeUrl} />

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
  reseauConfessionnel,
  code,
  ville,
  regime,
  nbSequences,
}: {
  etablissementId: string;
  nom: string;
  type: string;
  statut: string;
  reseauConfessionnel: string;
  code: string;
  ville: string;
  /** Régime de notation effectif de l'établissement (trimestre | semestre | sequence). */
  regime: string;
  nbSequences: number;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  const [vRegime, setRegime] = useState(regime);
  // Statut contrôlé : pilote l'affichage conditionnel du réseau confessionnel.
  // Valeur initiale = statut persisté ; après enregistrement, le choix de l'utilisateur
  // correspond déjà à la valeur enregistrée (pas de resynchronisation nécessaire).
  const [vStatut, setStatut] = useState(statut);
  // Après enregistrement, la page serveur renvoie le régime persisté : on s'y aligne
  // (le reset de formulaire des actions React ne reflète pas la valeur enregistrée).
  useEffect(() => setRegime(regime), [regime]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="nom">Nom de l&apos;établissement</Label>
          <Input id="nom" name="nom" defaultValue={nom} required />
        </div>
        <div>
          <Label htmlFor="type">Type d&apos;établissement</Label>
          <Select id="type" name="type" defaultValue={type}>
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>{t.l}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="statut">Statut</Label>
          <Select id="statut" name="statut" value={vStatut} onChange={(e) => setStatut(e.target.value)}>
            {STATUTS.map((s) => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </Select>
        </div>
        {vStatut === "confessionnel" && (
          <div>
            <Label htmlFor="reseauConfessionnel">Réseau confessionnel</Label>
            <Select id="reseauConfessionnel" name="reseauConfessionnel" defaultValue={reseauConfessionnel}>
              <option value="">— À préciser —</option>
              {RESEAUX_CONFESSIONNELS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="code">Code de l&apos;établissement</Label>
          <Input id="code" name="code" defaultValue={code} />
        </div>
        <div>
          <Label htmlFor="ville">Localité</Label>
          <Input id="ville" name="ville" defaultValue={ville} />
        </div>
        <div>
          <Label htmlFor="regimeNotation">Régime</Label>
          <Select id="regimeNotation" name="regimeNotation" value={vRegime} onChange={(e) => setRegime(e.target.value)}>
            <option value="trimestre">Trimestriel (3 trimestres)</option>
            <option value="semestre">Semestriel (2 semestres)</option>
            <option value="sequence">Séquentiel (6 ou 8 séquences)</option>
          </Select>
          {vRegime === "sequence" && (
            <div className="mt-2">
              <Label htmlFor="nbSequences">Nombre de séquences</Label>
              <Select id="nbSequences" name="nbSequences" defaultValue={String(nbSequences === 8 ? 8 : 6)}>
                <option value="6">6 séquences</option>
                <option value="8">8 séquences</option>
              </Select>
            </div>
          )}
          <p className="mt-1 text-[0.7rem] text-ink-700/55">
            Choix propre à l&apos;établissement (régime de notation des bulletins).
          </p>
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
  prenomsChef,
  children,
}: {
  etablissementId: string;
  fonctionChef: string;
  nomChef: string;
  prenomsChef: string;
  children: React.ReactNode;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <input type="hidden" name="etablissementId" value={etablissementId} />
        {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="fonctionChef">Fonction</Label>
            {/* Liste déroulante à recherche rapide (combobox maison, fiable multi-navigateurs). */}
            <ComboFonction
              name="fonctionChef"
              defaultValue={fonctionChef}
              options={FONCTIONS_CHEF}
              placeholder="Proviseur, Principal…"
            />
          </div>
          <div>
            <Label htmlFor="nomChef">NOM</Label>
            {/* Verrouillé en MAJUSCULES au fil de la saisie. */}
            <Input
              id="nomChef"
              name="nomChef"
              defaultValue={nomChef}
              placeholder="VIGAN"
              onChange={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }}
            />
          </div>
          <div>
            <Label htmlFor="prenomsChef">Prénoms</Label>
            {/* Première lettre de chaque composante (séparée par une espace) en majuscule. */}
            <Input
              id="prenomsChef"
              name="prenomsChef"
              defaultValue={prenomsChef}
              placeholder="N'venonfon Blandine"
              onChange={(e) => { e.currentTarget.value = casseTitrePrenoms(e.currentTarget.value); }}
            />
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
  // Compatibilité : l'ancien intitulé « Plan officiel (M.E.N.A.) » stocké en base
  // est assimilé au nouveau « Plan officiel du Ministère ».
  const planActuel =
    !planRapport || planRapport === "Plan officiel (M.E.N.A.)" ? "Plan officiel du Ministère" : planRapport;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="planRapport">Plan du rapport (titres et sous-titres)</Label>
          <Select id="planRapport" name="planRapport" defaultValue={planActuel}>
            <option value="Plan officiel du Ministère">Plan officiel du Ministère</option>
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

export interface ConditionVacation {
  libelle: string;
  doubleVacation: boolean;
}

export interface PlageSansCours {
  jour: number; // 0 = Lundi … 4 = Vendredi
  moment: string; // "matin" | "apresmidi" | "journee"
}

// Suggestions de départ pour les paramètres conditionnels de double vacation.
const SUGGESTIONS_CONDITIONS = ["Cours d'EPS", "Devoir", "Travaux manuels"];
const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const MOMENTS = [
  { v: "journee", l: "Toute la journée" },
  { v: "matin", l: "Matin" },
  { v: "apresmidi", l: "Après-midi" },
];
const libelleMoment = (m: string) => MOMENTS.find((x) => x.v === m)?.l ?? m;

export function DimensionnementBlock({
  etablissementId,
  effectifSouhaite,
  nbSalles,
  creneaux,
  horaires,
  conditionsVacation,
  eps,
  reposEnseignant,
  regrouperHeuresCreuses,
  autoriserHeuresCreuses,
  plagesSansCours,
  doubleVacationMatin,
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
  /** Paramètres conditionnels de double vacation (élèves), persistés. */
  conditionsVacation: ConditionVacation[];
  /** Plages horaires d'EPS de l'établissement (« HH:MM » ou « »). */
  eps: { matinDebut: string; matinFin: string; apresMidiDebut: string; apresMidiFin: string };
  reposEnseignant: boolean;
  regrouperHeuresCreuses: boolean;
  /** Autoriser des heures creuses dans l'EDT des élèves (pour souffler). */
  autoriserHeuresCreuses: boolean;
  /** Plages sans cours de l'établissement (jour / demi-journée). */
  plagesSansCours: PlageSansCours[];
  /** En double vacation, quels indices ont cours le matin : "impairs" | "pairs". */
  doubleVacationMatin: string;
}) {
  const [etat, action] = useActionState(sauvegarderConfiguration, initial);

  // Miroir local des champs de dimensionnement (créneaux + horaires) pour afficher EN DIRECT
  // la capacité réelle de la journée : les <input> restent non contrôlés (defaultValue), on
  // observe seulement leurs changements. Resynchronisé sur la valeur serveur après enregistrement.
  const [dims, setDims] = useState({ creneaux, ...horaires });
  const dimsServeur = JSON.stringify({ creneaux, ...horaires });
  useEffect(() => setDims(JSON.parse(dimsServeur)), [dimsServeur]);
  const majDim = (champ: keyof typeof dims, valeur: string) =>
    setDims((d) => ({ ...d, [champ]: champ === "creneaux" ? Number(valeur) : valeur }));
  const capacite = capaciteJournee({
    creneauxParJour: Number(dims.creneaux) || 1,
    horaireDebutMatin: dims.debutMatin,
    horairePauseMatinDebut: dims.pauseMatinDebut,
    horairePauseMatinFin: dims.pauseMatinFin,
    horairePauseMidiDebut: dims.pauseMidiDebut,
    horaireRepriseApresMidi: dims.repriseApresMidi,
    horaireFinJournee: dims.finJournee,
  });
  const creneauxTropEleves = capacite != null && Number(dims.creneaux) > capacite;

  // Liste locale des conditions, resynchronisée quand la VALEUR serveur change (après
  // enregistrement) — pas à chaque re-rendu, pour ne pas perdre une saisie en cours.
  const [conditions, setConditions] = useState<ConditionVacation[]>(conditionsVacation);
  const [nouvelleCondition, setNouvelleCondition] = useState("");
  const serveurJson = JSON.stringify(conditionsVacation);
  useEffect(() => setConditions(JSON.parse(serveurJson)), [serveurJson]);

  // Plages sans cours de l'établissement (liste locale, resynchronisée sur la valeur serveur).
  const [plages, setPlages] = useState<PlageSansCours[]>(plagesSansCours);
  const [nouveauJour, setNouveauJour] = useState(0);
  const [nouveauMoment, setNouveauMoment] = useState("journee");
  const plagesServeurJson = JSON.stringify(plagesSansCours);
  useEffect(() => setPlages(JSON.parse(plagesServeurJson)), [plagesServeurJson]);

  function ajouterPlage() {
    if (plages.some((p) => p.jour === nouveauJour && p.moment === nouveauMoment)) return;
    setPlages([...plages, { jour: nouveauJour, moment: nouveauMoment }]);
  }

  function ajouterCondition(libelle: string) {
    const propre = libelle.trim();
    if (!propre) return;
    if (conditions.some((c) => c.libelle.toLowerCase() === propre.toLowerCase())) return;
    // À la sélection d'un paramètre, la question « double vacation ? » se répond via
    // les boutons Oui / Non de la ligne (défaut : Oui).
    setConditions([...conditions, { libelle: propre, doubleVacation: true }]);
    setNouvelleCondition("");
  }
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="etablissementId" value={etablissementId} />
      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      {/* key incluant la valeur serveur : après « Enregistrer », React remonte chaque champ
          avec la valeur persistée (le reset de formulaire des actions serveur remettrait
          sinon l'ancienne valeur à l'écran, donnant l'impression d'une non-persistance). */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="effectifSouhaiteParClasse">Effectif souhaité / classe</Label>
          <Input key={`eff:${effectifSouhaite}`} id="effectifSouhaiteParClasse" name="effectifSouhaiteParClasse" type="number" min={1} defaultValue={effectifSouhaite} />
        </div>
        <div>
          <Label htmlFor="nbSallesDisponibles">Salles de classe disponibles</Label>
          <Input key={`salles:${nbSalles}`} id="nbSallesDisponibles" name="nbSallesDisponibles" type="number" min={0} defaultValue={nbSalles} />
        </div>
        <div>
          <Label htmlFor="creneauxParJour">Créneaux horaires / jour</Label>
          <Input key={`creneaux:${creneaux}`} id="creneauxParJour" name="creneauxParJour" type="number" min={1} defaultValue={creneaux} onChange={(e) => majDim("creneaux", e.target.value)} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-forest-900">Horaires journaliers</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="horaireDebutMatin">Début des cours (matin)</Label>
            <Input key={`h1:${horaires.debutMatin}`} id="horaireDebutMatin" name="horaireDebutMatin" type="time" defaultValue={horaires.debutMatin} onChange={(e) => majDim("debutMatin", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="horairePauseMatinDebut">Pause mi-matinée (début)</Label>
            <Input key={`h2:${horaires.pauseMatinDebut}`} id="horairePauseMatinDebut" name="horairePauseMatinDebut" type="time" defaultValue={horaires.pauseMatinDebut} onChange={(e) => majDim("pauseMatinDebut", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="horairePauseMatinFin">Reprise mi-matinée</Label>
            <Input key={`h3:${horaires.pauseMatinFin}`} id="horairePauseMatinFin" name="horairePauseMatinFin" type="time" defaultValue={horaires.pauseMatinFin} onChange={(e) => majDim("pauseMatinFin", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="horairePauseMidiDebut">Pause méridienne (début)</Label>
            <Input key={`h4:${horaires.pauseMidiDebut}`} id="horairePauseMidiDebut" name="horairePauseMidiDebut" type="time" defaultValue={horaires.pauseMidiDebut} onChange={(e) => majDim("pauseMidiDebut", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="horaireRepriseApresMidi">Reprise après-midi</Label>
            <Input key={`h5:${horaires.repriseApresMidi}`} id="horaireRepriseApresMidi" name="horaireRepriseApresMidi" type="time" defaultValue={horaires.repriseApresMidi} onChange={(e) => majDim("repriseApresMidi", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="horaireFinJournee">Fin des cours</Label>
            <Input key={`h6:${horaires.finJournee}`} id="horaireFinJournee" name="horaireFinJournee" type="time" defaultValue={horaires.finJournee} onChange={(e) => majDim("finJournee", e.target.value)} />
          </div>
        </div>
        {capacite != null && (
          <p className={`mt-2 text-xs ${creneauxTropEleves ? "font-medium text-gold-700" : "text-ink-700/55"}`}>
            {creneauxTropEleves
              ? `⚠ Avec ces horaires et des séances de 55 min, seuls ${capacite} créneaux tiennent avant la fin des cours. Au-delà, l'après-midi déborde l'heure de fin. Valeur conseillée : ${capacite}.`
              : `Avec ces horaires et des séances de 55 min, jusqu'à ${capacite} créneaux/jour tiennent avant la fin des cours.`}
          </p>
        )}
      </div>

      {/* ── Élèves : paramètres conditionnels de double vacation (liste flexible) ── */}
      <div className="border-t border-cream-100 pt-4">
        <p className="mb-1 text-sm font-semibold text-forest-900">
          Élèves — paramètres conditionnels de double vacation
        </p>
        <p className="mb-3 text-xs text-ink-700/55">
          Ajoutez les conditions propres à l&apos;établissement au fur et à mesure (cours d&apos;EPS,
          devoir, travaux manuels…) et indiquez pour chacune s&apos;il y a double vacation ou non.
          Ces paramètres documentent les règles de vacation de l&apos;établissement ; leur prise en
          compte par le générateur d&apos;emplois du temps sera enrichie condition par condition.
        </p>
        <input type="hidden" name="conditionsVacation" value={JSON.stringify(conditions)} />
        {conditions.length > 0 && (
          <ul className="mb-3 space-y-2">
            {conditions.map((c, i) => (
              <li key={c.libelle} className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 text-sm font-medium text-ink-800">{c.libelle}</span>
                <span className="flex items-center gap-1.5 text-xs text-ink-700/60">
                  Double vacation :
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() =>
                        setConditions(conditions.map((x, j) => (j === i ? { ...x, doubleVacation: v } : x)))
                      }
                      aria-pressed={c.doubleVacation === v}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        c.doubleVacation === v
                          ? "border-transparent bg-forest-700 text-cream-50"
                          : "border-cream-300 bg-white text-ink-700/65 hover:border-forest-300"
                      }`}
                    >
                      {v ? "Oui" : "Non"}
                    </button>
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                  title={`Retirer « ${c.libelle} »`}
                  aria-label={`Retirer ${c.libelle}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/45 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={nouvelleCondition}
            onChange={(e) => setNouvelleCondition(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                ajouterCondition(nouvelleCondition);
              }
            }}
            placeholder="Nouvelle condition (ex : Cours d'EPS)…"
            className="h-9 min-w-[14rem] flex-1 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          />
          <button
            type="button"
            onClick={() => ajouterCondition(nouvelleCondition)}
            disabled={!nouvelleCondition.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50 disabled:opacity-50"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
        {SUGGESTIONS_CONDITIONS.some((s) => !conditions.some((c) => c.libelle.toLowerCase() === s.toLowerCase())) && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-700/55">
            Suggestions :
            {SUGGESTIONS_CONDITIONS.filter(
              (s) => !conditions.some((c) => c.libelle.toLowerCase() === s.toLowerCase()),
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ajouterCondition(s)}
                className="rounded-full border border-cream-300 bg-white px-2.5 py-0.5 font-medium text-forest-800 hover:border-forest-300 hover:bg-forest-50"
              >
                + {s}
              </button>
            ))}
          </p>
        )}

        {/* Heures creuses dans l'EDT des élèves : choix du chef d'établissement. */}
        <input type="hidden" name="contraintesElevesPresentes" value="1" />
        <label className="mt-3 flex cursor-pointer items-start gap-2.5 py-1.5">
          <input
            key={`creuses-eleves:${autoriserHeuresCreuses}`}
            type="checkbox"
            name="autoriserHeuresCreuses"
            defaultChecked={autoriserHeuresCreuses}
            className="mt-0.5 h-4 w-4 accent-forest-700"
          />
          <span className="text-sm text-ink-800">
            <strong>Autoriser des heures creuses</strong> dans l&apos;emploi du temps des élèves,
            pour leur permettre de souffler — la génération cesse alors de compacter leurs journées.
          </span>
        </label>

        {/* Parité des classes ayant cours le matin en double vacation. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="doubleVacationMatin" className="text-sm text-ink-800">
            En double vacation, les classes ayant cours <strong>le matin</strong> ont des
          </label>
          <select
            key={`dvm:${doubleVacationMatin}`}
            id="doubleVacationMatin"
            name="doubleVacationMatin"
            defaultValue={doubleVacationMatin === "pairs" ? "pairs" : "impairs"}
            /* Halo orange pour attirer l'attention sur ce réglage de parité. */
            className="h-9 rounded-lg border border-gold-300 bg-white px-2.5 text-sm outline-none ring-2 ring-gold-300 ring-offset-2 focus:border-gold-400 focus:ring-gold-400"
          >
            <option value="impairs">indices impairs</option>
            <option value="pairs">indices pairs</option>
          </select>
        </div>
      </div>

      {/* ── Jour(s) ou demi-journée(s) sans cours dans tout l'établissement ── */}
      <div className="border-t border-cream-100 pt-4">
        <p className="mb-1 text-sm font-semibold text-forest-900">
          Jour(s) ou demi-journée(s) sans cours
        </p>
        <p className="mb-3 text-xs text-ink-700/55">
          Indiquez les moments où AUCUN cours n&apos;a lieu dans l&apos;établissement (ex : mercredi
          après-midi). Le générateur n&apos;y placera aucune séance.
        </p>
        <input type="hidden" name="plagesSansCours" value={JSON.stringify(plages)} />
        {plages.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {plages.map((p, i) => (
              <li key={`${p.jour}:${p.moment}`} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 text-ink-800">
                  {JOURS_SEMAINE[p.jour]} — {libelleMoment(p.moment)}
                </span>
                <button
                  type="button"
                  onClick={() => setPlages(plages.filter((_, j) => j !== i))}
                  title="Retirer cette plage"
                  aria-label={`Retirer ${JOURS_SEMAINE[p.jour]} ${libelleMoment(p.moment)}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-700/45 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={nouveauJour}
            onChange={(e) => setNouveauJour(Number(e.target.value))}
            className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          >
            {JOURS_SEMAINE.map((j, idx) => (
              <option key={j} value={idx}>{j}</option>
            ))}
          </select>
          <select
            value={nouveauMoment}
            onChange={(e) => setNouveauMoment(e.target.value)}
            className="h-9 rounded-lg border border-cream-300 bg-white px-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
          >
            {MOMENTS.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={ajouterPlage}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest-200 px-4 text-xs font-semibold text-forest-800 hover:bg-forest-50"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* ── Plages horaires d'EPS de l'établissement ── */}
      <div className="border-t border-cream-100 pt-4">
        <p className="mb-1 text-sm font-semibold text-forest-900">Plages horaires d&apos;EPS</p>
        <p className="mb-3 text-xs text-ink-700/55">
          Les séances d&apos;EPS ne seront placées que dans ces plages (matin et après-midi).
          Laissez vide pour ne pas restreindre.
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="epsMatinDebut">Matin — début</Label>
            <Input key={`e1:${eps.matinDebut}`} id="epsMatinDebut" name="epsMatinDebut" type="time" defaultValue={eps.matinDebut} />
          </div>
          <div>
            <Label htmlFor="epsMatinFin">Matin — fin</Label>
            <Input key={`e2:${eps.matinFin}`} id="epsMatinFin" name="epsMatinFin" type="time" defaultValue={eps.matinFin} />
          </div>
          <div>
            <Label htmlFor="epsApresMidiDebut">Après-midi — début</Label>
            <Input key={`e3:${eps.apresMidiDebut}`} id="epsApresMidiDebut" name="epsApresMidiDebut" type="time" defaultValue={eps.apresMidiDebut} />
          </div>
          <div>
            <Label htmlFor="epsApresMidiFin">Après-midi — fin</Label>
            <Input key={`e4:${eps.apresMidiFin}`} id="epsApresMidiFin" name="epsApresMidiFin" type="time" defaultValue={eps.apresMidiFin} />
          </div>
        </div>
      </div>

      {/* ── Enseignants : jour de repos & regroupement des heures creuses ── */}
      <div className="border-t border-cream-100 pt-4">
        <p className="mb-1 text-sm font-semibold text-forest-900">Enseignants</p>
        <input type="hidden" name="contraintesEnseignantsPresentes" value="1" />
        <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
          <input
            key={`repos:${reposEnseignant}`}
            type="checkbox"
            name="reposEnseignant"
            defaultChecked={reposEnseignant}
            className="mt-0.5 h-4 w-4 accent-forest-700"
          />
          <span className="text-sm text-ink-800">
            Garantir à chaque enseignant <strong>un jour de repos</strong> parmi les cinq jours
            (lundi à vendredi) — contrainte stricte de la génération.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
          <input
            key={`creuses:${regrouperHeuresCreuses}`}
            type="checkbox"
            name="regrouperHeuresCreuses"
            defaultChecked={regrouperHeuresCreuses}
            className="mt-0.5 h-4 w-4 accent-forest-700"
          />
          <span className="text-sm text-ink-800">
            <strong>Regrouper les heures creuses</strong> de chaque enseignant (plutôt la matinée
            ou plutôt l&apos;après-midi) — les emplois du temps réduisent au maximum les heures
            creuses dispersées.
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}
