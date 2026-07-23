import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UtilisateurCourant } from "@/lib/auth/session";
import { peutAdministrerApfc, type RoleId } from "@/lib/rbac";
import { paysConsulte } from "@/lib/pays-consulte";
import { trouverPays } from "@/lib/referentiels/pays";
import { libelleApfc, paysEffectifApfc } from "@/lib/apfc-terme-serveur";
import { TERME_APFC_DEFAUT } from "@/lib/apfc-terme";
import {
  deriveCategoriePedagogique,
  estCategoriePedagogiqueValide,
  estPrimaireOuPrescolaire,
} from "@/lib/referentiels/etablissement";
import {
  disciplinesElementaires,
  lireStructureModeleDe,
  normaliserComparaison,
  type EnteteRapport,
  type StructureModeleDe,
} from "./rapport-commun";

/**
 * PÉRIMÈTRE APFC des rapports narratifs d'inspection — module serveur PARTAGÉ par la page
 * « Rapports Pédagogiques Disciplinaires » (rapport bilan CRD) et la page « Rapports
 * d'antennes » (rapports trimestriel et annuel) : lecture des antennes (fail-closed), garde
 * d'écriture, en-tête officiel par défaut et modèles personnels. JAMAIS réécrit par page
 * (CLAUDE.md §3 : couche RBAC centralisée et unique).
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
 * Filtre Prisma des antennes dont l'utilisateur peut CONSULTER les rapports — REFUSÉ PAR
 * DÉFAUT (`null` = aucun accès). Même logique de cloisonnement que la page « Supervision
 * APFC » : rôles d'antenne → leur APFC ; drena/inspecteur → les antennes de leur région ;
 * rôles globaux/nationaux → les antennes du PAYS CONSULTÉ (comme la Gestion des APFC —
 * `paysConsulte()` verrouille déjà un périmètre « pays » sur son propre pays).
 */
export async function filtreApfcRapport(u: UtilisateurCourant): Promise<Prisma.ApfcWhereInput | null> {
  if (estRoleAntenne(u)) return { id: u.portee.apfcId ?? "__aucune__" };
  if (ROLES_REGIONAUX.has(u.roleReel)) return { regionId: u.portee.regionId ?? "__aucune__" };
  if (ROLES_NATIONAUX.has(u.roleReel)) {
    return { region: { pays: { equals: await paysConsulte(), mode: "insensitive" } } };
  }
  return null;
}

/** Antenne telle que chargée pour les rapports (fiche + région pour le pays et l'en-tête). */
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
 * `null` si le rôle n'a AUCUN accès aux rapports (fail-closed, section masquée).
 */
export async function apfcsAccessibles(u: UtilisateurCourant): Promise<ApfcRapport[] | null> {
  const filtre = await filtreApfcRapport(u);
  if (!filtre) return null;
  return prisma.apfc.findMany({ where: filtre, orderBy: { nom: "asc" }, select: SELECTION_APFC });
}

/**
 * REVALIDATION fail-closed d'un `?apfc=<id>` : l'antenne n'est renvoyée que si elle est DANS
 * le périmètre de lecture de l'utilisateur (sinon null, paramètre ignoré). Utilisée par les
 * pages ET par les routes de téléchargement Word (mêmes gardes de lecture).
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
 * Peut ENREGISTRER un rapport d'APFC (bilan CRD, trimestriel, annuel) : admin et superviseur
 * international (partout), Admin APFC et Chef d'antenne DE cette antenne — hors mode aperçu.
 * Les autres rôles des pages restent en LECTURE SEULE. Le contrôle de périmètre s'appuie sur
 * la garde CENTRALE `peutAdministrerApfc` (rbac/scope), jamais réécrite ; seul le cas
 * `chef_antenne` (portée « antenne », non couverte par cette garde) est vérifié directement
 * sur son rattachement `Utilisateur.apfcId` — même champ que l'Admin APFC.
 */
export function peutModifierRapportApfc(
  u: UtilisateurCourant,
  apfc: { id: string; pays: string | null },
): boolean {
  if (u.apercuActif) return false;
  if (!ROLES_ECRITURE_RAPPORT.has(u.roleReel)) return false;
  if (u.roleReel === "chef_antenne") return u.portee.apfcId != null && u.portee.apfcId === apfc.id;
  return peutAdministrerApfc(u.portee, apfc.id, apfc.pays);
}

/**
 * Peut posséder un MODÈLE PERSONNEL de rapport : mêmes RÔLES que l'écriture des rapports
 * (même ensemble `ROLES_ECRITURE_RAPPORT`, jamais dupliqué), hors mode aperçu. Le modèle est
 * PERSONNEL (rangé sous le compte) : aucune portée APFC à vérifier pour l'enregistrer.
 */
export function peutAvoirModeleRapport(u: UtilisateurCourant): boolean {
  return !u.apercuActif && ROLES_ECRITURE_RAPPORT.has(u.roleReel);
}

// ── En-tête officiel par défaut (pays + antenne) ──

/** Forme longue ivoirienne de l'appellation « APFC » (terme local par défaut). */
const APPELLATION_APFC_LONGUE = "ANTENNE DE LA PEDAGOGIE ET DE LA FORMATION CONTINUE";

