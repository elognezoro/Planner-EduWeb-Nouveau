"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
import { hacherMotDePasse } from "@/lib/auth/password";
import { ROLES } from "@/lib/rbac";
import { lireFichierTexte } from "@/lib/csv/lire-fichier-texte";
import { journaliserSecurite } from "@/lib/audit/journal";
import { creerNotification } from "@/lib/notifications/creer";
import { motDePasseConforme } from "@/lib/validation/mot-de-passe";
import { cibleLV2 } from "@/lib/disciplines/lv2";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

// Rôles attribuables au sein d'un établissement.
const ROLES_IMPORT = [
  "enseignant",
  "educateur",
  "chef_etablissement",
  "adjoint_chef_etablissement",
  "inspecteur_orientation",
  "parent",
  "eleve",
] as const;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin" || u.roleReel === "superviseur_international") return u;
  // Le gestionnaire de l'établissement (admin d'établissements, chef ou ACE) gère LE SIEN.
  if (
    (u.roleReel === "etablissements_admin" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  // Super Admin Établissements : gère tout établissement de SON pays (cloisonnement strict).
  if (u.roleReel === "super_admin_etablissements") {
    const e = await prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { pays: true } });
    if (ecritureNationaleAutorisee(u, "super_admin_etablissements", e?.pays)) return u;
  }
  return null;
}

/**
 * Rôles pouvant AUTORISER l'arrivée d'un utilisateur d'un AUTRE établissement, ou toucher un
 * compte de direction existant (règle client : seul le CHEF de l'établissement d'accueil — et
 * sa parité documentée admin d'établissements / hiérarchie — jamais l'ACE seul). `roleReel`
 * est déjà normalisé par la session : « directeur_etudes » compte comme chef.
 */
const ROLES_AUTORITE_RATTACHEMENT = new Set<string>([
  "chef_etablissement",
  "etablissements_admin",
  "super_admin_etablissements",
  "superviseur_international",
  "admin",
]);
/** Comptes de DIRECTION : jamais réécrits depuis cette console sans autorité chef. */
const ROLES_DIRECTION = new Set<string>(["chef_etablissement", "adjoint_chef_etablissement"]);

type Appelant = { id: string; email: string; roleReel: string; roleActif: string };
type ResultatRattachement =
  | { statut: "cree" | "rattache" | "transfere"; id: string }
  | { statut: "refus"; message: string };

/**
 * Crée le compte, ou rattache un compte EXISTANT — sous CLOISONNEMENT strict (règle client) :
 * - un compte à rôle hors établissement (admin, super admin, DRENA, CAFOP/APFC, finance…)
 *   n'est JAMAIS réécrit depuis cette console ;
 * - un compte de DIRECTION (chef / ACE) n'est réécrit que par une autorité chef ;
 * - un compte d'un AUTRE établissement ne rejoint celui-ci que sur décision d'une autorité
 *   chef de l'établissement d'ACCUEIL (jamais l'ACE seul) — journalisé + titulaire notifié ;
 * - l'identité (prénoms/nom) d'un compte existant n'est jamais écrasée.
 */
