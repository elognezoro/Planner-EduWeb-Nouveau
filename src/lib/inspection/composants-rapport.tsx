"use client";

import { useState } from "react";
import { ChevronDown, Plus, RotateCcw, Trash2, X } from "lucide-react";
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
import { ClassementBarres, ComparaisonBarres } from "@/components/app/mobile/graphiques-mobiles";
import { useEcranMobile, useImpressionDepuisEcranMobile } from "@/lib/mobile/appareil";
import {
  MAX_CELLULE_RAPPORT,
  MAX_LIGNES_TABLEAU,
  MAX_TEXTE_RAPPORT,
  MAX_TITRE_ZONE,
  MAX_ZONES_PAR_SECTION,
  type SectionLibre,
  type ZoneSupplementaire,
} from "./rapport-commun";

/**
 * Composants CLIENT partagés des rapports narratifs d'inspection (rapport bilan CRD,
 * rapports trimestriel et annuel d'antenne) : accordéons exclusifs à contenu toujours monté,
 * tableaux éditables, zones de saisie et sections libres, confirmations 2 clics (aucun
 * dialogue natif), diagrammes Recharts sobres. JAMAIS dupliqués par page.
 */

export const textareaCls =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70";

// Téléphone : « mobile:py-2.5 » porte le champ à 44 px de haut (cible tactile).
export const inputCls =
  "w-full rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70 mobile:py-2.5";

// ── Confirmations en 2 CLICS inline (aucun dialogue natif) ──

/** Poubelle → « Confirmer » / « Annuler » (2e clic = confirmation). */
export function BoutonRetrait2Clics({
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
        className="shrink-0 rounded-full p-1.5 text-ink-700/40 transition-colors hover:bg-red-50 hover:text-red-600 mobile:inline-flex mobile:min-h-11 mobile:min-w-11 mobile:items-center mobile:justify-center"
      >
        <Trash2 size={14} className="mobile:size-4.5" />
      </button>
    );
  }
  // Téléphone : une fois armé, le groupe passe sur sa propre ligne quand le parent autorise le
  // retour à la ligne (basis-full), sinon il rétrécit (min-w-0) ; le libellé de confirmation
  // se coupe sur deux lignes au lieu de faire déborder la carte.
  return (
    <span className="flex shrink-0 items-center gap-1 mobile:min-w-0 mobile:shrink mobile:basis-full mobile:justify-end mobile:gap-2">
      <button
        type="button"
        onClick={() => {
          setArme(false);
          onConfirmer();
        }}
        className="whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 mobile:min-h-11 mobile:whitespace-normal mobile:rounded-2xl mobile:px-3.5 mobile:py-2 mobile:text-xs mobile:leading-snug"
      >
        {confirmation}
      </button>
      <button
        type="button"
        onClick={() => setArme(false)}
        className="rounded-full border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700/70 transition-colors hover:bg-cream-100 mobile:min-h-11 mobile:shrink-0 mobile:px-3.5 mobile:text-xs"
      >
        Annuler
      </button>
    </span>
  );
}

/** Bouton TEXTE à confirmation 2 clics (ex. « Réinitialiser l'en-tête », « Appliquer mon modèle »). */
export function BoutonTexte2Clics({
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
        className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50 mobile:min-h-11 mobile:px-4"
      >
        {icone ?? <RotateCcw size={13} />} {libelle}
      </button>
    );
  }
  // Téléphone : confirmation en 14 px, cibles de 44 px, libellé coupé plutôt que débordant.
  return (
    <span className="flex items-center gap-1 mobile:min-w-0 mobile:max-w-full mobile:flex-wrap mobile:gap-2">
      <button
        type="button"
        onClick={() => {
          setArme(false);
          onConfirmer();
        }}
        className="whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 mobile:min-h-11 mobile:whitespace-normal mobile:rounded-2xl mobile:px-3.5 mobile:py-2 mobile:text-xs mobile:leading-snug"
      >
        {confirmation}
      </button>
      <button
        type="button"
        onClick={() => setArme(false)}
        className="rounded-full border border-cream-300 bg-white px-2 py-1 text-[11px] font-semibold text-ink-700/70 transition-colors hover:bg-cream-100 mobile:min-h-11 mobile:px-3.5 mobile:text-xs"
      >
        Annuler
      </button>
    </span>
  );
}

// ── Zones de saisie supplémentaires (petit titre + texte) — sections officielles ET libres ──