/** « DE X » avec élision simple (« D'ABENGOUROU ») devant une voyelle. */
function deElide(nom: string): string {
  return /^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/i.test(nom) ? `D'${nom}` : `DE ${nom}`;
}

/** Nom de l'antenne SANS le préfixe « APFC » (ou le terme local) — « APFC Abengourou » → « Abengourou ». */
function nomAntenneSansPrefixe(nom: string, terme: string): string {
  const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefixes = [TERME_APFC_DEFAUT, terme.trim()].filter(Boolean).map(echapper).join("|");
  return nom.trim().replace(new RegExp(`^(?:${prefixes})\\b[\\s:—–-]*`, "i"), "").trim();
}

/**
 * Mentions PAR DÉFAUT communes de l'en-tête officiel d'un rapport d'APFC, calculées d'après
 * le PAYS effectif de l'antenne (ministère, forme officielle de l'État, devise — référentiel
 * pays) et l'ANTENNE (région, appellation locale des APFC, nom sans le préfixe « APFC »).
 * La mention `coordination` reste VIDE ici : le rapport CRD la complète avec sa discipline,
 * les rapports d'antenne ne l'affichent pas. Chaque mention reste modifiable dans le panneau
 * « En-tête du document » ; une mention vidée retombe sur ces défauts (`completerEntete`).
 */
export async function enteteBaseApfc(apfc: ApfcRapport): Promise<EnteteRapport> {
  const pays = await paysEffectifApfc(apfc.region?.pays ?? null);
  const [infoPays, terme] = [trouverPays(pays), await libelleApfc(pays)];
  // Appellation locale : forme longue ivoirienne pour le terme par défaut « APFC », sinon le
  // terme local du pays (ex. « ADEN ») — la mention reste modifiable dans le panneau d'en-tête.
  const appellation =
    terme.trim().toUpperCase() === TERME_APFC_DEFAUT ? APPELLATION_APFC_LONGUE : terme.trim().toUpperCase();
  const nomAntenne = (nomAntenneSansPrefixe(apfc.nom, terme) || apfc.localite?.trim() || apfc.nom).toUpperCase();
  return {
    ministere: (infoPays?.ministere || "Ministère de l'Éducation Nationale et de l'Alphabétisation").toUpperCase(),
    directionRegionale: apfc.region ? `DIRECTION RÉGIONALE ${deElide(apfc.region.nom.toUpperCase())}` : "",
    antenne: `${appellation} ${deElide(nomAntenne)}`,
    coordination: "",
    republique: (infoPays?.intitule ?? `République de ${pays}`).toUpperCase(),
    devise: infoPays?.devise ?? "",
  };
}

// ── Données communes des pré-remplissages ──

/**
 * Établissements COUVERTS par l'antenne (CouvertureApfc), avec leur volet préscolaire/primaire
 * vs secondaire (catégorie pédagogique déclarée si valide, sinon dérivée du type — même règle
 * que la console de configuration). Partagé par les pré-remplissages CRD et antenne.
 */
export async function etablissementsCouverts(
  apfcId: string,
): Promise<{ ids: string[]; estPrimaire: Map<string, boolean> }> {
  const etablissements = await prisma.etablissement.findMany({
    where: { couvertureApfc: { is: { apfcId } } },
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
  return { ids: etablissements.map((e) => e.id), estPrimaire };
}

/** Disciplines JSON d'un PersonnelApfc / d'un Utilisateur (tableau de chaînes, toléré sale). */
export function lireDisciplinesJson(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.filter((d): d is string => typeof d === "string" && d.trim().length > 0).map((d) => d.trim());
}

/**
 * Disciplines de l'antenne (les CRD) : celles du PERSONNEL (PersonnelApfc.disciplines) +
 * celles des ENSEIGNANTS des établissements couverts (CompetenceEnseignant → Discipline).
 * Les valeurs COMPOSITES (« Anglais / EPS », « Français ; EDHC ») sont ÉCLATÉES en disciplines
 * SIMPLES (`disciplinesElementaires` — jamais de couples, consigne client), dédoublonnées sans
 * casse/accents (première graphie conservée) et triées. Partagé : sélecteur de discipline du
 * rapport CRD ET liste des CRD des introductions des rapports d'antenne.
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
  ].flatMap((n) => disciplinesElementaires(n))) {
    const cle = normaliserComparaison(nom);
    if (cle && !vues.has(cle)) vues.set(cle, nom);
  }
  return [...vues.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

// ── Modèles personnels (ModeleRapport — un par utilisateur et par type de rapport) ──

/**
 * Structure du modèle personnel de l'utilisateur pour un `typeRapport` donné (« crd »,
 * « antenne-trimestriel », « antenne-annuel ») — null si aucun modèle enregistré.
 * La validation des identifiants de sections est fournie par l'appelant (`estValide`).
 */
export async function chargerModelePersonnelDe<T extends string>(
  utilisateurId: string,
  typeRapport: string,
  estValide: (v: string) => v is T,
): Promise<StructureModeleDe<T> | null> {
  const modele = await prisma.modeleRapport.findUnique({
    where: { proprietaireId_typeRapport: { proprietaireId: utilisateurId, typeRapport } },
    select: { structure: true },
  });
  return modele ? lireStructureModeleDe(modele.structure, estValide) : null;
}
