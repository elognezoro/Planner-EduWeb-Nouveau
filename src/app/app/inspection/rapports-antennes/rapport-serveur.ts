import "server-only";
import { prisma } from "@/lib/prisma";
import {
  chargerModelePersonnelDe,
  disciplinesPourApfc,
  enteteBaseApfc,
  etablissementsCouverts,
  type ApfcRapport,
} from "@/lib/inspection/portee-apfc-rapports";
import {
  MAX_LIGNES_TABLEAU,
  ligneVide,
  nombreDeCellule,
  normaliserComparaison as norm,
  nouvelId,
  pourcentage,
  type EnteteRapport,
} from "@/lib/inspection/rapport-commun";
import { lireContenuRapport } from "@/lib/inspection/rapport-disciplinaire";
import {
  CORRESPONDANCES_CRD,
  TABLEAUX_ACTIVITES_ANTENNE,
  TABLEAUX_RAPPORT_ANTENNE,
  TRIMESTRES,
  contenuAntenneParDefaut,
  estSectionAntenne,
  fenetrePeriode,
  indicesTableauActivites,
  lireContenuRapportAntenne,
  titreTypeAntenne,
  typeModeleAntenne,
  type CleActivitesAntenne,
  type ContenuRapportAntenne,
  type PeriodeAntenne,
  type StructureModeleAntenne,
  type TypeRapportAntenne,
} from "@/lib/inspection/rapport-antenne";
import { appliquerStructureModeleDe } from "@/lib/inspection/rapport-commun";

/**
 * Côté SERVEUR des rapports TRIMESTRIEL et ANNUEL d'antenne (page « Rapports d'antennes ») :
 * chargement du rapport enregistré et PRÉ-REMPLISSAGE — visites de la période, AGRÉGATION des
 * rapports CRD enregistrés (trimestriel et annuel) et des rapports TRIMESTRIELS enregistrés
 * (annuel), introduction générée. Le PÉRIMÈTRE de lecture, la GARDE d'écriture, l'en-tête par
 * défaut et les modèles personnels viennent du module PARTAGÉ
 * `src/lib/inspection/portee-apfc-rapports.ts` (commun avec le rapport CRD) — réexportés
 * ci-dessous pour la page, les actions et la route Word.
 */
export {
  apfcAutorisee,
  apfcsAccessibles,
  estRoleAntenne,
  filtreApfcRapport,
  peutAvoirModeleRapport,
  peutModifierRapportApfc,
  type ApfcRapport,
} from "@/lib/inspection/portee-apfc-rapports";

// ── Modèles personnels (typeRapport « antenne-trimestriel » / « antenne-annuel ») ──

/** Modèle personnel de l'utilisateur pour ce type de rapport d'antenne — null si aucun. */
export async function chargerModeleAntenne(
  utilisateurId: string,
  type: TypeRapportAntenne,
): Promise<StructureModeleAntenne | null> {
  return chargerModelePersonnelDe(utilisateurId, typeModeleAntenne(type), estSectionAntenne);
}

// ── En-tête officiel par défaut (base commune, sans ligne de coordination disciplinaire) ──

export async function enteteParDefautAntenne(apfc: ApfcRapport): Promise<EnteteRapport> {
  return enteteBaseApfc(apfc);
}

// ── Agrégation (parse TOLÉRANT : cellule non numérique ignorée, tout reste éditable) ──

/** Cumul des colonnes numériques d'une ligne d'activités. */
interface CumulLigne {
  prevue: number;
  realisee: number;
  touches: number;
  attendus: number;
  /** Au moins une valeur numérique rencontrée (sinon la ligne cible n'est pas modifiée). */
  trouve: boolean;
}

const cumulVide = (): CumulLigne => ({ prevue: 0, realisee: 0, touches: 0, attendus: 0, trouve: false });

/** Indices d'une ligne SOURCE (tableaux CRD ou tableaux d'antenne). */
interface IndicesSource {
  prevue: number | null;
  realisee: number | null;
  touches: number | null;
  attendus: number | null;
}

/** Additionne dans `cumul` les valeurs numériques lisibles de la ligne source. */
function accumuler(cumul: CumulLigne, ligne: string[], indices: IndicesSource): void {
  const lire = (i: number | null) => (i == null ? null : nombreDeCellule(ligne[i] ?? ""));
  const p = lire(indices.prevue);
  const r = lire(indices.realisee);
  const t = lire(indices.touches);
  const a = lire(indices.attendus);
  if (p != null) cumul.prevue += p;
  if (r != null) cumul.realisee += r;
  if (t != null) cumul.touches += t;
  if (a != null) cumul.attendus += a;
  if (p != null || r != null || t != null || a != null) cumul.trouve = true;
}

