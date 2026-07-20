/**
 * Import CSV en lot du personnel d'une APFC (conseillers pédagogiques, formateurs…).
 *
 * Module PUR (aucune dépendance serveur/DOM) : utilisé à la fois côté client (aperçu avant
 * import, zone de glisser/déposer) et côté serveur (action `importerPersonnelApfcCSV`), à
 * l'image de `apfc-import.ts` pour les APFC elles-mêmes. Réutilise son parseur CSV robuste
 * (`parseCSV`) et sa clef de rapprochement insensible casse/accents (`clefTexte`).
 *
 * Format attendu : une ligne = une personne. Colonnes reconnues : `nom` (obligatoire), `prenoms`,
 * `fonction`, `disciplines` (plusieurs valeurs séparées par « | » ou « / » dans la cellule,
 * rapprochées du référentiel Discipline fourni — insensible casse/accents ; non reconnues
 * conservées telles quelles), `email`, `telephone`.
 */

import { parseCSV, clefTexte } from "@/lib/apfc-import";

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clefColonne = (s: string) => sansAccent(s).toLowerCase().trim().replace(/\s+/g, "_");

const ALIAS: Record<string, string[]> = {
  nom: ["nom", "noms", "lastname", "surname", "famille"],
  prenoms: ["prenoms", "prenom", "firstname", "givenname"],
  fonction: ["fonction", "role", "poste", "titre", "fonctions"],
  disciplines: ["discipline", "disciplines", "matiere", "matieres", "specialite", "specialites"],
  email: ["email", "mail", "courriel", "adresse_mail", "e_mail"],
  telephone: ["telephone", "tel", "phone", "contact", "telephones"],
};

/** Clef de rapprochement d'une personne (nom + prénoms), insensible casse/accents/espaces. */
export const clefPersonne = (nom: string, prenoms?: string | null) =>
  clefTexte(`${nom} ${prenoms ?? ""}`.replace(/\s+/g, " "));

// ── Types du plan d'import ──────────────────────────────────
export type StatutLignePersonnel = "ok" | "erreur" | "doublon";
export type LignePersonnelApfcPlan = {
  ligne: number;
  nom: string;
  prenoms: string | null;
  fonction: string | null;
  disciplines: string[];
  email: string | null;
  telephone: string | null;
  statut: StatutLignePersonnel;
  message: string | null;
};
export type AnalyseImportPersonnelApfc = {
  ok: boolean;
  messageFatal?: string;
  lignes: LignePersonnelApfcPlan[];
  totalLignes: number;
  nbValides: number; // = « ok » = importables
  nbErreurs: number;
  nbDoublons: number;
};

const vide = (extra: Partial<AnalyseImportPersonnelApfc>): AnalyseImportPersonnelApfc => ({
  ok: false, lignes: [], totalLignes: 0, nbValides: 0, nbErreurs: 0, nbDoublons: 0, ...extra,
});

/**
 * Analyse un CSV de personnel d'APFC en plan d'import : une ligne par personne, disciplines
 * rapprochées du référentiel fourni (insensible casse/accents, conservées telles quelles si
 * non reconnues), doublons détectés dans le fichier ET contre l'annuaire existant fourni.
 * Ne touche pas la base : la validation est rejouée côté serveur avant écriture.
 */
export function analyserImportPersonnelApfc(
  texte: string,
  disciplinesRef: string[],
  existants: { nom: string; prenoms: string | null }[] = [],
): AnalyseImportPersonnelApfc {
  const rows = parseCSV(texte);
  if (rows.length < 2) {
    return vide({ messageFatal: "Le fichier doit contenir une ligne d'en-tête puis au moins une ligne de données." });
  }

  const entete = rows[0].cells.map(clefColonne);
  const idxDe = (champ: string) => entete.findIndex((e) => ALIAS[champ].includes(e));
  const iNom = idxDe("nom");
  const iPrenoms = idxDe("prenoms");
  const iFonction = idxDe("fonction");
  const iDisciplines = idxDe("disciplines");
  const iEmail = idxDe("email");
  const iTelephone = idxDe("telephone");

  if (iNom === -1) {
    return vide({
      totalLignes: rows.length - 1,
      messageFatal: "Colonne obligatoire manquante : « nom ». Téléchargez le modèle CSV pour le format attendu.",
    });
  }

  const indexDisciplines = new Map(disciplinesRef.map((d) => [clefTexte(d), d]));
  const rapprocherDisciplines = (cellule: string): string[] =>
    cellule
      .split(/[|/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => indexDisciplines.get(clefTexte(s)) ?? s);

  const existantsSet = new Set(existants.map((e) => clefPersonne(e.nom, e.prenoms)));
  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
  const vus = new Set<string>();
  const lignes: LignePersonnelApfcPlan[] = [];

  for (let r = 1; r < rows.length; r++) {
    const ligneNum = rows[r].ligne;
    const row = rows[r].cells;
    const nom = cell(row, iNom);
    const prenoms = cell(row, iPrenoms) || null;
    const fonction = cell(row, iFonction) || null;
    const disciplines = iDisciplines >= 0 ? rapprocherDisciplines(cell(row, iDisciplines)) : [];
    const email = cell(row, iEmail) || null;
    const telephone = cell(row, iTelephone) || null;

    if (!nom) {
      lignes.push({ ligne: ligneNum, nom: "", prenoms, fonction, disciplines, email, telephone, statut: "erreur", message: "Nom manquant — ligne ignorée." });
      continue;
    }

    const cle = clefPersonne(nom, prenoms);
    if (vus.has(cle)) {
      lignes.push({ ligne: ligneNum, nom, prenoms, fonction, disciplines, email, telephone, statut: "doublon", message: "Doublon dans le fichier — ligne ignorée." });
      continue;
    }
    if (existantsSet.has(cle)) {
      lignes.push({ ligne: ligneNum, nom, prenoms, fonction, disciplines, email, telephone, statut: "doublon", message: "Déjà présent dans l'annuaire de l'APFC — ligne ignorée." });
      continue;
    }
    vus.add(cle);

    lignes.push({ ligne: ligneNum, nom, prenoms, fonction, disciplines, email, telephone, statut: "ok", message: null });
  }

  const nbErreurs = lignes.filter((l) => l.statut === "erreur").length;
  const nbDoublons = lignes.filter((l) => l.statut === "doublon").length;
  const nbValides = lignes.filter((l) => l.statut === "ok").length;

  return { ok: true, lignes, totalLignes: rows.length - 1, nbValides, nbErreurs, nbDoublons };
}
