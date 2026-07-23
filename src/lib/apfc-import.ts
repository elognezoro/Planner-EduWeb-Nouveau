/**
 * Import CSV en lot des APFC (Antennes Pédagogiques de Formation Continue).
 *
 * Module PUR (aucune dépendance serveur/DOM) : utilisé à la fois côté client (aperçu avant
 * import, zone de glisser/déposer) et côté serveur (action `importerApfcCSV`), à l'image de
 * `lms-import.ts` pour les cours.
 *
 * Format attendu : une ligne = une APFC. Colonnes reconnues (seule `nom` est obligatoire) :
 * `nom;code;pays;region;localite;adresse;telephone;email;responsable;contact_responsable`.
 * - `region` : nom de la direction régionale / DRENA, rapproché du référentiel Region du pays
 *   courant (insensible à la casse et aux accents ; non bloquant si introuvable) ;
 * - `pays` : facultatif — s'il est renseigné, il doit correspondre au pays consulté (sinon la
 *   ligne est en erreur : jamais de création hors du pays consulté) ;
 * - RÉTRO-COMPATIBILITÉ : les anciens fichiers `nom;region` restent acceptés tels quels
 *   (colonnes absentes = champs vides).
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
  code: ["code", "code_apfc", "matricule"],
  pays: ["pays", "country"],
  region: ["region", "region_drena", "direction_regionale", "directionregionale", "drena", "direction"],
  localite: ["localite", "ville", "commune", "site"],
  adresse: ["adresse", "address", "bp", "boite_postale"],
  telephone: ["telephone", "tel", "phone"],
  email: ["email", "e_mail", "mail", "courriel"],
  responsable: ["responsable", "nom_du_responsable", "nom_responsable", "chef_antenne", "chef_d'antenne", "directeur"],
  contact_responsable: [
    "contact_responsable",
    "contact_du_responsable",
    "responsable_contact",
    "tel_responsable",
    "telephone_responsable",
  ],
};

/** Bornes de longueur des champs libres (mêmes plafonds que la validation serveur du formulaire). */
const BORNES = { nom: 160, code: 40, localite: 120, adresse: 200, telephone: 40, email: 160, responsable: 160, contact: 60 } as const;

/** Tronque et vide → null (champ facultatif). */
const borner = (s: string, max: number): string | null => {
  const t = s.trim();
  return t ? t.slice(0, max) : null;
};

/** Format d'e-mail plausible (validation légère, réutilisée par les actions serveur). */
export const EMAIL_PLAUSIBLE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── Types du plan d'import ──────────────────────────────────
export type StatutLigneApfc = "ok" | "avertissement" | "erreur" | "doublon";
export type LigneApfcPlan = {
  ligne: number;
  nom: string;
  regionSaisie: string | null;
  regionId: string | null;
  regionNom: string | null;
  /** Coordonnées facultatives de l'antenne (maquette « Nouvelle APFC ») — null si absentes. */
  code: string | null;
  localite: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  responsable: string | null;
  responsableContact: string | null;
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
 * référentiel fourni (insensible casse/accents), doublons intra-fichier détectés,
 * colonne `pays` (facultative) contrôlée contre `paysReference` (le pays consulté).
 * Ne touche pas la base : la validation est rejouée côté serveur avant écriture.
 */
export function analyserImportApfc(
  texte: string,
  regions: { id: string; nom: string }[],
  paysReference?: string | null,
): AnalyseImportApfc {
  const rows = parseCSV(texte);
  if (rows.length < 2) {
    return vide({ messageFatal: "Le fichier doit contenir une ligne d'en-tête puis au moins une ligne de données." });
  }

  const entete = rows[0].cells.map(clefColonne);
  const idxDe = (champ: string) => entete.findIndex((e) => ALIAS[champ].includes(e));
  const iNom = idxDe("nom");
  const iRegion = idxDe("region");
  const iCode = idxDe("code");
  const iPays = idxDe("pays");
  const iLocalite = idxDe("localite");
  const iAdresse = idxDe("adresse");
  const iTelephone = idxDe("telephone");
  const iEmail = idxDe("email");
  const iResponsable = idxDe("responsable");
  const iContactResp = idxDe("contact_responsable");

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
    const nom = cell(row, iNom).slice(0, BORNES.nom);
    const regionSaisie = cell(row, iRegion) || null;
    const coordonnees = {
      code: borner(cell(row, iCode), BORNES.code),
      localite: borner(cell(row, iLocalite), BORNES.localite),
      adresse: borner(cell(row, iAdresse), BORNES.adresse),
      telephone: borner(cell(row, iTelephone), BORNES.telephone),
      email: borner(cell(row, iEmail), BORNES.email)?.toLowerCase() ?? null,
      responsable: borner(cell(row, iResponsable), BORNES.responsable),
      responsableContact: borner(cell(row, iContactResp), BORNES.contact),
    };
    const paysSaisi = cell(row, iPays) || null;

    if (!nom) {
      lignes.push({ ligne: ligneNum, nom: "", regionSaisie, regionId: null, regionNom: null, ...coordonnees, statut: "erreur", message: "Nom manquant — ligne ignorée." });
      continue;
    }

    // Colonne `pays` facultative : si elle contredit le pays consulté, la ligne est REFUSÉE
    // (jamais de création hors du pays consulté — cloisonnement par pays).
    if (paysSaisi && paysReference && clefTexte(paysSaisi) !== clefTexte(paysReference)) {
      lignes.push({
        ligne: ligneNum, nom, regionSaisie, regionId: null, regionNom: null, ...coordonnees,
        statut: "erreur", message: `Pays « ${paysSaisi} » différent du pays consulté (${paysReference}) — ligne ignorée.`,
      });
      continue;
    }

    const cle = clefTexte(nom);
    if (vus.has(cle)) {
      lignes.push({ ligne: ligneNum, nom, regionSaisie, regionId: null, regionNom: null, ...coordonnees, statut: "doublon", message: "Doublon dans le fichier — ligne ignorée." });
      continue;
    }
    vus.add(cle);

    let regionId: string | null = null;
    let regionNom: string | null = null;
    let statut: StatutLigneApfc = "ok";
    const messages: string[] = [];
    if (regionSaisie) {
      const region = indexRegions.get(clefTexte(regionSaisie));
      if (region) {
        regionId = region.id;
        regionNom = region.nom;
      } else {
        statut = "avertissement";
        messages.push(`Région « ${regionSaisie} » introuvable — APFC créée sans région.`);
      }
    }
    // E-mail invalide : non bloquant — le champ est simplement ignoré (ligne importable).
    if (coordonnees.email && !EMAIL_PLAUSIBLE.test(coordonnees.email)) {
      statut = "avertissement";
      messages.push(`E-mail « ${coordonnees.email} » invalide — champ ignoré.`);
      coordonnees.email = null;
    }

    lignes.push({ ligne: ligneNum, nom, regionSaisie, regionId, regionNom, ...coordonnees, statut, message: messages.join(" ") || null });
  }

  const nbErreurs = lignes.filter((l) => l.statut === "erreur").length;
  const nbAvertissements = lignes.filter((l) => l.statut === "avertissement").length;
  const nbDoublons = lignes.filter((l) => l.statut === "doublon").length;
  const nbValides = lignes.filter((l) => l.statut === "ok" || l.statut === "avertissement").length;

  return { ok: true, lignes, totalLignes: rows.length - 1, nbValides, nbErreurs, nbAvertissements, nbDoublons };
}
