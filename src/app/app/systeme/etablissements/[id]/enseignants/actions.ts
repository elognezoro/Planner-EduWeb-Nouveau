"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { hacherMotDePasse } from "@/lib/auth/password";
import { ROLES } from "@/lib/rbac";

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
  if (u.roleReel === "admin") return u;
  // Le gestionnaire de l'établissement (admin d'établissements, chef ou ACE) gère LE SIEN.
  if (
    (u.roleReel === "etablissements_admin" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  return null;
}

async function creerOuRattacher(
  email: string,
  prenoms: string,
  nom: string,
  etablissementId: string,
  roleId: string,
): Promise<{ id: string; statut: "cree" | "rattache" }> {
  const existant = await prisma.utilisateur.findUnique({ where: { email } });
  if (existant) {
    await prisma.utilisateur.update({
      where: { id: existant.id },
      data: {
        roleActifId: roleId,
        etablissementId,
        prenoms: prenoms || existant.prenoms,
        nom: nom || existant.nom,
      },
    });
    return { id: existant.id, statut: "rattache" };
  }
  const hash = await hacherMotDePasse(randomBytes(12).toString("base64url"));
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
      prisma.discipline.findMany({ select: { id: true } }),
      prisma.niveau.findMany({ select: { id: true } }),
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
  // Ne conserve que des disciplines réellement existantes.
  const valides = demandees.length
    ? (await prisma.discipline.findMany({ where: { id: { in: demandees } }, select: { id: true } })).map((d) => d.id)
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
    const r = await creerOuRattacher(parsed.data.email, parsed.data.prenoms, parsed.data.nom, parsed.data.etablissementId, role.id);
    revalidatePath(`/app/systeme/etablissements/${parsed.data.etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${parsed.data.etablissementId}`);
    return {
      ok: true,
      message: r.statut === "cree" ? "Utilisateur créé (mot de passe à définir via « mot de passe oublié »)." : "Compte existant rattaché.",
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
    const [prenoms = "", nom = "", email = "", role = "", disciplines = "", niveaux = ""] = cols;
    if (!email) continue;
    out.push({
      prenoms,
      nom,
      email: email.toLowerCase(),
      role,
      disciplines: disciplines.split("|").map((s) => s.trim()).filter(Boolean),
      niveaux: niveaux.split("|").map((s) => s.trim()).filter(Boolean),
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
    const lignes = parserCSV(await fichier.text());
    if (lignes.length === 0) {
      return { ok: false, message: "CSV vide ou illisible (colonnes : prénoms ; nom ; email ; rôle ; disciplines ; niveaux)." };
    }

    // Référentiels
    const [rolesDb, disciplines, niveaux] = await Promise.all([
      prisma.role.findMany({ where: { nomTechnique: { in: [...ROLES_IMPORT] } } }),
      prisma.discipline.findMany({ select: { id: true, nom: true } }),
      prisma.niveau.findMany({ select: { id: true, nom: true, cycle: true } }),
    ]);
    const roleParCle = new Map<string, string>();
    for (const r of rolesDb) {
      roleParCle.set(norm(r.nomTechnique), r.id);
      const def = ROLES[r.nomTechnique as keyof typeof ROLES];
      if (def) roleParCle.set(norm(def.libelle), r.id);
    }
    const idEnseignant = roleParCle.get("enseignant")!;
    const discParNom = new Map(disciplines.map((d) => [norm(d.nom), d.id]));
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
    let ignores = 0;
    const inconnus = new Set<string>();

    for (const l of lignes) {
      if (!/.+@.+\..+/.test(l.email)) {
        ignores++;
        continue;
      }
      const roleId = (l.role && roleParCle.get(norm(l.role))) || idEnseignant;
      const r = await creerOuRattacher(l.email, l.prenoms, l.nom, etablissementId, roleId);
      if (r.statut === "cree") crees++;
      else rattaches++;

      if (roleId === idEnseignant) {
        const discIds: string[] = [];
        for (const d of l.disciplines) {
          const did = discParNom.get(norm(d));
          if (did) discIds.push(did);
          else inconnus.add(`discipline « ${d} »`);
        }
        const nivIds = new Set<string>();
        for (const n of l.niveaux) {
          const ids = developperNiveau(n);
          if (ids) for (const nid of ids) nivIds.add(nid);
          else inconnus.add(`niveau « ${n} » (attendu : 1er cycle ou 2nd cycle)`);
        }
        await appliquerCompetences(r.id, etablissementId, discIds, [...nivIds]);
      }
    }

    revalidatePath(`/app/systeme/etablissements/${etablissementId}/enseignants`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    const note = inconnus.size > 0 ? ` Non reconnus (ignorés) : ${[...inconnus].slice(0, 6).join(", ")}.` : "";
    return {
      ok: true,
      message: `Import terminé : ${crees} créé(s), ${rattaches} mis à jour, ${ignores} ignoré(s).${note}`,
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