/** Recalcule la colonne pourcentage d'une ligne d'antenne (touchés / attendus). */
function recalculerPourcentage(ligne: string[], cle: CleActivitesAntenne): void {
  const idx = indicesTableauActivites(cle);
  if (idx.pourcentage == null || idx.touches == null || idx.attendus == null) return;
  const t = nombreDeCellule(ligne[idx.touches] ?? "");
  const a = nombreDeCellule(ligne[idx.attendus] ?? "");
  if (t != null && a != null) {
    const p = pourcentage(t, a);
    if (p) ligne[idx.pourcentage] = p;
  }
}

/** AJOUTE un cumul aux cellules numériques d'une ligne d'antenne (valeurs existantes conservées). */
function ajouterAuxCellules(ligne: string[], cle: CleActivitesAntenne, cumul: CumulLigne): void {
  const idx = indicesTableauActivites(cle);
  const poser = (i: number | null, v: number) => {
    if (i == null) return;
    const actuel = nombreDeCellule(ligne[i] ?? "") ?? 0;
    ligne[i] = String(actuel + v);
  };
  poser(idx.prevue, cumul.prevue);
  poser(idx.realisee, cumul.realisee);
  poser(idx.touches, cumul.touches);
  poser(idx.attendus, cumul.attendus);
  recalculerPourcentage(ligne, cle);
}

/** Ligne d'un tableau d'antenne dont la nature (colonne 1) correspond, sans casse/accents. */
function ligneParNature(contenu: ContenuRapportAntenne, cle: CleActivitesAntenne, nature: string): string[] | undefined {
  return contenu[cle].find((l) => norm(l[0] ?? "") === norm(nature));
}

/**
 * AGRÉGATION DES RAPPORTS CRD de l'antenne : pour chaque RapportDisciplinaire enregistré, les
 * lignes de ses tableaux d'activités dont la nature correspond à une source des
 * `CORRESPONDANCES_CRD[type]` sont ADDITIONNÉES (colonnes numériques, parse tolérant) dans la
 * ligne cible du rapport d'antenne. Renvoie le nombre de rapports CRD pris en compte.
 */
async function agregerRapportsCrd(
  contenu: ContenuRapportAntenne,
  type: TypeRapportAntenne,
  apfcId: string,
): Promise<number> {
  const rapports = await prisma.rapportDisciplinaire.findMany({ where: { apfcId }, select: { contenu: true } });
  if (rapports.length === 0) return 0;

  const correspondances = CORRESPONDANCES_CRD[type];
  const cumuls = correspondances.map(() => cumulVide());
  for (const r of rapports) {
    const crd = lireContenuRapport(r.contenu);
    // Tableaux CRD scannés, avec leurs indices : I-1/I-2 (Prévue 1, Réalisés 2, Total 4,
    // Touchés 5) et tableau complémentaire (Objet en 1 → Prévue 2, Réalisés 3).
    const tablesCrd: { lignes: string[][]; indices: IndicesSource }[] = [
      { lignes: crd.activitesPrimaire, indices: { prevue: 1, realisee: 2, touches: 5, attendus: 4 } },
      { lignes: crd.activitesSecondaire, indices: { prevue: 1, realisee: 2, touches: 5, attendus: 4 } },
      { lignes: crd.activitesComplement, indices: { prevue: 2, realisee: 3, touches: null, attendus: null } },
    ];
    correspondances.forEach((corr, i) => {
      const sources = new Set(corr.sources.map((s) => norm(s)));
      for (const table of tablesCrd) {
        for (const ligne of table.lignes) {
          if (sources.has(norm(ligne[0] ?? ""))) accumuler(cumuls[i], ligne, table.indices);
        }
      }
    });
  }
  correspondances.forEach((corr, i) => {
    if (!cumuls[i].trouve) return;
    const ligne = ligneParNature(contenu, corr.table, corr.nature);
    if (ligne) ajouterAuxCellules(ligne, corr.table, cumuls[i]);
  });
  return rapports.length;
}

/**
 * AGRÉGATION DES RAPPORTS TRIMESTRIELS enregistrés de la même année scolaire (rapport ANNUEL) :
 * les lignes de MÊME nature (sans casse/accents) sont additionnées dans le tableau annuel
 * correspondant ; une nature absente de l'annuel est AJOUTÉE en fin de tableau (transparence,
 * dans la limite des 40 lignes). Renvoie le nombre de rapports trimestriels pris en compte.
 */
