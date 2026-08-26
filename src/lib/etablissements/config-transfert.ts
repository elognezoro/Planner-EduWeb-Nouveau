import type { Etablissement } from "@prisma/client";

/**
 * Export / import de la configuration d'un établissement — sérialisation et validation
 * PARTAGÉES entre la route d'export JSON, l'action d'import et la sauvegarde de la
 * configuration : tout champ ajouté à l'export doit l'être aussi à la liste blanche
 * d'import (et réciproquement), avec les mêmes règles de validation côté serveur.
 */

export interface PlageSansCours {
  jour: number;
  moment: string;
  /** Niveaux scolaires concernés (ids) — absent ou vide = TOUT l'établissement. */
  niveauIds?: string[];
  /** « EPS uniquement » : ferme la demi-journée aux cours EN SALLE mais laisse l'EPS (les niveaux
   * concernés y font EPS, ce qui libère leur salle attitrée). Ne s'applique qu'à matin/apresmidi. */
  saufEps?: boolean;
}
export interface ConditionVacation {
  libelle: string;
  doubleVacation: boolean;
}

const FORMAT_HHMM = /^(\d{1,2}):([0-5]\d)$/;

/** Normalise une heure « HH:MM » (tolère « 7:30 » → « 07:30 ») ; null si vide ou invalide. */
export function heureHHMM(v: unknown): string | null {
  const m = FORMAT_HHMM.exec(String(v ?? "").trim());
  return m && Number(m[1]) <= 23 ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** Coercition booléenne fail-closed : seuls true / "true" / 1 / "1" / "on" valent vrai. */
export function booleen(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1" || v === "on";
}

/** Entier ≥ 0 (volumes horaires, effectifs…) ; toute valeur illisible retombe à 0. */
export function entierPositif(v: unknown): number {
  return Math.max(0, Math.round(Number(v) || 0));
}

/** Valide et déduplique les plages sans cours ; null si la structure d'ensemble est invalide. */
export function validerPlagesSansCours(brut: unknown): PlageSansCours[] | null {
  if (!Array.isArray(brut) || brut.length > 60) return null;
  const vus = new Set<string>();
  const plages: PlageSansCours[] = [];
  for (const p of brut) {
    const jour = Number((p as { jour?: unknown })?.jour);
    const moment = String((p as { moment?: unknown })?.moment ?? "");
    if (!Number.isInteger(jour) || jour < 0 || jour > 4) continue;
    if (!["matin", "apresmidi", "journee"].includes(moment)) continue;
    // Niveaux concernés (facultatif) : identifiants dédupliqués — absent/vide = tout
    // l'établissement. Deux entrées même jour/moment mais niveaux différents coexistent.
    const brutNiveaux = (p as { niveauIds?: unknown })?.niveauIds;
    const niveauIds = Array.isArray(brutNiveaux)
      ? [...new Set(brutNiveaux.map((n) => String(n).trim()).filter((n) => n.length > 0 && n.length <= 50))].slice(0, 40)
      : [];
    // « EPS uniquement » : n'a de sens que sur une demi-journée (matin/apresmidi).
    const saufEps = booleen((p as { saufEps?: unknown })?.saufEps) && moment !== "journee";
    const cle = `${jour}:${moment}:${saufEps ? "eps" : ""}:${[...niveauIds].sort().join("|")}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const base: PlageSansCours = niveauIds.length > 0 ? { jour, moment, niveauIds } : { jour, moment };
    plages.push(saufEps ? { ...base, saufEps: true } : base);
  }
  return plages;
}

/** Valide et déduplique les paramètres conditionnels de vacation ; null si structure invalide. */
export function validerConditionsVacation(brut: unknown): ConditionVacation[] | null {
  if (!Array.isArray(brut) || brut.length > 50) return null;
  const vus = new Set<string>();
  const conditions: ConditionVacation[] = [];
  for (const c of brut) {
    const libelle = String((c as { libelle?: unknown })?.libelle ?? "").trim().slice(0, 80);
    if (!libelle || vus.has(libelle.toLowerCase())) continue;
    vus.add(libelle.toLowerCase());
    conditions.push({ libelle, doubleVacation: Boolean((c as { doubleVacation?: unknown })?.doubleVacation) });
  }
  return conditions;
}

/** Champs scalaires de l'établissement sérialisés dans l'export JSON de configuration. */
export function configEtablissementExportee(etab: Etablissement) {
  return {
    nom: etab.nom, type: etab.type, statut: etab.statut, code: etab.code, ville: etab.ville,
    pays: etab.pays, sloganBulletin: etab.sloganBulletin, ministere: etab.ministere,
    anneeScolaire: etab.anneeScolaire, fonctionChef: etab.fonctionChef, nomChef: etab.nomChef, prenomsChef: etab.prenomsChef,
    planRapport: etab.planRapport, presentationRapport: etab.presentationRapport,
    effectifSouhaiteParClasse: etab.effectifSouhaiteParClasse,
    nbSallesDisponibles: etab.nbSallesDisponibles, creneauxParJour: etab.creneauxParJour,
    horaireDebutMatin: etab.horaireDebutMatin, horairePauseMatinDebut: etab.horairePauseMatinDebut,
    horairePauseMatinFin: etab.horairePauseMatinFin, horairePauseMidiDebut: etab.horairePauseMidiDebut,
    horaireRepriseApresMidi: etab.horaireRepriseApresMidi, horaireFinJournee: etab.horaireFinJournee,
    // Contraintes d'emploi du temps paramétrables (bloc éponyme de schema.prisma)
    reposEnseignant: etab.reposEnseignant,
    regrouperHeuresCreuses: etab.regrouperHeuresCreuses,
    autoriserHeuresCreuses: etab.autoriserHeuresCreuses,
    doubleVacationMatin: etab.doubleVacationMatin,
    epsDemiJourneeOpposee: etab.epsDemiJourneeOpposee,
    salleFixeParClasse: etab.salleFixeParClasse,
    epsMatinDebut: etab.epsMatinDebut, epsMatinFin: etab.epsMatinFin,
    epsApresMidiDebut: etab.epsApresMidiDebut, epsApresMidiFin: etab.epsApresMidiFin,
    volumeHoraire1erCycle: etab.volumeHoraire1erCycle,
    volumeHoraire2ndCycle: etab.volumeHoraire2ndCycle,
    conditionsVacation: etab.conditionsVacation,
    plagesSansCours: etab.plagesSansCours,
    interdireMemeDisciplineConsecutive: etab.interdireMemeDisciplineConsecutive,
    interdireLitterairesConsecutifs: etab.interdireLitterairesConsecutifs,
    interdireScientifiquesConsecutifs: etab.interdireScientifiquesConsecutifs,
    eviterSeanceIsoleeEnseignant: etab.eviterSeanceIsoleeEnseignant,
    limiterDisciplineParDemiJournee: etab.limiterDisciplineParDemiJournee,
    eviterMemeDisciplineFinJournee: etab.eviterMemeDisciplineFinJournee,
  };
}

// ── Listes blanches d'import (miroir de configEtablissementExportee) ──
// Champs texte copiés tels quels (comportement historique).
const CHAMPS_IMPORT_BRUTS = [
  "nom", "type", "statut", "code", "ville", "pays", "sloganBulletin", "ministere",
  "anneeScolaire", "fonctionChef", "nomChef", "prenomsChef", "planRapport", "presentationRapport",
];
// Dimensionnement & volumes horaires dus par enseignant (plafonds du solveur) : entiers ≥ 0.
const CHAMPS_IMPORT_ENTIERS = [
  "effectifSouhaiteParClasse", "nbSallesDisponibles", "creneauxParJour",
  "volumeHoraire1erCycle", "volumeHoraire2ndCycle",
];
// Horaires journaliers « HH:MM » : normalisés, valeur illisible → null.
const CHAMPS_IMPORT_HORAIRES = [
  "horaireDebutMatin", "horairePauseMatinDebut", "horairePauseMatinFin",
  "horairePauseMidiDebut", "horaireRepriseApresMidi", "horaireFinJournee",
];
// Contraintes d'emploi du temps à bascule : coercition booléenne stricte.
const CHAMPS_IMPORT_BOOLEENS = [
  "reposEnseignant", "regrouperHeuresCreuses", "autoriserHeuresCreuses",
  "epsDemiJourneeOpposee", "salleFixeParClasse",
  "interdireMemeDisciplineConsecutive", "interdireLitterairesConsecutifs",
  "interdireScientifiquesConsecutifs", "eviterSeanceIsoleeEnseignant",
  "limiterDisciplineParDemiJournee", "eviterMemeDisciplineFinJournee",
];
// Plages d'EPS importées PAR PAIRE (mêmes règles de cohérence qu'à la sauvegarde : début ET
// fin valides, fin > début) — une paire incomplète ou incohérente est neutralisée (null/null).
const PAIRES_EPS = [
  ["epsMatinDebut", "epsMatinFin"],
  ["epsApresMidiDebut", "epsApresMidiFin"],
] as const;

/**
 * Construit les données Prisma d'un import de configuration à partir du bloc
 * « etablissement » du fichier JSON. Seuls les champs de la liste blanche PRÉSENTS dans le
 * fichier sont retenus, chacun revalidé côté serveur (mêmes règles que la sauvegarde de la
 * configuration — ne jamais faire confiance au fichier). `erreur` est renseignée (et
 * l'import doit être refusé) si une structure d'ensemble est invalide.
 */
export function donneesImportEtablissement(
  e: Record<string, unknown>,
): { data: Record<string, unknown>; erreur?: string } {
  const data: Record<string, unknown> = {};
  for (const k of CHAMPS_IMPORT_BRUTS) if (k in e) data[k] = e[k];
  for (const k of CHAMPS_IMPORT_ENTIERS) if (k in e) data[k] = entierPositif(e[k]);
  for (const k of CHAMPS_IMPORT_HORAIRES) if (k in e) data[k] = heureHHMM(e[k]);
  for (const k of CHAMPS_IMPORT_BOOLEENS) if (k in e) data[k] = booleen(e[k]);
  if ("doubleVacationMatin" in e) {
    data.doubleVacationMatin = e.doubleVacationMatin === "pairs" ? "pairs" : "impairs";
  }
  for (const [cleDebut, cleFin] of PAIRES_EPS) {
    if (!(cleDebut in e) && !(cleFin in e)) continue;
    const debut = heureHHMM(e[cleDebut]);
    const fin = heureHHMM(e[cleFin]);
    const valide = debut !== null && fin !== null && debut < fin;
    data[cleDebut] = valide ? debut : null;
    data[cleFin] = valide ? fin : null;
  }
  if ("plagesSansCours" in e) {
    const plages = validerPlagesSansCours(e.plagesSansCours);
    if (!plages) return { data, erreur: "Plages sans cours invalides dans le fichier." };
    data.plagesSansCours = plages;
  }
  if ("conditionsVacation" in e) {
    const conditions = validerConditionsVacation(e.conditionsVacation);
    if (!conditions) return { data, erreur: "Paramètres de vacation invalides dans le fichier." };
    data.conditionsVacation = conditions;
  }
  return { data };
}
