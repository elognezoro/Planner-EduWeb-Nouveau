import "server-only";
import { prisma } from "@/lib/prisma";
import {
  chargerModelePersonnelDe,
  enteteBaseApfc,
  etablissementsCouverts,
  lireDisciplinesJson,
  type ApfcRapport,
} from "@/lib/inspection/portee-apfc-rapports";
import {
  INDEX_VISITES_PRIMAIRE,
  INDEX_VISITES_SECONDAIRE,
  MAX_DISCIPLINE,
  appliquerStructureModele,
  contenuParDefaut,
  disciplinesElementaires,
  estSectionOfficielle,
  lireContenuRapport,
  normaliserComparaison as norm,
  pourcentage,
  type ContenuRapport,
  type EnteteRapport,
  type StructureModele,
} from "@/lib/inspection/rapport-disciplinaire";

/**
 * Côté SERVEUR du rapport bilan CRD (page « Rapports Pédagogiques Disciplinaires ») :
 * chargement du rapport enregistré et PRÉ-REMPLISSAGE par les données réelles (visites,
 * enseignants, modules CAFOP). Le PÉRIMÈTRE de lecture, la GARDE d'écriture, l'en-tête par
 * défaut et les modèles personnels viennent du module PARTAGÉ
 * `src/lib/inspection/portee-apfc-rapports.ts` (commun avec les rapports d'antenne) —
 * réexportés ci-dessous pour les consommateurs historiques (page, actions, route Word).
 */
export {
  apfcAutorisee,
  apfcsAccessibles,
  disciplinesPourApfc,
  estRoleAntenne,
  filtreApfcRapport,
  peutAvoirModeleRapport,
  peutModifierRapportApfc as peutModifierRapportDisciplinaire,
  type ApfcRapport,
} from "@/lib/inspection/portee-apfc-rapports";

// ── Modèle personnel de rapport (ModeleRapport, typeRapport « crd ») ──

/** Type de rapport couvert par ce module (colonne générique `ModeleRapport.typeRapport`). */
export const TYPE_RAPPORT_CRD = "crd";

/** Structure du modèle personnel « crd » de l'utilisateur — null si aucun modèle enregistré. */
export async function chargerModelePersonnel(utilisateurId: string): Promise<StructureModele | null> {
  return chargerModelePersonnelDe(utilisateurId, TYPE_RAPPORT_CRD, estSectionOfficielle);
}

// ── Discipline ──

/** Paramètre « discipline » nettoyé (saisie libre autorisée, bornée). */
export function nettoyerDiscipline(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_DISCIPLINE) : "";
}

// ── En-tête officiel par défaut (base partagée + coordination disciplinaire) ──

/**
 * Mentions PAR DÉFAUT de l'en-tête officiel du rapport CRD : base COMMUNE des rapports
 * d'APFC (`enteteBaseApfc` — pays, ministère, direction régionale, antenne) complétée par
 * la ligne « COORDINATION RÉGIONALE DISCIPLINAIRE <DISCIPLINE> ». Chaque mention reste
 * modifiable ; une mention vidée retombe sur ces défauts (`completerEntete`).
 */
export async function enteteParDefaut(apfc: ApfcRapport, discipline: string): Promise<EnteteRapport> {
  const base = await enteteBaseApfc(apfc);
  return { ...base, coordination: `COORDINATION RÉGIONALE DISCIPLINAIRE ${discipline.toUpperCase()}` };
}

// ── Pré-remplissage par les données réelles ──

const nomComplet = (p: { prenoms?: string | null; nom?: string | null }): string =>
  [p.prenoms, p.nom].filter(Boolean).join(" ").trim();

/** Statistiques de visites d'un « volet » (primaire/CAFOP ou secondaire). */
interface StatsVisitesVolet {
  prevues: number;
  realisees: number;
  totalEnseignants: number;
  touches: number;
}

/** Remplit les colonnes chiffrées d'une ligne « Visites de classes » (chaînes éditables). */
function remplirLigneVisites(ligne: string[], s: StatsVisitesVolet): void {
  ligne[1] = String(s.prevues);
  ligne[2] = String(s.realisees);
  ligne[3] = pourcentage(s.realisees, s.prevues);
  ligne[4] = String(s.totalEnseignants);
  ligne[5] = String(s.touches);
  ligne[6] = pourcentage(s.touches, s.totalEnseignants);
}