async function agregerTrimestriels(
  contenu: ContenuRapportAntenne,
  apfcId: string,
  annee: string,
): Promise<number> {
  const rapports = await prisma.rapportAntenne.findMany({
    where: { apfcId, type: "trimestriel", periode: { startsWith: `${annee}-` } },
    select: { contenu: true },
  });
  if (rapports.length === 0) return 0;

  const cumuls = new Map<string, CumulLigne & { cle: CleActivitesAntenne; nature: string }>();
  for (const r of rapports) {
    const trimestriel = lireContenuRapportAntenne(r.contenu);
    for (const { cle } of TABLEAUX_ACTIVITES_ANTENNE) {
      const idx = indicesTableauActivites(cle);
      for (const ligne of trimestriel[cle]) {
        const nature = (ligne[0] ?? "").trim();
        if (!nature) continue;
        const cleCumul = `${cle}::${norm(nature)}`;
        const cumul = cumuls.get(cleCumul) ?? { ...cumulVide(), cle, nature };
        accumuler(cumul, ligne, idx);
        cumuls.set(cleCumul, cumul);
      }
    }
  }
  for (const cumul of cumuls.values()) {
    if (!cumul.trouve) continue;
    const existante = ligneParNature(contenu, cumul.cle, cumul.nature);
    if (existante) {
      ajouterAuxCellules(existante, cumul.cle, cumul);
    } else if (contenu[cumul.cle].length < MAX_LIGNES_TABLEAU) {
      const ligne = ligneVide(TABLEAUX_RAPPORT_ANTENNE[cumul.cle]);
      ligne[0] = cumul.nature;
      ajouterAuxCellules(ligne, cumul.cle, cumul);
      contenu[cumul.cle].push(ligne);
    }
  }
  return rapports.length;
}

// ── Visites de la période (données vivantes, fenêtre UTC) ──

interface StatsVoletVisites {
  prevues: number;
  realisees: number;
  touches: number;
  attendus: number;
}

/** FIXE (écrase) les colonnes chiffrées d'une ligne « Visites de classes » (fenêtre = source d'autorité). */
function fixerLigneVisites(ligne: string[], cle: CleActivitesAntenne, s: StatsVoletVisites): void {
  const idx = indicesTableauActivites(cle);
  if (idx.prevue != null) ligne[idx.prevue] = String(s.prevues);
  ligne[idx.realisee] = String(s.realisees);
  if (idx.touches != null) ligne[idx.touches] = String(s.touches);
  if (idx.attendus != null) ligne[idx.attendus] = String(s.attendus);
  if (idx.pourcentage != null) ligne[idx.pourcentage] = pourcentage(s.touches, s.attendus);
}

/**
 * Visites des encadreurs de l'antenne dans les établissements COUVERTS, sur la FENÊTRE de la
 * période (UTC) — réparties préscolaire/primaire vs secondaire ; « attendus » = enseignants
 * distincts (CompetenceEnseignant) des établissements couverts du volet.
 */
