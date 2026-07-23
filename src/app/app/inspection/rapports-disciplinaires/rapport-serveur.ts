import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UtilisateurCourant } from "@/lib/auth/session";
import { peutAdministrerApfc, type RoleId } from "@/lib/rbac";
import { paysConsulte } from "@/lib/pays-consulte";
import {
  deriveCategoriePedagogique,
  estCategoriePedagogiqueValide,
  estPrimaireOuPrescolaire,
} from "@/lib/referentiels/etablissement";
import {
  INDEX_VISITES_PRIMAIRE,
  INDEX_VISITES_SECONDAIRE,
  MAX_DISCIPLINE,
  contenuParDefaut,
  lireContenuRapport,
  pourcentage,
  type ContenuRapport,
} from "@/lib/inspection/rapport-disciplinaire";

/**
 * Côté SERVEUR du rapport bilan CRD (page « Rapports Pédagogiques Disciplinaires ») :
 * périmètre de LECTURE des antennes (fail-closed), garde d'ÉCRITURE (jamais dupliquée —
 * `peutAdministrerApfc` de la couche RBAC centrale est réutilisée), chargement du rapport
 * enregistré et PRÉ-REMPLISSAGE par les données réelles (visites, enseignants, modules CAFOP).
 * Partagé par la page, l'action d'enregistrement et l'export Word — jamais réécrit ailleurs.
 */

// ── Périmètre de lecture ──

const ROLES_ANTENNE = new Set<RoleId>(["apfc_admin", "chef_antenne", "conseiller_pedagogique"]);
const ROLES_REGIONAUX = new Set<RoleId>(["drena", "inspecteur"]);
const ROLES_NATIONAUX = new Set<RoleId>([
  "admin",
  "superviseur_international",
  "super_admin_apfc",
  "representant_pays",
]);

/** Rôles d'antenne : leur APFC est sélectionnée automatiquement (pas de sélecteur). */
export function estRoleAntenne(u: UtilisateurCourant): boolean {
  return ROLES_ANTENNE.has(u.roleReel);
}

/**
 * Filtre Prisma des antennes dont l'utilisateur peut CONSULTER le rapport CRD — REFUSÉ PAR
 * DÉFAUT (`null` = aucun accès au rapport). Même logique de cloisonnement que la page
 * « Supervision APFC » : rôles d'antenne → leur APFC ; drena/inspecteur → les antennes de
 * leur région ; rôles globaux/nationaux → les antennes du PAYS CONSULTÉ (comme la Gestion
 * des APFC — `paysConsulte()` verrouille déjà un périmètre « pays » sur son propre pays).
 */
export async function filtreApfcRapport(u: UtilisateurCourant): Promise<Prisma.ApfcWhereInput | null> {
  if (estRoleAntenne(u)) return { id: u.portee.apfcId ?? "__aucune__" };
  if (ROLES_REGIONAUX.has(u.roleReel)) return { regionId: u.portee.regionId ?? "__aucune__" };
  if (ROLES_NATIONAUX.has(u.roleReel)) {
    return { region: { pays: { equals: await paysConsulte(), mode: "insensitive" } } };
  }
  return null;
}

/** Antenne telle que chargée pour le rapport (fiche + région pour le pays et l'en-tête). */
export type ApfcRapport = {
  id: string;
  nom: string;
  localite: string | null;
  regionId: string | null;
  chefAntenneNom: string | null;
  chefAntennePrenoms: string | null;
  region: { nom: string; pays: string } | null;
};

const SELECTION_APFC = {
  id: true,
  nom: true,
  localite: true,
  regionId: true,
  chefAntenneNom: true,
  chefAntennePrenoms: true,
  region: { select: { nom: true, pays: true } },
} satisfies Prisma.ApfcSelect;

/**
 * Antennes proposées au sélecteur (périmètre déjà appliqué), triées par nom —
 * `null` si le rôle n'a AUCUN accès au rapport CRD (fail-closed, section masquée).
 */
export async function apfcsAccessibles(u: UtilisateurCourant): Promise<ApfcRapport[] | null> {
  const filtre = await filtreApfcRapport(u);
  if (!filtre) return null;
  return prisma.apfc.findMany({ where: filtre, orderBy: { nom: "asc" }, select: SELECTION_APFC });
}

/**
 * REVALIDATION fail-closed d'un `?apfc=<id>` : l'antenne n'est renvoyée que si elle est DANS
 * le périmètre de lecture de l'utilisateur (sinon null, paramètre ignoré). Utilisée par la
 * page ET par la route de téléchargement Word (mêmes gardes de lecture).
 */
export async function apfcAutorisee(u: UtilisateurCourant, apfcId: string): Promise<ApfcRapport | null> {
  if (!apfcId) return null;
  const filtre = await filtreApfcRapport(u);
  if (!filtre) return null;
  return prisma.apfc.findFirst({ where: { AND: [{ id: apfcId }, filtre] }, select: SELECTION_APFC });
}

// ── Garde d'écriture ──