/**
 * Contenu PRÉ-REMPLI par les données des établissements et CAFOP sous la responsabilité de
 * l'antenne, pour la discipline choisie :
 * - « Membres de la CRD » : personnel APFC dont les disciplines contiennent la discipline +
 *   conseillers pédagogiques rattachés à l'antenne ayant cette spécialité ;
 * - « Visites de classes » (tableaux I-1 et I-2) : visites des encadreurs de l'antenne
 *   (inspecteur.apfcId) sur des enseignants de la discipline (CompetenceEnseignant) dans les
 *   établissements COUVERTS (CouvertureApfc) — Prévue = planifiées + réalisées, Réalisés =
 *   réalisées, « touchés » = enseignants distincts effectivement visités, volet primaire/CAFOP
 *   vs secondaire selon la catégorie pédagogique de l'établissement ;
 * - « Modules CAFOP » : nombre de modules ACTIFS par année de formation (référentiel national
 *   ModuleCafop), renseigné seulement si la région de l'antenne compte au moins un CAFOP
 *   (les modules ne sont pas rattachés à un centre précis) ;
 * - introduction et conclusion générées (nombre d'encadreurs, discipline, antenne, plan I/II/III).
 */
export async function preRemplirContenu(apfc: ApfcRapport, discipline: string): Promise<ContenuRapport> {
  const contenu = contenuParDefaut();
  const cleDiscipline = norm(discipline);

  // Établissements couverts, répartis primaire/CAFOP vs secondaire (helper partagé).
  const { ids: idsEtablissements, estPrimaire } = await etablissementsCouverts(apfc.id);

  // Enseignants de la discipline dans les établissements couverts (référentiel des compétences).
  // La correspondance ÉCLATE les valeurs composites (« Histoire / Géographie » compte pour
  // « Histoire » ET pour « Géographie ») — même règle que le sélecteur de discipline.
  const concerneDiscipline = (nom: string) => disciplinesElementaires(nom).some((e) => norm(e) === cleDiscipline);
  const competences = (
    idsEtablissements.length
      ? await prisma.competenceEnseignant.findMany({
          where: { etablissementId: { in: idsEtablissements } },
          select: { enseignantId: true, etablissementId: true, discipline: { select: { nom: true } } },
        })
      : []
  ).filter((c) => concerneDiscipline(c.discipline.nom));
  const enseignantsPrimaire = new Set<string>();
  const enseignantsSecondaire = new Set<string>();
  for (const c of competences) {
    (estPrimaire.get(c.etablissementId) ? enseignantsPrimaire : enseignantsSecondaire).add(c.enseignantId);
  }
  const idsEnseignants = [...new Set(competences.map((c) => c.enseignantId))];

  // Visites des encadreurs de l'antenne sur ces enseignants (planifiées + réalisées).
  const visites = idsEnseignants.length
    ? await prisma.visite.findMany({
        where: {
          inspecteur: { apfcId: apfc.id },
          etablissementId: { in: idsEtablissements },
          enseignantId: { in: idsEnseignants },
          statut: { in: ["planifiee", "realisee"] },
        },
        select: { etablissementId: true, enseignantId: true, statut: true },
      })
    : [];
  const stats: Record<"primaire" | "secondaire", StatsVisitesVolet> = {
    primaire: { prevues: 0, realisees: 0, totalEnseignants: enseignantsPrimaire.size, touches: 0 },
    secondaire: { prevues: 0, realisees: 0, totalEnseignants: enseignantsSecondaire.size, touches: 0 },
  };
  const touchesPrimaire = new Set<string>();
  const touchesSecondaire = new Set<string>();
  for (const v of visites) {
    const volet = estPrimaire.get(v.etablissementId) ? "primaire" : "secondaire";
    stats[volet].prevues += 1;
    if (v.statut === "realisee") {
      stats[volet].realisees += 1;
      if (v.enseignantId) (volet === "primaire" ? touchesPrimaire : touchesSecondaire).add(v.enseignantId);
    }
  }
  stats.primaire.touches = touchesPrimaire.size;
  stats.secondaire.touches = touchesSecondaire.size;
  remplirLigneVisites(contenu.activitesPrimaire[INDEX_VISITES_PRIMAIRE], stats.primaire);
  if (INDEX_VISITES_SECONDAIRE >= 0) {
    remplirLigneVisites(contenu.activitesSecondaire[INDEX_VISITES_SECONDAIRE], stats.secondaire);
  }

  // Membres de la CRD : personnel de l'antenne (disciplines) + conseillers pédagogiques (spécialités).
  const [personnel, conseillers] = await Promise.all([
    prisma.personnelApfc.findMany({
      where: { apfcId: apfc.id },
      orderBy: { nom: "asc" },
      select: { nom: true, prenoms: true, fonction: true, disciplines: true },
    }),
    prisma.utilisateur.findMany({
      where: { apfcId: apfc.id, roleActif: { nomTechnique: "conseiller_pedagogique" } },
      orderBy: { nom: "asc" },
      select: { nom: true, prenoms: true, email: true, specialites: true },
    }),
  ]);
  const membres = new Map<string, string>();
  for (const p of personnel) {
    // Un profil « Anglais / EPS » compte pour « Anglais » ET pour « EPS » (composites éclatés).
    if (!lireDisciplinesJson(p.disciplines).some((d) => concerneDiscipline(d))) continue;
    const nom = nomComplet(p) || p.nom;
    membres.set(norm(nom), p.fonction ? `${nom} — ${p.fonction}` : nom);
  }
  for (const c of conseillers) {
    if (!lireDisciplinesJson(c.specialites).some((d) => concerneDiscipline(d))) continue;
    const nom = nomComplet(c) || c.email;
    if (!membres.has(norm(nom))) membres.set(norm(nom), `${nom} — Conseiller Pédagogique`);
  }
  contenu.membres = [...membres.values()].join("\n");

  // Modules CAFOP actifs par année (référentiel national), si la région de l'antenne a un CAFOP.
  const nbCafops = apfc.regionId ? await prisma.cafop.count({ where: { regionId: apfc.regionId } }) : 0;
  if (nbCafops > 0) {
    const modules = await prisma.moduleCafop.groupBy({
      by: ["annee"],
      where: { actif: true },
      _count: { _all: true },
    });
    const parAnnee = new Map(modules.map((m) => [m.annee, m._count._all]));
    contenu.programmesCafop[0][1] = String(parAnnee.get(1) ?? 0);
    contenu.programmesCafop[1][1] = String(parAnnee.get(2) ?? 0);
  }

  // Discipline pré-remplie dans les tableaux II « Secondaire » (colonne Discipline).
  for (const ligne of [...contenu.programmesPremierCycle, ...contenu.programmesSecondCycle]) {
    ligne[1] = discipline;
  }

  // Introduction et conclusion générées (restent entièrement éditables).
  const nbEncadreurs = membres.size;
  const accord = nbEncadreurs > 1 ? "s" : "";
  contenu.introduction =
    `La Coordination Régionale Disciplinaire de ${discipline}, animée par ${nbEncadreurs} encadreur${accord} ` +
    `de l'antenne « ${apfc.nom} », a conduit ses activités d'encadrement pédagogique au cours de la période ` +
    `concernée dans les établissements et structures placés sous sa responsabilité. Le présent rapport bilan ` +
    `s'articule autour des points suivants : I – Bilan des activités menées ; II – État d'exécution des ` +
    `programmes ; III – Analyse des activités menées.`;
  contenu.conclusion =
    `Au terme de la période concernée, la Coordination Régionale Disciplinaire de ${discipline} se félicite de ` +
    `la mobilisation des encadreurs et des enseignants. Les insuffisances relevées feront l'objet d'un suivi ` +
    `particulier, et les solutions proposées seront mises en œuvre au cours de la période à venir.`;
  contenu.coordinateur = nomComplet({ prenoms: apfc.chefAntennePrenoms, nom: apfc.chefAntenneNom });

  // En-tête officiel par défaut (pays + antenne + discipline) — modifiable ensuite par
  // l'utilisateur ; généré UNIQUEMENT à la création du contenu par défaut (pas de magie
  // de resynchronisation sur les rapports déjà enregistrés).
  contenu.entete = await enteteParDefaut(apfc, discipline);

  return contenu;
}

