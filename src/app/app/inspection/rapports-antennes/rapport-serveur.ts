import "server-only";
import { prisma } from "@/lib/prisma";
import {
  deriveCategoriePedagogique,
  estCategoriePedagogiqueValide,
  estPrimaireOuPrescolaire,
} from "@/lib/referentiels/etablissement";
import { enteteBaseApfc, lireDisciplinesJson, type ApfcRapport } from "@/lib/inspection/portee-apfc-rapports";
import {
  completerEntete,
  disciplinesElementaires,
  nombreDeCellule,
  normaliserComparaison as norm,
  type EnteteRapport,
} from "@/lib/inspection/rapport-commun";
import { lireContenuRapport } from "@/lib/inspection/rapport-disciplinaire";
import {
  ACTIVITES_ORDRE_LIGNES,
  BLOCS_AUTO,
  CORRESPONDANCES_CRD,
  ORDRES,
  contenuAntenneParDefaut,
  dateIsoEnFrancais,
  enteteDepuisContenuInconnu,
  lireContenuAntenneV2,
  lireStructureModeleAntenne,
  nomLongTrimestre,
  tableauAutoStub,
  titreTypeAntenne,
  typeModeleAntenne,
  type CleBlocAuto,
  type ContenuRapportAntenne,
  type FenetreDonnees,
  type Ordre,
  type PeriodeAntenne,
  type SectionPlan,
  type StructureModeleAntenne,
  type TableauSection,
  type TypeRapportAntenne,
} from "@/lib/inspection/rapport-antenne";

/**
 * Côté SERVEUR des rapports TRIMESTRIEL et ANNUEL d'antenne (page « Rapports d'antennes »),
 * contenu v2 « plan hiérarchique » : calcul des BLOCS AUTO du catalogue pour la FENÊTRE de
 * période choisie (visites, grilles, sessions, personnel, agrégations des rapports CRD et
 * trimestriels), chargement du rapport enregistré (jamais altéré, sauf régénération demandée)
 * et pré-remplissage du plan par défaut. Le PÉRIMÈTRE de lecture, la GARDE d'écriture et
 * l'en-tête par défaut viennent du module PARTAGÉ `portee-apfc-rapports.ts` — réexportés
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

// ── Modèles personnels (structure v2 « plan sans les chiffres ») ──

/** Modèle personnel de l'utilisateur pour ce type de rapport d'antenne — null si aucun. */
export async function chargerModeleAntenne(
  utilisateurId: string,
  type: TypeRapportAntenne,
): Promise<StructureModeleAntenne | null> {
  const modele = await prisma.modeleRapport.findUnique({
    where: { proprietaireId_typeRapport: { proprietaireId: utilisateurId, typeRapport: typeModeleAntenne(type) } },
    select: { structure: true },
  });
  return modele ? lireStructureModeleAntenne(modele.structure) : null;
}

// ── En-tête officiel par défaut (base commune, sans ligne de coordination disciplinaire) ──

export async function enteteParDefautAntenne(apfc: ApfcRapport): Promise<EnteteRapport> {
  return enteteBaseApfc(apfc);
}

/** Période persistée (clé du rapport) : « 2025-2026-T1 » / « 2025-2026 ». */
export function chainePeriode(periode: PeriodeAntenne): string {
  return periode.trimestre ? `${periode.annee}-${periode.trimestre}` : periode.annee;
}

// ── Collecte des DONNÉES de la fenêtre (espaces de l'APFC) et construction des blocs AUTO ──

export interface SourcesAgregees {
  crd: number;
  trimestriels: number;
}

interface StatsOrdre {
  visites: number;
  touches: number;
  grilles: number;
}

/** Données d'introduction (rapport annuel : couverture + effectifs d'encadrement). */
export interface StatsIntroduction {
  couverture: Record<Ordre, number>;
  personnel: number;
  conseillers: number;
}

/** Blocs AUTO calculés pour la fenêtre + sources agrégées + stats d'introduction. */
export interface ContexteBlocs {
  blocs: Record<CleBlocAuto, TableauSection>;
  sources: SourcesAgregees;
  stats: StatsIntroduction;
}

