"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, RemoveFormatting, Table2,
  Subscript, Superscript, Rows3, Columns3, Trash2,
} from "lucide-react";
import { estHtmlRiche, CLASSE_HTML_RICHE } from "@/lib/lms";
import { cn } from "@/lib/utils";
import { TableurModal } from "./tableur-modal";
import { BoutonDictee } from "./bouton-dictee";

const ehTexte = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Valeur initiale : HTML riche tel quel ; texte brut hérité converti en paragraphes. */
function versHtmlInitial(v: string | null | undefined): string {
  if (!v) return "";
  if (estHtmlRiche(v)) return v;
  return `<p>${ehTexte(v).replace(/\n/g, "<br>")}</p>`;
}

/** Couleurs de police proposées (thème de la plateforme + usuelles). */
const COULEURS = [
  { v: "#1f2937", t: "Noir" },
  { v: "#1f5134", t: "Vert forêt" },
  { v: "#b45309", t: "Or" },
  { v: "#b91c1c", t: "Rouge" },
  { v: "#1d4ed8", t: "Bleu" },
];

/**
 * Éditeur riche minimal, sans dépendance : gras, italique, souligné, barré, couleur de
 * police, hiérarchie des titres, puces / numérotation, justification, effacement de format.
 * La valeur (HTML) est soumise via un champ caché `name` — TOUJOURS re-sanitisée côté
 * serveur (sanitiserHtmlRiche) avant enregistrement.
 */
