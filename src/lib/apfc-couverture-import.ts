/**
 * Import CSV en lot des établissements couverts par une APFC (compétence territoriale de
 * l'antenne — table `CouvertureApfc`).
 *
 * Module PUR (aucune dépendance serveur/DOM), à l'image de `apfc-personnel-import.ts` : le
 * rapprochement se fait cependant TOUJOURS côté serveur (répertoire trop volumineux — 41 000+
 * établissements — pour être expédié au client), via `previsualiserImportCouvertureApfc` /
 * `importerCouverturesApfcCSV` (src/lib/formation/actions.ts), qui appellent toutes deux
 * `analyserImportCouvertureApfc` ci-dessous pour garantir un aperçu et un import cohérents.
 *
 * Format attendu : une ligne = un établissement. Colonnes reconnues : `code` (PRIORITAIRE pour le
 * rapprochement — identifiant unique) et/ou `nom` (+ `ville` optionnelle pour désambiguïser en
 * cas d'homonymie). Rapprochement insensible à la casse et aux accents.
 */

import { parseCSV, clefTexte } from "@/lib/apfc-import";

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clefColonne = (s: string) => sansAccent(s).toLowerCase().trim().replace(/\s+/g, "_");
const clefCode = (s: string) => sansAccent(s).toLowerCase().trim().replace(/\s+/g, "");

const ALIAS: Record<string, string[]> = {
  code: ["code", "code_etablissement", "matricule", "identifiant"],
  nom: ["nom", "etablissement", "nom_etablissement", "name", "designation", "denomination"],
  ville: ["ville", "localite", "commune", "city"],
};

/** Établissement candidat au rapprochement — répertoire du pays de l'APFC, avec sa couverture
 * ACTUELLE éventuelle (par une autre APFC) pour ne jamais lui « voler » silencieusement un
 * établissement déjà rattaché ailleurs. */
export interface EtabCandidatCouverture {
  id: string;
  nom: string;
  ville: string | null;
  code: string | null;
  /** Nom de l'APFC qui couvre déjà cet établissement (null si aucune). */
  couvertePar: string | null;
  /** Identifiant de cette APFC couvrante (null si aucune) — comparé à l'APFC en cours d'import. */
  couvertureApfcId: string | null;
}

export type StatutLigneCouverture = "ok" | "erreur" | "doublon" | "deja_couvert" | "ambigu";
export type LigneCouverturePlan = {
  ligne: number;
  saisieCode: string | null;
  saisieNom: string | null;
  saisieVille: string | null;
  etablissementId: string | null;
  etablissementNom: string | null;
  statut: StatutLigneCouverture;
  message: string | null;
};
export type AnalyseImportCouvertureApfc = {
  ok: boolean;
  messageFatal?: string;
  lignes: LigneCouverturePlan[];
  totalLignes: number;
  nbValides: number; // = « ok » = importables
  nbErreurs: number;
  nbDoublons: number;
  nbDejaCouverts: number;
  nbAmbigus: number;
};

const vide = (extra: Partial<AnalyseImportCouvertureApfc>): AnalyseImportCouvertureApfc => ({
  ok: false, lignes: [], totalLignes: 0, nbValides: 0, nbErreurs: 0, nbDoublons: 0, nbDejaCouverts: 0, nbAmbigus: 0, ...extra,
});

/**
 * Analyse un CSV d'établissements en plan d'import : une ligne par établissement, rapproché
 * du répertoire (`candidats`) — par code en priorité, sinon par nom (+ ville pour lever une
 * ambiguïté). `dejaCouvertsParCetteApfc` évite de ré-importer des établissements déjà rattachés
 * à L'APFC en cours d'édition (pas une erreur bloquante, un simple doublon silencieux).
 */
