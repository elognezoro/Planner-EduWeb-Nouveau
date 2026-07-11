"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, RemoveFormatting, Table2,
} from "lucide-react";
import { estHtmlRiche, CLASSE_HTML_RICHE } from "@/lib/lms";
import { cn } from "@/lib/utils";
import { TableurModal } from "./tableur-modal";

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

  // La valeur soumise commence TOUJOURS par une balise (sinon estHtmlRiche la prendrait pour du
  // texte brut et elle échapperait à la sanitisation HTML côté serveur).
  const sync = () => {
    const brut = zone.current?.innerHTML ?? "";
    setHtml(brut.trim() === "" ? "" : /^\s*</.test(brut) ? brut : `<p>${brut}</p>`);
  };
  const cmd = (commande: string, valeur?: string) => {
    zone.current?.focus();
    document.execCommand(commande, false, valeur);
    sync();
  };
  const insererTableur = (tableHtml: string) => {
    zone.current?.focus();
    document.execCommand("insertHTML", false, tableHtml + "<p><br></p>");
    sync();
    setTableurOuvert(false);
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
        <button type="button" onClick={() => cmd("removeFormat")} className={btn} title="Effacer la mise en forme" aria-label="Effacer la mise en forme"><RemoveFormatting size={15} /></button>
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
