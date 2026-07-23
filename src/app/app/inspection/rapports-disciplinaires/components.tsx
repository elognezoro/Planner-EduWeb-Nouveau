"use client";

import { useActionState, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookmarkPlus, ChevronDown, Eye, Plus, RotateCcw, Save, Trash2, Undo2, Wand2, X } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/app/ui";
import { SelectRecherche } from "@/components/app/select-recherche";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import {
  CLES_TABLEAUX,
  COLONNES_ACTIVITES,
  COLONNES_ACTIVITES_COMPLEMENT,
  COLONNES_PROGRAMMES_CAFOP,
  COLONNES_PROGRAMMES_SECONDAIRE,
  MAX_CELLULE_RAPPORT,
  MAX_LIGNES_TABLEAU,
  MAX_SECTIONS_LIBRES,
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  MAX_TITRE_ZONE,
  MAX_ZONES_PAR_SECTION,
  completerEntete,
  ligneVide,
  nombreDeCellule,
  nouvelId,
  titreSectionOfficielle,
  type CleTableau,
  type ContenuRapport,
  type EnteteRapport,
  type IdSectionOfficielle,
  type SectionLibre,
  type StructureModele,
  type ZoneSupplementaire,
} from "@/lib/inspection/rapport-disciplinaire";
import { enregistrerModeleRapport, enregistrerRapportDisciplinaire } from "./actions";
import type { EtatForm } from "../visites/actions";

const initial: EtatForm = { ok: false };

const textareaCls =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70";

const inputCls =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70";

// ── Bandeau de sélection : antenne (rôles nationaux/régionaux) + discipline (?apfc=&discipline=) ──

