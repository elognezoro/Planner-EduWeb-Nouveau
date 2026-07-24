"use client";

import { useActionState, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookmarkPlus, Eye, ListOrdered, Plus, Save, Table2, Wand2, X } from "lucide-react";
import { SelectRecherche } from "@/components/app/select-recherche";
import { FormAlert, SubmitButton } from "@/components/ui/form";
import {
  BoutonRetrait2Clics,
  BoutonTexte2Clics,
  ChartPrevuRealise,
  NoteDiagramme,
  SectionAccordeon,
  inputCls,
  textareaCls,
} from "@/lib/inspection/composants-rapport";
import {
  MAX_CELLULE_RAPPORT,
  MAX_LIGNES_TABLEAU,
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_RAPPORT,
  MAX_TITRE_ZONE,
  completerEntete,
  nombreDeCellule,
  normaliserComparaison as norm,
  nouvelId,
  type EnteteRapport,
} from "@/lib/inspection/rapport-commun";
import {
  BLOCS_AUTO,
  GRAPHIQUES_AUTO,
  MAX_COLONNES_TABLEAU,
  MAX_GRAPHIQUES_PAR_SECTION,
  MAX_SECTIONS_PLAN,
  MAX_TABLEAUX_PAR_SECTION,
  TRIMESTRES,
  anneesScolairesProposees,
  estCleBlocAuto,
  estCleGraphique,
  libelleGraphique,
  periodeDepuis,
  sectionVide,
  sourceBlocAuto,
  sourceTableauDuGraphique,
  tableauManuelVide,
  titresNiveau1,
  trimestreCourant,
  trouverTableauParSource,
  type CleBlocAuto,
  type CleGraphique,
  type CodeTrimestre,
  type ContenuRapportAntenne,
  type NiveauTitre,
  type PeriodeAntenne,
  type SectionPlan,
  type StructureModeleAntenne,
  type TableauSection,
  type TypeRapportAntenne,
} from "@/lib/inspection/rapport-antenne";
import { enregistrerModeleRapportAntenne, enregistrerRapportAntenne } from "./actions";
import type { EtatForm } from "../visites/actions";

const initial: EtatForm = { ok: false };

// ── Bandeau de sélection : onglets + antenne + période (clé) + FENÊTRE de données Du/Au ──