async function statsVisitesPeriode(
  apfc: ApfcRapport,
  periode: PeriodeAntenne,
): Promise<{ primaire: StatsVoletVisites; secondaire: StatsVoletVisites }> {
  const { ids, estPrimaire } = await etablissementsCouverts(apfc.id);
  const { debut, fin } = fenetrePeriode(periode);
  const [visites, competences] = await Promise.all([
    ids.length
      ? prisma.visite.findMany({
          where: {
            inspecteur: { apfcId: apfc.id },
            etablissementId: { in: ids },
            statut: { in: ["planifiee", "realisee"] },
            date: { gte: debut, lt: fin },
          },
          select: { etablissementId: true, enseignantId: true, statut: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.competenceEnseignant.findMany({
          where: { etablissementId: { in: ids } },
          select: { enseignantId: true, etablissementId: true },
        })
      : Promise.resolve([]),
  ]);

  const volets = {
    primaire: { prevues: 0, realisees: 0, touches: new Set<string>(), attendus: new Set<string>() },
    secondaire: { prevues: 0, realisees: 0, touches: new Set<string>(), attendus: new Set<string>() },
  };
  for (const c of competences) {
    (estPrimaire.get(c.etablissementId) ? volets.primaire : volets.secondaire).attendus.add(c.enseignantId);
  }
  for (const v of visites) {
    const volet = estPrimaire.get(v.etablissementId) ? volets.primaire : volets.secondaire;
    volet.prevues += 1;
    if (v.statut === "realisee") {
      volet.realisees += 1;
      if (v.enseignantId) volet.touches.add(v.enseignantId);
    }
  }
  const enStats = (v: (typeof volets)["primaire"]): StatsVoletVisites => ({
    prevues: v.prevues,
    realisees: v.realisees,
    touches: v.touches.size,
    attendus: v.attendus.size,
  });
  return { primaire: enStats(volets.primaire), secondaire: enStats(volets.secondaire) };
}

// ── Pré-remplissage complet ──

const nomComplet = (p: { prenoms?: string | null; nom?: string | null }): string =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim();

/** Cycle d'un encadreur, inféré du libellé de sa fonction (repli : secondaire). */
function cycleDeFonction(fonction: string | null | undefined): "secondaire" | "cafop" | "primaire" {
  const f = norm(fonction ?? "");
  if (f.includes("cafop")) return "cafop";
  if (f.includes("primaire") || f.includes("prescolaire") || f.includes("maternel")) return "primaire";
  return "secondaire";
}

/** Nombre de rapports AGRÉGÉS dans un pré-remplissage (panneau des sources). */
export interface SourcesAgregees {
  crd: number;
  trimestriels: number;
}

/**
 * Contenu PRÉ-REMPLI d'un rapport d'antenne :
 * 1. structure officielle du type (lignes par défaut du modèle Word) ;
 * 2. AGRÉGATION des rapports CRD enregistrés (correspondances par nature d'activité) — et,
 *    pour l'ANNUEL, des rapports TRIMESTRIELS enregistrés de la même année scolaire ;
 * 3. « Visites de classes » : ÉCRASÉES par les visites RÉELLES de la fenêtre de la période
 *    (source d'autorité, évite les doubles comptes avec les rapports CRD non périodisés) ;
 * 4. introduction générée (encadreurs par cycle, liste des CRD, plan I/II/III), conclusion,
 *    signataire (chef d'antenne de la fiche), en-tête officiel par défaut.
 * Tout reste éditable ; parse tolérant partout (cellule non numérique ignorée).
 */
export async function preRemplirContenuAntenne(
  apfc: ApfcRapport,
  type: TypeRapportAntenne,
  periode: PeriodeAntenne,
): Promise<{ contenu: ContenuRapportAntenne; sources: SourcesAgregees }> {
  const contenu = contenuAntenneParDefaut(type);

  // 2. Agrégations (CRD toujours ; trimestriels de la même année pour l'annuel).
  const sources: SourcesAgregees = {
    crd: await agregerRapportsCrd(contenu, type, apfc.id),
    trimestriels: type === "annuel" ? await agregerTrimestriels(contenu, apfc.id, periode.annee) : 0,
  };

  // 3. Visites réelles de la fenêtre de la période (écrasent les lignes « Visites de classes »).
  const visites = await statsVisitesPeriode(apfc, periode);
  if (type === "trimestriel") {
    const ligne = ligneParNature(contenu, "actSuivi", "Visites de classes");
    if (ligne) {
      fixerLigneVisites(ligne, "actSuivi", {
        prevues: visites.primaire.prevues + visites.secondaire.prevues,
        realisees: visites.primaire.realisees + visites.secondaire.realisees,
        touches: visites.primaire.touches + visites.secondaire.touches,
        attendus: visites.primaire.attendus + visites.secondaire.attendus,
      });
    }
  } else {
    const lignePrimaire = ligneParNature(contenu, "actSuivi", "Visites de classes /primaire/CAFOP");
    if (lignePrimaire) fixerLigneVisites(lignePrimaire, "actSuivi", visites.primaire);
    const ligneSecondaire = ligneParNature(contenu, "actSuivi", "Visites de classes /secondaire");
    if (ligneSecondaire) fixerLigneVisites(ligneSecondaire, "actSuivi", visites.secondaire);
  }

  // 4. Introduction générée : encadreurs par cycle (PersonnelApfc + conseillers rattachés)
  //    et liste des CRD (disciplines élémentaires de l'antenne — helper partagé).
  const [personnel, conseillers, disciplines] = await Promise.all([
    prisma.personnelApfc.findMany({ where: { apfcId: apfc.id }, select: { fonction: true } }),
    prisma.utilisateur.count({ where: { apfcId: apfc.id, roleActif: { nomTechnique: "conseiller_pedagogique" } } }),
    disciplinesPourApfc(apfc.id),
  ]);
  const cycles = { secondaire: conseillers, cafop: 0, primaire: 0 };
  for (const p of personnel) cycles[cycleDeFonction(p.fonction)] += 1;
  const total = personnel.length + conseillers;
  const details = [
    cycles.secondaire > 0 ? `${cycles.secondaire} pour le secondaire` : "",
    cycles.cafop > 0 ? `${cycles.cafop} pour le CAFOP` : "",
    cycles.primaire > 0 ? `${cycles.primaire} pour le préscolaire-primaire` : "",
  ].filter(Boolean);
  const libellePeriode =
    type === "trimestriel"
      ? `du ${(TRIMESTRES.find((t) => t.code === periode.trimestre)?.nomLong ?? "PREMIER").toLowerCase()} trimestre de l'année scolaire ${periode.annee}`
      : `de l'année scolaire ${periode.annee}`;
  contenu.introduction =
    `L'antenne « ${apfc.nom} » compte ${total} encadreur${total > 1 ? "s" : ""} pédagogique${total > 1 ? "s" : ""}` +
    `${details.length ? ` (${details.join(", ")})` : ""}.` +
    (disciplines.length
      ? ` Ses Coordinations Régionales Disciplinaires (CRD) couvrent : ${disciplines.join(", ")}.`
      : "") +
    ` Le présent rapport des activités ${libellePeriode} s'articule autour des points suivants : ` +
    `I – ${type === "annuel" ? "Activités des Coordinations Régionales" : "Activités pédagogiques réalisées"} ; ` +
    `II – État d'exécution des programmes ; III – Analyse des résultats des activités.`;
  contenu.conclusion =
    `Au terme ${libellePeriode}, l'antenne se félicite de la mobilisation de ses encadreurs et des enseignants. ` +
    `Les insuffisances relevées feront l'objet d'un suivi particulier, et les solutions proposées seront mises ` +
    `en œuvre au cours de la période à venir.`;
  contenu.signataire = nomComplet({ prenoms: apfc.chefAntennePrenoms, nom: apfc.chefAntenneNom });

  // Annuel : « thème de l'année » proposé comme zone libre de l'introduction (modèle officiel).
  if (type === "annuel") {
    contenu.zonesSupplementaires.introduction = [{ id: nouvelId(), titre: "Thème de l'année", texte: "" }];
  }

  // En-tête officiel par défaut (pays + antenne, sans ligne de coordination disciplinaire).
  contenu.entete = await enteteParDefautAntenne(apfc);

  return { contenu, sources };
}

// ── Chargement (rapport enregistré, sinon pré-rempli + modèle personnel) ──

export interface RapportAntenneCharge {
  titre: string;
  contenu: ContenuRapportAntenne;
  /** Vrai si un rapport enregistré existe en base pour (antenne, type, période). */
  enregistre: boolean;
  majLe: Date | null;
  rempliParNom: string | null;
  /** Sources agrégées du pré-remplissage — null pour un rapport déjà enregistré. */
  sources: SourcesAgregees | null;
}

/** Période persistée « 2025-2026-T1 » / « 2025-2026 ». */
export function chainePeriode(periode: PeriodeAntenne): string {
  return periode.trimestre ? `${periode.annee}-${periode.trimestre}` : periode.annee;
}

/**
 * Rapport de (antenne, type, période) : le rapport ENREGISTRÉ s'il existe (JAMAIS altéré à
 * l'ouverture), sinon un contenu PRÉ-REMPLI (agrégations + visites + textes générés) sur
 * lequel la STRUCTURE du modèle personnel est appliquée, et un titre TYPE du modèle officiel
 * (le titre type du modèle personnel prime s'il est renseigné). Utilisé par la page ET par
 * la route Word (jamais de contenu passé par l'URL).
 */
export async function chargerRapportAntenne(
  apfc: ApfcRapport,
  type: TypeRapportAntenne,
  periode: PeriodeAntenne,
  modele?: StructureModeleAntenne | null,
): Promise<RapportAntenneCharge> {
  const existant = await prisma.rapportAntenne.findUnique({
    where: { apfcId_type_periode: { apfcId: apfc.id, type, periode: chainePeriode(periode) } },
    select: {
      titre: true,
      contenu: true,
      majLe: true,
      rempliPar: { select: { prenoms: true, nom: true, email: true } },
    },
  });
  if (existant) {
    return {
      titre: existant.titre ?? "",
      contenu: lireContenuRapportAntenne(existant.contenu),
      enregistre: true,
      majLe: existant.majLe,
      rempliParNom: existant.rempliPar ? nomComplet(existant.rempliPar) || existant.rempliPar.email : null,
      sources: null,
    };
  }
  const { contenu, sources } = await preRemplirContenuAntenne(apfc, type, periode);
  let contenuFinal = contenu;
  let titre = titreTypeAntenne(type, periode);
  if (modele) {
    contenuFinal = appliquerStructureModeleDe(contenu, modele);
    if (modele.titre.trim()) titre = modele.titre;
  }
  return { titre, contenu: contenuFinal, enregistre: false, majLe: null, rempliParNom: null, sources };
}