async function creerOuRattacher(
  appelant: Appelant,
  email: string,
  prenoms: string,
  nom: string,
  etablissementId: string,
  roleId: string,
  roleTech: string,
  // Mot de passe (haché) fourni par le CSV du Convertisseur : appliqué UNIQUEMENT à la
  // CRÉATION d'un compte neuf — jamais à un compte existant (aucune capture possible).
  motDePasseHash: string | null = null,
): Promise<ResultatRattachement> {
  // ATTRIBUER un rôle de direction (chef / ACE) exige aussi l'autorité chef : l'ACE seul ne
  // promeut personne à la direction via cette console.
  if (ROLES_DIRECTION.has(roleTech) && !ROLES_AUTORITE_RATTACHEMENT.has(appelant.roleReel)) {
    return {
      statut: "refus",
      message: "Attribuer un rôle de direction (chef / adjoint) est réservé au chef d'établissement (ou à l'admin de l'établissement).",
    };
  }
  const existant = await prisma.utilisateur.findUnique({
    where: { email },
    select: {
      id: true,
      prenoms: true,
      nom: true,
      etablissementId: true,
      roleActif: { select: { nomTechnique: true, libelle: true } },
    },
  });
  if (!existant) {
    const hash = motDePasseHash ?? (await hacherMotDePasse(randomBytes(12).toString("base64url")));
    const u = await prisma.utilisateur.create({
      data: {
        email,
        motDePasseHash: hash,
        prenoms,
        nom,
        statutCompte: "actif",
        emailVerifieLe: new Date(),
        roleActifId: roleId,
        etablissementId,
      },
    });
    return { id: u.id, statut: "cree" };
  }

  const roleActuel = existant.roleActif.nomTechnique;
  const autoriteChef = ROLES_AUTORITE_RATTACHEMENT.has(appelant.roleReel);

  // 1. Seuls les rôles « de terrain » attribuables ici peuvent être (re)rattachés : un compte
  //    de gestion/hiérarchie n'est jamais rétrogradé ni déplacé depuis cette console.
  if (!(ROLES_IMPORT as readonly string[]).includes(roleActuel)) {
    return {
      statut: "refus",
      message: `« ${email} » existe déjà avec le rôle ${existant.roleActif.libelle} — ce compte ne peut pas être rattaché depuis cette console.`,
    };
  }
  // 2. Compte de direction (chef / ACE) : autorité chef exigée.
  if (ROLES_DIRECTION.has(roleActuel) && !autoriteChef) {
    return {
      statut: "refus",
      message: `« ${email} » est un compte de direction — seul le chef d'établissement (ou l'admin de l'établissement) peut le modifier.`,
    };
  }
  // 3. Compte d'un AUTRE établissement : strictement cloisonné par défaut — seule une autorité
  //    chef de l'établissement d'ACCUEIL peut autoriser sa venue.
  const autreEtablissement = existant.etablissementId !== null && existant.etablissementId !== etablissementId;
  if (autreEtablissement && !autoriteChef) {
    return {
      statut: "refus",
      message: `« ${email} » appartient à un autre établissement — seul le chef d'établissement (ou l'admin de l'établissement) peut l'autoriser à rejoindre celui-ci.`,
    };
  }

  // Un transfert inter-établissements COUPE tout lien résiduel hors établissement d'accueil :
  // - affectations de classes (sinon l'enseignant garderait notes / cahier de texte / registre
  //   d'appel de ses anciennes classes) ;
  // - compétences et niveaux d'intervention (l'unicité (enseignant, discipline/niveau) rendrait
  //   sinon toute re-déclaration à destination silencieusement impossible) ;
  // - rattachement secondaire visant l'établissement d'origine (portée multi-établissements).
  const purgeTransfert =
    autreEtablissement && existant.etablissementId
      ? [
          prisma.affectationEnseignant.deleteMany({
            where: { enseignantId: existant.id, classe: { etablissementId: { not: etablissementId } } },
          }),
          prisma.competenceEnseignant.deleteMany({
            where: { enseignantId: existant.id, etablissementId: { not: etablissementId } },
          }),
          prisma.niveauEnseignant.deleteMany({
            where: { enseignantId: existant.id, etablissementId: { not: etablissementId } },
          }),
          prisma.affectationEtablissement.deleteMany({
            where: { utilisateurId: existant.id, etablissementId: existant.etablissementId },
          }),
        ]
      : [];

  await prisma.$transaction([
    prisma.utilisateur.update({
      where: { id: existant.id },
      data: {
        roleActifId: roleId,
        etablissementId,
        // Identité : l'existant PRIME — un tiers ne réécrit pas les nom/prénoms d'un compte.
        prenoms: existant.prenoms || prenoms,
        nom: existant.nom || nom,
      },
    }),
    ...purgeTransfert,
  ]);

  if (autreEtablissement) {
    // Décision d'accueil inter-établissements : tracée au journal de sécurité + titulaire notifié.
    await journaliserSecurite("rattachement_inter_etablissement", {
      utilisateurId: appelant.id,
      acteurEmail: appelant.email,
      acteurRole: appelant.roleActif,
      cible: `Utilisateur:${existant.id}`,
      details: { email, de: existant.etablissementId, vers: etablissementId },
    });
    await creerNotification({
      destinataireId: existant.id,
      type: "role",
      titre: "Changement d'établissement",
      message: "Votre compte a été rattaché à un nouvel établissement par sa direction. Consultez votre profil pour vérifier votre rattachement.",
      lien: "/app/mon-profil",
    });
    return { id: existant.id, statut: "transfere" };
  }
  return { id: existant.id, statut: "rattache" };
}