const ROLES_ECRITURE_RAPPORT = new Set<RoleId>(["admin", "superviseur_international", "apfc_admin", "chef_antenne"]);

/**
 * Peut ENREGISTRER le rapport CRD de cette antenne : admin et superviseur international
 * (partout), Admin APFC et Chef d'antenne DE cette antenne — hors mode aperçu. Les autres
 * rôles de la page (inspecteur, drena, conseiller pédagogique…) restent en LECTURE SEULE.
 * Le contrôle de périmètre s'appuie sur la garde CENTRALE `peutAdministrerApfc` (rbac/scope),
 * jamais réécrite ; seul le cas `chef_antenne` (portée « antenne », non couverte par cette
 * garde) est vérifié directement sur son rattachement `Utilisateur.apfcId` — même champ que
 * l'Admin APFC (cf. page Supervision APFC).
 */
export function peutModifierRapportDisciplinaire(
  u: UtilisateurCourant,
  apfc: { id: string; pays: string | null },
): boolean {
  if (u.apercuActif) return false;
  if (!ROLES_ECRITURE_RAPPORT.has(u.roleReel)) return false;
  if (u.roleReel === "chef_antenne") return u.portee.apfcId != null && u.portee.apfcId === apfc.id;
  return peutAdministrerApfc(u.portee, apfc.id, apfc.pays);
}

// ── Discipline ──

/** Paramètre « discipline » nettoyé (saisie libre autorisée, bornée). */
export function nettoyerDiscipline(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_DISCIPLINE) : "";
}

/** Normalisation pour comparaisons insensibles à la casse et aux accents. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Disciplines JSON d'un PersonnelApfc / d'un Utilisateur (tableau de chaînes, toléré sale). */
function lireDisciplinesJson(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((d): d is string => typeof d === "string" && d.trim().length > 0).map((d) => d.trim());
}

/**
 * Disciplines proposées au sélecteur : celles du PERSONNEL de l'antenne (PersonnelApfc.disciplines)
 * + celles des ENSEIGNANTS des établissements couverts (CompetenceEnseignant → Discipline),
 * dédoublonnées sans casse/accents et triées — la saisie libre reste possible côté client.
 */
export async function disciplinesPourApfc(apfcId: string): Promise<string[]> {
  const [personnel, competences] = await Promise.all([
    prisma.personnelApfc.findMany({ where: { apfcId }, select: { disciplines: true } }),
    prisma.competenceEnseignant.findMany({
      where: { etablissement: { couvertureApfc: { is: { apfcId } } } },
      distinct: ["disciplineId"],
      select: { discipline: { select: { nom: true } } },
    }),
  ]);
  const vues = new Map<string, string>();
  for (const nom of [
    ...personnel.flatMap((p) => lireDisciplinesJson(p.disciplines)),
    ...competences.map((c) => c.discipline.nom),
  ]) {
    const cle = norm(nom);
    if (cle && !vues.has(cle)) vues.set(cle, nom);
  }
  return [...vues.values()].sort((a, b) => a.localeCompare(b, "fr"));
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

  // Établissements couverts, répartis primaire/CAFOP vs secondaire (catégorie pédagogique
  // déclarée si valide, sinon dérivée du type — même règle que la console de configuration).
  const etablissements = await prisma.etablissement.findMany({
    where: { couvertureApfc: { is: { apfcId: apfc.id } } },
    select: { id: true, categoriePedagogique: true, type: true },
  });
  const estPrimaire = new Map<string, boolean>();
  for (const e of etablissements) {
    const cat =
      e.categoriePedagogique && estCategoriePedagogiqueValide(e.categoriePedagogique)
        ? e.categoriePedagogique
        : deriveCategoriePedagogique(e.type);
    estPrimaire.set(e.id, estPrimaireOuPrescolaire(cat));
  }
  const idsEtablissements = etablissements.map((e) => e.id);

  // Enseignants de la discipline dans les établissements couverts (référentiel des compétences).
  const competences = idsEtablissements.length
    ? await prisma.competenceEnseignant.findMany({
        where: {
          etablissementId: { in: idsEtablissements },
          discipline: { nom: { equals: discipline, mode: "insensitive" } },
        },
        select: { enseignantId: true, etablissementId: true },
      })
    : [];
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
    if (!lireDisciplinesJson(p.disciplines).some((d) => norm(d) === cleDiscipline)) continue;
    const nom = nomComplet(p) || p.nom;
    membres.set(norm(nom), p.fonction ? `${nom} — ${p.fonction}` : nom);
  }
  for (const c of conseillers) {
    if (!lireDisciplinesJson(c.specialites).some((d) => norm(d) === cleDiscipline)) continue;
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
 * sans casse), sinon un contenu PRÉ-REMPLI par les données — utilisé par la page ET par
 * l'export Word (jamais de contenu passé par l'URL).
 */
export async function chargerRapport(apfc: ApfcRapport, discipline: string): Promise<RapportCharge> {
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
  return {
    titre: "",
    contenu: await preRemplirContenu(apfc, discipline),
    enregistre: false,
    majLe: null,
    rempliParNom: null,
  };
}
