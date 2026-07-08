// Construction du document HTML autonome pour la « version PDF » des comptes (impression navigateur
// → Enregistrer au format PDF). Ne contient QUE les colonnes username, password, firstname, lastname.
// Fonction pure et testable : aucune dépendance au DOM ni à l'application.

export interface MetaComptesPdf {
  ecole?: string;
  classe?: string;
  annee?: string;
  /** Date déjà formatée (ex. « 08 juillet 2026 »). Injectée par l'appelant pour rester pure. */
  date: string;
}

/** Échappement HTML minimal des valeurs de cellule. */
const eh = (v: string): string =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const COLONNES: { cle: string; i: number; mono: boolean }[] = [
  { cle: "username", i: 0, mono: true },
  { cle: "password", i: 1, mono: true },
  { cle: "firstname", i: 2, mono: false },
  { cle: "lastname", i: 3, mono: false },
];

/**
 * Document A4 portrait listant les comptes. `rows` = lignes complètes de la sortie Moodle ;
 * seules les 4 premières colonnes (username, password, firstname, lastname) sont reprises.
 * `autoImpression` déclenche l'impression au chargement (désactivé pour un simple aperçu).
 */
export function construireHtmlComptesPdf(
  rows: string[][],
  meta: MetaComptesPdf,
  opts: { autoImpression?: boolean } = {},
): string {
  const etab = (meta.ecole ?? "").trim();
  const cls = (meta.classe ?? "").trim();
  const an = (meta.annee ?? "").trim();
  const sousTitre = [cls && `Classe : ${cls}`, an && `Année scolaire : ${an}`]
    .filter(Boolean)
    .join("  ·  ");

  const thead = `<tr>${COLONNES.map((c) => `<th${c.mono ? ' class="mono"' : ""}>${c.cle}</th>`).join("")}</tr>`;
  const tbody = rows
    .map(
      (r) =>
        `<tr>${COLONNES.map((c) => `<td${c.mono ? ' class="mono"' : ""}>${eh(r[c.i] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");

  const scriptImpression = opts.autoImpression
    ? `<script>(function(){function p(){window.focus();window.print();}if(document.readyState==="complete"){p();}else{window.addEventListener("load",p);}})();<\/script>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Comptes Moodle${etab ? ` — ${eh(etab)}` : ""}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a2a1e; margin: 0; }
  header { margin: 0 0 10px; border-bottom: 2px solid #2f6f4e; padding-bottom: 8px; }
  h1 { font-size: 16px; margin: 0 0 3px; color: #1f4d36; }
  .sous { font-size: 11px; color: #4a4a4a; }
  .meta { font-size: 10px; color: #7a7a7a; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  thead { display: table-header-group; }
  th { text-align: left; background: #eef4ef; border: 1px solid #cfe0d4; padding: 5px 7px; color: #1f4d36; }
  td { border: 1px solid #e4e4e4; padding: 4px 7px; }
  tbody tr:nth-child(even) { background: #f7faf8; }
  th.mono, td.mono { font-family: "Consolas", "Courier New", monospace; font-size: 10px; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <header>
    <h1>${etab ? eh(etab) : "Liste des comptes"}</h1>
    ${sousTitre ? `<div class="sous">${eh(sousTitre)}</div>` : ""}
    <div class="meta">Identifiants Moodle · ${rows.length} compte(s) · généré le ${eh(meta.date)}</div>
  </header>
  <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  ${scriptImpression}
</body></html>`;
}