/** Applique compétences (disciplines) et niveaux d'intervention d'un enseignant. */
async function appliquerCompetences(
  enseignantId: string,
  etablissementId: string,
  disciplineIds: string[],
  niveauIds: string[],
) {
  // Atomique : le remplacement complet (suppressions + recréations) réussit ou échoue en bloc.
  await prisma.$transaction([
    prisma.competenceEnseignant.deleteMany({ where: { enseignantId, etablissementId } }),
    prisma.niveauEnseignant.deleteMany({ where: { enseignantId, etablissementId } }),
    ...(disciplineIds.length > 0
      ? [
          prisma.competenceEnseignant.createMany({
            data: disciplineIds.map((disciplineId) => ({ enseignantId, disciplineId, etablissementId })),
            skipDuplicates: true,
          }),
        ]
      : []),
    ...(niveauIds.length > 0
      ? [
          prisma.niveauEnseignant.createMany({
            data: niveauIds.map((niveauId) => ({ enseignantId, niveauId, etablissementId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

/**
 * Enregistre EN LOT les disciplines de plusieurs enseignants (bouton « Enregistrer les
 * compétences » du bloc de la console) — sans toucher aux niveaux d'intervention.
 */
export async function enregistrerCompetencesLot(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  let brut: unknown;
  try {
    brut = JSON.parse(String(formData.get("modifications") ?? "[]"));
  } catch {
    return { ok: false, message: "Paramètres invalides." };
  }
  const modifications = (Array.isArray(brut) ? brut : [])
    .slice(0, 300)
    .map((m) => ({
      enseignantId: String((m as { enseignantId?: unknown })?.enseignantId ?? ""),
      disciplineIds: Array.isArray((m as { disciplineIds?: unknown })?.disciplineIds)
        ? ((m as { disciplineIds: unknown[] }).disciplineIds).map(String).slice(0, 50)
        : [],
      // Niveaux d'intervention (facultatif) : présents quand le bloc édite aussi les cycles.
      niveauIds: Array.isArray((m as { niveauIds?: unknown })?.niveauIds)
        ? ((m as { niveauIds: unknown[] }).niveauIds).map(String).slice(0, 50)
        : null,
    }))
    .filter((m) => m.enseignantId);
  if (modifications.length === 0) return { ok: true, message: "Aucune modification à enregistrer." };

  try {
    // Seuls les enseignants de CET établissement et des références existantes sont acceptés.
    const [enseignantsValides, disciplinesValides, niveauxValides] = await Promise.all([
      prisma.utilisateur.findMany({
        where: { id: { in: modifications.map((m) => m.enseignantId) }, etablissementId },
        select: { id: true },
      }),
      // CLOISONNEMENT : seules les références du national ou de CET établissement sont valides.
      prisma.discipline.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId }] },
        select: { id: true },
      }),
      prisma.niveau.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId }] },
        select: { id: true },
      }),
    ]);
    const idsEnseignants = new Set(enseignantsValides.map((e) => e.id));
    const idsDisciplines = new Set(disciplinesValides.map((d) => d.id));
    const idsNiveaux = new Set(niveauxValides.map((n) => n.id));
    const retenues = modifications
      .filter((m) => idsEnseignants.has(m.enseignantId))
      .map((m) => ({
        ...m,
        disciplineIds: m.disciplineIds.filter((d) => idsDisciplines.has(d)),
        niveauIds: m.niveauIds ? m.niveauIds.filter((n) => idsNiveaux.has(n)) : null,
      }));
    if (retenues.length === 0) return { ok: false, message: "Aucun enseignant valide dans cet établissement." };

    // Atomique : tous les remplacements réussissent ou échouent en bloc.
    await prisma.$transaction(
      retenues.flatMap((m) => [
        prisma.competenceEnseignant.deleteMany({ where: { enseignantId: m.enseignantId, etablissementId } }),
        ...(m.disciplineIds.length > 0
          ? [
              prisma.competenceEnseignant.createMany({
                data: m.disciplineIds.map((disciplineId) => ({
                  enseignantId: m.enseignantId,
                  disciplineId,
                  etablissementId,
                })),
                skipDuplicates: true,
              }),
            ]
          : []),
        // Niveaux : remplacés uniquement si la modification les fournit.
        ...(m.niveauIds !== null
          ? [
              prisma.niveauEnseignant.deleteMany({ where: { enseignantId: m.enseignantId, etablissementId } }),
              ...(m.niveauIds.length > 0
                ? [
                    prisma.niveauEnseignant.createMany({
                      data: m.niveauIds.map((niveauId) => ({
                        enseignantId: m.enseignantId,
                        niveauId,
                        etablissementId,
                      })),
                      skipDuplicates: true,
                    }),
                  ]
                : []),
            ]
          : []),
      ]),
    );
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
    return { ok: true, message: `Compétences de ${retenues.length} enseignant(s) enregistrées.` };
  } catch (e) {
    console.error("[competences lot] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Remplace les DISCIPLINES d'un enseignant (bloc « Compétences des enseignants » de la
 * console de configuration) — sans toucher à ses niveaux d'intervention.
 */
export async function enregistrerDisciplinesEnseignant(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "");
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const enseignant = await prisma.utilisateur.findUnique({
    where: { id: enseignantId },
    select: { etablissementId: true },
  });
  if (!enseignant || enseignant.etablissementId !== etablissementId) {
    return { ok: false, message: "Enseignant hors de cet établissement." };
  }

  let brutes: unknown;
  try {
    brutes = JSON.parse(String(formData.get("disciplineIds") ?? "[]"));
  } catch {
    return { ok: false, message: "Paramètres invalides." };
  }
  const demandees = Array.isArray(brutes) ? brutes.map(String).slice(0, 50) : [];
  // CLOISONNEMENT : seules les disciplines du national ou de CET établissement sont valides
  // (même filtre que enregistrerCompetencesLot — jamais la discipline d'une autre école).
  const valides = demandees.length
    ? (
        await prisma.discipline.findMany({
          where: { id: { in: demandees }, OR: [{ etablissementId: null }, { etablissementId }] },
          select: { id: true },
        })
      ).map((d) => d.id)
    : [];

  try {
    // Atomique : le remplacement complet (suppression + recréation) réussit ou échoue en bloc.
    await prisma.$transaction([
      prisma.competenceEnseignant.deleteMany({ where: { enseignantId, etablissementId } }),
      ...(valides.length > 0
        ? [
            prisma.competenceEnseignant.createMany({
              data: valides.map((disciplineId) => ({ enseignantId, disciplineId, etablissementId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
  } catch (e) {
    console.error("[competences] erreur :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Disciplines enregistrées." };
}

const schemaAjout = z.object({
  etablissementId: z.string().min(1),
  prenoms: z.string().trim().min(1, "Prénoms requis.").max(80),
  nom: z.string().trim().min(1, "Nom requis.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail invalide."),
  role: z.string().optional(),
});

export async function ajouterEnseignant(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const parsed = schemaAjout.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const u = await peutGerer(parsed.data.etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const roleTech =
    parsed.data.role && (ROLES_IMPORT as readonly string[]).includes(parsed.data.role)
      ? parsed.data.role
      : "enseignant";
  try {
    const role = await prisma.role.findUnique({ where: { nomTechnique: roleTech } });
    if (!role) return { ok: false, message: "Rôle introuvable (seed manquant ?)." };
    const r = await creerOuRattacher(u, parsed.data.email, parsed.data.prenoms, parsed.data.nom, parsed.data.etablissementId, role.id, roleTech);
    if (r.statut === "refus") return { ok: false, message: r.message };
    revalidatePath(`/app/systeme/etablissements/${parsed.data.etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${parsed.data.etablissementId}`);
    return {
      ok: true,
      message:
        r.statut === "cree"
          ? "Utilisateur créé (mot de passe à définir via « mot de passe oublié »)."
          : r.statut === "transfere"
            ? "Utilisateur d'un autre établissement rattaché au vôtre (décision tracée, titulaire notifié)."
            : "Compte existant rattaché.",
    };
  } catch (e) {
    console.error("[enseignant] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

interface LigneCSV {
  prenoms: string;
  nom: string;
  email: string;
  role: string;
  disciplines: string[];
  niveaux: string[];
  /** 7e colonne facultative (CSV du Convertisseur) : mot de passe initial du compte. */
  motDePasse: string;
}

function parserCSV(texte: string): LigneCSV[] {
  // Retire un éventuel BOM UTF-8 (présent dans le modèle téléchargeable, pour Excel).
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.length === 0) return [];
  const delim = lignes[0].includes(";") ? ";" : ",";
  const entete = norm(lignes[0]);
  const aEntete = entete.includes("email") || entete.includes("nom");
  const corps = aEntete ? lignes.slice(1) : lignes;
  const out: LigneCSV[] = [];
  for (const l of corps) {
    const cols = l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const [prenoms = "", nom = "", email = "", role = "", disciplines = "", niveaux = "", motDePasse = ""] = cols;
    if (!email) continue;
    out.push({
      prenoms,
      nom,
      email: email.toLowerCase(),
      role,
      disciplines: disciplines.split("|").map((s) => s.trim()).filter(Boolean),
      niveaux: niveaux.split("|").map((s) => s.trim()).filter(Boolean),
      motDePasse,
    });
  }
  return out;
}

export async function importerEnseignantsCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Aucun fichier CSV sélectionné." };
  }

  try {
    const lignes = parserCSV(await lireFichierTexte(fichier));
    if (lignes.length === 0) {
      return { ok: false, message: "CSV vide ou illisible (colonnes : prénoms ; nom ; email ; rôle ; disciplines ; niveaux)." };
    }

    // Référentiels
    const [rolesDb, disciplines, niveaux] = await Promise.all([
      prisma.role.findMany({ where: { nomTechnique: { in: [...ROLES_IMPORT] } } }),
      // CLOISONNEMENT : l'import ne résout les noms que dans le national + CET établissement.
      prisma.discipline.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId }] },
        select: { id: true, nom: true, etablissementId: true },
      }),
      prisma.niveau.findMany({
        where: { OR: [{ etablissementId: null }, { etablissementId }] },
        select: { id: true, nom: true, cycle: true },
      }),
    ]);
    const roleParCle = new Map<string, string>();
    // Nom technique par id de rôle : nécessaire au contrôle « rôle de direction » du rattachement.
    const techParId = new Map(rolesDb.map((r) => [r.id, r.nomTechnique]));
    for (const r of rolesDb) {
      roleParCle.set(norm(r.nomTechnique), r.id);
      const def = ROLES[r.nomTechnique as keyof typeof ROLES];
      if (def) roleParCle.set(norm(def.libelle), r.id);
    }
    const idEnseignant = roleParCle.get("enseignant")!;

    // L'import ne résout que le VISIBLE : une discipline MASQUÉE localement (retirée de la
    // liste) n'est jamais ciblée — sinon des compétences invisibles du bloc seraient posées.
    const etabConfig = await prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { disciplinesRenommees: true, disciplinesMasquees: true },
    });
    const masquees = new Set(etabConfig?.disciplinesMasquees ?? []);
    const disciplinesVisibles = disciplines.filter((d) => !masquees.has(d.id));
    const discParNom = new Map(disciplinesVisibles.map((d) => [norm(d.nom), d.id]));

    // Les EXPRESSIONS LOCALES de l'établissement (disciplinesRenommees) résolvent AUSSI :
    // l'admin recopie les libellés qu'il VOIT sur la page de configuration. Un nom canonique
    // déjà présent n'est jamais écrasé, et seule une discipline VISIBLE ici est ciblée.
    const idsVisibles = new Set(disciplinesVisibles.map((d) => d.id));
    for (const [dId, libelle] of Object.entries(
      (etabConfig?.disciplinesRenommees as Record<string, unknown> | null) ?? {},
    )) {
      if (typeof libelle !== "string") continue;
      const cle = norm(libelle);
      if (!discParNom.has(cle) && idsVisibles.has(dId)) discParNom.set(cle, dId);
    }

    // Une spécialité MASQUÉE localement, exactement homonyme, est RÉACTIVÉE par l'import
    // (la déclarer pour un enseignant = l'établissement l'utilise — même principe que les
    // sous-lignes LV2 du bloc effectifs) et listée dans le bilan.
    const discMasqueesParNom = new Map(
      disciplines.filter((d) => masquees.has(d.id)).map((d) => [norm(d.nom), d] as const),
    );
    const reactivees = new Set<string>();
    // Expressions locales par id (pour compléter discParNom quand une masquée est réactivée).
    const expressionsParId = new Map(
      Object.entries((etabConfig?.disciplinesRenommees as Record<string, unknown> | null) ?? {}).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    );
    /**
     * Retire la discipline du masquage local — sur une lecture FRAÎCHE de la colonne (jamais
     * une copie d'avant la boucle : un masquage posé en parallèle ne doit pas être écrasé).
     */
    const reactiver = async (discId: string) => {
      const frais = await prisma.etablissement.findUnique({
        where: { id: etablissementId },
        select: { disciplinesMasquees: true },
      });
      const liste = frais?.disciplinesMasquees ?? [];
      if (liste.includes(discId)) {
        await prisma.etablissement.update({
          where: { id: etablissementId },
          data: { disciplinesMasquees: liste.filter((x) => x !== discId) },
        });
      }
      masquees.delete(discId);
    };
    // Règle client : les COMPOSANTES d'un couple de spécialités visible (« Français/EDHC »)
    // sont reconnues individuellement — si aucune discipline autonome n'existe dans le
    // périmètre, elle est créée pour l'établissement.
    const composantesCouples = new Map<string, string>();
    for (const d of disciplinesVisibles) {
      if (!d.nom.includes("/")) continue;
      for (const part of d.nom.split("/").map((s) => s.trim()).filter(Boolean)) {
        if (!composantesCouples.has(norm(part))) composantesCouples.set(norm(part), part);
      }
    }

    // Règle client (LV2, source unique lib/disciplines/lv2) : une spécialité « Espagnol » ou
    // « Allemand » du CSV vaut « LV2-Espagnol » / « LV2-Allemand ». Résolution : discipline
    // LV2-x déjà visible ; sinon la variante « Espagnol »/« Allemand » PROPRE à l'établissement
    // est RENOMMÉE (ses compétences existantes suivent) ; sinon la discipline d'établissement
    // est créée. Une ligne NATIONALE (« Allemand » historique, partagée) n'est JAMAIS mutée.
    const resoudreDiscipline = async (brut: string): Promise<string | null> => {
      const cible = cibleLV2(brut);
      if (!cible) {
        const n = norm(brut);
        const vue = discParNom.get(n);
        if (vue) return vue;
        // 1. Discipline MASQUÉE homonyme → réactivée puis résolue.
        const masquee = discMasqueesParNom.get(n);
        if (masquee) {
          await reactiver(masquee.id);
          discParNom.set(n, masquee.id);
          reactivees.add(masquee.nom);
          // La réactivée redevient résoluble sous TOUTES ses graphies dans la suite du fichier :
          // son expression locale éventuelle, et — si c'est un couple — ses composantes.
          const expr = expressionsParId.get(masquee.id);
          if (expr && !discParNom.has(norm(expr))) discParNom.set(norm(expr), masquee.id);
          if (masquee.nom.includes("/")) {
            for (const part of masquee.nom.split("/").map((s) => s.trim()).filter(Boolean)) {
              if (!composantesCouples.has(norm(part))) composantesCouples.set(norm(part), part);
            }
          }
          return masquee.id;
        }
        // 2. COMPOSANTE d'un couple visible sans discipline autonome → créée pour l'établissement.
        const composante = composantesCouples.get(n);
        if (composante) {
          try {
            const creee = await prisma.discipline.create({
              data: { nom: composante, couleur: "#2f7d5e", etablissementId },
              select: { id: true },
            });
            discParNom.set(n, creee.id);
            return creee.id;
          } catch {
            // Course : l'unicité (etablissementId, nom) a tranché — relire la ligne posée.
            const relue = await prisma.discipline.findFirst({
              where: { nom: { equals: composante, mode: "insensitive" }, OR: [{ etablissementId: null }, { etablissementId }] },
              select: { id: true },
            });
            if (relue && !masquees.has(relue.id)) {
              discParNom.set(n, relue.id);
              return relue.id;
            }
          }
        }
        return null;
      }
      const cleCible = norm(cible);
      const deja = discParNom.get(cleCible);
      if (deja) return deja;
      // Membre MASQUÉ de la famille LV2 (« LV2-x » ou variante nue « Espagnol »/« Allemand ») :
      // RÉACTIVÉ — jamais de doublon créé, jamais de compétence posée sur une ligne invisible.
      const masqueeLV2 = disciplines.find((d) => masquees.has(d.id) && cibleLV2(d.nom) === cible);
      if (masqueeLV2) {
        await reactiver(masqueeLV2.id);
        // Variante nue LOCALE : renommée vers le nom canonique (ses compétences suivent) ;
        // une ligne NATIONALE n'est jamais mutée.
        if (masqueeLV2.etablissementId === etablissementId && norm(masqueeLV2.nom) !== cleCible) {
          try {
            await prisma.discipline.update({ where: { id: masqueeLV2.id }, data: { nom: cible } });
          } catch {
            // Homonyme local déjà présent : la ligne réactivée reste sous son nom actuel.
          }
        }
        discParNom.set(cleCible, masqueeLV2.id);
        reactivees.add(cible);
        return masqueeLV2.id;
      }
      const locale = disciplinesVisibles.find(
        (d) => d.etablissementId === etablissementId && cibleLV2(d.nom) === cible,
      );
      let id: string;
      try {
        id = locale
          ? (await prisma.discipline.update({ where: { id: locale.id }, data: { nom: cible } })).id
          : (await prisma.discipline.create({ data: { nom: cible, etablissementId } })).id;
      } catch {
        // Course entre deux imports simultanés : l'unicité (etablissementId, nom) a tranché —
        // on relit la ligne posée par l'autre plutôt que d'avorter tout l'import (jamais une
        // ligne encore MASQUÉE : elle serait invisible du bloc Compétences).
        const posee = await prisma.discipline.findFirst({
          where: { nom: cible, OR: [{ etablissementId: null }, { etablissementId }] },
          select: { id: true },
        });
        if (!posee || masquees.has(posee.id)) return null;
        id = posee.id;
      }
      discParNom.set(cleCible, id);
      return id;
    };
    const nivParNom = new Map(niveaux.map((n) => [norm(n.nom), n.id]));
    const idsPremierCycle = niveaux.filter((n) => n.cycle === "college").map((n) => n.id);
    const idsTousNiveaux = niveaux.map((n) => n.id);

    // « 1er cycle » → niveaux du collège ; « 2nd cycle » → les DEUX cycles (un enseignant
    // du 2nd cycle peut enseigner au 1er, l'inverse est faux). Sinon : nom de niveau exact.
    const developperNiveau = (brut: string): string[] | null => {
      const n = norm(brut).replace(/\s+/g, " ");
      if (["1er cycle", "1e cycle", "premier cycle", "college", "1er cycle (college)"].includes(n)) {
        return idsPremierCycle;
      }
      if (["2nd cycle", "2e cycle", "2eme cycle", "second cycle", "lycee", "2nd cycle (lycee)"].includes(n)) {
        return idsTousNiveaux;
      }
      const nid = nivParNom.get(n);
      return nid ? [nid] : null;
    };

    let crees = 0;
    let rattaches = 0;
    let transferes = 0;
    let ignores = 0;
    let mdpAppliques = 0;
    let mdpInvalides = 0;
    const inconnus = new Set<string>();
    const refuses: string[] = [];

    for (const l of lignes) {
      if (!/.+@.+\..+/.test(l.email)) {
        ignores++;
        continue;
      }
      const roleId = (l.role && roleParCle.get(norm(l.role))) || idEnseignant;
      // Mot de passe initial (7e colonne, CSV du Convertisseur) : appliqué seulement s'il
      // respecte la politique des comptes, et seulement à la CRÉATION (jamais réécrit).
      const mdpBrut = l.motDePasse.trim();
      let hashCsv: string | null = null;
      if (mdpBrut) {
        if (motDePasseConforme(mdpBrut)) hashCsv = await hacherMotDePasse(mdpBrut);
        else mdpInvalides++;
      }
      const r = await creerOuRattacher(u, l.email, l.prenoms, l.nom, etablissementId, roleId, techParId.get(roleId) ?? "enseignant", hashCsv);
      if (r.statut === "refus") {
        // Cloisonnement : compte d'un autre établissement / de direction / de gestion — refusé
        // et LISTÉ dans le bilan (jamais de rattachement silencieux).
        refuses.push(l.email);
        continue;
      }
      if (r.statut === "cree") {
        crees++;
        if (hashCsv) mdpAppliques++;
      } else {
        rattaches++;
        if (r.statut === "transfere") transferes++;
      }

      if (roleId === idEnseignant) {
        const discIds: string[] = [];
        for (const d of l.disciplines) {
          const did = await resoudreDiscipline(d);
          if (did) discIds.push(did);
          else inconnus.add(`discipline « ${d} »`);
        }
        const nivIds = new Set<string>();
        for (const n of l.niveaux) {
          const ids = developperNiveau(n);
          if (ids) for (const nid of ids) nivIds.add(nid);
          else inconnus.add(`niveau « ${n} » (attendu : 1er cycle ou 2nd cycle)`);
        }
        // Fichier SANS spécialités ni niveaux (liste 3 colonnes) : les compétences déjà
        // déclarées des comptes rattachés sont CONSERVÉES — jamais purgées en silence.
        // Le remplacement complet ne joue que si la ligne déclare au moins une valeur.
        if (discIds.length > 0 || nivIds.size > 0) {
          await appliquerCompetences(r.id, etablissementId, discIds, [...nivIds]);
        }
      }
    }

    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    const note = inconnus.size > 0 ? ` Non reconnus (ignorés) : ${[...inconnus].slice(0, 6).join(", ")}.` : "";
    // Disciplines retirées de la liste locale puis redéclarées par le fichier : réactivées.
    const noteReactivees =
      reactivees.size > 0 ? ` Discipline(s) réactivée(s) pour l'établissement : ${[...reactivees].join(", ")}.` : "";
    const noteRefus =
      refuses.length > 0
        ? ` ${refuses.length} compte(s) refusé(s) — autre établissement, direction ou rôle de gestion : ${refuses.slice(0, 6).join(", ")}${refuses.length > 6 ? "…" : ""}.`
        : "";
    // Les transferts inter-établissements sont annoncés EXPLICITEMENT dans le bilan (jamais
    // fondus dans « mis à jour ») : chacun est aussi tracé au journal et notifié au titulaire.
    const noteTransferts =
      transferes > 0
        ? ` — dont ${transferes} rattaché(s) depuis un autre établissement (décisions tracées, titulaires notifiés)`
        : "";
    const noteMdp =
      mdpAppliques > 0 || mdpInvalides > 0
        ? ` Mots de passe du fichier : ${mdpAppliques} appliqué(s) aux comptes créés${mdpInvalides > 0 ? `, ${mdpInvalides} non conforme(s) ignoré(s) (« mot de passe oublié » pour ces comptes)` : ""}.`
        : "";
    return {
      ok: true,
      message: `Import terminé : ${crees} créé(s), ${rattaches} mis à jour${noteTransferts}, ${ignores} ignoré(s).${note}${noteReactivees}${noteRefus}${noteMdp}`,
    };
  } catch (e) {
    console.error("[import csv] erreur :", e);
    return { ok: false, message: "Erreur lors de l'import." };
  }
}

export async function enregistrerCompetences(formData: FormData) {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "");
  if (!etablissementId || !enseignantId) return;
  const u = await peutGerer(etablissementId);
  if (!u) return;

  // CLOISONNEMENT : l'enseignant visé doit appartenir à CET établissement (même contrôle que
  // enregistrerDisciplinesEnseignant — un identifiant forgé ne vise jamais un compte étranger).
  const enseignant = await prisma.utilisateur.findUnique({
    where: { id: enseignantId },
    select: { etablissementId: true },
  });
  if (!enseignant || enseignant.etablissementId !== etablissementId) return;

  const disciplineIds: string[] = [];
  const niveauIds: string[] = [];
  for (const [cle, val] of formData.entries()) {
    if (val !== "on") continue;
    if (cle.startsWith("disc_")) disciplineIds.push(cle.slice("disc_".length));
    else if (cle.startsWith("niveau_")) niveauIds.push(cle.slice("niveau_".length));
  }

  try {
    await appliquerCompetences(enseignantId, etablissementId, disciplineIds, niveauIds);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
  } catch (e) {
    console.error("[competences] erreur :", e);
  }
}

// ── Suppression ──
export async function supprimerUtilisateur(formData: FormData) {
  const utilisateurId = String(formData.get("utilisateurId") ?? "");
  const etablissementId = String(formData.get("etablissementId") ?? "");
  if (!utilisateurId || !etablissementId) return;
  const u = await peutGerer(etablissementId);
  if (!u) return;
  if (utilisateurId === u.id) return; // ne pas se supprimer soi-même

  const cible = await prisma.utilisateur.findUnique({ where: { id: utilisateurId }, include: { roleActif: true } });
  if (!cible || cible.etablissementId !== etablissementId) return;
  if (cible.roleActif.nomTechnique === "admin") return; // jamais l'admin
  // Un compte de DIRECTION (chef / adjoint) n'est supprimé que par une autorité chef :
  // l'ACE seul ne retire pas la direction de son établissement.
  if (ROLES_DIRECTION.has(cible.roleActif.nomTechnique) && !ROLES_AUTORITE_RATTACHEMENT.has(u.roleReel)) return;

  await prisma.utilisateur.delete({ where: { id: utilisateurId } });
  revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
  revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
}

// ── Génération des comptes enseignants depuis les effectifs déclarés ──

const CYCLE_LABEL: Record<string, string> = {
  college: "collège",
  lycee: "lycée",
  primaire: "primaire",
  prescolaire: "préscolaire",
};

// Prénoms / noms ivoiriens courants — pour générer des comptes-enseignants réalistes.
// Ce sont des espaces réservés : chaque enseignant modifiera ensuite ses propres coordonnées.
const PRENOMS = [
  "Kouadio", "Aya", "Koffi", "Adjoua", "Yao", "Affoué", "Kouassi", "Akissi", "N'Guessan", "Amenan",
  "Konan", "Ahou", "Kouamé", "Adjo", "Brou", "Aké", "Aristide", "Fatou", "Ibrahim", "Mariam",
  "Serge", "Chantal", "Désiré", "Rita", "Franck", "Grâce", "Emmanuel", "Rachelle", "Boubacar", "Awa",
  "Landry", "Estelle", "Junior", "Nadège", "Cyprien", "Sylvie", "Patrick", "Clarisse", "Éric", "Solange",
];
const NOMS = [
  "Koné", "Ouattara", "Traoré", "Yao", "Kouassi", "Aka", "Bamba", "Coulibaly", "Diarra", "Touré",
  "Gnamien", "Assi", "Ehui", "Kacou", "N'Dri", "Kouamé", "Konan", "Brou", "Yéo", "Soro",
  "Diabaté", "Guéi", "Zadi", "Kroa", "Tanoh", "Adou", "Béchi", "Loukou", "Séka", "Djédjé",
  "Gnahoré", "Kanga", "Amani", "Doumbia", "Fofana", "Cissé", "Sangaré", "Bakayoko", "Méité", "Silué",
];

function slug(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Crée de vrais comptes enseignants à partir de la table des effectifs (cycle × discipline).
 * Chaque compte reçoit une compétence (la discipline) et les niveaux du cycle où il intervient,
 * de sorte qu'il puisse être affecté et apparaître NOMMÉMENT sur l'emploi du temps.
 * Idempotent : ne crée que le complément manquant par rapport aux effectifs déclarés.
 */
export async function genererComptesEnseignants(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const [etab, effectifs, classes, roleEns, existants] = await Promise.all([
      prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { nom: true } }),
      prisma.effectifEnseignant.findMany({
        where: { etablissementId },
        include: { discipline: { select: { id: true, nom: true } } },
      }),
      prisma.classe.findMany({
        where: { etablissementId },
        select: { niveauId: true, niveau: { select: { cycle: true } } },
      }),
      prisma.role.findUnique({ where: { nomTechnique: "enseignant" }, select: { id: true } }),
      prisma.utilisateur.findMany({
        where: { etablissementId, roleActif: { nomTechnique: "enseignant" } },
        select: {
          competences: { select: { disciplineId: true } },
          niveauxIntervention: { select: { niveau: { select: { cycle: true } } } },
        },
      }),
    ]);
    if (!etab) return { ok: false, message: "Établissement introuvable." };
    if (!roleEns) return { ok: false, message: "Rôle « enseignant » introuvable (seed manquant ?)." };
    if (effectifs.length === 0 || effectifs.every((e) => e.nombre <= 0)) {
      return { ok: false, message: "Renseignez d'abord les effectifs des enseignants par cycle et discipline." };
    }

    // Niveaux réellement utilisés (via les classes), regroupés par cycle.
    const niveauxParCycle = new Map<string, Set<string>>();
    for (const cl of classes) {
      const s = niveauxParCycle.get(cl.niveau.cycle) ?? new Set<string>();
      s.add(cl.niveauId);
      niveauxParCycle.set(cl.niveau.cycle, s);
    }

    // Comptes existants déjà rattachés à un pool (discipline × cycle) — pour l'idempotence.
    const existantsParPool = new Map<string, number>();
    for (const t of existants) {
      const cycles = new Set(t.niveauxIntervention.map((n) => n.niveau.cycle));
      const discs = new Set(t.competences.map((c) => c.disciplineId));
      for (const d of discs) for (const c of cycles) {
        const k = `${c}:${d}`;
        existantsParPool.set(k, (existantsParPool.get(k) ?? 0) + 1);
      }
    }

    // E-mails déjà pris sur le domaine de l'établissement (garantit l'unicité).
    const etabSlug = slug(etab.nom) || "etablissement";
    const domaine = `@${etabSlug}.eduweb.ci`;
    const dejaPris = new Set(
      (await prisma.utilisateur.findMany({ where: { email: { endsWith: domaine } }, select: { email: true } }))
        .map((x) => x.email),
    );

    // Un seul mot de passe aléatoire (inconnu) partagé : les enseignants le réinitialiseront.
    const hash = await hacherMotDePasse(randomBytes(18).toString("base64url"));

    interface Nouveau { email: string; prenoms: string; nom: string; disciplineId: string; niveauIds: string[] }
    const nouveaux: Nouveau[] = [];
    const cyclesSansClasse = new Set<string>();
    let g = existants.length; // index global pour varier les noms

    for (const ef of effectifs) {
      if (ef.nombre <= 0) continue;
      const niveauIds = [...(niveauxParCycle.get(ef.cycle) ?? [])];
      if (niveauIds.length === 0) {
        cyclesSansClasse.add(CYCLE_LABEL[ef.cycle] ?? ef.cycle);
        continue;
      }
      const dejaCrees = existantsParPool.get(`${ef.cycle}:${ef.disciplineId}`) ?? 0;
      const manquants = Math.max(0, ef.nombre - dejaCrees);
      for (let k = 0; k < manquants; k++) {
        // Combinaison prénom × nom variée (pas de grappes de patronymes identiques) et unique
        // sur ≥ 1600 comptes : le nom avance à chaque enseignant (pas seulement par bloc).
        const prenoms = PRENOMS[g % PRENOMS.length];
        const nom = NOMS[(Math.floor(g / PRENOMS.length) + g * 7) % NOMS.length];
        g += 1;
        let email = `${slug(prenoms)}.${slug(nom)}.${g}${domaine}`;
        let suffixe = g;
        while (dejaPris.has(email)) {
          suffixe += 1;
          email = `${slug(prenoms)}.${slug(nom)}.${suffixe}${domaine}`;
        }
        dejaPris.add(email);
        nouveaux.push({ email, prenoms, nom, disciplineId: ef.disciplineId, niveauIds });
      }
    }

    if (nouveaux.length === 0) {
      const note = cyclesSansClasse.size > 0
        ? ` (aucune classe pour : ${[...cyclesSansClasse].join(", ")} — calculez d'abord les classes)`
        : " Les comptes correspondant aux effectifs existent déjà.";
      return { ok: true, message: `Aucun nouveau compte à créer.${note}` };
    }

    // 1) Création des comptes.
    await prisma.utilisateur.createMany({
      data: nouveaux.map((n) => ({
        email: n.email,
        prenoms: n.prenoms,
        nom: n.nom,
        motDePasseHash: hash,
        statutCompte: "actif" as const,
        emailVerifieLe: new Date(),
        roleActifId: roleEns.id,
        etablissementId,
      })),
      skipDuplicates: true,
    });

    // 2) Récupération des identifiants pour poser compétences + niveaux.
    const crees = await prisma.utilisateur.findMany({
      where: { email: { in: nouveaux.map((n) => n.email) } },
      select: { id: true, email: true },
    });
    const idParEmail = new Map(crees.map((c) => [c.email, c.id]));

    const competences: { enseignantId: string; disciplineId: string; etablissementId: string }[] = [];
    const niveaux: { enseignantId: string; niveauId: string; etablissementId: string }[] = [];
    for (const n of nouveaux) {
      const eid = idParEmail.get(n.email);
      if (!eid) continue;
      competences.push({ enseignantId: eid, disciplineId: n.disciplineId, etablissementId });
      for (const niveauId of n.niveauIds) niveaux.push({ enseignantId: eid, niveauId, etablissementId });
    }
    if (competences.length > 0) await prisma.competenceEnseignant.createMany({ data: competences, skipDuplicates: true });
    if (niveaux.length > 0) await prisma.niveauEnseignant.createMany({ data: niveaux, skipDuplicates: true });

    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/emploi-du-temps`);

    const note = cyclesSansClasse.size > 0
      ? ` Ignoré (aucune classe) : ${[...cyclesSansClasse].join(", ")}.`
      : "";
    return {
      ok: true,
      message: `${nouveaux.length} compte(s) enseignant(s) créé(s) depuis les effectifs. Régénérez l'emploi du temps pour les voir apparaître nommément. Mot de passe à définir via « mot de passe oublié ».${note}`,
    };
  } catch (e) {
    console.error("[generer comptes enseignants] erreur :", e);
    return { ok: false, message: "Erreur technique lors de la création des comptes." };
  }
}

/** Supprime tous les enseignants rattachés à l'établissement (nettoyage en masse). */
export async function viderEnseignants(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  try {
    const r = await prisma.utilisateur.deleteMany({
      where: { etablissementId, roleActif: { nomTechnique: "enseignant" } },
    });
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true, message: `${r.count} enseignant(s) supprimé(s).` };
  } catch (e) {
    console.error("[vider enseignants] erreur :", e);
    return { ok: false, message: "Erreur lors de la suppression." };
  }
}
