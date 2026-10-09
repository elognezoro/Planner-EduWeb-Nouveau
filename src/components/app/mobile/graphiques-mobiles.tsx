"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { COULEURS_GRAPHIQUE } from "@/lib/mobile/couleurs";

/**
 * GRAPHIQUES MOBILES — présentations lisibles au téléphone, dans la charte EduWeb.
 *
 * Les graphiques de l'ordinateur (Recharts, axes, libellés tournés) deviennent illisibles sous
 * 400 px : noms d'établissements qui se chevauchent, légendes interminables, valeurs visibles au
 * survol seulement. Chaque composant graphique bascule vers ces présentations quand
 * `useEcranMobile()` est vrai (écran sous 64rem, JAMAIS à l'impression) — l'ordinateur et le
 * papier gardent leurs graphiques, inchangés.
 *
 * Règles communes : libellés COMPLETS (jamais tronqués ni tournés), valeurs toujours affichées
 * (pas d'information réservée au survol), « Voir tout » au-delà d'une limite.
 */

const nf = (n: number, decimales = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: decimales });
const CREME_AUTRES = "#e9dcbe";

export interface ElementClassement {
  libelle: string;
  valeur: number;
  /** Texte secondaire (ex. « 12 classes »). */
  detail?: string;
  /** Couleur propre (sinon : vert forêt). */
  couleur?: string;
}

/**
 * CLASSEMENT — barres horizontales (triées par défaut), libellé COMPLET au-dessus de chaque barre,
 * valeur alignée à droite. Remplace les histogrammes à catégories nombreuses ou longues.
 */
export function ClassementBarres({
  donnees,
  unite,
  max: maxImpose,
  limite = 8,
  trier = true,
  decimales = 0,
  formater,
  vide = "Aucune donnée.",
}: {
  donnees: ElementClassement[];
  /** Suffixe de la valeur (ex. « élèves », « % »). */
  unite?: string;
  /** Valeur pleine échelle (ex. 100 pour des pourcentages, 20 pour des notes) ; sinon le maximum. */
  max?: number;
  limite?: number;
  /** false : garde l'ordre fourni (niveaux, mois…). */
  trier?: boolean;
  decimales?: number;
  /** Affichage de la valeur (ex. montant en FCFA) — remplace nombre + unité. */
  formater?: (n: number) => string;
  vide?: string;
}) {
  const [tout, setTout] = useState(false);
  if (donnees.length === 0) return <p className="py-8 text-center text-sm text-ink-700/70">{vide}</p>;
  const lignes = trier ? [...donnees].sort((a, b) => b.valeur - a.valeur) : donnees;
  const visibles = tout ? lignes : lignes.slice(0, limite);
  const max = maxImpose ?? Math.max(...lignes.map((d) => d.valeur), 1);
  return (
    <div>
      <ol className="space-y-3.5">
        {visibles.map((d, i) => (
          <li key={`${d.libelle}-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-medium leading-snug text-forest-900 wrap-break-word">{d.libelle}</span>
              <span className="shrink-0 text-sm font-bold text-forest-900 tabular-nums">
                {formater ? formater(d.valeur) : nf(d.valeur, decimales)}
                {!formater && unite && <span className="ml-1 text-xs font-medium text-ink-700/70">{unite}</span>}
              </span>
            </div>
            {d.detail && <p className="text-xs text-ink-700/70">{d.detail}</p>}
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-cream-200" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, Math.min(100, (d.valeur / max) * 100))}%`, backgroundColor: d.couleur ?? "#246a48" }}
              />
            </div>
          </li>
        ))}
      </ol>
      {lignes.length > limite && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          className="mt-4 min-h-11 w-full rounded-full border border-cream-200 text-sm font-semibold text-forest-800 active:bg-cream-100"
        >
          {tout ? "Réduire" : `Voir les ${lignes.length} éléments`}
        </button>
      )}
    </div>
  );
}

export interface PartRepartition {
  libelle: string;
  valeur: number;
  /** Couleur imposée (ex. Absences en rouge) ; sinon la palette de la charte, dans l'ordre. */
  couleur?: string;
}