/** Ordre d'enseignement d'un établissement couvert (type « cafop » prioritaire). */
function ordreEtablissement(e: { categoriePedagogique: string | null; type: string }): Ordre {
  if (norm(e.type).includes("cafop")) return "cafop";
  const cat =
    e.categoriePedagogique && estCategoriePedagogiqueValide(e.categoriePedagogique)
      ? e.categoriePedagogique
      : deriveCategoriePedagogique(e.type);
  return estPrimaireOuPrescolaire(cat) ? "primaire" : "secondaire";
}

/** Somme tolérante d'une cellule numérique (cellule non numérique ignorée). */
function ajouterCellule(cible: number, cellule: string): number {
  const n = nombreDeCellule(cellule);
  return n == null ? cible : cible + n;
}

/**
 * Calcule TOUS les blocs AUTO du catalogue pour la fenêtre de période :
 * - visites RÉALISÉES des encadreurs de l'antenne dans les établissements couverts (par ordre
 *   d'enseignement — type « cafop » / préscolaire-primaire / secondaire), enseignants touchés
 *   distincts, grilles de supervision remplies (« contrôle des auxiliaires ») ;
 * - sessions de formation continue de l'antenne (Cohorte `apfc_session`) dans la fenêtre ;
 * - répartition des Encadreurs Pédagogiques par CRD (PersonnelApfc + conseillers rattachés) ;
 * - agrégation des rapports CRD enregistrés (correspondances par nature, parse tolérant) et,
 *   pour l'ANNUEL, des rapports trimestriels v2 enregistrés de la même année scolaire.
 */