export function analyserImportCouvertureApfc(
  texte: string,
  candidats: EtabCandidatCouverture[],
  apfcIdCourant: string,
  dejaCouvertsParCetteApfc: Set<string> = new Set(),
): AnalyseImportCouvertureApfc {
  const rows = parseCSV(texte);
  if (rows.length < 2) {
    return vide({ messageFatal: "Le fichier doit contenir une ligne d'en-tête puis au moins une ligne de données." });
  }

  const entete = rows[0].cells.map(clefColonne);
  const idxDe = (champ: string) => entete.findIndex((e) => ALIAS[champ].includes(e));
  const iCode = idxDe("code");
  const iNom = idxDe("nom");
  const iVille = idxDe("ville");

  if (iCode === -1 && iNom === -1) {
    return vide({
      totalLignes: rows.length - 1,
      messageFatal: "Colonne obligatoire manquante : « code » et/ou « nom ». Téléchargez le modèle CSV pour le format attendu.",
    });
  }

  const parCode = new Map(candidats.filter((c) => c.code).map((c) => [clefCode(c.code as string), c]));
  const parNom = new Map<string, EtabCandidatCouverture[]>();
  for (const c of candidats) {
    const cle = clefTexte(c.nom);
    const liste = parNom.get(cle);
    if (liste) liste.push(c);
    else parNom.set(cle, [c]);
  }

  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
  const vus = new Set<string>(); // dédoublonnage intra-fichier, une fois l'établissement résolu
  const lignes: LigneCouverturePlan[] = [];

  for (let r = 1; r < rows.length; r++) {
    const ligneNum = rows[r].ligne;
    const row = rows[r].cells;
    const saisieCode = iCode >= 0 ? cell(row, iCode) || null : null;
    const saisieNom = iNom >= 0 ? cell(row, iNom) || null : null;
    const saisieVille = iVille >= 0 ? cell(row, iVille) || null : null;

    if (!saisieCode && !saisieNom) {
      lignes.push({ ligne: ligneNum, saisieCode, saisieNom, saisieVille, etablissementId: null, etablissementNom: null, statut: "erreur", message: "Ni code ni nom renseigné — ligne ignorée." });
      continue;
    }

    let trouve: EtabCandidatCouverture | null = saisieCode ? parCode.get(clefCode(saisieCode)) ?? null : null;
    let ambigu = false;

    if (!trouve && saisieNom) {
      const correspondants = parNom.get(clefTexte(saisieNom)) ?? [];
      if (correspondants.length === 1) {
        trouve = correspondants[0];
      } else if (correspondants.length > 1) {
        const filtres = saisieVille
          ? correspondants.filter((c) => c.ville && clefTexte(c.ville) === clefTexte(saisieVille))
          : [];
        if (filtres.length === 1) trouve = filtres[0];
        else ambigu = true;
      }
    }

    if (ambigu) {
      lignes.push({
        ligne: ligneNum, saisieCode, saisieNom, saisieVille, etablissementId: null, etablissementNom: null,
        statut: "ambigu", message: "Plusieurs établissements correspondent à ce nom — précisez le code ou la ville.",
      });
      continue;
    }
    if (!trouve) {
      lignes.push({
        ligne: ligneNum, saisieCode, saisieNom, saisieVille, etablissementId: null, etablissementNom: null,
        statut: "erreur", message: "Établissement introuvable dans le répertoire.",
      });
      continue;
    }

    if (vus.has(trouve.id) || dejaCouvertsParCetteApfc.has(trouve.id)) {
      lignes.push({
        ligne: ligneNum, saisieCode, saisieNom, saisieVille, etablissementId: trouve.id, etablissementNom: trouve.nom,
        statut: "doublon", message: "Doublon dans le fichier ou déjà couvert par cette antenne — ligne ignorée.",
      });
      continue;
    }
    if (trouve.couvertureApfcId && trouve.couvertureApfcId !== apfcIdCourant) {
      lignes.push({
        ligne: ligneNum, saisieCode, saisieNom, saisieVille, etablissementId: trouve.id, etablissementNom: trouve.nom,
        statut: "deja_couvert", message: `Déjà couvert par « ${trouve.couvertePar ?? "une autre antenne"} » — non déplacé.`,
      });
      continue;
    }

    vus.add(trouve.id);
    lignes.push({ ligne: ligneNum, saisieCode, saisieNom, saisieVille, etablissementId: trouve.id, etablissementNom: trouve.nom, statut: "ok", message: null });
  }

  const nbErreurs = lignes.filter((l) => l.statut === "erreur").length;
  const nbDoublons = lignes.filter((l) => l.statut === "doublon").length;
  const nbDejaCouverts = lignes.filter((l) => l.statut === "deja_couvert").length;
  const nbAmbigus = lignes.filter((l) => l.statut === "ambigu").length;
  const nbValides = lignes.filter((l) => l.statut === "ok").length;

  return { ok: true, lignes, totalLignes: rows.length - 1, nbValides, nbErreurs, nbDoublons, nbDejaCouverts, nbAmbigus };
}
