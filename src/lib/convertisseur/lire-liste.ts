// Lecture d'une LISTE de personnes depuis un fichier (Excel, Word, CSV, texte) — partagée par
// les deux blocs de la page « Convertisseur CSV ». Code CLIENT uniquement (DOMParser, imports
// dynamiques xlsx/mammoth) : à n'importer que depuis des composants "use client".

import { lireFichierTexte } from "@/lib/csv/lire-fichier-texte";

/** Minuscules, sans accents, espaces réduits — pour comparer des en-têtes de colonnes. */
export function normEnTete(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function parseTexteCSV(texte: string): string[][] {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length === 0) return [];
  const virg = (lignes[0].match(/,/g) ?? []).length;
  const pv = (lignes[0].match(/;/g) ?? []).length;
  const tab = (lignes[0].match(/\t/g) ?? []).length;
  const delim = tab >= virg && tab >= pv ? "\t" : pv > virg ? ";" : ",";
  return lignes.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
}

function htmlEnLignes(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (table) {
    return [...table.querySelectorAll("tr")]
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => (c.textContent ?? "").trim()))
      .filter((r) => r.some((c) => c.length > 0));
  }
  return [...doc.querySelectorAll("p,li")]
    .map((p) => (p.textContent ?? "").trim())
    .filter(Boolean)
    .map((t) => [t]);
}

export async function lireFichierListe(file: File): Promise<string[][]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return (XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }) as unknown[][]).map((r) =>
      r.map((c) => String(c ?? "").trim()),
    );
  }
  if (ext === "docx") {
    const mod = await import("mammoth/mammoth.browser");
    const convertToHtml = mod.convertToHtml ?? mod.default.convertToHtml;
    const { value } = await convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlEnLignes(value);
  }
  return parseTexteCSV(await lireFichierTexte(file));
}

/** Index de la première colonne dont l'en-tête normalisé figure dans `alias` (−1 sinon). */
export function trouverColonne(cols: string[], alias: string[]): number {
  return cols.findIndex((c) => alias.includes(normEnTete(c)));
}