export async function preparerBlocsAuto(
  apfc: ApfcRapport,
  type: TypeRapportAntenne,
  periode: PeriodeAntenne,
  fenetre: FenetreDonnees,
): Promise<ContexteBlocs> {
  // 1. Établissements couverts, classés par ordre d'enseignement.
  const etablissements = await prisma.etablissement.findMany({
    where: { couvertureApfc: { is: { apfcId: apfc.id } } },
    select: { id: true, categoriePedagogique: true, type: true },
  });
  const ordreParEtablissement = new Map<string, Ordre>(etablissements.map((e) => [e.id, ordreEtablissement(e)]));
  const ids = etablissements.map((e) => e.id);
  const couverture: Record<Ordre, number> = { secondaire: 0, primaire: 0, cafop: 0 };
  for (const ordre of ordreParEtablissement.values()) couverture[ordre] += 1;

  // 2. Visites réalisées de la fenêtre (+ grilles remplies) et sessions de formation continue.
  const [visites, ateliers, personnel, conseillers, rapportsCrd, trimestriels] = await Promise.all([
    ids.length
      ? prisma.visite.findMany({
          where: {
            inspecteur: { apfcId: apfc.id },
            etablissementId: { in: ids },
            statut: "realisee",
            date: { gte: fenetre.debut, lt: fenetre.finExclusive },
          },
          select: { etablissementId: true, enseignantId: true, grille: { select: { id: true } } },
        })
      : Promise.resolve([]),
    prisma.cohorte.count({
      where: {
        apfcId: apfc.id,
        type: "apfc_session",
        OR: [
          { dateDebut: { gte: fenetre.debut, lt: fenetre.finExclusive } },
          { dateDebut: null, creeLe: { gte: fenetre.debut, lt: fenetre.finExclusive } },
        ],
      },
    }),
    prisma.personnelApfc.findMany({
      where: { apfcId: apfc.id },
      select: { fonction: true, disciplines: true },
    }),
    prisma.utilisateur.findMany({
      where: { apfcId: apfc.id, roleActif: { nomTechnique: "conseiller_pedagogique" } },
      select: { specialites: true },
    }),
    prisma.rapportDisciplinaire.findMany({ where: { apfcId: apfc.id }, select: { contenu: true } }),
    type === "annuel"
      ? prisma.rapportAntenne.findMany({
          where: { apfcId: apfc.id, type: "trimestriel", periode: { startsWith: `${periode.annee}-` } },
          select: { contenu: true },
        })
      : Promise.resolve([]),
  ]);

  const parOrdre: Record<Ordre, StatsOrdre> = {
    secondaire: { visites: 0, touches: 0, grilles: 0 },
    primaire: { visites: 0, touches: 0, grilles: 0 },
    cafop: { visites: 0, touches: 0, grilles: 0 },
  };
  const touchesParOrdre: Record<Ordre, Set<string>> = {
    secondaire: new Set(),
    primaire: new Set(),
    cafop: new Set(),
  };
  for (const v of visites) {
    const ordre = ordreParEtablissement.get(v.etablissementId) ?? "secondaire";
    parOrdre[ordre].visites += 1;
    if (v.grille) parOrdre[ordre].grilles += 1;
    if (v.enseignantId) touchesParOrdre[ordre].add(v.enseignantId);
  }
  for (const ordre of ORDRES) parOrdre[ordre.cle].touches = touchesParOrdre[ordre.cle].size;

  // 3. Répartition des Encadreurs Pédagogiques par CRD (disciplines × fonctions).
  const fonctions = [
    ...new Set(personnel.map((p) => p.fonction?.trim() || "Encadreur Pédagogique")),
  ].slice(0, 8);
  const colonnesCrd = ["CRD", ...fonctions, ...(conseillers.length ? ["Conseillers Pédagogiques"] : []), "Total"];
  const parCrd = new Map<string, { libelle: string; compte: Map<string, number> }>();
  const compter = (disciplines: string[], colonne: string) => {
    for (const d of disciplines.flatMap((x) => disciplinesElementaires(x))) {
      const cle = norm(d);
      if (!cle) continue;
      const entree = parCrd.get(cle) ?? { libelle: d, compte: new Map<string, number>() };
      entree.compte.set(colonne, (entree.compte.get(colonne) ?? 0) + 1);
      parCrd.set(cle, entree);
    }
  };
  for (const p of personnel) compter(lireDisciplinesJson(p.disciplines), p.fonction?.trim() || "Encadreur Pédagogique");
  for (const c of conseillers) compter(lireDisciplinesJson(c.specialites), "Conseillers Pédagogiques");
  const lignesCrd = [...parCrd.values()]
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"))
    .map((entree) => {
      const valeurs = colonnesCrd.slice(1, -1).map((f) => entree.compte.get(f) ?? 0);
      return [entree.libelle, ...valeurs.map(String), String(valeurs.reduce((s, n) => s + n, 0))];
    });

  // 4. Agrégation des rapports CRD enregistrés (parse tolérant, correspondances par nature).
  const cumulsCrd = CORRESPONDANCES_CRD.map(() => ({ prevue: 0, realisee: 0, touches: 0, attendus: 0, trouve: false }));
  for (const r of rapportsCrd) {
    const crd = lireContenuRapport(r.contenu);
    const tables: { lignes: string[][]; prevue: number; realisee: number; touches: number | null; attendus: number | null }[] = [
      { lignes: crd.activitesPrimaire, prevue: 1, realisee: 2, touches: 5, attendus: 4 },
      { lignes: crd.activitesSecondaire, prevue: 1, realisee: 2, touches: 5, attendus: 4 },
      { lignes: crd.activitesComplement, prevue: 2, realisee: 3, touches: null, attendus: null },
    ];
    CORRESPONDANCES_CRD.forEach((corr, i) => {
      const sources = new Set(corr.sources.map((s) => norm(s)));
      for (const t of tables) {
        for (const ligne of t.lignes) {
          if (!sources.has(norm(ligne[0] ?? ""))) continue;
          const avant = cumulsCrd[i].prevue + cumulsCrd[i].realisee + cumulsCrd[i].touches + cumulsCrd[i].attendus;
          cumulsCrd[i].prevue = ajouterCellule(cumulsCrd[i].prevue, ligne[t.prevue] ?? "");
          cumulsCrd[i].realisee = ajouterCellule(cumulsCrd[i].realisee, ligne[t.realisee] ?? "");
          if (t.touches != null) cumulsCrd[i].touches = ajouterCellule(cumulsCrd[i].touches, ligne[t.touches] ?? "");
          if (t.attendus != null) cumulsCrd[i].attendus = ajouterCellule(cumulsCrd[i].attendus, ligne[t.attendus] ?? "");
          const apres = cumulsCrd[i].prevue + cumulsCrd[i].realisee + cumulsCrd[i].touches + cumulsCrd[i].attendus;
          if (apres !== avant) cumulsCrd[i].trouve = true;
        }
      }
    });
  }
  const lignesAgregationCrd = CORRESPONDANCES_CRD.flatMap((corr, i) =>
    cumulsCrd[i].trouve
      ? [[corr.nature, String(cumulsCrd[i].prevue), String(cumulsCrd[i].realisee), String(cumulsCrd[i].touches), String(cumulsCrd[i].attendus)]]
      : [],
  );

  // 5. Agrégation des rapports TRIMESTRIELS v2 de la même année (récapitulatifs sommés).
  let nbTrimestriels = 0;
  const sommeRecap = { activites: [0, 0, 0, 0], touches: [0, 0, 0, 0] };
  for (const r of trimestriels) {
    const v2 = lireContenuAntenneV2(r.contenu);
    if (!v2) continue;
    nbTrimestriels += 1;
    for (const section of v2.sections) {
      for (const t of section.tableaux) {
        const cible = t.source === "recap-activites" ? sommeRecap.activites : t.source === "recap-touches" ? sommeRecap.touches : null;
        if (!cible || !t.lignes[0]) continue;
        for (let i = 0; i < 4; i += 1) cible[i] = ajouterCellule(cible[i], t.lignes[0][i] ?? "");
      }
    }
  }

  // 6. Construction des tableaux du catalogue (insérés AVEC leurs chiffres, puis éditables).
  const totalActivites = (o: Ordre) =>
    parOrdre[o].visites + parOrdre[o].grilles + (o === "secondaire" ? ateliers : 0);
  const blocs = {} as Record<CleBlocAuto, TableauSection>;
  for (const { cle } of BLOCS_AUTO) blocs[cle] = tableauAutoStub(cle);
  for (const ordre of ORDRES) {
    const s = parOrdre[ordre.cle];
    const lignesActivites: string[][] = [
      [ACTIVITES_ORDRE_LIGNES[0], String(s.visites), String(s.touches)],
      [ACTIVITES_ORDRE_LIGNES[1], "0", ""],
      [ACTIVITES_ORDRE_LIGNES[2], String(ordre.cle === "secondaire" ? ateliers : 0), ""],
      [ACTIVITES_ORDRE_LIGNES[3], String(s.grilles), ""],
      ["Total", String(totalActivites(ordre.cle)), String(s.touches)],
    ];
    blocs[`activites-${ordre.cle}`].lignes = lignesActivites;
    blocs[`axe-2-${ordre.cle}`].lignes = [
      ["Visites de classes", "Visites de classes", String(s.visites), `${s.touches} enseignant(s) touché(s)`, "", ""],
      ["Classes ouvertes", "Classes ouvertes", "0", "", "", ""],
      ["Contrôle des auxiliaires pédagogiques", "Contrôle des auxiliaires pédagogiques", String(s.grilles), "", "", ""],
    ];
    blocs[`axe-3-${ordre.cle}`].lignes = [
      [
        "Ateliers / sessions de formation continue",
        "Sessions de formation continue de l'antenne",
        String(ordre.cle === "secondaire" ? ateliers : 0),
        "",
        "",
        "",
      ],
    ];
  }
  blocs["recap-activites"].lignes = [
    [
      String(totalActivites("secondaire")),
      String(totalActivites("primaire")),
      String(totalActivites("cafop")),
      String(totalActivites("secondaire") + totalActivites("primaire") + totalActivites("cafop")),
    ],
  ];
  blocs["recap-touches"].lignes = [
    [
      String(parOrdre.secondaire.touches),
      String(parOrdre.primaire.touches),
      String(parOrdre.cafop.touches),
      String(parOrdre.secondaire.touches + parOrdre.primaire.touches + parOrdre.cafop.touches),
    ],
  ];
  blocs["tableau-crd-encadreurs"].colonnes = colonnesCrd;
  blocs["tableau-crd-encadreurs"].lignes = lignesCrd;
  blocs["axes-vide"].lignes = [["", "", "", "", "", ""]];
  blocs["agregation-crd"].lignes = lignesAgregationCrd;
  blocs["agregation-trimestriels"].lignes =
    nbTrimestriels > 0
      ? [
          ["Activités menées", ...sommeRecap.activites.map(String)],
          ["Enseignants touchés", ...sommeRecap.touches.map(String)],
        ]
      : [];

  return {
    blocs,
    sources: { crd: rapportsCrd.length, trimestriels: nbTrimestriels },
    stats: { couverture, personnel: personnel.length, conseillers: conseillers.length },
  };
}

