"use client";

import { useActionState, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Eye, Plus, Save, X } from "lucide-react";
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
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  ligneVide,
  nombreDeCellule,
  type CleTableau,
  type ContenuRapport,
} from "@/lib/inspection/rapport-disciplinaire";
import { enregistrerRapportDisciplinaire } from "./actions";
import type { EtatForm } from "../visites/actions";

const initial: EtatForm = { ok: false };

const textareaCls =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70";

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
        {/* Disciplines du personnel de l'antenne + des enseignants couverts — saisie libre possible. */}
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

// ── Accordéon EXCLUSIF : contenu TOUJOURS monté (masqué en CSS) pour que tout soit soumis ──

function SectionAccordeon({
  titre,
  ouverte,
  onToggle,
  children,
}: {
  titre: string;
  ouverte: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ouverte}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-forest-900">{titre}</h3>
        <ChevronDown
          size={18}
          className={`shrink-0 text-ink-700/45 transition-transform ${ouverte ? "rotate-180" : ""}`}
        />
      </button>
      {/* Contenu TOUJOURS monté (masqué si replié) : les champs restent soumis avec le formulaire. */}
      <div className={ouverte ? "mt-4 space-y-4" : "hidden"}>{children}</div>
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

export function RapportCrdForm({
  apfcId,
  discipline,
  initiale,
  lectureSeule,
  faitA,
  dateDuJour,
}: {
  apfcId: string;
  discipline: string;
  initiale: RapportCrdInitial;
  /** Vrai si l'utilisateur ne peut pas enregistrer (drena, inspecteur, aperçu…) : tout est figé. */
  lectureSeule: boolean;
  /** Localité de l'antenne pour « Fait à …, le … » (repli sur la région). */
  faitA: string;
  dateDuJour: string;
}) {
  const [etat, action] = useActionState(enregistrerRapportDisciplinaire, initial);
  // Accordéons EXCLUSIFS : une seule section dépliée à la fois (la première par défaut) ;
  // les contenus repliés restent MONTÉS (masqués en CSS) pour que tout le formulaire soit soumis.
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

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="apfcId" value={apfcId} />
      <input type="hidden" name="discipline" value={discipline} />
      {/* Tableaux soumis en JSON (validés STRICTEMENT côté serveur : structure, bornes, 40 lignes max). */}
      {CLES_TABLEAUX.map((cle) => (
        <input key={cle} type="hidden" name={cle} value={JSON.stringify(tables[cle])} />
      ))}

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
          defaultValue={initiale.titre}
          disabled={lectureSeule}
          placeholder="RAPPORT BILAN DES ACTIVITES DU PREMIER TRIMESTRE 2025 - 2026"
          className="w-full bg-transparent text-center font-display text-lg font-bold uppercase tracking-wide text-black outline-none placeholder:normal-case placeholder:text-black/45"
        />
      </div>

      {/* 1. Membres de la CRD */}
      <SectionAccordeon
        titre="Membres de la Coordination Régionale Disciplinaire"
        ouverte={ouverte === "membres"}
        onToggle={() => basculer("membres")}
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
      </SectionAccordeon>

      {/* 2. Introduction */}
      <SectionAccordeon titre="INTRODUCTION" ouverte={ouverte === "introduction"} onToggle={() => basculer("introduction")}>
        <textarea
          name="introduction"
          rows={6}
          maxLength={MAX_TEXTE_RAPPORT}
          defaultValue={initiale.contenu.introduction}
          disabled={lectureSeule}
          placeholder="Présentation de la coordination, de la période et du plan du rapport…"
          className={textareaCls}
        />
      </SectionAccordeon>

      {/* 3. I – Bilan des activités menées */}
      <SectionAccordeon
        titre="I – BILAN DES ACTIVITES MENEES"
        ouverte={ouverte === "bilan"}
        onToggle={() => basculer("bilan")}
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
      </SectionAccordeon>

      {/* 4. II – État d'exécution des programmes */}
      <SectionAccordeon
        titre="II – ETAT D'EXECUTION DES PROGRAMMES"
        ouverte={ouverte === "programmes"}
        onToggle={() => basculer("programmes")}
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
      </SectionAccordeon>

      {/* 5. III – Analyse des activités menées */}
      <SectionAccordeon
        titre="III – ANALYSE DES ACTIVITÉS MENÉES"
        ouverte={ouverte === "analyse"}
        onToggle={() => basculer("analyse")}
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
      </SectionAccordeon>

      {/* 6. Conclusion + bloc signature */}
      <SectionAccordeon titre="CONCLUSION" ouverte={ouverte === "conclusion"} onToggle={() => basculer("conclusion")}>
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
      </SectionAccordeon>

      {!lectureSeule && (
        <div className="flex justify-end">
          <SubmitButton className="w-auto px-8">
            <Save size={15} /> Enregistrer le rapport
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
