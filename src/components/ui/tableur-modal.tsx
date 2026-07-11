"use client";

import { useState } from "react";
import { X, Plus, Minus, Table2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tableur simple (type Excel) inséré dans l'éditeur riche : grille éditable + formules
 * de base (=SOMME, =MOYENNE, =MIN, =MAX, =NB, arithmétique + − × ÷ avec réf. A1 et plages
 * A1:B3). À l'insertion, seule la table des VALEURS CALCULÉES est injectée (HTML sanitisé
 * côté serveur). Tout le calcul est client — les valeurs numériques finales sont figées.
 */

type Grille = string[][];

const A = "A".charCodeAt(0);
const colLettre = (i: number) => {
  let s = "";
  let n = i;
  do { s = String.fromCharCode(A + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};
const colIdx = (s: string) => {
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - A + 1);
  return n - 1;
};
const refToRC = (ref: string): { r: number; c: number } | null => {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  return m ? { c: colIdx(m[1]), r: parseInt(m[2], 10) - 1 } : null;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Valeur NUMÉRIQUE d'une cellule pour les formules (0 si vide, NaN si non numérique/cycle). */
function cellNum(g: Grille, r: number, c: number, seen: Set<string>): number {
  if (r < 0 || c < 0 || r >= g.length || c >= (g[0]?.length ?? 0)) return NaN;
  const key = r + ":" + c;
  if (seen.has(key)) return NaN; // référence circulaire
  const raw = (g[r]?.[c] ?? "").trim();
  if (raw === "") return 0;
  if (!raw.startsWith("=")) { const n = parseFloat(raw.replace(",", ".")); return isNaN(n) ? NaN : n; }
  seen.add(key);
  const v = evalExpr(g, raw.slice(1), seen);
  seen.delete(key);
  return v;
}

function collecter(g: Grille, args: string, seen: Set<string>): number[] {
  const out: number[] = [];
  for (const brut of args.split(",")) {
    const tok = brut.trim();
    if (!tok) continue;
    const rng = /^([A-Za-z]+\d+):([A-Za-z]+\d+)$/.exec(tok);
    if (rng) {
      const a = refToRC(rng[1]), b = refToRC(rng[2]);
      if (a && b) for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++)
        for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
          const n = cellNum(g, r, c, seen); if (isFinite(n)) out.push(n);
        }
    } else if (/^[A-Za-z]+\d+$/.test(tok)) {
      const rc = refToRC(tok); if (rc) { const n = cellNum(g, rc.r, rc.c, seen); if (isFinite(n)) out.push(n); }
    } else {
      const n = parseFloat(tok.replace(",", ".")); if (isFinite(n)) out.push(n);
    }
  }
  return out;
}

/** Évalue l'expression d'une formule (sans le « = »). */
function evalExpr(g: Grille, expr: string, seen: Set<string>): number {
  let e = expr;
  const fnRe = /([A-Za-zÀ-ÿ]+)\s*\(([^()]*)\)/;
  let garde = 0;
  while (fnRe.test(e) && garde++ < 50) {
    e = e.replace(fnRe, (_all, name: string, args: string) => {
      const v = collecter(g, args, seen);
      const f = name.toUpperCase();
      let res: number;
      if (f === "SOMME" || f === "SUM") res = v.reduce((a, b) => a + b, 0);
      else if (f === "MOYENNE" || f === "MOY" || f === "AVERAGE") res = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      else if (f === "MIN") res = v.length ? Math.min(...v) : 0;
      else if (f === "MAX") res = v.length ? Math.max(...v) : 0;
      else if (f === "NB" || f === "COUNT") res = v.length;
      else res = NaN;
      return "(" + res + ")";
    });
  }
  // Réf. cellules restantes → leur valeur numérique.
  e = e.replace(/([A-Za-z]+\d+)/g, (ref) => { const rc = refToRC(ref); return "(" + (rc ? cellNum(g, rc.r, rc.c, seen) : NaN) + ")"; });
  e = e.replace(/,/g, "."); // décimales françaises éventuelles
  if (!/^[-+*/().0-9eE\s]*$/.test(e)) return NaN; // arithmétique pure uniquement (aucun identifiant)
  try {
    // eslint-disable-next-line no-new-func -- expression validée : uniquement chiffres/opérateurs/parenthèses
    const val = Function('"use strict";return (' + (e.trim() || "0") + ")")();
    return typeof val === "number" && isFinite(val) ? val : NaN;
  } catch { return NaN; }
}

/** Valeur AFFICHÉE d'une cellule (texte brut, ou résultat calculé pour une formule). */
function affichage(g: Grille, r: number, c: number): string {
  const raw = (g[r]?.[c] ?? "").trim();
  if (!raw.startsWith("=")) return raw;
  const v = cellNum(g, r, c, new Set());
  return isFinite(v) ? String(Math.round(v * 10000) / 10000) : "#ERR";
}