/** Ré-applique les blocs AUTO (colonnes + lignes recalculées) aux tableaux `source` du plan. */
export function remplirBlocsAuto(sections: SectionPlan[], blocs: Record<CleBlocAuto, TableauSection>): SectionPlan[] {
  return sections.map((s) => ({
    ...s,
    tableaux: s.tableaux.map((t) =>
      t.source && blocs[t.source]
        ? { ...t, colonnes: [...blocs[t.source].colonnes], lignes: blocs[t.source].lignes.map((l) => [...l]) }
        : t,
    ),
  }));
}

// ── Pré-remplissage du plan par défaut (textes générés + blocs auto chiffrés) ──

const nomComplet = (p: { prenoms?: string | null; nom?: string | null }): string =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim();

/** Section du plan repérée par son titre (sans casse/accents) — pour poser les textes générés. */
function sectionParTitre(sections: SectionPlan[], titre: string): SectionPlan | undefined {
  return sections.find((s) => norm(s.titre) === norm(titre));
}

function contenuPreRempli(
  apfc: ApfcRapport,
  type: TypeRapportAntenne,
  periode: PeriodeAntenne,
  fenetre: FenetreDonnees,
  ctx: ContexteBlocs,
  enteteBase: EnteteRapport,
): ContenuRapportAntenne {
  const contenu = contenuAntenneParDefaut(type, periode, fenetre);
  contenu.sections = remplirBlocsAuto(contenu.sections, ctx.blocs);
  contenu.entete = enteteBase;
  contenu.signataire = nomComplet({ prenoms: apfc.chefAntennePrenoms, nom: apfc.chefAntenneNom });

  const plage = `du ${dateIsoEnFrancais(fenetre.debutIso)} au ${dateIsoEnFrancais(fenetre.finIso)}`;
  const intro = sectionParTitre(contenu.sections, "INTRODUCTION");
  if (intro) {
    if (type === "trimestriel") {
      intro.texte =
        `Dans le cadre de ses missions d'encadrement pédagogique, l'antenne « ${apfc.nom} »` +
        `${apfc.region ? `, relevant de la Direction Régionale de ${apfc.region.nom},` : ""} a mené au cours du ` +
        `${nomLongTrimestre(periode.trimestre ?? "T1").toLowerCase()} trimestre de l'année scolaire ${periode.annee} ` +
        `(période ${plage}) des activités de suivi, d'encadrement et de formation au profit des enseignants des ` +
        `établissements placés sous sa responsabilité. Le présent bilan en présente l'état de réalisation, les ` +
        `difficultés rencontrées et les perspectives.`;
    } else {
      const c = ctx.stats.couverture;
      intro.texte =
        `L'antenne « ${apfc.nom} »${apfc.localite?.trim() ? `, sise à ${apfc.localite.trim()},` : ""}` +
        `${apfc.region ? ` relève de la Direction Régionale de ${apfc.region.nom}.` : "."} Sa compétence territoriale couvre ` +
        `${c.secondaire + c.primaire + c.cafop} établissement(s) (${c.secondaire} du secondaire, ${c.primaire} du ` +
        `préscolaire-primaire, ${c.cafop} de type CAFOP). Son encadrement pédagogique compte ${ctx.stats.personnel} ` +
        `membre(s) du personnel et ${ctx.stats.conseillers} conseiller(s) pédagogique(s) rattaché(s). Le présent rapport ` +
        `annuel d'activités couvre la période ${plage}.`;
    }
  }
  const conclusion = sectionParTitre(contenu.sections, "CONCLUSION");
  if (conclusion) {
    conclusion.texte =
      `Au terme de la période ${plage}, l'antenne se félicite de la mobilisation de ses encadreurs et des enseignants. ` +
      `Les difficultés relevées feront l'objet d'un suivi particulier et les perspectives dégagées seront mises en ` +
      `œuvre au cours de la période à venir.`;
  }
  return contenu;
}