export function ZonesSupplementairesBloc({
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
          {/* Téléphone : retour à la ligne permis — la confirmation de retrait passe dessous. */}
          <div className="flex items-center gap-2 mobile:flex-wrap">
            <input
              type="text"
              value={z.titre}
              maxLength={MAX_TITRE_ZONE}
              disabled={lectureSeule}
              placeholder="Titre de la zone (facultatif)"
              aria-label="Titre de la zone"
              onChange={(e) => onModifier(z.id, "titre", e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-cream-300 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-forest-400 focus:ring-1 focus:ring-forest-200 disabled:bg-cream-50 disabled:text-ink-700/70 mobile:py-2.5"
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
          className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50 mobile:min-h-11 mobile:w-full mobile:justify-center"
        >
          <Plus size={13} /> Ajouter une zone de saisie
        </button>
      )}
    </div>
  );
}

// ── Accordéon EXCLUSIF : contenu TOUJOURS monté (masqué en CSS) pour que tout soit soumis ──

export function SectionAccordeon({
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
      {/* Téléphone : retour à la ligne permis — une confirmation de retrait armée passe dessous. */}
      <div className="flex items-center gap-2 mobile:flex-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouverte}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left mobile:min-h-11"
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

export function SectionLibreCard({
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
      {/* Téléphone : retour à la ligne permis — la confirmation de suppression passe dessous
          au lieu d'écraser le titre et de faire déborder la carte. */}
      <div className="flex items-center gap-2 mobile:flex-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={ouverte}
          aria-label={`${ouverte ? "Replier" : "Déplier"} la section ${section.titre || "sans titre"}`}
          className="shrink-0 rounded-full p-1 text-ink-700/45 transition-colors hover:bg-cream-100 mobile:inline-flex mobile:min-h-11 mobile:min-w-11 mobile:items-center mobile:justify-center"
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
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-base font-bold uppercase tracking-wide text-forest-900 outline-none placeholder:font-normal placeholder:normal-case placeholder:text-ink-700/40 focus:border-cream-300 focus:bg-white disabled:text-forest-900 mobile:min-h-11"
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

export function TableauEditable({
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
      {/* Ordinateur et papier : la grille de saisie. Téléphone : remplacée par les cartes ci-dessous. */}
      <div className="overflow-x-auto rounded-xl border border-cream-200 mobile:hidden">
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
      {/* Téléphone : une CARTE par ligne, chaque champ étiqueté par le nom de sa colonne (16 px,
          pleine largeur) — plus de grille à faire défiler de côté. Champs contrôlés et sans
          « name » : les deux rendus partagent le même état, rien n'est soumis en double. */}
      <div className="lg:hidden print:hidden">
        {lignes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-cream-300 px-3 py-4 text-center text-xs text-ink-700/60">
            Aucune ligne pour l&apos;instant.
          </p>
        ) : (
          <ol className="space-y-3">
            {lignes.map((ligne, li) => (
              <li key={li} className="rounded-2xl border border-cream-200 bg-white p-3.5">
                <div className={`mb-1 flex items-center justify-between gap-2 ${lectureSeule ? "" : "min-h-11"}`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Ligne {li + 1}</span>
                  {!lectureSeule && (
                    <button
                      type="button"
                      onClick={() => onRetirer(li)}
                      aria-label={`Retirer la ligne ${li + 1}`}
                      className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-ink-700/50 transition-colors active:bg-red-50 active:text-red-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                {lectureSeule ? (
                  <dl className="space-y-2">
                    {ligne.map((cellule, ci) => (
                      <div key={ci}>
                        <dt className="text-xs font-semibold text-ink-700/70">{colonnes[ci]}</dt>
                        <dd className="text-sm text-ink-800 wrap-break-word">{cellule.trim() ? cellule : "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="space-y-3">
                    {ligne.map((cellule, ci) => (
                      <label key={ci} className="block">
                        <span className="mb-1 block text-xs font-semibold text-ink-700/75">{colonnes[ci]}</span>
                        <input
                          type="text"
                          value={cellule}
                          maxLength={MAX_CELLULE_RAPPORT}
                          onChange={(e) => onCellule(li, ci, e.target.value)}
                          className="min-h-11 w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-base outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      {!lectureSeule && (
        <button
          type="button"
          onClick={onAjouter}
          disabled={lignes.length >= MAX_LIGNES_TABLEAU}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1 text-xs font-semibold text-forest-800 transition-colors hover:bg-forest-50 disabled:opacity-50 mobile:mt-3 mobile:min-h-11 mobile:w-full mobile:justify-center"
        >
          <Plus size={13} /> Ajouter une ligne
        </button>
      )}
    </div>
  );
}

// ── Diagrammes Recharts (EN LIGNE uniquement — absents des documents Word) ──

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

/**
 * Téléphone : deux séries INDÉPENDANTES (ex. activités / personnes touchées) — libellé complet,
 * chaque valeur étiquetée par sa série, sans rapport « b / a » ni taux qui n'auraient pas de sens.
 * Même échelle commune aux deux séries que le diagramme de l'ordinateur.
 */
function DeuxSeriesMobile({
  donnees,
  serieA,
  serieB,
  couleurA,
  couleurB,
}: {
  donnees: { libelle: string; a: number; b: number }[];
  serieA: string;
  serieB: string;
  couleurA: string;
  couleurB: string;
}) {
  const max = Math.max(...donnees.flatMap((d) => [d.a, d.b]), 1);
  return (
    <ol className="space-y-4">
      {donnees.map((d, i) => (
        <li key={`${d.libelle}-${i}`}>
          <p className="text-sm font-medium leading-snug text-forest-900 wrap-break-word">{d.libelle}</p>
          {[
            { serie: serieA, valeur: d.a, couleur: couleurA },
            { serie: serieB, valeur: d.b, couleur: couleurB },
          ].map((s, k) => (
            <div key={k} className="mt-1.5 flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-ink-700/75 wrap-break-word">{s.serie}</span>
              <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-cream-200" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(s.valeur / max) * 100}%`, backgroundColor: s.couleur }}
                />
              </span>
              <span className="min-w-12 shrink-0 text-right text-sm font-semibold text-forest-900 tabular-nums">
                {s.valeur.toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

export function ChartPrevuRealise({
  data,
  nomPrevues = "Prévue",
  nomRealisees = "Réalisés",
  tauxRealisation,
}: {
  data: { nom: string; prevues: number; realisees: number }[];
  /** Libellés des deux séries (« Réalisés » au CRD, « Réalisée » aux rapports d'antenne). */
  nomPrevues?: string;
  nomRealisees?: string;
  /**
   * Vue téléphone uniquement : la 2e série est-elle une RÉALISATION de la 1re (affichage
   * « 8 / 10 » + taux en %) ? Par défaut, vrai seulement avec les libellés par défaut
   * (Prévue / Réalisés du CRD) ; faux pour des séries indépendantes (Activités / Touchés).
   */
  tauxRealisation?: boolean;
}) {
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : barres sans animation (sinon nulles sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  // Téléphone : l'axe des noms (196 px) ne laissait que ~25 px aux barres — liste lisible à la
  // place (libellés complets, valeurs affichées). Jamais au rendu serveur ni à l'impression.
  if (mobile) {
    const donnees = data.map((d) => ({ libelle: d.nom, a: d.prevues, b: d.realisees }));
    const avecTaux = tauxRealisation ?? (nomPrevues === "Prévue" && nomRealisees === "Réalisés");
    return avecTaux ? (
      <ComparaisonBarres
        donnees={donnees}
        serieA={nomPrevues}
        serieB={nomRealisees}
        couleurA="#9cc5ab"
        couleurB="#34855c"
        limite={data.length}
      />
    ) : (
      <DeuxSeriesMobile donnees={donnees} serieA={nomPrevues} serieB={nomRealisees} couleurA="#9cc5ab" couleurB="#34855c" />
    );
  }
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
        <Bar dataKey="prevues" name={nomPrevues} fill="#9cc5ab" radius={[0, 4, 4, 0]} maxBarSize={12} isAnimationActive={impression ? false : undefined} />
        <Bar dataKey="realisees" name={nomRealisees} fill="#34855c" radius={[0, 4, 4, 0]} maxBarSize={12} isAnimationActive={impression ? false : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartTauxExecution({ data }: { data: { nom: string; taux: number }[] }) {
  const mobile = useEcranMobile();
  // Impression lancée depuis un téléphone : barres sans animation (sinon nulles sur le papier).
  const impression = useImpressionDepuisEcranMobile();
  // Téléphone : libellés horizontaux superposés sur ~250 px — classement en barres horizontales,
  // libellés complets, pleine échelle à 100 %, ORDRE conservé (CAFOP, 1er cycle, 2nd cycle).
  if (mobile) {
    return (
      <ClassementBarres
        donnees={data.map((d) => ({ libelle: d.nom, valeur: d.taux, couleur: "#34855c" }))}
        trier={false}
        max={100}
        unite="%"
        decimales={1}
        limite={data.length}
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3ebd7" vertical={false} />
        <XAxis dataKey="nom" tick={axisStyle} tickLine={false} axisLine={{ stroke: "#e9dcbe" }} interval={0} tickFormatter={courtNom} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} unit=" %" allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f0f8f3" }} />
        <Bar dataKey="taux" name="Taux d'exécution (%)" fill="#34855c" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={impression ? false : undefined} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NoteDiagramme({ texte }: { texte: string }) {
  return <p className="text-xs text-ink-700/55">{texte}</p>;
}
