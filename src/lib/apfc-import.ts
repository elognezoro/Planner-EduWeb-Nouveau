/**
 * Import CSV en lot des APFC (Antennes Pédagogiques de Formation Continue).
 *
 * Module PUR (aucune dépendance serveur/DOM) : utilisé à la fois côté client (aperçu avant
 * import, zone de glisser/déposer) et côté serveur (action `importerApfcCSV`), à l'image de
 * `lms-import.ts` pour les cours.
 *
 * Format attendu : une ligne = une APFC. Colonnes reconnues : `nom` (obligatoire) et `region`
 * (nom de la direction régionale, rapproché du référentiel Region du pays courant — insensible
 * à la casse et aux accents ; non bloquant si introuvable).
 */

// ── Parseur CSV robuste (automate) — identique en substance à lms-import.ts ──
// Gère : guillemets, délimiteurs/retours-ligne échappés dans les guillemets, guillemets
// doublés (""), BOM UTF-8, détection auto du séparateur (; ou ,), CRLF/LF/CR.
export type LigneCSV = { cells: string[]; ligne: number };

/** Détecte le délimiteur (; ou ,) d'après la première ligne NON vide. */
function detecterDelimiteur(t: string): ";" | "," {
  for (const l of t.split(/\r\n|\r|\n/)) {
    if (l.trim() === "") continue;
    const pv = (l.match(/;/g) ?? []).length;
    const vg = (l.match(/,/g) ?? []).length;
    return pv > vg ? ";" : ",";
  }
  return ",";
}

export function parseCSV(texte: string): LigneCSV[] {
  const t = texte.replace(/^﻿/, ""); // BOM UTF-8
  const delim = detecterDelimiteur(t);

  const rows: LigneCSV[] = [];
  let champ = "";
  let cells: string[] = [];
  let dansGuillemets = false;
  let numLigne = 1;
  let ligneDebut = 1;

  const pousser = () => {
    cells.push(champ); champ = "";
    if (cells.some((c) => c.trim() !== "")) rows.push({ cells, ligne: ligneDebut });
    cells = [];
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (cells.length === 0 && champ === "" && !dansGuillemets) ligneDebut = numLigne;
    if (dansGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else {
        champ += c;
        if (c === "\n") numLigne++;
      }
    } else if (c === '"') {
      dansGuillemets = true;
    } else if (c === delim) {
      cells.push(champ); champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      pousser();
      numLigne++;
    } else {
      champ += c;
    }
  }
  if (champ !== "" || cells.length > 0) pousser();
  return rows;
}

// ── Normalisation (accents/casse) — colonnes et rapprochement des régions ──
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clefColonne = (s: string) => sansAccent(s).toLowerCase().trim().replace(/\s+/g, "_");
/** Clef de rapprochement d'un texte (nom de région, nom d'APFC…) : accents/casse/espaces multiples ignorés. */
export const clefTexte = (s: string) => sansAccent(s).toLowerCase().trim().replace(/\s+/g, " ");

const ALIAS: Record<string, string[]> = {
  nom: ["nom", "apfc", "antenne", "centre", "name", "nom_apfc", "nom_de_lapfc"],
  region: ["region", "direction_regionale", "directionregionale", "drena", "direction"],
};

// ── Types du plan d'import ──────────────────────────────────
export type StatutLigneApfc = "ok" | "avertissement" | "erreur" | "doublon";
export type LigneApfcPlan = {
  ligne: number;
  nom: string;
  regionSaisie: string | null;
  regionId: string | null;
  regionNom: string | null;
  statut: StatutLigneApfc;
  message: string | null;
};
export type AnalyseImportApfc = {
  ok: boolean;
  messageFatal?: string;
  lignes: LigneApfcPlan[];
  totalLignes: number;
  nbValides: number; // « ok » + « avertissement » = importables
  nbErreurs: number;
  nbAvertissements: number;
  nbDoublons: number;
};

const vide = (extra: Partial<AnalyseImportApfc>): AnalyseImportApfc => ({
  ok: false, lignes: [], totalLignes: 0, nbValides: 0, nbErreurs: 0, nbAvertissements: 0, nbDoublons: 0, ...extra,
});

/**
 * Analyse un CSV d'APFC en plan d'import : une ligne par APFC, région rapprochée du
 * référentiel fourni (insensible casse/accents), doublons intra-fichier détectés.
 * Ne touche pas la base : la validation est rejouée côté serveur avant écriture.
 */
export function analyserImportApfc(texte: string, regions: { id: string; nom: string }[]): AnalyseImportApfc {
  const rows = parseCSV(texte);
  if (rows.length < 2) {
    return vide({ messageFatal: "Le fichier doit contenir une ligne d'en-tête puis au moins une ligne de données." });
  }

  const entete = rows[0].cells.map(clefColonne);
  const idxDe = (champ: string) => entete.findIndex((e) => ALIAS[champ].includes(e));
  const iNom = idxDe("nom");
  const iRegion = idxDe("region");

  if (iNom === -1) {
    return vide({
      totalLignes: rows.length - 1,
      messageFatal: "Colonne obligatoire manquante : « nom ». Téléchargez le modèle CSV pour le format attendu.",
    });
  }

  const indexRegions = new Map(regions.map((r) => [clefTexte(r.nom), r]));
  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
  const vus = new Set<string>();
  const lignes: LigneApfcPlan[] = [];

  for (let r = 1; r < rows.length; r++) {
    const ligneNum = rows[r].ligne;
    const row = rows[r].cells;
    const nom = cell(row, iNom);
    const regionSaisie = cell(row, iRegion) || null;

    if (!nom) {
      lignes.push({ ligne: ligneNum, nom: "", regionSaisie, regionId: null, regionNom: null, statut: "erreur", message: "Nom manquant — ligne ignorée." });
      continue;
    }

    const cle = clefTexte(nom);
    if (vus.has(cle)) {
      lignes.push({ ligne: ligneNum, nom, regionSaisie, regionId: null, regionNom: null, statut: "doublon", message: "Doublon dans le fichier — ligne ignorée." });
      continue;
    }
    vus.add(cle);

    let regionId: string | null = null;
    let regionNom: string | null = null;
    let statut: StatutLigneApfc = "ok";
    let message: string | null = null;
    if (regionSaisie) {
      const region = indexRegions.get(clefTexte(regionSaisie));
      if (region) {
        regionId = region.id;
        regionNom = region.nom;
      } else {
        statut = "avertissement";
        message = `Région « ${regionSaisie} » introuvable — APFC créée sans région.`;
      }
    }

    lignes.push({ ligne: ligneNum, nom, regionSaisie, regionId, regionNom, statut, message });
  }

  const nbErreurs = lignes.filter((l) => l.statut === "erreur").length;
  const nbAvertissements = lignes.filter((l) => l.statut === "avertissement").length;
  const nbDoublons = lignes.filter((l) => l.statut === "doublon").length;
  const nbValides = lignes.filter((l) => l.statut === "ok" || l.statut === "avertissement").length;

  return { ok: true, lignes, totalLignes: rows.length - 1, nbValides, nbErreurs, nbAvertissements, nbDoublons };
}