// ── Chargement (rapport enregistré, régénération, sinon pré-rempli + modèle personnel) ──

export interface RapportAntenneCharge {
  titre: string;
  contenu: ContenuRapportAntenne;
  /** Vrai si le rapport AFFICHÉ est l'enregistrement en base (non recalculé). */
  enregistre: boolean;
  majLe: Date | null;
  rempliParNom: string | null;
  /** Sources agrégées du pré-remplissage/de la régénération — null si servi tel quel. */
  sources: SourcesAgregees | null;
}

/**
 * Rapport de (antenne, type, période) :
 * - ENREGISTRÉ au format v2 : servi TEL QUEL (jamais altéré) — sauf `regenerer`, où ses
 *   tableaux AUTO sont recalculés pour la fenêtre demandée et le rapport est marqué « non
 *   enregistré » tant que l'utilisateur n'enregistre pas ;
 * - ENREGISTRÉ à l'ANCIEN format (avant la refonte « plan ») : lecture TOLÉRANTE — en-tête et
 *   titre conservés, PLAN PAR DÉFAUT pré-rempli (aucun crash) ;
 * - NOUVEAU : plan par défaut pré-rempli (blocs auto chiffrés, textes générés), STRUCTURE du
 *   modèle personnel appliquée (plan sans chiffres → blocs auto re-générés), titre type.
 */
