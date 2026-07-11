/**
 * Import CSV de contenus LMS « Aide et Formation ».
 *
 * Module PUR (aucune dépendance serveur/DOM) : utilisé à la fois côté client
 * (aperçu avant import) et côté serveur (action `importerCoursCsv`).
 *
 * Format attendu : une ligne = une leçon ; les colonnes de cours sont répétées
 * sur chaque ligne du même cours. Les lignes sont regroupées par titre de cours,
 * dans leur ordre d'apparition.
 */

import { NIVEAUX } from "@/lib/lms";

/** Types de leçon importables (le type « fichier » — pièce jointe binaire — est exclu du CSV). */
export const TYPES_IMPORT = ["texte", "video", "lien", "quiz"] as const;

// ── Parseur CSV robuste (automate) ──────────────────────────
// Gère : guillemets, délimiteurs/retours-ligne échappés dans les guillemets,
// guillemets doublés (""), BOM UTF-8, détection auto du séparateur (; ou ,), CRLF/LF/CR.
// Chaque ligne conserve son numéro physique 1-indexé (avant filtrage des lignes vides).
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
  const t = texte.replace(/^﻿/, "");
  const delim = detecterDelimiteur(t);

  const rows: LigneCSV[] = [];
  let champ = "";
  let cells: string[] = [];
  let dansGuillemets = false;
  let numLigne = 1; // ligne physique courante
  let ligneDebut = 1; // ligne physique où commence l'enregistrement courant

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

// ── Résolution des colonnes par alias ───────────────────────
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clefColonne = (s: string) => sansAccent(s).toLowerCase().trim().replace(/\s+/g, "_");

const ALIAS: Record<string, string[]> = {
  cours: ["cours", "titre_cours", "cours_titre", "titre_du_cours", "course"],
  categorie: ["categorie", "category", "theme", "rubrique"],
  niveau: ["niveau", "level"],
  description: ["description", "description_cours", "cours_description", "resume"],
  lecon: ["lecon", "lesson", "module", "titre_lecon", "chapitre", "titre"],
  type: ["type", "type_lecon", "format"],
  contenu: ["contenu", "content", "texte", "url", "lien", "valeur"],
  duree: ["duree", "duree_minutes", "duree_min", "duration", "minutes"],
};

// ── Types du plan d'import ──────────────────────────────────
export type LeconPlan = { titre: string; type: string; contenu: string | null; dureeMinutes: number | null };
export type CoursPlan = { titre: string; categorie: string | null; niveau: string | null; description: string | null; lecons: LeconPlan[] };
export type MessageLigne = { ligne: number; niveau: "erreur" | "avertissement"; message: string };
export type AnalyseImport = {
  ok: boolean;
  messageFatal?: string;
  colonnes: string[];
  cours: CoursPlan[];
  messages: MessageLigne[];
  totalLignes: number;
  totalLecons: number;
  nbErreurs: number;
  nbAvertissements: number;
};

const vide = (extra: Partial<AnalyseImport>): AnalyseImport => ({
  ok: false, colonnes: [], cours: [], messages: [], totalLignes: 0, totalLecons: 0, nbErreurs: 0, nbAvertissements: 0, ...extra,
});

/**
 * Analyse un CSV en plan d'import (cours + leçons) et collecte erreurs/avertissements.
 * Ne touche pas la base : la validation est rejouée côté serveur avant écriture.
 */