export function FiltresRapportsAntenne({
  type,
  periode,
  fenetre,
  montrerApfc,
  apfcOptions,
  apfcDefaut,
  termeAntenne,
}: {
  type: TypeRapportAntenne;
  periode: PeriodeAntenne;
  /** Fenêtre EFFECTIVE des données (« YYYY-MM-DD » inclusifs), modifiable. */
  fenetre: { debutIso: string; finIso: string };
  montrerApfc: boolean;
  apfcOptions: { id: string; nom: string }[];
  apfcDefaut: { id: string; nom: string } | null;
  termeAntenne: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const annees = useMemo(() => anneesScolairesProposees().map((a) => ({ id: a, nom: a })), []);
  const trimestre = periode.trimestre ?? trimestreCourant();

  /** Navigation par searchParams — le composant serveur REVALIDE tout (fail-closed). */
  function naviguer(
    cible: TypeRapportAntenne,
    apfcId: string | null,
    annee: string,
    trim: CodeTrimestre,
    dates?: { debut: string; fin: string },
  ) {
    const params = new URLSearchParams();
    params.set("type", cible);
    if (apfcId) params.set("apfc", apfcId);
    params.set("periode", periodeDepuis(cible, annee, trim));
    if (dates) {
      params.set("debut", dates.debut);
      params.set("fin", dates.fin);
    }
    router.push(`${pathname}?${params.toString()}#rapports-antenne`);
  }

  return (
    <div className="space-y-4">
      {/* Onglets des deux rapports officiels. */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "trimestriel", libelle: "Rapport trimestriel" },
            { v: "annuel", libelle: "Rapport annuel" },
          ] as const
        ).map((onglet) => (
          <button
            key={onglet.v}
            type="button"
            onClick={() => naviguer(onglet.v, apfcDefaut?.id ?? null, periode.annee, trimestre)}
            aria-pressed={type === onglet.v}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              type === onglet.v
                ? "bg-forest-700 text-white"
                : "border border-cream-300 bg-white text-forest-800 hover:bg-forest-50"
            }`}
          >
            {onglet.libelle}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {montrerApfc && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Antenne ({termeAntenne})</label>
            <SelectRecherche
              key={apfcDefaut?.id ?? "aucune"}
              name="filtre-apfc-antenne"
              options={apfcOptions}
              defaut={apfcDefaut}
              placeholder="Choisir l'antenne…"
              effacable
              grand
              onSelect={(o) => {
                if (o) naviguer(type, o.id, periode.annee, trimestre);
              }}
            />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Année scolaire</label>
          <SelectRecherche
            key={`annee-${periode.annee}`}
            name="filtre-annee"
            options={annees}
            defaut={{ id: periode.annee, nom: periode.annee }}
            placeholder="Ex. 2025-2026"
            grand
            onSelect={(o) => {
              if (o) naviguer(type, apfcDefaut?.id ?? null, o.id, trimestre);
            }}
          />
        </div>
        {type === "trimestriel" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Trimestre</label>
            <SelectRecherche
              key={`trimestre-${trimestre}`}
              name="filtre-trimestre"
              options={TRIMESTRES.map((t) => ({ id: t.code, nom: t.libelle }))}
              defaut={{ id: trimestre, nom: TRIMESTRES.find((t) => t.code === trimestre)?.libelle ?? trimestre }}
              placeholder="Choisir le trimestre…"
              grand
              onSelect={(o) => {
                if (o && (o.id === "T1" || o.id === "T2" || o.id === "T3")) {
                  naviguer(type, apfcDefaut?.id ?? null, periode.annee, o.id);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* FENÊTRE des données : « Du … au … » pré-remplie par la période, MODIFIABLE. */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-3">
        <p className="w-full text-xs text-ink-700/60 sm:w-auto sm:flex-1">
          Période des données prises en compte par les tableaux et diagrammes automatiques.
        </p>
        <div>
          <label htmlFor="fenetre-debut" className="mb-1 block text-xs font-medium text-forest-900">
            Du
          </label>
          <input
            id="fenetre-debut"
            type="date"
            value={fenetre.debutIso}
            onChange={(e) => {
              if (e.target.value) {
                naviguer(type, apfcDefaut?.id ?? null, periode.annee, trimestre, {
                  debut: e.target.value,
                  fin: fenetre.finIso,
                });
              }
            }}
            className="h-9 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400"
          />
        </div>
        <div>
          <label htmlFor="fenetre-fin" className="mb-1 block text-xs font-medium text-forest-900">
            au
          </label>
          <input
            id="fenetre-fin"
            type="date"
            value={fenetre.finIso}
            onChange={(e) => {
              if (e.target.value) {
                naviguer(type, apfcDefaut?.id ?? null, periode.annee, trimestre, {
                  debut: fenetre.debutIso,
                  fin: e.target.value,
                });
              }
            }}
            className="h-9 rounded-lg border border-cream-300 bg-white px-2 text-sm outline-none focus:border-forest-400"
          />
        </div>
      </div>
    </div>
  );
}

/** « Recharger les données de la période » (2 clics) → ?regenerer=1 (rapport enregistré). */
export function BoutonRegenerer({ url }: { url: string }) {
  const router = useRouter();
  return (
    <BoutonTexte2Clics
      libelle="Recharger les données de la période"
      confirmation="Recalculer les tableaux automatiques ?"
      onConfirmer={() => router.push(url)}
    />
  );
}

// ── Tableau d'une section (auto ou manuel) : titre, colonnes et lignes éditables ──

function TableauSectionEditable({
  tableau,
  lectureSeule,
  onChange,
  onSupprimer,
}: {
  tableau: TableauSection;
  lectureSeule: boolean;
  onChange: (maj: (t: TableauSection) => TableauSection) => void;
  onSupprimer: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-cream-200 bg-cream-50/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={tableau.titre}
          maxLength={MAX_TITRE_ZONE}
          disabled={lectureSeule}
          placeholder="Titre du tableau"
          aria-label="Titre du tableau"
          onChange={(e) => onChange((t) => ({ ...t, titre: e.target.value }))}
          className="min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
        />
        {tableau.source && (
          <span
            title={sourceBlocAuto(tableau.source)}
            className="rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-semibold text-forest-800"
          >
            auto
          </span>
        )}
        {!lectureSeule && (
          <BoutonRetrait2Clics libelle="Supprimer le tableau" confirmation="Supprimer le tableau ?" onConfirmer={onSupprimer} />
        )}
      </div>
      {tableau.source && (
        <p className="text-[11px] text-ink-700/55">Source : {sourceBlocAuto(tableau.source)} — chiffres modifiables.</p>
      )}
      <div className="overflow-x-auto rounded-lg border border-cream-200 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-cream-200 bg-cream-50/70">
              {tableau.colonnes.map((c, ci) => (
                <th key={ci} className="px-1.5 py-1.5 text-left align-bottom">
                  <span className="flex items-center gap-1">
                    <input
                      type="text"
                      value={c}
                      maxLength={MAX_CELLULE_RAPPORT}
                      disabled={lectureSeule}
                      aria-label={`Colonne ${ci + 1}`}
                      onChange={(e) =>
                        onChange((t) => ({ ...t, colonnes: t.colonnes.map((x, i) => (i === ci ? e.target.value : x)) }))
                      }
                      className="min-w-20 w-full rounded-md border border-cream-200 bg-white px-1.5 py-1 text-[11px] font-semibold outline-none focus:border-forest-400 disabled:border-transparent disabled:bg-transparent"
                    />
                    {!lectureSeule && tableau.colonnes.length > 1 && (
                      <BoutonRetrait2Clics
                        libelle={`Supprimer la colonne ${c || ci + 1}`}
                        confirmation="Supprimer la colonne ?"
                        onConfirmer={() =>
                          onChange((t) => ({
                            ...t,
                            colonnes: t.colonnes.filter((_, i) => i !== ci),
                            lignes: t.lignes.map((l) => l.filter((_, i) => i !== ci)),
                          }))
                        }
                      />
                    )}
                  </span>
                </th>
              ))}
              {!lectureSeule && (
                <th className="w-8 px-1 py-1.5">
                  <span className="sr-only">Retirer la ligne</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tableau.lignes.map((ligne, li) => (
              <tr key={li} className="border-b border-cream-100 align-top last:border-0">
                {ligne.map((cellule, ci) => (
                  <td key={ci} className="p-1">
                    <input
                      type="text"
                      value={cellule}
                      maxLength={MAX_CELLULE_RAPPORT}
                      disabled={lectureSeule}
                      aria-label={`${tableau.colonnes[ci] ?? `Colonne ${ci + 1}`} — ligne ${li + 1}`}
                      onChange={(e) =>
                        onChange((t) => ({
                          ...t,
                          lignes: t.lignes.map((l, i) => (i === li ? l.map((x, j) => (j === ci ? e.target.value : x)) : l)),
                        }))
                      }
                      className="min-w-16 w-full rounded-md border border-cream-200 bg-white px-1.5 py-1.5 text-xs outline-none focus:border-forest-400 disabled:border-transparent disabled:bg-transparent"
                    />
                  </td>
                ))}
                {!lectureSeule && (
                  <td className="p-1 pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => onChange((t) => ({ ...t, lignes: t.lignes.filter((_, i) => i !== li) }))}
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onChange((t) =>
                t.lignes.length >= MAX_LIGNES_TABLEAU ? t : { ...t, lignes: [...t.lignes, t.colonnes.map(() => "")] },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
          >
            <Plus size={13} /> Ajouter une ligne
          </button>
          <button
            type="button"
            onClick={() =>
              onChange((t) =>
                t.colonnes.length >= MAX_COLONNES_TABLEAU
                  ? t
                  : { ...t, colonnes: [...t.colonnes, `Colonne ${t.colonnes.length + 1}`], lignes: t.lignes.map((l) => [...l, ""]) },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
          >
            <Plus size={13} /> Ajouter une colonne
          </button>
        </div>
      )}
    </div>
  );
}

// ── Diagramme d'une section (EN LIGNE uniquement — jamais dans le Word) ──

function GraphiqueSection({
  cle,
  sections,
  sectionId,
}: {
  cle: CleGraphique;
  sections: SectionPlan[];
  sectionId: string;
}) {
  const data = useMemo(() => {
    const source = sourceTableauDuGraphique(cle);
    if (source) {
      const t = trouverTableauParSource(sections, source, sectionId);
      if (!t) return [];
      return t.lignes.flatMap((l) => {
        const nom = (l[0] ?? "").trim();
        if (!nom || norm(nom) === "total") return [];
        const activites = nombreDeCellule(l[1] ?? "");
        const touches = nombreDeCellule(l[2] ?? "");
        if (activites == null && touches == null) return [];
        return [{ nom, prevues: activites ?? 0, realisees: touches ?? 0 }];
      });
    }
    const recapActivites = trouverTableauParSource(sections, "recap-activites", sectionId);
    const recapTouches = trouverTableauParSource(sections, "recap-touches", sectionId);
    if (!recapActivites && !recapTouches) return [];
    return ["Secondaire", "Primaire", "CAFOP"].flatMap((nom, i) => {
      const activites = nombreDeCellule(recapActivites?.lignes[0]?.[i] ?? "");
      const touches = nombreDeCellule(recapTouches?.lignes[0]?.[i] ?? "");
      if (activites == null && touches == null) return [];
      return [{ nom, prevues: activites ?? 0, realisees: touches ?? 0 }];
    });
  }, [cle, sections, sectionId]);

  return (
    <div className="rounded-2xl border border-cream-200 bg-cream-50/40 p-3.5">
      <p className="mb-2 text-[13px] font-semibold text-forest-900">{libelleGraphique(cle)}</p>
      {data.length > 0 ? (
        <ChartPrevuRealise data={data} nomPrevues="Activités" nomRealisees="Touchés" />
      ) : (
        <NoteDiagramme texte="Aucune donnée numérique à représenter (le tableau associé est vide ou absent)." />
      )}
    </div>
  );
}

// ── Éditeur d'une SECTION du plan (titre hiérarchisé + narratif + tableaux + diagrammes) ──

const STYLES_TITRE: Record<NiveauTitre, string> = {
  1: "font-display text-base font-bold uppercase tracking-wide text-forest-900",
  2: "text-sm font-bold text-forest-900",
  3: "text-sm font-semibold text-forest-800",
};

const NIVEAUX_OPTIONS: { v: NiveauTitre; l: string }[] = [
  { v: 1, l: "Titre" },
  { v: 2, l: "Sous-titre" },
  { v: 3, l: "Sous-sous-titre" },
];

function SectionEditeur({
  section,
  sections,
  lectureSeule,
  premiere,
  derniere,
  blocsAuto,
  onChange,
  onMonter,
  onDescendre,
  onSupprimer,
  onAjouterApres,
}: {
  section: SectionPlan;
  /** Plan complet (diagrammes et plan de présentation recalculés en direct). */
  sections: SectionPlan[];
  lectureSeule: boolean;
  premiere: boolean;
  derniere: boolean;
  /** Blocs AUTO chiffrés pour la fenêtre courante (insertion côté client AVEC les chiffres). */
  blocsAuto: Record<CleBlocAuto, TableauSection>;
  onChange: (maj: (s: SectionPlan) => SectionPlan) => void;
  onMonter: () => void;
  onDescendre: () => void;
  onSupprimer: () => void;
  onAjouterApres: () => void;
}) {
  const indentation =
    section.niveau === 2 ? "ml-3 border-l-2 border-cream-200 pl-3" : section.niveau === 3 ? "ml-6 border-l-2 border-cream-200 pl-3" : "";

  return (
    <div className={`space-y-3 ${indentation}`}>
      {/* Champ TITRE + niveau (Titre / Sous-titre / Sous-sous-titre) + Monter/Descendre/Supprimer. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={section.titre}
          maxLength={MAX_TITRE_ZONE}
          disabled={lectureSeule || section.planAuto}
          placeholder={NIVEAUX_OPTIONS.find((n) => n.v === section.niveau)?.l ?? "Titre"}
          aria-label="Titre de la section"
          onChange={(e) => onChange((s) => ({ ...s, titre: e.target.value }))}
          className={`min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 py-1.5 outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-200 disabled:border-transparent disabled:bg-transparent ${STYLES_TITRE[section.niveau]}`}
        />
        {!lectureSeule && (
          <>
            <label className="sr-only" htmlFor={`niveau-${section.id}`}>
              Niveau du titre
            </label>
            <select
              id={`niveau-${section.id}`}
              value={section.niveau}
              disabled={section.planAuto}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v === 1 || v === 2 || v === 3) onChange((s) => ({ ...s, niveau: v }));
              }}
              className="h-8 rounded-lg border border-cream-300 bg-white px-1.5 text-xs font-semibold text-forest-800 outline-none focus:border-forest-400"
            >
              {NIVEAUX_OPTIONS.map((n) => (
                <option key={n.v} value={n.v}>
                  {n.l}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onMonter}
              disabled={premiere}
              aria-label="Monter la section"
              title="Monter"
              className="rounded-full p-1.5 text-ink-700/50 transition-colors hover:bg-cream-100 disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={onDescendre}
              disabled={derniere}
              aria-label="Descendre la section"
              title="Descendre"
              className="rounded-full p-1.5 text-ink-700/50 transition-colors hover:bg-cream-100 disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
            <BoutonRetrait2Clics
              libelle="Supprimer la section"
              confirmation="Supprimer la section ?"
              onConfirmer={onSupprimer}
            />
          </>
        )}
      </div>

      {/* Contenu : « PLAN DE PRÉSENTATION » généré, sinon narratif éditable. */}
      {section.planAuto ? (
        <div className="rounded-xl border border-cream-200 bg-cream-50/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-700/55">
            <ListOrdered size={12} /> Généré automatiquement (titres de niveau 1 du plan) — présent dans le Word.
          </p>
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-800">
            {titresNiveau1(sections).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      ) : (
        <textarea
          value={section.texte}
          rows={section.texte.length > 400 ? 8 : 4}
          maxLength={MAX_TEXTE_RAPPORT}
          disabled={lectureSeule}
          placeholder="Narratif de la section…"
          aria-label={`Narratif — ${section.titre || "section"}`}
          onChange={(e) => onChange((s) => ({ ...s, texte: e.target.value }))}
          className={textareaCls}
        />
      )}

      {/* Tableaux de la section (auto avec chiffres, ou manuels). */}
      {section.tableaux.map((t) => (
        <TableauSectionEditable
          key={t.id}
          tableau={t}
          lectureSeule={lectureSeule}
          onChange={(maj) => onChange((s) => ({ ...s, tableaux: s.tableaux.map((x) => (x.id === t.id ? maj(x) : x)) }))}
          onSupprimer={() => onChange((s) => ({ ...s, tableaux: s.tableaux.filter((x) => x.id !== t.id) }))}
        />
      ))}

      {/* Diagrammes de la section. */}
      {section.graphiques.map((g) => (
        <div key={g} className="space-y-1">
          <GraphiqueSection cle={g} sections={sections} sectionId={section.id} />
          {!lectureSeule && (
            <div className="flex justify-end">
              <BoutonRetrait2Clics
                libelle="Supprimer le diagramme"
                confirmation="Supprimer le diagramme ?"
                onConfirmer={() => onChange((s) => ({ ...s, graphiques: s.graphiques.filter((x) => x !== g) }))}
              />
            </div>
          )}
        </div>
      ))}

      {/* Panneaux d'insertion : tableau AUTO (catalogue), tableau manuel, diagramme. */}
      {!lectureSeule && !section.planAuto && (
        <div className="flex flex-wrap items-center gap-2">
          <SelectRecherche
            key={`bloc-${section.id}-${section.tableaux.length}`}
            name={`insertion-bloc-${section.id}`}
            options={BLOCS_AUTO.map((b) => ({ id: b.cle, nom: b.libelle }))}
            placeholder="+ Insérer un tableau automatique…"
            className="w-72"
            onSelect={(o) => {
              if (!o || !estCleBlocAuto(o.id)) return;
              const bloc = blocsAuto[o.id];
              onChange((s) =>
                s.tableaux.length >= MAX_TABLEAUX_PAR_SECTION
                  ? s
                  : {
                      ...s,
                      tableaux: [
                        ...s.tableaux,
                        { ...bloc, id: nouvelId(), colonnes: [...bloc.colonnes], lignes: bloc.lignes.map((l) => [...l]) },
                      ],
                    },
              );
            }}
          />
          <button
            type="button"
            onClick={() =>
              onChange((s) =>
                s.tableaux.length >= MAX_TABLEAUX_PAR_SECTION ? s : { ...s, tableaux: [...s.tableaux, tableauManuelVide()] },
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50"
          >
            <Table2 size={13} /> Tableau manuel
          </button>
          <SelectRecherche
            key={`graphique-${section.id}-${section.graphiques.length}`}
            name={`insertion-graphique-${section.id}`}
            options={GRAPHIQUES_AUTO.map((g) => ({ id: g.cle, nom: g.libelle }))}
            placeholder="+ Insérer un diagramme…"
            className="w-72"
            onSelect={(o) => {
              if (!o) return;
              const cle = o.id;
              if (!estCleGraphique(cle)) return;
              onChange((s) =>
                s.graphiques.includes(cle) || s.graphiques.length >= MAX_GRAPHIQUES_PAR_SECTION
                  ? s
                  : { ...s, graphiques: [...s.graphiques, cle] },
              );
            }}
          />
        </div>
      )}

      {/* « + Ajouter un titre » APRÈS la section courante. */}
      {!lectureSeule && (
        <button
          type="button"
          onClick={onAjouterApres}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-ink-700/60 transition-colors hover:border-forest-300 hover:text-forest-800"
        >
          <Plus size={13} /> Ajouter un titre
        </button>
      )}
    </div>
  );
}

// ── Formulaire complet (plan hiérarchique v2) ──

export interface RapportAntenneInitial {
  titre: string;
  contenu: ContenuRapportAntenne;
}

const CHAMPS_ENTETE: { cle: keyof EnteteRapport; libelle: string }[] = [
  { cle: "ministere", libelle: "Ministère" },
  { cle: "republique", libelle: "État (forme officielle)" },
  { cle: "directionRegionale", libelle: "Direction régionale" },
  { cle: "devise", libelle: "Devise nationale" },
  { cle: "antenne", libelle: "Antenne" },
];

export function RapportAntenneForm({
  apfcId,
  type,
  periode,
  fenetre,
  initiale,
  enteteInitiale,
  enteteDefaut,
  modele,
  blocsAuto,
  lectureSeule,
  faitA,
  dateDuJour,
}: {
  apfcId: string;
  type: TypeRapportAntenne;
  /** Période persistée (« 2025-2026-T1 » / « 2025-2026 »), déjà revalidée côté serveur. */
  periode: string;
  /** Fenêtre EFFECTIVE des données (stockée dans le contenu à l'enregistrement). */
  fenetre: { debutIso: string; finIso: string };
  initiale: RapportAntenneInitial;
  enteteInitiale: EnteteRapport;
  enteteDefaut: EnteteRapport;
  modele: StructureModeleAntenne | null;
  /** Blocs AUTO chiffrés pour la fenêtre (insertion client + application du modèle). */
  blocsAuto: Record<CleBlocAuto, TableauSection>;
  lectureSeule: boolean;
  faitA: string;
  dateDuJour: string;
}) {
  const [etat, action] = useActionState(enregistrerRapportAntenne, initial);
  const [etatModele, actionModele] = useActionState(enregistrerModeleRapportAntenne, initial);
  // Accordéons EXCLUSIFS par section de NIVEAU 1 (les niveaux 2-3 s'affichent dans l'accordéon
  // parent) ; contenus repliés MONTÉS (masqués CSS) — tout l'état du plan vit en React.
  const [ouverte, setOuverte] = useState<string | null>("entete");
  const basculer = (id: string) => setOuverte((o) => (o === id ? null : id));

  const [sections, setSections] = useState<SectionPlan[]>(initiale.contenu.sections);
  const [titre, setTitre] = useState(initiale.titre);
  const [entete, setEntete] = useState<EnteteRapport>(enteteInitiale);

  // ── Opérations sur le PLAN ──
  function modifierSection(id: string, maj: (s: SectionPlan) => SectionPlan) {
    setSections((prev) => prev.map((s) => (s.id === id ? maj(s) : s)));
  }
  function deplacerSection(id: string, sens: -1 | 1) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const suivant = [...prev];
      [suivant[i], suivant[j]] = [suivant[j], suivant[i]];
      return suivant;
    });
  }
  function supprimerSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setOuverte((o) => (o === id ? null : o));
  }
  function ajouterApres(id: string | null) {
    setSections((prev) => {
      if (prev.length >= MAX_SECTIONS_PLAN) return prev;
      const nouvelle = sectionVide(1);
      if (id == null) return [...prev, nouvelle];
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return [...prev, nouvelle];
      nouvelle.niveau = prev[i].niveau;
      const suivant = [...prev];
      suivant.splice(i + 1, 0, nouvelle);
      return suivant;
    });
  }

  /** Application CLIENT du modèle personnel (plan sans chiffres → blocs auto re-chiffrés). */
  function appliquerModele() {
    if (!modele) return;
    if (modele.sections.length > 0) {
      setSections(
        modele.sections.map((s) => ({
          ...s,
          tableaux: s.tableaux.map((t) =>
            t.source && blocsAuto[t.source]
              ? { ...t, colonnes: [...blocsAuto[t.source].colonnes], lignes: blocsAuto[t.source].lignes.map((l) => [...l]) }
              : { ...t, colonnes: [...t.colonnes], lignes: t.lignes.map((l) => [...l]) },
          ),
          graphiques: [...s.graphiques],
        })),
      );
    }
    setEntete((prev) => completerEntete(modele.entete, prev));
    if (modele.titre.trim()) setTitre(modele.titre);
  }

  // Regroupement en ACCORDÉONS : chaque section de niveau 1 ouvre un groupe ; les sections de
  // niveaux 2-3 qui la suivent s'affichent DANS son accordéon.
  const groupes = useMemo(() => {
    const resultat: { chef: SectionPlan; membres: SectionPlan[] }[] = [];
    for (const s of sections) {
      if (s.niveau === 1 || resultat.length === 0) resultat.push({ chef: s, membres: [s] });
      else resultat[resultat.length - 1].membres.push(s);
    }
    return resultat;
  }, [sections]);

  const rendreSection = (s: SectionPlan) => {
    const index = sections.findIndex((x) => x.id === s.id);
    return (
      <SectionEditeur
        key={s.id}
        section={s}
        sections={sections}
        lectureSeule={lectureSeule}
        premiere={index === 0}
        derniere={index === sections.length - 1}
        blocsAuto={blocsAuto}
        onChange={(maj) => modifierSection(s.id, maj)}
        onMonter={() => deplacerSection(s.id, -1)}
        onDescendre={() => deplacerSection(s.id, 1)}
        onSupprimer={() => supprimerSection(s.id)}
        onAjouterApres={() => ajouterApres(s.id)}
      />
    );
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="apfcId" value={apfcId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="periode" value={periode} />
      <input type="hidden" name="periode-debut" value={fenetre.debutIso} />
      <input type="hidden" name="periode-fin" value={fenetre.finIso} />
      {/* PLAN soumis en JSON (lecteur tolérant et borné côté serveur). */}
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />

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

      {/* Barre du MODÈLE personnel (un modèle par type de rapport — plan sans les chiffres). */}
      {!lectureSeule && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-200 bg-cream-50/60 px-4 py-2.5">
          <p className="text-xs text-ink-700/60">Votre modèle s&apos;applique automatiquement aux nouveaux rapports.</p>
          <div className="flex flex-wrap items-center gap-2">
            {modele && (
              <BoutonTexte2Clics
                libelle="Appliquer mon modèle"
                confirmation="Appliquer le modèle ?"
                onConfirmer={appliquerModele}
                icone={<Wand2 size={13} />}
              />
            )}
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

      {/* Bloc TITRE violet (titre type pré-rempli selon le type et la période). */}
      <div className="rounded-lg border-[3px] border-[#3f3358] bg-[#7c6a9c] px-4 py-4">
        <label htmlFor={`titre-rapport-antenne-${type}`} className="sr-only">
          Titre du rapport
        </label>
        <input
          id={`titre-rapport-antenne-${type}`}
          type="text"
          name="titre"
          maxLength={MAX_TITRE_RAPPORT}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          disabled={lectureSeule}
          placeholder={
            type === "annuel"
              ? "RAPPORT ANNUEL D'ACTIVITÉS 2025-2026"
              : "BILAN DES ACTIVITÉS PÉDAGOGIQUES MENÉES AU PREMIER TRIMESTRE 2025-2026"
          }
          className="w-full bg-transparent text-center font-display text-lg font-bold uppercase tracking-wide text-black outline-none placeholder:normal-case placeholder:text-black/45"
        />
      </div>

      {/* En-tête du document (5 mentions configurables — les armoiries restent celles du pays). */}
      <SectionAccordeon titre="En-tête du document" ouverte={ouverte === "entete"} onToggle={() => basculer("entete")}>
        <p className="text-xs text-ink-700/60">
          Mentions officielles de l&apos;en-tête (reproduites en ligne et dans le Word). Une mention
          vidée retombe sur la valeur par défaut du pays et de l&apos;antenne.
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

      {/* LE PLAN : un accordéon par section de niveau 1 (les niveaux 2-3 dedans). */}
      {groupes.map((g) => (
        <SectionAccordeon
          key={g.chef.id}
          titre={g.chef.titre.trim() || "Section sans titre"}
          ouverte={ouverte === g.chef.id}
          onToggle={() => basculer(g.chef.id)}
        >
          <div className="space-y-5">{g.membres.map((s) => rendreSection(s))}</div>
        </SectionAccordeon>
      ))}

      {/* « + Ajouter un titre » en FIN de plan + bloc signature. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        {!lectureSeule ? (
          <button
            type="button"
            onClick={() => ajouterApres(null)}
            disabled={sections.length >= MAX_SECTIONS_PLAN}
            className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-4 py-1.5 text-sm font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50"
          >
            <Plus size={15} /> Ajouter un titre
          </button>
        ) : (
          <span />
        )}
        <div className="w-full max-w-sm space-y-2 text-center text-sm">
          <p className="text-ink-800">
            Fait à <span className="font-semibold">{faitA || "…"}</span>, le{" "}
            <span className="font-semibold">{dateDuJour}</span>
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-forest-900">Le Chef d&apos;Antenne</p>
          <label htmlFor={`signataire-antenne-${type}`} className="sr-only">
            Nom du chef d&apos;antenne
          </label>
          <input
            id={`signataire-antenne-${type}`}
            type="text"
            name="signataire"
            maxLength={MAX_TITRE_RAPPORT}
            defaultValue={initiale.contenu.signataire}
            disabled={lectureSeule}
            placeholder="Nom du chef d'antenne"
            className="w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-center text-sm font-semibold outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70"
          />
        </div>
      </div>

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