export async function chargerRapportAntenne(
  apfc: ApfcRapport,
  type: TypeRapportAntenne,
  periode: PeriodeAntenne,
  fenetre: FenetreDonnees,
  ctx: ContexteBlocs,
  modele: StructureModeleAntenne | null,
  regenerer: boolean,
): Promise<RapportAntenneCharge> {
  const enteteBase = await enteteParDefautAntenne(apfc);
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
    const v2 = lireContenuAntenneV2(existant.contenu);
    if (v2 && !regenerer) {
      return {
        titre: existant.titre ?? "",
        contenu: v2,
        enregistre: true,
        majLe: existant.majLe,
        rempliParNom: existant.rempliPar ? nomComplet(existant.rempliPar) || existant.rempliPar.email : null,
        sources: null,
      };
    }
    if (v2) {
      // Régénération demandée : blocs AUTO recalculés pour la fenêtre, le reste inchangé.
      return {
        titre: existant.titre ?? "",
        contenu: {
          ...v2,
          periode: { debut: fenetre.debutIso, fin: fenetre.finIso },
          sections: remplirBlocsAuto(v2.sections, ctx.blocs),
        },
        enregistre: false,
        majLe: existant.majLe,
        rempliParNom: null,
        sources: ctx.sources,
      };
    }
    // ANCIEN format (avant la refonte) : en-tête/titre conservés, plan par défaut pré-rempli.
    const contenu = contenuPreRempli(apfc, type, periode, fenetre, ctx, enteteBase);
    contenu.entete = completerEntete(enteteDepuisContenuInconnu(existant.contenu), contenu.entete);
    return {
      titre: existant.titre ?? "",
      contenu,
      enregistre: true,
      majLe: existant.majLe,
      rempliParNom: existant.rempliPar ? nomComplet(existant.rempliPar) || existant.rempliPar.email : null,
      sources: ctx.sources,
    };
  }

  // NOUVEAU rapport : plan par défaut pré-rempli, puis structure du modèle personnel.
  let contenu = contenuPreRempli(apfc, type, periode, fenetre, ctx, enteteBase);
  let titre = titreTypeAntenne(type, periode);
  if (modele && modele.sections.length > 0) {
    contenu = {
      ...contenu,
      sections: remplirBlocsAuto(modele.sections, ctx.blocs),
      entete: completerEntete(modele.entete, contenu.entete),
    };
    if (modele.titre.trim()) titre = modele.titre;
  } else if (modele) {
    contenu = { ...contenu, entete: completerEntete(modele.entete, contenu.entete) };
    if (modele.titre.trim()) titre = modele.titre;
  }
  return { titre, contenu, enregistre: false, majLe: null, rempliParNom: null, sources: ctx.sources };
}