export function analyserImportCsv(texte: string): AnalyseImport {
  const rows = parseCSV(texte);
  if (rows.length < 2) {
    return vide({ messageFatal: "Le fichier doit contenir une ligne d'en-tête puis au moins une ligne de données." });
  }

  const entete = rows[0].cells.map(clefColonne);
  const idxDe = (champ: string) => entete.findIndex((e) => ALIAS[champ].includes(e));
  const iCours = idxDe("cours"), iLecon = idxDe("lecon"), iCat = idxDe("categorie"),
    iNiv = idxDe("niveau"), iDesc = idxDe("description"), iType = idxDe("type"),
    iContenu = idxDe("contenu"), iDuree = idxDe("duree");

  if (iCours === -1 || iLecon === -1) {
    return vide({
      totalLignes: rows.length - 1,
      messageFatal: "Colonnes obligatoires manquantes : « cours » et « lecon ». Téléchargez le modèle CSV pour le format attendu.",
    });
  }

  const colonnes = (["cours", "categorie", "niveau", "description", "lecon", "type", "contenu", "duree"] as const)
    .filter((c) => idxDe(c) !== -1);

  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
  const messages: MessageLigne[] = [];
  const parTitre = new Map<string, CoursPlan>();
  const ordre: string[] = [];
  let totalLecons = 0;

  for (let r = 1; r < rows.length; r++) {
    const ligneNum = rows[r].ligne; // numéro physique dans le fichier
    const row = rows[r].cells;
    const titreCours = cell(row, iCours);
    const titreLecon = cell(row, iLecon);

    if (!titreCours) { messages.push({ ligne: ligneNum, niveau: "erreur", message: "Cours manquant — ligne ignorée." }); continue; }
    if (!titreLecon) { messages.push({ ligne: ligneNum, niveau: "erreur", message: `Leçon manquante pour « ${titreCours} » — ligne ignorée.` }); continue; }

    const cle = titreCours.toLowerCase();
    let plan = parTitre.get(cle);
    if (!plan) {
      plan = { titre: titreCours, categorie: cell(row, iCat) || null, description: cell(row, iDesc) || null, niveau: null, lecons: [] };
      parTitre.set(cle, plan);
      ordre.push(cle);
    } else {
      if (!plan.categorie && cell(row, iCat)) plan.categorie = cell(row, iCat);
      if (!plan.description && cell(row, iDesc)) plan.description = cell(row, iDesc);
    }
    if (!plan.niveau) {
      const niv = cell(row, iNiv).toLowerCase();
      if (niv) {
        if (NIVEAUX.some((n) => n.v === niv)) plan.niveau = niv;
        else messages.push({ ligne: ligneNum, niveau: "avertissement", message: `Niveau « ${niv} » inconnu (ignoré).` });
      }
    }

    let type = cell(row, iType).toLowerCase() || "texte";
    if (type === "fichier") {
      messages.push({ ligne: ligneNum, niveau: "avertissement", message: "Type « fichier » non pris en charge à l'import — converti en lien." });
      type = "lien";
    } else if (!(TYPES_IMPORT as readonly string[]).includes(type)) {
      messages.push({ ligne: ligneNum, niveau: "avertissement", message: `Type « ${type} » inconnu — remplacé par « texte ».` });
      type = "texte";
    }

    const contenu = cell(row, iContenu) || null;
    if ((type === "video" || type === "lien") && !contenu) {
      messages.push({ ligne: ligneNum, niveau: "avertissement", message: `Leçon « ${titreLecon} » de type ${type} sans URL de contenu.` });
    }

    let dureeMinutes: number | null = null;
    const dRaw = cell(row, iDuree);
    if (dRaw) {
      const d = Number(dRaw.replace(",", "."));
      if (Number.isFinite(d) && d >= 0) dureeMinutes = Math.floor(d);
      else messages.push({ ligne: ligneNum, niveau: "avertissement", message: `Durée « ${dRaw} » invalide (ignorée).` });
    }

    plan.lecons.push({ titre: titreLecon, type, contenu, dureeMinutes });
    totalLecons++;
  }

  const cours = ordre.map((k) => parTitre.get(k)!).filter((c) => c.lecons.length > 0);
  const nbErreurs = messages.filter((m) => m.niveau === "erreur").length;
  const nbAvertissements = messages.filter((m) => m.niveau === "avertissement").length;

  return { ok: true, colonnes, cours, messages, totalLignes: rows.length - 1, totalLecons, nbErreurs, nbAvertissements };
}