export function EditeurRiche({
  name,
  initial,
  minHauteur = 140,
  aide,
}: {
  name: string;
  initial?: string | null;
  minHauteur?: number;
  /** Petit texte d'aide affiché sous la zone (facultatif). */
  aide?: string;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(() => versHtmlInitial(initial));
  const [tableurOuvert, setTableurOuvert] = useState(false);

  // Injecte le contenu initial une seule fois (contentEditable n'est pas contrôlé par React).
  useEffect(() => {
    if (zone.current) zone.current.innerHTML = versHtmlInitial(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montage uniquement
  }, []);

  // La valeur soumise commence TOUJOURS par une balise BLOC. Si le contenu commence par du texte
  // (nœud texte de tête), on l'enveloppe dans <div> (qui accepte p/ul/… → imbrication valide) :
  // sinon estHtmlRiche le prendrait pour du texte brut → non sanitisé à l'écriture ET balises
  // affichées littéralement à la lecture.
  const sync = () => {
    const brut = zone.current?.innerHTML ?? "";
    if (brut.trim() === "") { setHtml(""); return; }
    const commenceParBloc = /^\s*<(p|div|h[1-6]|ul|ol|blockquote|table)[\s>/]/i.test(brut);
    setHtml(commenceParBloc ? brut : `<div>${brut}</div>`);
  };
  const cmd = (commande: string, valeur?: string) => {
    zone.current?.focus();
    // Couleur et alignement doivent produire des STYLES en ligne (style="color" / "text-align"),
    // seuls autorisés par le sanitiseur serveur — donc styleWithCSS ON pour ces commandes ; les
    // mises en forme de caractère (gras, italique, indice, exposant…) restent des BALISES
    // sémantiques (b/i/sub/sup…), styleWithCSS OFF, sinon elles deviendraient des styles rejetés.
    const enCss = commande === "foreColor" || commande.startsWith("justify");
    try { document.execCommand("styleWithCSS", false, enCss ? "true" : "false"); } catch { /* non supporté : défaut du navigateur */ }
    document.execCommand(commande, false, valeur);
    sync();
  };
  /** Cellule (td/th) contenant le curseur, ou null si le curseur n'est pas dans un tableau. */
  const celluleCourante = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    while (n && n !== zone.current) {
      if (n.nodeType === 1) {
        const el = n as HTMLElement;
        if (el.tagName === "TD" || el.tagName === "TH") return el as HTMLTableCellElement;
      }
      n = n.parentNode;
    }
    return null;
  };
  const supprimerTableau = () => { const t = celluleCourante()?.closest("table"); if (t) { t.remove(); sync(); } };
  const supprimerLigne = () => {
    const c = celluleCourante(); if (!c) return;
    const tr = c.closest("tr"); const t = c.closest("table");
    if (tr) { tr.remove(); if (t && t.rows.length === 0) t.remove(); sync(); }
  };
  const supprimerColonne = () => {
    const c = celluleCourante(); const t = c?.closest("table"); if (!c || !t) return;
    const i = c.cellIndex;
    Array.from(t.rows).forEach((r) => { if (r.cells[i]) r.deleteCell(i); });
    if (!t.rows[0] || t.rows[0].cells.length === 0) t.remove();
    sync();
  };
  const insererTableur = (tableHtml: string) => {
    zone.current?.focus();
    document.execCommand("insertHTML", false, tableHtml + "<p><br></p>");
    sync();
    setTableurOuvert(false);
  };
  /** Insère le texte dicté à l'emplacement du curseur. */
  const insererDictee = (texte: string) => {
    zone.current?.focus();
    document.execCommand("insertText", false, texte.endsWith(" ") ? texte : texte + " ");
    sync();
  };

  const btn = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-forest-800 hover:bg-forest-50";

  return (
    <div className="rounded-xl border border-cream-300 bg-white focus-within:border-forest-400 focus-within:ring-2 focus-within:ring-forest-200">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-cream-200 px-2 py-1.5">
        <select
          aria-label="Hiérarchie des titres"
          title="Hiérarchie des titres"
          defaultValue=""
          onChange={(e) => { if (e.target.value) cmd("formatBlock", e.target.value); e.target.value = ""; }}
          className="h-8 rounded-lg border border-cream-200 bg-white px-1.5 text-xs text-forest-800"
        >
          <option value="" disabled>Titre…</option>
          <option value="H2">Titre</option>
          <option value="H3">Sous-titre</option>
          <option value="P">Paragraphe</option>
        </select>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <button type="button" onClick={() => cmd("bold")} className={btn} title="Gras" aria-label="Gras"><Bold size={15} /></button>
        <button type="button" onClick={() => cmd("italic")} className={btn} title="Italique" aria-label="Italique"><Italic size={15} /></button>
        <button type="button" onClick={() => cmd("underline")} className={btn} title="Souligné" aria-label="Souligné"><Underline size={15} /></button>
        <button type="button" onClick={() => cmd("strikeThrough")} className={btn} title="Barré" aria-label="Barré"><Strikethrough size={15} /></button>
        <button type="button" onClick={() => cmd("subscript")} className={btn} title="Indice" aria-label="Indice"><Subscript size={15} /></button>
        <button type="button" onClick={() => cmd("superscript")} className={btn} title="Exposant" aria-label="Exposant"><Superscript size={15} /></button>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        {COULEURS.map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => cmd("foreColor", c.v)}
            className="inline-flex h-8 w-6 shrink-0 items-center justify-center rounded-lg hover:bg-forest-50"
            title={`Couleur : ${c.t}`}
            aria-label={`Couleur de police ${c.t}`}
          >
            <span className="h-4 w-4 rounded-full border border-cream-300" style={{ backgroundColor: c.v }} />
          </button>
        ))}
        <label className="inline-flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-forest-50" title="Couleur personnalisée" aria-label="Couleur de police personnalisée">
          <span className="h-4 w-4 rounded-full border border-cream-300" style={{ background: "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }} />
          <input type="color" defaultValue="#1f5134" onChange={(e) => cmd("foreColor", e.target.value)} className="sr-only" />
        </label>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <button type="button" onClick={() => cmd("insertUnorderedList")} className={btn} title="Liste à puces" aria-label="Liste à puces"><List size={15} /></button>
        <button type="button" onClick={() => cmd("insertOrderedList")} className={btn} title="Liste numérotée" aria-label="Liste numérotée"><ListOrdered size={15} /></button>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <button type="button" onClick={() => cmd("justifyLeft")} className={btn} title="Aligner à gauche" aria-label="Aligner à gauche"><AlignLeft size={15} /></button>
        <button type="button" onClick={() => cmd("justifyCenter")} className={btn} title="Centrer" aria-label="Centrer"><AlignCenter size={15} /></button>
        <button type="button" onClick={() => cmd("justifyRight")} className={btn} title="Aligner à droite" aria-label="Aligner à droite"><AlignRight size={15} /></button>
        <button type="button" onClick={() => cmd("justifyFull")} className={btn} title="Justifier" aria-label="Justifier"><AlignJustify size={15} /></button>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <button type="button" onClick={() => setTableurOuvert(true)} className={btn} title="Insérer un tableur" aria-label="Insérer un tableur"><Table2 size={15} /></button>
        <button type="button" onClick={supprimerLigne} className={btn} title="Supprimer la ligne du tableau" aria-label="Supprimer la ligne du tableau"><Rows3 size={15} /></button>
        <button type="button" onClick={supprimerColonne} className={btn} title="Supprimer la colonne du tableau" aria-label="Supprimer la colonne du tableau"><Columns3 size={15} /></button>
        <button type="button" onClick={supprimerTableau} className={btn} title="Supprimer le tableau" aria-label="Supprimer le tableau"><Trash2 size={15} /></button>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <button type="button" onClick={() => cmd("removeFormat")} className={btn} title="Effacer la mise en forme" aria-label="Effacer la mise en forme"><RemoveFormatting size={15} /></button>
        <span className="mx-1 h-5 w-px bg-cream-200" />
        <BoutonDictee onTexte={insererDictee} compact label="Dicter" />
      </div>

      {/* Zone d'édition */}
      <div
        ref={zone}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={sync}
        onBlur={sync}
        className={cn("w-full px-3 py-2 text-sm text-ink-800 outline-none", CLASSE_HTML_RICHE)}
        style={{ minHeight: minHauteur }}
      />

      <input type="hidden" name={name} value={html} />
      {aide && <p className="border-t border-cream-100 px-3 py-1.5 text-xs text-ink-700/50">{aide}</p>}
      {tableurOuvert && <TableurModal onInsert={insererTableur} onClose={() => setTableurOuvert(false)} />}
    </div>
  );
}