export function FiltresRapportCrd({
  montrerApfc,
  apfcOptions,
  apfcDefaut,
  disciplineOptions,
  disciplineDefaut,
  termeAntenne,
}: {
  /** Faux pour les rôles d'antenne (leur APFC est sélectionnée automatiquement). */
  montrerApfc: boolean;
  apfcOptions: { id: string; nom: string }[];
  apfcDefaut: { id: string; nom: string } | null;
  disciplineOptions: { id: string; nom: string }[];
  disciplineDefaut: { id: string; nom: string } | null;
  /** Libellé local des antennes (ex. « APFC », « ADEN ») pour les intitulés. */
  termeAntenne: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  /** Navigation par searchParams — le composant serveur REVALIDE tout (fail-closed). */
  function naviguer(apfcId: string | null, discipline: string | null) {
    const params = new URLSearchParams();
    if (apfcId) params.set("apfc", apfcId);
    if (discipline) params.set("discipline", discipline);
    router.push(`${pathname}?${params.toString()}#rapport-crd`);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {montrerApfc && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Antenne ({termeAntenne})</label>
          <SelectRecherche
            key={apfcDefaut?.id ?? "aucune"}
            name="filtre-apfc"
            options={apfcOptions}
            defaut={apfcDefaut}
            placeholder="Choisir l'antenne…"
            effacable
            grand
            onSelect={(o) => {
              // Seule une sélection effective navigue (effacer ne recharge pas la page).
              if (o) naviguer(o.id, disciplineDefaut?.id ?? null);
            }}
          />
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-forest-900">Discipline</label>
        {/* Disciplines SIMPLES (composites « X / Y » éclatées côté serveur) — saisie libre possible. */}
        <SelectRecherche
          key={`${apfcDefaut?.id ?? "aucune"}-${disciplineDefaut?.id ?? "aucune"}`}
          name="filtre-discipline"
          options={disciplineOptions}
          defaut={disciplineDefaut}
          placeholder="Choisir ou saisir la discipline…"
          valeurLibre
          effacable
          grand
          disabled={montrerApfc && !apfcDefaut}
          onSelect={(o) => {
            if (o) naviguer(apfcDefaut?.id ?? null, o.nom);
          }}
        />
      </div>
    </div>
  );
}

// ── Confirmations en 2 CLICS inline (aucun dialogue natif) ──

/** Poubelle → « Confirmer » / « Annuler » (2e clic = confirmation). */
function BoutonRetrait2Clics({
  libelle,
  confirmation,
  onConfirmer,
}: {
  /** Intitulé accessible du bouton poubelle (aria-label / title). */
  libelle: string;
  /** Texte du bouton rouge une fois armé. */
  confirmation: string;
  onConfirmer: () => void;
}) {
  const [arme, setArme] = useState(false);
  if (!arme) {
    return (
      <button
        type="button"
        onClick={() => setArme(true)}
        aria-label={libelle}
        title={libelle}
        className="shrink-0 rounded-full p-1.5 text-ink-700/40 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={14} />
      </button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setArme(false);
          onConfirmer();
        }}
        className="whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700"
      >
        {confirmation}
      </button>
      <button
        type="button"
        onClick={() => setArme(false)}
        className="rounded-full border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700/70 transition-colors hover:bg-cream-100"
      >
        Annuler
      </button>
    </span>
  );
}

/** Bouton TEXTE à confirmation 2 clics (ex. « Réinitialiser l'en-tête », « Appliquer mon modèle »). */
function BoutonTexte2Clics({
  libelle,
  confirmation,
  onConfirmer,
  icone,
}: {
  libelle: string;
  confirmation: string;
  onConfirmer: () => void;
  /** Icône du déclencheur (défaut : flèche de réinitialisation). */
  icone?: React.ReactNode;
}) {
  const [arme, setArme] = useState(false);
  if (!arme) {
    return (
      <button
        type="button"
        onClick={() => setArme(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
      >
        {icone ?? <RotateCcw size={13} />} {libelle}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setArme(false);
          onConfirmer();
        }}
        className="whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700"
      >
        {confirmation}
      </button>
      <button
        type="button"
        onClick={() => setArme(false)}
        className="rounded-full border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700/70 transition-colors hover:bg-cream-100"
      >
        Annuler
      </button>
    </span>
  );
}

// ── Zones de saisie supplémentaires (petit titre + texte) — sections officielles ET libres ──

function ZonesSupplementairesBloc({
  zones,
  lectureSeule,
  onAjouter,
  onModifier,
  onRetirer,
}: {
  zones: ZoneSupplementaire[];
  lectureSeule: boolean;
  onAjouter: () => void;
  onModifier: (id: string, champ: "titre" | "texte", valeur: string) => void;
  onRetirer: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {zones.map((z) => (
        <div key={z.id} className="space-y-2 rounded-xl border border-cream-200 bg-cream-50/40 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={z.titre}
              maxLength={MAX_TITRE_ZONE}
              disabled={lectureSeule}
              placeholder="Titre de la zone (facultatif)"
              aria-label="Titre de la zone"
              onChange={(e) => onModifier(z.id, "titre", e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
            />
            {!lectureSeule && (
              <BoutonRetrait2Clics
                libelle="Supprimer la zone"
                confirmation="Supprimer la zone ?"
                onConfirmer={() => onRetirer(z.id)}
              />
            )}
          </div>
          <textarea
            value={z.texte}
            rows={3}
            maxLength={MAX_TEXTE_RAPPORT}
            disabled={lectureSeule}
            placeholder="Texte de la zone…"
            aria-label="Texte de la zone"
            onChange={(e) => onModifier(z.id, "texte", e.target.value)}
            className={textareaCls}
          />
        </div>
      ))}
      {!lectureSeule && (
        <button
          type="button"
          onClick={onAjouter}
          disabled={zones.length >= MAX_ZONES_PAR_SECTION}
          className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50"
        >
          <Plus size={13} /> Ajouter une zone de saisie
        </button>
      )}
    </div>
  );
}

// ── Accordéon EXCLUSIF : contenu TOUJOURS monté (masqué en CSS) pour que tout soit soumis ──

function SectionAccordeon({
  titre,
  ouverte,
  onToggle,
  actions,
  children,
}: {
  titre: string;
  ouverte: boolean;
  onToggle: () => void;
  /** Boutons d'en-tête (ex. retrait de la section) — rendus HORS du bouton d'accordéon. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouverte}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
        >
          <h3 className="font-display text-base font-bold uppercase tracking-wide text-forest-900">{titre}</h3>
          <ChevronDown
            size={18}
            className={`shrink-0 text-ink-700/45 transition-transform ${ouverte ? "rotate-180" : ""}`}
          />
        </button>
        {actions}
      </div>
      {/* Contenu TOUJOURS monté (masqué si replié) : les champs restent soumis avec le formulaire. */}
      <div className={ouverte ? "mt-4 space-y-4" : "hidden"}>{children}</div>
    </Card>
  );
}

// ── Section LIBRE : titre éditable dans l'en-tête + zones de saisie propres ──

function SectionLibreCard({
  section,
  ouverte,
  onToggle,
  lectureSeule,
  onTitre,
  onSupprimer,
  onAjouterZone,
  onModifierZone,
  onRetirerZone,
}: {
  section: SectionLibre;
  ouverte: boolean;
  onToggle: () => void;
  lectureSeule: boolean;
  onTitre: (valeur: string) => void;
  onSupprimer: () => void;
  onAjouterZone: () => void;
  onModifierZone: (zoneId: string, champ: "titre" | "texte", valeur: string) => void;
  onRetirerZone: (zoneId: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouverte}
          aria-label={`${ouverte ? "Replier" : "Déplier"} la section ${section.titre || "sans titre"}`}
          className="shrink-0 rounded-full p-1 text-ink-700/45 transition-colors hover:bg-cream-100"
        >
          <ChevronDown size={18} className={`transition-transform ${ouverte ? "rotate-180" : ""}`} />
        </button>
        {/* Titre ÉDITABLE de la section libre (champ dans l'en-tête de l'accordéon). */}
        <input
          type="text"
          value={section.titre}
          maxLength={MAX_TITRE_ZONE}
          disabled={lectureSeule}
          placeholder="Titre de la section"
          aria-label="Titre de la section"
          onChange={(e) => onTitre(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-base font-bold uppercase tracking-wide text-forest-900 outline-none placeholder:font-normal placeholder:normal-case placeholder:text-ink-700/40 focus:border-cream-300 focus:bg-white disabled:text-forest-900"
        />
        {!lectureSeule && (
          <BoutonRetrait2Clics
            libelle="Supprimer la section"
            confirmation={`Supprimer la section et ses ${section.zones.length} zone(s) ?`}
            onConfirmer={onSupprimer}
          />
        )}
      </div>
      {/* Contenu TOUJOURS monté (masqué si replié) : même accordéon exclusif que les officielles. */}
      <div className={ouverte ? "mt-4 space-y-4" : "hidden"}>
        <ZonesSupplementairesBloc
          zones={section.zones}
          lectureSeule={lectureSeule}
          onAjouter={onAjouterZone}
          onModifier={onModifierZone}
          onRetirer={onRetirerZone}
        />
      </div>
    </Card>
  );
}

// ── Tableau éditable (lignes de cellules texte, ajout/retrait de ligne sans dialogue natif) ──

function TableauEditable({
  titre,
  colonnes,
  lignes,
  lectureSeule,
  onCellule,
  onAjouter,
  onRetirer,
}: {
  titre?: string;
  colonnes: readonly string[];
  lignes: string[][];
  lectureSeule: boolean;
  onCellule: (ligne: number, colonne: number, valeur: string) => void;
  onAjouter: () => void;
  onRetirer: (ligne: number) => void;
}) {
  return (
    <div>
      {titre && <p className="mb-2 text-sm font-bold text-forest-900">{titre}</p>}
      <div className="overflow-x-auto rounded-xl border border-cream-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/70 text-left text-[11px] text-ink-700/70">
              {colonnes.map((c) => (
                <th key={c} className="px-2 py-2 align-bottom font-semibold">
                  {c}
                </th>
              ))}
              {!lectureSeule && (
                <th className="w-8 px-1 py-2">
                  <span className="sr-only">Retirer</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, li) => (
              <tr key={li} className="border-b border-cream-100 align-top last:border-0">
                {ligne.map((cellule, ci) => (
                  <td key={ci} className="p-1">
                    <input
                      type="text"
                      value={cellule}
                      maxLength={MAX_CELLULE_RAPPORT}
                      disabled={lectureSeule}
                      aria-label={`${colonnes[ci]} — ligne ${li + 1}`}
                      onChange={(e) => onCellule(li, ci, e.target.value)}
                      className={`${ci === 0 ? "min-w-48" : "min-w-20"} w-full rounded-md border border-cream-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-200 disabled:border-transparent disabled:bg-transparent disabled:text-ink-800`}
                    />
                  </td>
                ))}
                {!lectureSeule && (
                  <td className="p-1 pt-2 text-center">
                    {/* Retrait DIRECT de la ligne (aucun dialogue natif — bloqué en aperçu). */}
                    <button
                      type="button"
                      onClick={() => onRetirer(li)}
                      aria-label={`Retirer la ligne ${li + 1}`}
                      className="rounded-full p-1 text-ink-700/40 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!lectureSeule && (
        <button
          type="button"
          onClick={onAjouter}
          disabled={lignes.length >= MAX_LIGNES_TABLEAU}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50"
        >
          <Plus size={13} /> Ajouter une ligne
        </button>
      )}
    </div>
  );
}

// ── Diagrammes Recharts (EN LIGNE uniquement — absents du document Word) ──

const axisStyle = { fontSize: 11, fill: "#2b3a33" };
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e9dcbe",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(15,53,39,0.08)",
};

/** Tronque les libellés trop longs sur l'axe (le libellé complet reste au survol). */
function courtNom(nom: string): string {
  return nom.length > 30 ? `${nom.slice(0, 29)}…` : nom;
}

function ChartPrevuRealise({ data }: { data: { nom: string; prevues: number; realisees: number }[] }) {
  const hauteur = Math.max(180, data.length * 44 + 60);
  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" horizontal={false} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="nom"
          width={196}
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          tickFormatter={courtNom}
          interval={0}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="prevues" name="Prévue" fill="#9cc5ab" radius={[0, 4, 4, 0]} maxBarSize={12} />
        <Bar dataKey="realisees" name="Réalisés" fill="#34855c" radius={[0, 4, 4, 0]} maxBarSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartTauxExecution({ data }: { data: { nom: string; taux: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="nom" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} tickFormatter={courtNom} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit=" %" allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar dataKey="taux" name="Taux d'exécution (%)" fill="#34855c" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function NoteDiagramme({ texte }: { texte: string }) {
  return <p className="text-xs text-ink-700/55">{texte}</p>;
}

// ── Formulaire complet du rapport bilan CRD ──

/** Valeurs initiales (rapport enregistré, sinon contenu pré-rempli côté serveur). */
export interface RapportCrdInitial {
  titre: string;
  contenu: ContenuRapport;
}

/** Libellés du panneau « En-tête du document » (6 mentions configurables). */
const CHAMPS_ENTETE: { cle: keyof EnteteRapport; libelle: string }[] = [
  { cle: "ministere", libelle: "Ministère" },
  { cle: "republique", libelle: "État (forme officielle)" },
  { cle: "directionRegionale", libelle: "Direction régionale" },
  { cle: "devise", libelle: "Devise nationale" },
  { cle: "antenne", libelle: "Antenne" },
  { cle: "coordination", libelle: "Coordination disciplinaire" },
];

export function RapportCrdForm({
  apfcId,
  discipline,
  initiale,
  enteteInitiale,
  enteteDefaut,
  modele,
  lectureSeule,
  faitA,
  dateDuJour,
}: {
  apfcId: string;
  discipline: string;
  initiale: RapportCrdInitial;
  /** En-tête EFFECTIF au chargement (mentions enregistrées complétées par les défauts). */
  enteteInitiale: EnteteRapport;
  /** Défauts calculés côté serveur (pays + antenne) — cible du bouton « Réinitialiser ». */
  enteteDefaut: EnteteRapport;
  /** MODÈLE personnel de l'utilisateur (null si aucun) — bouton « Appliquer mon modèle ». */
  modele: StructureModele | null;
  /** Vrai si l'utilisateur ne peut pas enregistrer (drena, inspecteur, aperçu…) : tout est figé. */
  lectureSeule: boolean;
  /** Localité de l'antenne pour « Fait à …, le … » (repli sur la région). */
  faitA: string;
  dateDuJour: string;
}) {
  const [etat, action] = useActionState(enregistrerRapportDisciplinaire, initial);
  // Enregistrement du MODÈLE personnel : second état de formulaire, soumis par le bouton
  // « Enregistrer comme mon modèle » (attribut formAction — mêmes champs, autre action).
  const [etatModele, actionModele] = useActionState(enregistrerModeleRapport, initial);
  // Accordéons EXCLUSIFS (en-tête, sections officielles ET libres) : une seule section dépliée
  // à la fois ; les contenus repliés OU retirés restent MONTÉS (masqués en CSS) pour que tout
  // le formulaire soit soumis — les données des sections retirées sont ainsi CONSERVÉES.
  const [ouverte, setOuverte] = useState<string | null>("membres");
  const basculer = (id: string) => setOuverte((o) => (o === id ? null : id));

  // Tableaux éditables (état contrôlé : alimente les cellules, les diagrammes ET la soumission).
  const [tables, setTables] = useState<Record<CleTableau, string[][]>>(() => ({
    activitesPrimaire: initiale.contenu.activitesPrimaire,
    activitesSecondaire: initiale.contenu.activitesSecondaire,
    activitesComplement: initiale.contenu.activitesComplement,
    programmesCafop: initiale.contenu.programmesCafop,
    programmesPremierCycle: initiale.contenu.programmesPremierCycle,
    programmesSecondCycle: initiale.contenu.programmesSecondCycle,
  }));

  // Titre (bloc violet) contrôlé — nécessaire pour « Appliquer mon modèle » (titre type).
  const [titre, setTitre] = useState(initiale.titre);
  // En-tête configurable (6 mentions) + configuration libre des sections.
  const [entete, setEntete] = useState<EnteteRapport>(enteteInitiale);
  const [masquees, setMasquees] = useState<IdSectionOfficielle[]>(initiale.contenu.sectionsMasquees);
  const [zonesSupp, setZonesSupp] = useState<Partial<Record<IdSectionOfficielle, ZoneSupplementaire[]>>>(
    initiale.contenu.zonesSupplementaires,
  );
  const [sectionsLibres, setSectionsLibres] = useState<SectionLibre[]>(initiale.contenu.sectionsLibres);

  function modifierCellule(cle: CleTableau, ligne: number, colonne: number, valeur: string) {
    setTables((prev) => ({
      ...prev,
      [cle]: prev[cle].map((l, li) => (li === ligne ? l.map((c, ci) => (ci === colonne ? valeur : c)) : l)),
    }));
  }
  function ajouterLigne(cle: CleTableau, nbColonnes: number) {
    setTables((prev) =>
      prev[cle].length >= MAX_LIGNES_TABLEAU ? prev : { ...prev, [cle]: [...prev[cle], ligneVide(nbColonnes)] },
    );
  }
  function retirerLigne(cle: CleTableau, ligne: number) {
    setTables((prev) => ({ ...prev, [cle]: prev[cle].filter((_, li) => li !== ligne) }));
  }
  const propsTableau = (cle: CleTableau, colonnes: readonly string[]) => ({
    colonnes,
    lignes: tables[cle],
    lectureSeule,
    onCellule: (l: number, c: number, v: string) => modifierCellule(cle, l, c, v),
    onAjouter: () => ajouterLigne(cle, colonnes.length),
    onRetirer: (l: number) => retirerLigne(cle, l),
  });

  // ── Configuration libre : zones des sections officielles ──
  function ajouterZoneOfficielle(section: IdSectionOfficielle) {
    setZonesSupp((prev) => {
      const zones = prev[section] ?? [];
      if (zones.length >= MAX_ZONES_PAR_SECTION) return prev;
      return { ...prev, [section]: [...zones, { id: nouvelId(), titre: "", texte: "" }] };
    });
  }
  function modifierZoneOfficielle(section: IdSectionOfficielle, id: string, champ: "titre" | "texte", valeur: string) {
    setZonesSupp((prev) => ({
      ...prev,
      [section]: (prev[section] ?? []).map((z) => (z.id === id ? { ...z, [champ]: valeur } : z)),
    }));
  }
  function retirerZoneOfficielle(section: IdSectionOfficielle, id: string) {
    setZonesSupp((prev) => ({ ...prev, [section]: (prev[section] ?? []).filter((z) => z.id !== id) }));
  }

  // ── Configuration libre : retrait/rétablissement des sections officielles ──
  function retirerSection(section: IdSectionOfficielle) {
    setMasquees((prev) => (prev.includes(section) ? prev : [...prev, section]));
    setOuverte((o) => (o === section ? null : o));
  }
  function retablirSection(section: IdSectionOfficielle) {
    setMasquees((prev) => prev.filter((s) => s !== section));
  }

  // ── Configuration libre : sections à titre libre ──
  function ajouterSectionLibre() {
    if (sectionsLibres.length >= MAX_SECTIONS_LIBRES) return;
    const id = nouvelId();
    // Au moins UNE zone de saisie à la création.
    setSectionsLibres((prev) => [...prev, { id, titre: "", zones: [{ id: nouvelId(), titre: "", texte: "" }] }]);
    setOuverte(`libre-${id}`);
  }
  function modifierSectionLibre(id: string, maj: (s: SectionLibre) => SectionLibre) {
    setSectionsLibres((prev) => prev.map((s) => (s.id === id ? maj(s) : s)));
  }
  function supprimerSectionLibre(id: string) {
    setSectionsLibres((prev) => prev.filter((s) => s.id !== id));
    setOuverte((o) => (o === `libre-${id}` ? null : o));
  }

  /**
   * Applique le MODÈLE personnel à l'état du formulaire, CÔTÉ CLIENT uniquement (rien n'est
   * écrit en base tant que l'utilisateur n'enregistre pas) : structure du modèle (sections
   * retirées, sections libres, zones types), mentions d'en-tête non vides et titre type —
   * SANS toucher aux tableaux chiffrés, membres, introduction, analyse ni conclusion saisis.
   */
  function appliquerModele() {
    if (!modele) return;
    setMasquees(modele.sectionsMasquees);
    setZonesSupp(modele.zonesSupplementaires);
    setSectionsLibres(modele.sectionsLibres);
    setEntete((prev) => completerEntete(modele.entete, prev));
    if (modele.titre.trim()) setTitre(modele.titre);
  }

  /** Bouton « retirer » d'une section officielle (masqué en lecture seule). */
  const actionsSection = (id: IdSectionOfficielle) =>
    lectureSeule ? undefined : (
      <BoutonRetrait2Clics
        libelle="Retirer la section"
        confirmation="Retirer la section ?"
        onConfirmer={() => retirerSection(id)}
      />
    );

  /** Zones supplémentaires d'une section officielle (pied d'accordéon). */
  const zonesSection = (id: IdSectionOfficielle) => (
    <ZonesSupplementairesBloc
      zones={zonesSupp[id] ?? []}
      lectureSeule={lectureSeule}
      onAjouter={() => ajouterZoneOfficielle(id)}
      onModifier={(zoneId, champ, valeur) => modifierZoneOfficielle(id, zoneId, champ, valeur)}
      onRetirer={(zoneId) => retirerZoneOfficielle(id, zoneId)}
    />
  );

  // Diagramme I : « Prévue vs Réalisés » par activité (lignes des tableaux I-1 et I-2).
  const dataPrevuRealise = useMemo(
    () =>
      [...tables.activitesPrimaire, ...tables.activitesSecondaire].flatMap((l) => {
        const nom = (l[0] ?? "").trim();
        const prevues = nombreDeCellule(l[1] ?? "");
        const realisees = nombreDeCellule(l[2] ?? "");
        if (!nom || (prevues == null && realisees == null)) return [];
        return [{ nom, prevues: prevues ?? 0, realisees: realisees ?? 0 }];
      }),
    [tables.activitesPrimaire, tables.activitesSecondaire],
  );

  // Diagramme II : taux d'exécution par niveau (CAFOP + premier/second cycle).
  const dataTaux = useMemo(
    () =>
      [
        ...tables.programmesCafop.map((l) => ({
          nom: (l[0] ?? "").trim() ? `CAFOP — ${(l[0] ?? "").trim()}` : "",
          taux: nombreDeCellule(l[4] ?? ""),
        })),
        ...tables.programmesPremierCycle.map((l) => ({ nom: (l[0] ?? "").trim(), taux: nombreDeCellule(l[5] ?? "") })),
        ...tables.programmesSecondCycle.map((l) => ({ nom: (l[0] ?? "").trim(), taux: nombreDeCellule(l[5] ?? "") })),
      ].flatMap((x) => (x.nom && x.taux != null ? [{ nom: x.nom, taux: x.taux }] : [])),
    [tables.programmesCafop, tables.programmesPremierCycle, tables.programmesSecondCycle],
  );

  const estMasquee = (id: IdSectionOfficielle) => masquees.includes(id);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="apfcId" value={apfcId} />
      <input type="hidden" name="discipline" value={discipline} />
      {/* Tableaux soumis en JSON (validés STRICTEMENT côté serveur : structure, bornes, 40 lignes max). */}
      {CLES_TABLEAUX.map((cle) => (
        <input key={cle} type="hidden" name={cle} value={JSON.stringify(tables[cle])} />
      ))}
      {/* Configuration libre soumise en JSON (lecteurs tolérants et bornés côté serveur). */}
      <input type="hidden" name="sectionsMasquees" value={JSON.stringify(masquees)} />
      <input type="hidden" name="zonesSupplementaires" value={JSON.stringify(zonesSupp)} />
      <input type="hidden" name="sectionsLibres" value={JSON.stringify(sectionsLibres)} />

      {lectureSeule && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
          <Eye size={17} className="mt-0.5 shrink-0" />
          <span>
            Lecture seule — vous consultez ce rapport sans pouvoir le modifier (seuls
            l&apos;administrateur, le superviseur international, l&apos;Admin APFC ou le Chef
            d&apos;antenne de cette antenne peuvent l&apos;enregistrer).
          </span>
        </div>
      )}

      {etat.message && <FormAlert ton={etat.ok ? "succes" : "erreur"}>{etat.message}</FormAlert>}
      {etatModele.message && <FormAlert ton={etatModele.ok ? "succes" : "erreur"}>{etatModele.message}</FormAlert>}

      {/* Barre du MODÈLE personnel : appliquer / enregistrer sa configuration comme modèle. */}
      {!lectureSeule && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5">
          <p className="text-xs text-ink-700/60">
            Votre modèle s&apos;applique automatiquement aux nouveaux rapports.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {modele && (
              <BoutonTexte2Clics
                libelle="Appliquer mon modèle"
                confirmation="Appliquer le modèle ?"
                onConfirmer={appliquerModele}
                icone={<Wand2 size={13} />}
              />
            )}
            {/* Soumission vers l'action MODÈLE (formAction) : mêmes champs, autre traitement. */}
            <button
              type="submit"
              formAction={actionModele}
              className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
            >
              <BookmarkPlus size={13} /> Enregistrer comme mon modèle
            </button>
          </div>
        </div>
      )}

      {/* Bloc TITRE violet du modèle officiel — le titre saisi est reproduit dans le Word. */}
      <div className="rounded-lg border-[3px] border-[#3f3358] bg-[#7c6a9c] px-4 py-4">
        <label htmlFor="titre-rapport-crd" className="sr-only">
          Titre du rapport
        </label>
        <input
          id="titre-rapport-crd"
          type="text"
          name="titre"
          maxLength={MAX_TITRE_RAPPORT}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          disabled={lectureSeule}
          placeholder="RAPPORT BILAN DES ACTIVITES DU PREMIER TRIMESTRE 2025 - 2026"
          className="w-full bg-transparent text-center font-display text-lg font-bold uppercase tracking-wide text-black outline-none placeholder:normal-case placeholder:text-black/45"
        />
      </div>

      {/* Bandeau discret des sections officielles retirées (données conservées) + Rétablir. */}
      {masquees.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5 text-xs text-ink-700/70">
          <span className="font-semibold text-forest-900">Sections retirées :</span>
          {masquees.map((id) => (
            <span key={id} className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-white px-2.5 py-1">
              <span className="max-w-56 truncate">{titreSectionOfficielle(id)}</span>
              {!lectureSeule && (
                <button
                  type="button"
                  onClick={() => retablirSection(id)}
                  className="inline-flex items-center gap-1 font-semibold text-forest-700 hover:underline"
                >
                  <Undo2 size={12} /> Rétablir
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* 0. En-tête du document — 6 mentions configurables (vide = défaut pays/antenne). */}
      <SectionAccordeon
        titre="En-tête du document"
        ouverte={ouverte === "entete"}
        onToggle={() => basculer("entete")}
      >
        <p className="text-xs text-ink-700/60">
          Mentions officielles de l&apos;en-tête (reproduites en ligne et dans le Word). Une mention
          vidée retombe sur la valeur par défaut du pays et de l&apos;antenne — les armoiries restent
          celles du pays.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHAMPS_ENTETE.map((champ) => (
            <div key={champ.cle}>
              <label className="mb-1.5 block text-sm font-medium text-forest-900">{champ.libelle}</label>
              <input
                type="text"
                name={`entete-${champ.cle}`}
                value={entete[champ.cle]}
                maxLength={MAX_TITRE_ZONE}
                disabled={lectureSeule}
                placeholder={enteteDefaut[champ.cle] || "—"}
                onChange={(e) => setEntete((prev) => ({ ...prev, [champ.cle]: e.target.value }))}
                className={inputCls}
              />
            </div>
          ))}
        </div>
        {!lectureSeule && (
          <BoutonTexte2Clics
            libelle="Réinitialiser l'en-tête"
            confirmation="Confirmer la réinitialisation"
            onConfirmer={() => setEntete(enteteDefaut)}
          />
        )}
      </SectionAccordeon>

      {/* 1. Membres de la CRD — comme toute section retirée, le bloc reste MONTÉ (masqué en
          CSS) pour que ses champs soient toujours soumis et ses données conservées. */}
      <div className={estMasquee("membres") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionOfficielle("membres")}
          ouverte={ouverte === "membres"}
          onToggle={() => basculer("membres")}
          actions={actionsSection("membres")}
        >
          <p className="text-xs text-ink-700/60">
            Encadreurs de la discipline (pré-remplis depuis le personnel de l&apos;antenne et les
            conseillers pédagogiques rattachés) — un membre par ligne, liste librement modifiable.
          </p>
          <textarea
            name="membres"
            rows={6}
            maxLength={MAX_TEXTE_RAPPORT}
            defaultValue={initiale.contenu.membres}
            disabled={lectureSeule}
            placeholder={"NOM Prénoms — fonction\nNOM Prénoms — fonction"}
            className={textareaCls}
          />
          {zonesSection("membres")}
        </SectionAccordeon>
      </div>

      {/* 2. Introduction */}
      <div className={estMasquee("introduction") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionOfficielle("introduction")}
          ouverte={ouverte === "introduction"}
          onToggle={() => basculer("introduction")}
          actions={actionsSection("introduction")}
        >
          <textarea
            name="introduction"
            rows={6}
            maxLength={MAX_TEXTE_RAPPORT}
            defaultValue={initiale.contenu.introduction}
            disabled={lectureSeule}
            placeholder="Présentation de la coordination, de la période et du plan du rapport…"
            className={textareaCls}
          />
          {zonesSection("introduction")}
        </SectionAccordeon>
      </div>

      {/* 3. I – Bilan des activités menées */}
      <div className={estMasquee("bilan") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionOfficielle("bilan")}
          ouverte={ouverte === "bilan"}
          onToggle={() => basculer("bilan")}
          actions={actionsSection("bilan")}
        >
          <TableauEditable titre="I-1. PRIMAIRE/CAFOP" {...propsTableau("activitesPrimaire", COLONNES_ACTIVITES)} />
          <TableauEditable titre="I-2. SECONDAIRE" {...propsTableau("activitesSecondaire", COLONNES_ACTIVITES)} />
          <TableauEditable
            titre="Autres activités (objet, prévisions et réalisations)"
            {...propsTableau("activitesComplement", COLONNES_ACTIVITES_COMPLEMENT)}
          />
          <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-3.5">
            <p className="mb-2 text-[13px] font-semibold text-forest-900">Diagramme — Prévue vs Réalisés par activité</p>
            {dataPrevuRealise.length > 0 ? (
              <ChartPrevuRealise data={dataPrevuRealise} />
            ) : (
              <NoteDiagramme texte="Renseignez des valeurs numériques dans les colonnes « Prévue » et « Réalisés » pour afficher le diagramme." />
            )}
          </div>
          {zonesSection("bilan")}
        </SectionAccordeon>
      </div>

      {/* 4. II – État d'exécution des programmes */}
      <div className={estMasquee("programmes") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionOfficielle("programmes")}
          ouverte={ouverte === "programmes"}
          onToggle={() => basculer("programmes")}
          actions={actionsSection("programmes")}
        >
          <TableauEditable titre="CAFOP" {...propsTableau("programmesCafop", COLONNES_PROGRAMMES_CAFOP)} />
          <TableauEditable
            titre="Secondaire (premier cycle)"
            {...propsTableau("programmesPremierCycle", COLONNES_PROGRAMMES_SECONDAIRE)}
          />
          <TableauEditable
            titre="Secondaire (Second cycle)"
            {...propsTableau("programmesSecondCycle", COLONNES_PROGRAMMES_SECONDAIRE)}
          />
          <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-3.5">
            <p className="mb-2 text-[13px] font-semibold text-forest-900">Diagramme — Taux d&apos;exécution par niveau</p>
            {dataTaux.length > 0 ? (
              <ChartTauxExecution data={dataTaux} />
            ) : (
              <NoteDiagramme texte="Renseignez les colonnes de taux d'exécution (en %) pour afficher le diagramme." />
            )}
          </div>
          {zonesSection("programmes")}
        </SectionAccordeon>
      </div>

      {/* 5. III – Analyse des activités menées */}
      <div className={estMasquee("analyse") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionOfficielle("analyse")}
          ouverte={ouverte === "analyse"}
          onToggle={() => basculer("analyse")}
          actions={actionsSection("analyse")}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                { nom: "analyse-satisfactions", libelle: "POINTS DE SATISFACTION", valeur: initiale.contenu.analyse.satisfactions },
                { nom: "analyse-insuffisances", libelle: "INSUFFISANCES RELEVEES", valeur: initiale.contenu.analyse.insuffisances },
                { nom: "analyse-solutions", libelle: "SOLUTIONS PROPOSEES", valeur: initiale.contenu.analyse.solutions },
              ] as const
            ).map((colonne) => (
              <div key={colonne.nom}>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-forest-900">
                  {colonne.libelle}
                </label>
                <textarea
                  name={colonne.nom}
                  rows={10}
                  maxLength={MAX_TEXTE_RAPPORT}
                  defaultValue={colonne.valeur}
                  disabled={lectureSeule}
                  className={textareaCls}
                />
              </div>
            ))}
          </div>
          {zonesSection("analyse")}
        </SectionAccordeon>
      </div>

      {/* 6. Conclusion + bloc signature */}
      <div className={estMasquee("conclusion") ? "hidden" : undefined}>
        <SectionAccordeon
          titre={titreSectionOfficielle("conclusion")}
          ouverte={ouverte === "conclusion"}
          onToggle={() => basculer("conclusion")}
          actions={actionsSection("conclusion")}
        >
          <textarea
            name="conclusion"
            rows={5}
            maxLength={MAX_TEXTE_RAPPORT}
            defaultValue={initiale.contenu.conclusion}
            disabled={lectureSeule}
            placeholder="Bilan général de la période et perspectives…"
            className={textareaCls}
          />
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 text-center text-sm">
              <p className="text-ink-800">
                Fait à <span className="font-semibold">{faitA || "…"}</span>, le{" "}
                <span className="font-semibold">{dateDuJour}</span>
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-forest-900">
                Le Coordinateur Régional Disciplinaire
              </p>
              <label htmlFor="coordinateur-crd" className="sr-only">
                Nom du coordinateur
              </label>
              <input
                id="coordinateur-crd"
                type="text"
                name="coordinateur"
                maxLength={MAX_TITRE_RAPPORT}
                defaultValue={initiale.contenu.coordinateur}
                disabled={lectureSeule}
                placeholder="Nom du coordinateur"
                className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-center text-sm font-semibold outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
              />
            </div>
          </div>
          {zonesSection("conclusion")}
        </SectionAccordeon>
      </div>

      {/* Sections LIBRES (titres ajoutés), rendues après les sections officielles. */}
      {sectionsLibres.map((s) => (
        <SectionLibreCard
          key={s.id}
          section={s}
          ouverte={ouverte === `libre-${s.id}`}
          onToggle={() => basculer(`libre-${s.id}`)}
          lectureSeule={lectureSeule}
          onTitre={(valeur) => modifierSectionLibre(s.id, (sec) => ({ ...sec, titre: valeur }))}
          onSupprimer={() => supprimerSectionLibre(s.id)}
          onAjouterZone={() =>
            modifierSectionLibre(s.id, (sec) =>
              sec.zones.length >= MAX_ZONES_PAR_SECTION
                ? sec
                : { ...sec, zones: [...sec.zones, { id: nouvelId(), titre: "", texte: "" }] },
            )
          }
          onModifierZone={(zoneId, champ, valeur) =>
            modifierSectionLibre(s.id, (sec) => ({
              ...sec,
              zones: sec.zones.map((z) => (z.id === zoneId ? { ...z, [champ]: valeur } : z)),
            }))
          }
          onRetirerZone={(zoneId) =>
            modifierSectionLibre(s.id, (sec) => ({ ...sec, zones: sec.zones.filter((z) => z.id !== zoneId) }))
          }
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!lectureSeule ? (
          <button
            type="button"
            onClick={ajouterSectionLibre}
            disabled={sectionsLibres.length >= MAX_SECTIONS_LIBRES}
            className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-4 py-1.5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50"
          >
            <Plus size={15} /> Ajouter un titre (section)
          </button>
        ) : (
          <span />
        )}
        {!lectureSeule && (
          <SubmitButton className="w-auto px-8">
            <Save size={15} /> Enregistrer le rapport
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