function genererTableHtml(g: Grille, entete: boolean): string {
  const cols = g[0]?.length ?? 0;
  let h = "<table>";
  let start = 0;
  if (entete && g.length > 0) {
    h += "<thead><tr>";
    for (let c = 0; c < cols; c++) h += "<th>" + esc(affichage(g, 0, c)) + "</th>";
    h += "</tr></thead>";
    start = 1;
  }
  h += "<tbody>";
  for (let r = start; r < g.length; r++) {
    h += "<tr>";
    for (let c = 0; c < cols; c++) h += "<td>" + esc(affichage(g, r, c)) + "</td>";
    h += "</tr>";
  }
  return h + "</tbody></table>";
}

const vide = (rows: number, cols: number): Grille => Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

export function TableurModal({ onInsert, onClose }: { onInsert: (html: string) => void; onClose: () => void }) {
  const [g, setG] = useState<Grille>(() => {
    const d = vide(4, 3);
    d[0] = ["Élément", "Note 1", "Note 2"]; // en-têtes d'exemple
    return d;
  });
  const [entete, setEntete] = useState(true);
  const rows = g.length;
  const cols = g[0]?.length ?? 0;

  const setCell = (r: number, c: number, val: string) =>
    setG((prev) => prev.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? val : cell)) : row)));
  const addRow = () => setG((p) => [...p, Array.from({ length: cols }, () => "")]);
  const delRow = () => setG((p) => (p.length > 1 ? p.slice(0, -1) : p));
  const addCol = () => setG((p) => p.map((row) => [...row, ""]));
  const delCol = () => setG((p) => (cols > 1 ? p.map((row) => row.slice(0, -1)) : p));

  const btn = "inline-flex items-center gap-1 rounded-lg border border-cream-300 px-2 py-1 text-xs font-semibold text-forest-800 hover:bg-cream-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-soft" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-forest-900"><Table2 size={18} className="text-forest-600" /> Insérer un tableur</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-700/60 hover:bg-cream-100" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={addRow} className={btn}><Plus size={13} /> Ligne</button>
          <button type="button" onClick={delRow} className={btn}><Minus size={13} /> Ligne</button>
          <button type="button" onClick={addCol} className={btn}><Plus size={13} /> Colonne</button>
          <button type="button" onClick={delCol} className={btn}><Minus size={13} /> Colonne</button>
          <label className="ml-2 inline-flex items-center gap-1.5 text-xs font-medium text-forest-800">
            <input type="checkbox" checked={entete} onChange={(e) => setEntete(e.target.checked)} /> 1<sup>re</sup> ligne = en-têtes
          </label>
        </div>

        {/* Grille d'édition */}
        <div className="overflow-x-auto rounded-xl border border-cream-200">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-8 bg-cream-100" />
                {Array.from({ length: cols }, (_, c) => (
                  <th key={c} className="min-w-[6rem] border border-cream-200 bg-cream-100 px-2 py-1 text-xs font-semibold text-forest-800">{colLettre(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.map((row, r) => (
                <tr key={r}>
                  <td className="border border-cream-200 bg-cream-100 px-1 text-center text-xs font-semibold text-ink-700/60">{r + 1}</td>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-cream-200 p-0">
                      <input
                        value={cell}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        className={cn("w-full min-w-[6rem] bg-transparent px-2 py-1 text-sm outline-none focus:bg-forest-50", entete && r === 0 && "font-semibold")}
                        placeholder={r === 0 && entete ? "En-tête" : ""}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-ink-700/55">
          Formules : <code>=SOMME(A2:A4)</code>, <code>=MOYENNE(B2:B4)</code>, <code>=A2+B2</code>, aussi <code>MIN</code>, <code>MAX</code>, <code>NB</code>. Réf. de cellule : lettre de colonne + numéro de ligne (ex. <code>B3</code>).
        </p>

        {/* Aperçu calculé */}
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Aperçu (valeurs calculées)</p>
          <div className="overflow-x-auto rounded-xl border border-cream-200 p-2" dangerouslySetInnerHTML={{ __html: apercuStyle(genererTableHtml(g, entete)) }} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-forest-800 hover:bg-cream-100">Annuler</button>
          <button type="button" onClick={() => onInsert(genererTableHtml(g, entete))} className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"><Check size={15} /> Insérer</button>
        </div>
      </div>
    </div>
  );
}

/** Styles inline pour l'aperçu (le rendu final s'appuie sur CLASSE_HTML_RICHE côté affichage). */
function apercuStyle(html: string): string {
  return html
    .replace(/<table>/g, '<table style="border-collapse:collapse;width:100%;font-size:0.85rem">')
    .replace(/<th>/g, '<th style="border:1px solid #d8cdb8;background:#f3ecdd;padding:2px 8px;text-align:left;font-weight:600">')
    .replace(/<td>/g, '<td style="border:1px solid #d8cdb8;padding:2px 8px">');
}