// ── Chargement (rapport enregistré, sinon pré-rempli) ──

export interface RapportCharge {
  titre: string;
  contenu: ContenuRapport;
  /** Vrai si un rapport enregistré existe en base pour (antenne, discipline). */
  enregistre: boolean;
  majLe: Date | null;
  rempliParNom: string | null;
}

/**
 * Rapport de (antenne, discipline) : le rapport ENREGISTRÉ s'il existe (discipline comparée
 * sans casse — JAMAIS altéré à l'ouverture), sinon un contenu PRÉ-REMPLI par les données,
 * sur lequel la STRUCTURE du modèle personnel `modele` (s'il est fourni) est appliquée :
 * pré-remplissage des données D'ABORD, structure du modèle PAR-DESSUS (en-tête personnalisé
 * non vide, sections masquées, sections libres, zones types, titre type). Utilisé par la
 * page ET par l'export Word (jamais de contenu passé par l'URL).
 */
export async function chargerRapport(
  apfc: ApfcRapport,
  discipline: string,
  modele?: StructureModele | null,
): Promise<RapportCharge> {
  const existant = await prisma.rapportDisciplinaire.findFirst({
    where: { apfcId: apfc.id, discipline: { equals: discipline, mode: "insensitive" } },
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
      contenu: lireContenuRapport(existant.contenu),
      enregistre: true,
      majLe: existant.majLe,
      rempliParNom: existant.rempliPar ? nomComplet(existant.rempliPar) || existant.rempliPar.email : null,
    };
  }
  let contenu = await preRemplirContenu(apfc, discipline);
  let titre = "";
  if (modele) {
    contenu = appliquerStructureModele(contenu, modele);
    titre = modele.titre;
  }
  return { titre, contenu, enregistre: false, majLe: null, rempliParNom: null };
}