/**
 * RÉPARTITION — anneau compact avec le TOTAL au centre, puis une légende en lignes (pastille,
 * libellé, valeur, pourcentage). Au-delà de `limite` parts, les plus petites sont regroupées
 * dans « Autres » (dépliable, détail en retrait sous « Autres »).
 */
export function RepartitionAnneau({
  donnees,
  libelleTotal = "au total",
  limite = 5,
  couleurs = COULEURS_GRAPHIQUE,
  trier = true,
  formater,
  vide = "Aucune donnée.",
}: {
  donnees: PartRepartition[];
  libelleTotal?: string;
  limite?: number;
  couleurs?: string[];
  /** false : garde l'ordre fourni (ex. Présents, Retards, Absences). */
  trier?: boolean;
  formater?: (n: number) => string;
  vide?: string;
}) {
  const [detail, setDetail] = useState(false);
  const base = donnees.filter((d) => d.valeur > 0);
  // Couleur attribuée AVANT le tri : chaque part garde la sienne quel que soit son rang.
  const colorees = base.map((d, i) => ({ ...d, couleur: d.couleur ?? couleurs[i % couleurs.length] }));
  const lignes = trier ? [...colorees].sort((a, b) => b.valeur - a.valeur) : colorees;
  if (lignes.length === 0) return <p className="py-8 text-center text-sm text-ink-700/70">{vide}</p>;
  const total = lignes.reduce((s, d) => s + d.valeur, 0);
  const principales = lignes.length > limite + 1 ? lignes.slice(0, limite) : lignes;
  const autres = lignes.slice(principales.length);
  const parts = autres.length ? [...principales, { libelle: "Autres", valeur: autres.reduce((s, d) => s + d.valeur, 0), couleur: CREME_AUTRES }] : principales;
  const pct = (v: number) => (total ? `${nf((v / total) * 100, v / total < 0.1 ? 1 : 0)} %` : "—");
  const val = (v: number) => (formater ? formater(v) : nf(v));
  return (
    <div>
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={parts} dataKey="valeur" nameKey="libelle" innerRadius="64%" outerRadius="100%" paddingAngle={parts.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {parts.map((p) => (
                <Cell key={p.libelle} fill={p.couleur} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="font-display text-2xl font-bold leading-tight text-forest-900 tabular-nums">{val(total)}</span>
          <span className="text-xs text-ink-700/70">{libelleTotal}</span>
        </div>
      </div>
      <ul className="mt-5 divide-y divide-cream-200">
        {parts.map((d) => (
          <li key={d.libelle}>
            <div className="flex items-center gap-3 py-2.5">
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: d.couleur }} />
              <span className="min-w-0 flex-1 text-sm text-forest-900 wrap-break-word">{d.libelle}</span>
              <span className="shrink-0 text-sm font-semibold text-forest-900 tabular-nums">{val(d.valeur)}</span>
              <span className="w-14 shrink-0 text-right text-xs text-ink-700/70 tabular-nums">{pct(d.valeur)}</span>
            </div>
            {/* Détail des petites parts, en retrait sous « Autres » (l'anneau les garde regroupées). */}
            {d.libelle === "Autres" && detail && (
              <ul className="mb-2 ml-6 space-y-1 border-l-2 border-cream-200 pl-3">
                {autres.map((a) => (
                  <li key={a.libelle} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 text-ink-700/80 wrap-break-word">{a.libelle}</span>
                    <span className="shrink-0 tabular-nums text-forest-900">{val(a.valeur)}</span>
                    <span className="w-14 shrink-0 text-right text-xs text-ink-700/70 tabular-nums">{pct(a.valeur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {autres.length > 0 && (
        <button
          type="button"
          onClick={() => setDetail((v) => !v)}
          className="mt-3 min-h-11 w-full rounded-full border border-cream-200 text-sm font-semibold text-forest-800 active:bg-cream-100"
        >
          {detail ? "Masquer le détail des autres" : `Détailler les ${autres.length} autres`}
        </button>
      )}
    </div>
  );
}

export interface ElementComparaison {
  libelle: string;
  /** Valeur de référence (prévu, capacité, objectif…). */
  a: number;
  /** Valeur mesurée (réalisé, effectif, atteint…). */
  b: number;
}

/**
 * COMPARAISON — deux séries par élément (prévu / réalisé, places / effectif…) : libellé complet,
 * deux jauges superposées, valeurs « b / a » et taux en %. Remplace les histogrammes groupés.
 */
export function ComparaisonBarres({
  donnees,
  serieA,
  serieB,
  couleurA = "#9cc5ab",
  couleurB = "#246a48",
  afficherTaux = true,
  limite = 8,
  formater,
  vide = "Aucune donnée.",
}: {
  donnees: ElementComparaison[];
  serieA: string;
  serieB: string;
  couleurA?: string;
  couleurB?: string;
  afficherTaux?: boolean;
  limite?: number;
  formater?: (n: number) => string;
  vide?: string;
}) {
  const [tout, setTout] = useState(false);
  if (donnees.length === 0) return <p className="py-8 text-center text-sm text-ink-700/70">{vide}</p>;
  const max = Math.max(...donnees.flatMap((d) => [d.a, d.b]), 1);
  const visibles = tout ? donnees : donnees.slice(0, limite);
  const val = (v: number) => (formater ? formater(v) : nf(v));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700/80">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleurA }} /> {serieA}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleurB }} /> {serieB}
        </span>
      </div>
      <ol className="space-y-3.5">
        {visibles.map((d, i) => (
          <li key={`${d.libelle}-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-sm font-medium leading-snug text-forest-900 wrap-break-word">{d.libelle}</span>
              <span className="shrink-0 text-sm text-forest-900 tabular-nums">
                <strong>{val(d.b)}</strong>
                <span className="text-ink-700/70"> / {val(d.a)}</span>
                {afficherTaux && d.a > 0 && <span className="ml-1.5 text-xs font-semibold text-forest-700">{nf((d.b / d.a) * 100)} %</span>}
              </span>
            </div>
            <div className="mt-1.5 space-y-1" aria-hidden>
              <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full rounded-full" style={{ width: `${(d.a / max) * 100}%`, backgroundColor: couleurA }} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full rounded-full" style={{ width: `${(d.b / max) * 100}%`, backgroundColor: couleurB }} />
              </div>
            </div>
            <span className="sr-only">
              {serieA} : {val(d.a)} ; {serieB} : {val(d.b)}
            </span>
          </li>
        ))}
      </ol>
      {donnees.length > limite && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          className="mt-4 min-h-11 w-full rounded-full border border-cream-200 text-sm font-semibold text-forest-800 active:bg-cream-100"
        >
          {tout ? "Réduire" : `Voir les ${donnees.length} éléments`}
        </button>
      )}
    </div>
  );
}

/**
 * SÉRIE COMPACTE — pour les courbes et histogrammes temporels (mois, semaines, tranches) : grille
 * de pastilles chiffrées, lisible sans axes.
 */
export function SerieCompacte({
  donnees,
  unite,
  decimales = 0,
  formater,
}: {
  donnees: { libelle: string; valeur: number | null }[];
  unite?: string;
  decimales?: number;
  formater?: (n: number) => string;
}) {
  const vals = donnees.map((d) => d.valeur ?? 0);
  const max = Math.max(...vals, 1);
  return (
    <ul className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
      {donnees.map((d, i) => (
        <li key={`${d.libelle}-${i}`} className="rounded-2xl bg-cream-50 p-2.5 ring-1 ring-inset ring-cream-200">
          <span className="block truncate text-xs text-ink-700/70">{d.libelle}</span>
          <span className="block font-semibold text-forest-900 tabular-nums">
            {d.valeur === null ? "—" : formater ? formater(d.valeur) : nf(d.valeur, decimales)}
            {!formater && unite && d.valeur !== null && <span className="ml-0.5 text-xs font-medium text-ink-700/70">{unite}</span>}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-cream-200" aria-hidden>
            <span className="block h-full rounded-full bg-forest-600" style={{ width: `${((d.valeur ?? 0) / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
