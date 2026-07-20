"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
import { nomEnMajuscules, prenomsEnTitre } from "@/lib/convertisseur/format-noms";
import { paysConsulte } from "@/lib/pays-consulte";
import { analyserImportApfc, clefTexte } from "@/lib/apfc-import";
import { analyserImportPersonnelApfc, clefPersonne } from "@/lib/apfc-personnel-import";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

/** Peut gérer cette structure de formation (admin global, ou admin rattaché). */
function peutGerer(u: UtilisateurCourant, structure: { cafopId?: string | null; apfcId?: string | null }): boolean {
  if (u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  if (structure.cafopId && u.roleReel === "cafop_admin") return u.portee.cafopId === structure.cafopId;
  if (structure.apfcId && u.roleReel === "apfc_admin") return u.portee.apfcId === structure.apfcId;
  return false;
}

async function structureDeCohorte(cohorteId: string) {
  return prisma.cohorte.findUnique({
    where: { id: cohorteId },
    select: { id: true, cafopId: true, apfcId: true },
  });
}

// ── Structures (CAFOP / APFC) — admin uniquement ──

export interface DetailsCafop {
  regionId?: string | null;
  drena?: string | null;
  localite?: string | null;
  directeur?: string | null;
  directeurTel?: string | null;
  effectif?: number | null;
}

/** Code d'un CAFOP : « CAF-{3 lettres}-{séquence} » (ex. « CAF-ABG-001 »). */
function codeCafop(base: string, seq: number): string {
  const abbr =
    (base || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3) || "CAF";
  return `CAF-${abbr}-${String(seq).padStart(3, "0")}`;
}

export async function creerStructure(
  type: "cafop" | "apfc",
  nom: string,
  details?: DetailsCafop,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  // Admin système, OU Super Admin national du type concerné (création DANS son pays).
  const roleSuper = type === "cafop" ? "super_admin_cafop" : "super_admin_apfc";
  if (u.apercuActif || (u.roleReel !== "admin" && u.roleReel !== roleSuper)) {
    return { ok: false, message: "Action réservée à l'administrateur." };
  }
  const libelle = nom.trim();
  if (!libelle) return { ok: false, message: "Le nom est obligatoire." };
  // Cloisonnement pays du Super Admin : la structure (et sa région) doivent être dans son pays.
  const superAdmin = u.roleReel === roleSuper;
  const paysSuper = u.portee.pays;
  if (superAdmin && !paysSuper) return { ok: false, message: "Votre compte n'a pas de pays de rattachement." };
  if (superAdmin && details?.regionId) {
    const region = await prisma.region.findUnique({ where: { id: details.regionId }, select: { pays: true } });
    if (!region || region.pays !== paysSuper) return { ok: false, message: "La direction régionale choisie n'appartient pas à votre pays." };
  }
  // L'APFC n'a pas de champ « pays » : son rattachement national passe par la région — obligatoire ici.
  if (superAdmin && type === "apfc" && !details?.regionId) {
    return { ok: false, message: "Choisissez une direction régionale de votre pays pour l'APFC." };
  }
  try {
    if (type === "cafop") {
      // Séquence = plus grand suffixe numérique existant + 1 : stable aux suppressions,
      // ne réutilise jamais un code déjà attribué (Cafop.code n'a pas de contrainte d'unicité).
      const codes = await prisma.cafop.findMany({ select: { code: true } });
      const maxSeq = codes.reduce((m, c) => {
        const n = Number(c.code?.match(/(\d+)\s*$/)?.[1] ?? 0);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 0);
      const seq = maxSeq + 1;
      const localite = details?.localite?.trim() || null;
      const effectif = Number.isFinite(details?.effectif) ? Math.max(0, Number(details?.effectif)) : 0;
      await prisma.cafop.create({
        data: {
          nom: libelle,
          regionId: details?.regionId || null,
          // Super Admin : centre créé dans SON pays. Admin : pays par défaut du schéma (modifiable ensuite).
          ...(superAdmin && paysSuper ? { pays: paysSuper } : {}),
          code: codeCafop(localite || libelle.replace(/^CAFOP\s+(d['e]\s*)?/i, ""), seq),
          drena: details?.drena?.trim() || null,
          localite,
          directeur: details?.directeur?.trim() || null,
          directeurTel: details?.directeurTel?.trim() || null,
          effectif,
        },
      });
    } else {
      await prisma.apfc.create({ data: { nom: libelle, regionId: details?.regionId || null } });
    }
    revalidatePath(`/app/systeme/${type}`);
  } catch (e) {
    console.error("[formation] création structure :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: type === "cafop" ? "CAFOP créé." : "APFC créée." };
}

/**
 * Modification de la fiche d'une APFC (nom, région) — même garde d'écriture que
 * `creerStructure("apfc", …)` : admin système, ou Super Admin APFC (dans son pays, avec
 * région obligatoire pour rester cloisonné).
 */
export async function modifierApfc(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || (u.roleReel !== "admin" && u.roleReel !== "super_admin_apfc")) {
    return { ok: false, message: "Action réservée à l'administrateur." };
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "APFC introuvable." };
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { ok: false, message: "Le nom de l'APFC est obligatoire." };
  const regionId = String(formData.get("regionId") ?? "").trim() || null;
  // Chef d'antenne — casse normalisée (NOM en MAJUSCULES, Prénoms en Casse Titre).
  const chefAntenneNom = nomEnMajuscules(String(formData.get("chefAntenneNom") ?? "")) || null;
  const chefAntennePrenoms = prenomsEnTitre(String(formData.get("chefAntennePrenoms") ?? "")) || null;

  const superAdmin = u.roleReel === "super_admin_apfc";
  const paysSuper = u.portee.pays;
  try {
    if (superAdmin) {
      if (!paysSuper) return { ok: false, message: "Votre compte n'a pas de pays de rattachement." };
      const actuelle = await prisma.apfc.findUnique({ where: { id }, select: { region: { select: { pays: true } } } });
      if (!actuelle || actuelle.region?.pays !== paysSuper) return { ok: false, message: "Cette APFC n'appartient pas à votre pays." };
      // L'APFC n'a pas de champ « pays » propre : son rattachement national passe par la région.
      if (!regionId) return { ok: false, message: "Choisissez une direction régionale de votre pays pour l'APFC." };
      const region = await prisma.region.findUnique({ where: { id: regionId }, select: { pays: true } });
      if (!region || region.pays !== paysSuper) return { ok: false, message: "La direction régionale choisie n'appartient pas à votre pays." };
    }
    await prisma.apfc.update({ where: { id }, data: { nom, regionId, chefAntenneNom, chefAntennePrenoms } });
    revalidatePath(`/app/systeme/apfc/${id}`);
    revalidatePath("/app/systeme/apfc");
  } catch (e) {
    console.error("[formation] modification APFC :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "APFC mise à jour." };
}

/**
 * Garde d'écriture réutilisée par toutes les actions de la fiche d'une APFC (documents
 * officiels, annuaire du personnel) : identique à celle de `modifierApfc` — admin système, ou
 * Super Admin APFC dans SON pays (cloisonnement vérifié via la région de l'APFC, qui porte son
 * seul rattachement national). `apfc_admin` gère ses sessions/cohortes, pas la fiche.
 */
async function peutModifierApfc(u: UtilisateurCourant, apfcId: string): Promise<boolean> {
  if (u.apercuActif || (u.roleReel !== "admin" && u.roleReel !== "super_admin_apfc")) return false;
  if (u.roleReel === "super_admin_apfc") {
    const paysSuper = u.portee.pays;
    if (!paysSuper) return false;
    const apfc = await prisma.apfc.findUnique({ where: { id: apfcId }, select: { region: { select: { pays: true } } } });
    if (!apfc || apfc.region?.pays !== paysSuper) return false;
  }
  return true;
}

/** Suppression d'un centre CAFOP / APFC (admin uniquement) — cascade sur ses promotions. */
export async function supprimerStructure(type: "cafop" | "apfc", id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") {
    return { ok: false, message: "Action réservée à l'administrateur." };
  }
  try {
    // Les comptes rattachés sont détachés (FK ON DELETE SET NULL) ; les promotions sont supprimées en cascade.
    if (type === "cafop") await prisma.cafop.delete({ where: { id } });
    else await prisma.apfc.delete({ where: { id } });
    revalidatePath(`/app/systeme/${type}`);
  } catch (e) {
    console.error("[formation] suppression structure :", e);
    return { ok: false, message: "Suppression impossible (erreur technique)." };
  }
  return { ok: true, message: type === "cafop" ? "CAFOP supprimé." : "APFC supprimée." };
}

// ── Modules de formation (CAFOP) — admin uniquement ──

function estAdmin(u: UtilisateurCourant): boolean {
  return !u.apercuActif && u.roleReel === "admin";
}

/** Données d'un module de formation (dates au format « yyyy-mm-dd » venant des <input type="date">). */
export interface ComposanteModule {
  nom: string;
  themes: string[];
}
export interface ModuleCafopInput {
  nom: string;
  code?: string | null;
  coefficient?: number;
  annee?: number;
  semestre?: number | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  datePretest?: string | null;
  dateEvaluation?: string | null;
  /** Structure pédagogique : composantes → thèmes (cascade Module → Composante → Thème). */
  composantes?: ComposanteModule[];
  /** Vrai = STAGE PRATIQUE (composantes/thèmes = habiletés visées) ; plusieurs stages par année. */
  estStage?: boolean;
}

/** Nettoie les composantes/thèmes saisis (trim, dédoublonnage, entrées vides retirées). */
function nettoyerComposantes(c?: ComposanteModule[]): ComposanteModule[] {
  if (!Array.isArray(c)) return [];
  return c
    .map((x) => ({
      nom: String(x?.nom ?? "").trim().slice(0, 120),
      themes: Array.isArray(x?.themes)
        ? [...new Set(x.themes.map((t) => String(t ?? "").trim().slice(0, 160)).filter(Boolean))].slice(0, 100)
        : [],
    }))
    .filter((x) => x.nom.length > 0)
    .slice(0, 50);
}

function jalonDate(s?: string | null): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function anneeValide(n?: number): number {
  const v = Math.trunc(Number(n));
  return v >= 1 && v <= 3 ? v : 1;
}
function semestreValide(n?: number | null): number | null {
  if (n == null) return null;
  const v = Math.trunc(Number(n));
  return v === 1 || v === 2 ? v : null;
}
function coefficientValide(n?: number): number {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(v, 99);
}

/** Champs communs à la création et à la modification d'un module. */
function donneesModule(data: ModuleCafopInput) {
  return {
    nom: data.nom.trim(),
    code: (data.code ?? "").trim() || null,
    coefficient: coefficientValide(data.coefficient),
    annee: anneeValide(data.annee),
    semestre: semestreValide(data.semestre),
    dateDebut: jalonDate(data.dateDebut),
    dateFin: jalonDate(data.dateFin),
    datePretest: jalonDate(data.datePretest),
    dateEvaluation: jalonDate(data.dateEvaluation),
    // Cast : Prisma Json n'accepte pas une interface nommée (pas de signature d'index).
    composantes: nettoyerComposantes(data.composantes) as unknown as Prisma.InputJsonValue,
    estStage: Boolean(data.estStage),
  };
}

export async function creerModuleCafop(data: ModuleCafopInput): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };
  const champs = donneesModule(data);
  if (!champs.nom) return { ok: false, message: "Le nom du module est obligatoire." };
  try {
    const ordre = await prisma.moduleCafop.count({ where: { annee: champs.annee } });
    await prisma.moduleCafop.create({ data: { ...champs, ordre } });
    revalidatePath("/app/systeme/cafop/enseignements");
  } catch (e) {
    console.error("[formation] création module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Module ajouté." };
}

export async function modifierModuleCafop(id: string, data: ModuleCafopInput): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };
  const champs = donneesModule(data);
  if (!champs.nom) return { ok: false, message: "Le nom du module est obligatoire." };
  try {
    await prisma.moduleCafop.update({ where: { id }, data: champs });
    revalidatePath("/app/systeme/cafop/enseignements");
  } catch (e) {
    console.error("[formation] modification module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Module mis à jour." };
}

export async function basculerModuleCafop(id: string, actif: boolean): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };
  try {
    await prisma.moduleCafop.update({ where: { id }, data: { actif } });
    revalidatePath("/app/systeme/cafop/enseignements");
  } catch (e) {
    console.error("[formation] bascule module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: actif ? "Module activé." : "Module désactivé." };
}

export async function supprimerModuleCafop(id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };
  try {
    await prisma.moduleCafop.delete({ where: { id } });
    revalidatePath("/app/systeme/cafop/enseignements");
  } catch (e) {
    console.error("[formation] suppression module :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Module supprimé." };
}

// ── Enseignants d'un CAFOP (annuaire : nom, prénoms, discipline) — admin / cafop_admin ──

export async function ajouterEnseignantCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  if (!(await peutGererCafop(u, cafopId))) return { ok: false, message: "Action non autorisée." };
  const nom = nomEnMajuscules(String(formData.get("nom") ?? ""));
  if (!nom) return { ok: false, message: "Le nom de l'enseignant est obligatoire." };
  const prenoms = prenomsEnTitre(String(formData.get("prenoms") ?? "")) || null;
  const discipline = String(formData.get("discipline") ?? "").trim().slice(0, 160) || null;
  try {
    await prisma.enseignantCafop.create({ data: { cafopId, nom, prenoms, discipline } });
    revalidatePath(`/app/systeme/cafop/${cafopId}`);
  } catch (e) {
    console.error("[formation] ajout enseignant CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Enseignant ajouté." };
}

export async function supprimerEnseignantCafop(id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const ens = await prisma.enseignantCafop.findUnique({ where: { id }, select: { cafopId: true } });
  if (!ens) return { ok: false, message: "Enseignant introuvable." };
  if (!(await peutGererCafop(u, ens.cafopId))) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.enseignantCafop.delete({ where: { id } });
    revalidatePath(`/app/systeme/cafop/${ens.cafopId}`);
  } catch (e) {
    console.error("[formation] suppression enseignant CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Enseignant retiré." };
}

/** Affecte le professeur principal de chaque groupe-classe du centre (renseigne le bulletin). */
export async function enregistrerProfsPrincipauxCafop(
  cafopId: string,
  affectations: { groupe: string; enseignantId: string | null }[],
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!(await peutGererCafop(u, cafopId))) return { ok: false, message: "Action non autorisée." };
  try {
    // Sécurité : n'accepter que des enseignants réellement rattachés à ce centre.
    const valides = new Set((await prisma.enseignantCafop.findMany({ where: { cafopId }, select: { id: true } })).map((e) => e.id));
    for (const a of affectations) {
      const groupe = (a.groupe ?? "").trim();
      if (!groupe) continue;
      if (a.enseignantId && valides.has(a.enseignantId)) {
        await prisma.profPrincipalCafop.upsert({
          where: { cafopId_groupe: { cafopId, groupe } },
          create: { cafopId, groupe, enseignantId: a.enseignantId },
          update: { enseignantId: a.enseignantId },
        });
      } else {
        await prisma.profPrincipalCafop.deleteMany({ where: { cafopId, groupe } });
      }
    }
    revalidatePath(`/app/systeme/cafop/${cafopId}`);
    revalidatePath(`/app/systeme/cafop/${cafopId}/notes-bulletins`);
  } catch (e) {
    console.error("[formation] profs principaux CAFOP :", e);
    return { ok: false, message: "Enregistrement impossible." };
  }
  return { ok: true, message: "Professeurs principaux enregistrés." };
}

/** Import CSV d'enseignants (colonnes : NOM, Prénoms, Discipline). */
export async function importerEnseignantsCafopCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  if (!(await peutGererCafop(u, cafopId))) return { ok: false, message: "Action non autorisée." };

  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const lignes = parseCSV(contenu);
  if (lignes.length < 2) return { ok: false, message: "Le CSV doit contenir un en-tête et au moins une ligne." };

  const entete = lignes[0];
  const idx = (...alias: string[]) => entete.findIndex((h) => alias.includes(norm(h)));
  const iNom = idx("nom", "noms", "lastname", "famille");
  const iPrenoms = idx("prenoms", "prenom", "firstname", "givenname");
  const iDiscipline = idx("discipline", "matiere", "matieres", "specialite");
  if (iNom < 0) return { ok: false, message: "Colonne « NOM » introuvable dans l'en-tête du CSV." };
  const cell = (l: string[], i: number) => (i >= 0 && i < l.length ? l[i].trim() : "");

  const enseignants = lignes
    .slice(1)
    .map((l) => {
      const nom = nomEnMajuscules(cell(l, iNom));
      if (!nom) return null;
      return { cafopId, nom, prenoms: prenomsEnTitre(cell(l, iPrenoms)) || null, discipline: cell(l, iDiscipline).slice(0, 160) || null };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (enseignants.length === 0) return { ok: false, message: "Aucun enseignant valide détecté dans le CSV." };
  try {
    await prisma.enseignantCafop.createMany({ data: enseignants });
    revalidatePath(`/app/systeme/cafop/${cafopId}`);
  } catch (e) {
    console.error("[formation] import CSV enseignants :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }
  return { ok: true, message: `${enseignants.length} enseignant(s) importé(s).` };
}

// ── Import CSV de CAFOP — admin uniquement ──

export async function importerCafopCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };

  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const lignes = parseCSV(contenu);
  if (lignes.length < 2) return { ok: false, message: "Le CSV doit contenir un en-tête et au moins une ligne." };

  const entete = lignes[0];
  const idx = (...alias: string[]) => entete.findIndex((h) => alias.includes(norm(h)));
  // `norm` retire déjà les accents : les alias sont écrits sans accent.
  const col = {
    nom: idx("nom", "cafop", "centre", "name"),
    code: idx("code", "matricule"),
    drena: idx("drena", "direction", "region"),
    localite: idx("localite", "ville", "site"),
    directeur: idx("directeur", "director", "responsable"),
    tel: idx("telephone", "tel", "contact", "phone"),
    effectif: idx("effectif", "eleves", "effectifs"),
    pays: idx("pays", "country"),
  };
  if (col.nom < 0) return { ok: false, message: "Colonne « nom » (ou « CAFOP ») introuvable dans l'en-tête." };

  const cell = (l: string[], i: number) => (i >= 0 && i < l.length ? l[i].trim() : "");
  let crees = 0;
  let maj = 0;
  try {
    // Séquence de code stable (max suffixe existant + 1).
    const codes = await prisma.cafop.findMany({ select: { code: true } });
    let maxSeq = codes.reduce((m, c) => {
      const n = Number(c.code?.match(/(\d+)\s*$/)?.[1] ?? 0);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);

    for (const l of lignes.slice(1)) {
      const nom = cell(l, col.nom);
      if (!nom) continue;
      const localite = cell(l, col.localite) || null;
      const effRaw = Number(cell(l, col.effectif).replace(/\D/g, ""));
      const data = {
        drena: cell(l, col.drena) || null,
        localite,
        directeur: cell(l, col.directeur) || null,
        directeurTel: cell(l, col.tel) || null,
        effectif: Number.isFinite(effRaw) ? effRaw : 0,
        pays: cell(l, col.pays) || "Côte d'Ivoire",
      };
      const codeCsv = cell(l, col.code) || null;
      const existant = await prisma.cafop.findFirst({ where: { nom }, select: { id: true } });
      if (existant) {
        await prisma.cafop.update({
          where: { id: existant.id },
          data: { ...data, ...(codeCsv ? { code: codeCsv } : {}) },
        });
        maj++;
      } else {
        maxSeq += 1;
        await prisma.cafop.create({
          data: {
            nom,
            ...data,
            code: codeCsv || codeCafop(localite || nom.replace(/^CAFOP\s+(d['e]\s*)?/i, ""), maxSeq),
          },
        });
        crees++;
      }
    }
    revalidatePath("/app/systeme/cafop");
  } catch (e) {
    console.error("[formation] import CAFOP CSV :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }
  if (crees === 0 && maj === 0) return { ok: false, message: "Aucun CAFOP valide détecté dans le CSV." };
  return { ok: true, message: `${crees} CAFOP créé(s), ${maj} mis à jour.` };
}

// ── Import CSV d'APFC (création en lot) — admin, ou Super Admin APFC dans son pays ──

/**
 * Import CSV en lot des APFC. Colonnes reconnues : `nom` (obligatoire), `region` (nom de la
 * direction régionale, rapproché du référentiel du pays consulté — insensible casse/accents,
 * non bloquant si introuvable). Dédoublonne par nom (insensible casse/accents) contre les APFC
 * déjà existantes du pays ; les lignes ignorées (doublons, nom manquant) sont signalées dans le
 * message de retour. La validation est REJOUÉE ici (jamais confiance au client) via le même
 * analyseur pur que l'aperçu client (`analyserImportApfc`, src/lib/apfc-import.ts).
 */
export async function importerApfcCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  // Garde d'écriture réutilisée de creerStructure("apfc", …) : admin global, ou Super Admin
  // APFC (création circonscrite à SON pays via `paysConsulte()`, qui le verrouille déjà).
  if (u.apercuActif || (u.roleReel !== "admin" && u.roleReel !== "super_admin_apfc")) {
    return { ok: false, message: "Action réservée à l'administrateur." };
  }

  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const pays = await paysConsulte();
  let regions: { id: string; nom: string }[] = [];
  let existants: { nom: string }[] = [];
  try {
    [regions, existants] = await Promise.all([
      prisma.region.findMany({ where: { pays }, select: { id: true, nom: true } }),
      prisma.apfc.findMany({ where: { region: { pays } }, select: { nom: true } }),
    ]);
  } catch (e) {
    console.error("[formation] import APFC CSV — référentiel :", e);
    return { ok: false, message: "Erreur technique lors du chargement du référentiel." };
  }

  const analyse = analyserImportApfc(contenu, regions);
  if (!analyse.ok) return { ok: false, message: analyse.messageFatal ?? "CSV invalide." };

  const nomsExistants = new Set(existants.map((e) => clefTexte(e.nom)));
  const importables = analyse.lignes.filter((l) => l.statut === "ok" || l.statut === "avertissement");
  if (importables.length === 0) return { ok: false, message: "Aucune APFC valide détectée dans le CSV." };

  let crees = 0;
  let ignoresExistants = 0;
  try {
    for (const l of importables) {
      const cle = clefTexte(l.nom);
      if (nomsExistants.has(cle)) { ignoresExistants++; continue; }
      await prisma.apfc.create({ data: { nom: l.nom, regionId: l.regionId } });
      nomsExistants.add(cle);
      crees++;
    }
    revalidatePath("/app/systeme/apfc");
  } catch (e) {
    console.error("[formation] import APFC CSV :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }

  const ignoresFichier = analyse.nbErreurs + analyse.nbDoublons;
  if (crees === 0) {
    return { ok: false, message: `Aucune APFC créée — ${ignoresExistants + ignoresFichier} ligne(s) ignorée(s) (déjà existante(s) ou invalide(s)).` };
  }
  const details = [
    ignoresExistants > 0 ? `${ignoresExistants} déjà existante(s) ignorée(s)` : null,
    ignoresFichier > 0 ? `${ignoresFichier} ligne(s) invalide(s) ignorée(s)` : null,
  ].filter(Boolean).join(", ");
  return { ok: true, message: `${crees} APFC créée(s)${details ? ` — ${details}` : ""}.` };
}

// ── Documents officiels de l'APFC (Vercel Blob) — mêmes gardes que modifierApfc ──
// Pas d'« embleme » ici : les armoiries du pays sont affichées automatiquement (référentiel
// pays via region.pays), sans dépôt personnalisé possible pour l'APFC (à la différence du CAFOP).

const CHAMPS_DOC_APFC: Record<string, "logoUrl" | "cachetUrl" | "signatureUrl"> = {
  logo: "logoUrl",
  cachet: "cachetUrl",
  signature: "signatureUrl",
};

export async function televerserDocumentApfc(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const id = String(formData.get("apfcId") ?? "");
  const champ = CHAMPS_DOC_APFC[String(formData.get("type") ?? "")];
  if (!champ) return { ok: false, message: "Type de document invalide." };
  if (!(await peutModifierApfc(u, id))) return { ok: false, message: "Action non autorisée." };
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Aucun fichier fourni." };
  if (!fichier.type.startsWith("image/")) return { ok: false, message: "Déposez une image (PNG, JPG, SVG…)." };
  if (fichier.size > TAILLE_MAX_DOC) return { ok: false, message: "L'image dépasse 4 Mo." };
  try {
    const ancien = (await prisma.apfc.findUnique({ where: { id }, select: { [champ]: true } }))?.[champ] as string | null | undefined;
    const ext = fichier.name.split(".").pop() ?? "png";
    const blob = await put(`apfc/${id}/${formData.get("type")}-${ext}`, fichier, { access: "public", addRandomSuffix: true });
    await prisma.apfc.update({ where: { id }, data: { [champ]: blob.url } });
    if (ancien) await del(ancien).catch(() => {}); // retire l'ancien fichier (best-effort)
    revalidatePath(`/app/systeme/apfc/${id}`);
  } catch (e) {
    console.error("[blob] APFC :", e);
    return { ok: false, message: "Téléversement impossible (configurez le stockage Blob)." };
  }
  return { ok: true, message: "Image téléversée." };
}

export async function supprimerDocumentApfc(formData: FormData): Promise<void> {
  const u = await getUtilisateurCourant();
  const id = String(formData.get("apfcId") ?? "");
  const champ = CHAMPS_DOC_APFC[String(formData.get("type") ?? "")];
  if (!u || !champ || !(await peutModifierApfc(u, id))) return;
  try {
    await prisma.apfc.update({ where: { id }, data: { [champ]: null } });
    revalidatePath(`/app/systeme/apfc/${id}`);
  } catch (e) {
    console.error("[blob] suppression APFC :", e);
  }
}

// ── Personnel de l'APFC (annuaire selon le profil disciplinaire) — mêmes gardes que modifierApfc ──

/** Nettoie les disciplines cochées (trim, dédoublonnage, entrées vides retirées, 30 max). */
function nettoyerDisciplinesPersonnel(valeurs: FormDataEntryValue[]): string[] {
  return [...new Set(valeurs.map((v) => String(v).trim().slice(0, 120)).filter(Boolean))].slice(0, 30);
}

export async function ajouterPersonnelApfc(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const apfcId = String(formData.get("apfcId") ?? "").trim();
  if (!(await peutModifierApfc(u, apfcId))) return { ok: false, message: "Action non autorisée." };
  const nom = nomEnMajuscules(String(formData.get("nom") ?? ""));
  if (!nom) return { ok: false, message: "Le nom est obligatoire." };
  const prenoms = prenomsEnTitre(String(formData.get("prenoms") ?? "")) || null;
  const fonction = String(formData.get("fonction") ?? "").trim().slice(0, 120) || null;
  const disciplines = nettoyerDisciplinesPersonnel(formData.getAll("disciplines"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 160) || null;
  const telephone = String(formData.get("telephone") ?? "").trim().slice(0, 40) || null;
  try {
    // Dédoublonnage nom+prénoms (insensible casse/accents) contre l'annuaire existant de l'APFC.
    const existants = await prisma.personnelApfc.findMany({ where: { apfcId }, select: { nom: true, prenoms: true } });
    const cle = clefPersonne(nom, prenoms);
    if (existants.some((e) => clefPersonne(e.nom, e.prenoms) === cle)) {
      return { ok: false, message: "Cette personne figure déjà dans l'annuaire de l'APFC." };
    }
    await prisma.personnelApfc.create({
      data: { apfcId, nom, prenoms, fonction, disciplines: disciplines.length ? disciplines : undefined, email, telephone },
    });
    revalidatePath(`/app/systeme/apfc/${apfcId}`);
  } catch (e) {
    console.error("[formation] ajout personnel APFC :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Personnel ajouté." };
}

export async function supprimerPersonnelApfc(id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const p = await prisma.personnelApfc.findUnique({ where: { id }, select: { apfcId: true } });
  if (!p) return { ok: false, message: "Personnel introuvable." };
  if (!(await peutModifierApfc(u, p.apfcId))) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.personnelApfc.delete({ where: { id } });
    revalidatePath(`/app/systeme/apfc/${p.apfcId}`);
  } catch (e) {
    console.error("[formation] suppression personnel APFC :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Personnel retiré." };
}

/**
 * Import CSV en lot du personnel d'une APFC. Colonnes reconnues : `nom` (obligatoire),
 * `prenoms`, `fonction`, `disciplines` (plusieurs valeurs séparées par « | » ou « / », rapprochées
 * du référentiel Discipline), `email`, `telephone`. Dédoublonne par nom+prénoms (insensible
 * casse/accents) contre l'annuaire déjà existant de l'APFC. Validation REJOUÉE ici via le même
 * analyseur pur que l'aperçu client (`analyserImportPersonnelApfc`, src/lib/apfc-personnel-import.ts).
 */
export async function importerPersonnelApfcCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const apfcId = String(formData.get("apfcId") ?? "").trim();
  if (!(await peutModifierApfc(u, apfcId))) return { ok: false, message: "Action non autorisée." };

  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  let disciplinesRef: { nom: string }[] = [];
  let existants: { nom: string; prenoms: string | null }[] = [];
  try {
    [disciplinesRef, existants] = await Promise.all([
      prisma.discipline.findMany({ select: { nom: true } }),
      prisma.personnelApfc.findMany({ where: { apfcId }, select: { nom: true, prenoms: true } }),
    ]);
  } catch (e) {
    console.error("[formation] import personnel APFC — référentiel :", e);
    return { ok: false, message: "Erreur technique lors du chargement du référentiel." };
  }

  const analyse = analyserImportPersonnelApfc(contenu, disciplinesRef.map((d) => d.nom), existants);
  if (!analyse.ok) return { ok: false, message: analyse.messageFatal ?? "CSV invalide." };

  const importables = analyse.lignes.filter((l) => l.statut === "ok");
  if (importables.length === 0) return { ok: false, message: "Aucun personnel valide détecté dans le CSV." };

  let crees = 0;
  try {
    for (const l of importables) {
      await prisma.personnelApfc.create({
        data: {
          apfcId,
          nom: nomEnMajuscules(l.nom),
          prenoms: l.prenoms ? prenomsEnTitre(l.prenoms) : null,
          fonction: l.fonction,
          disciplines: l.disciplines.length ? l.disciplines : undefined,
          email: l.email,
          telephone: l.telephone,
        },
      });
      crees++;
    }
    revalidatePath(`/app/systeme/apfc/${apfcId}`);
  } catch (e) {
    console.error("[formation] import CSV personnel APFC :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }

  const ignores = analyse.nbErreurs + analyse.nbDoublons;
  return { ok: true, message: `${crees} personne(s) importée(s)${ignores ? ` — ${ignores} ligne(s) ignorée(s) (doublon ou invalide)` : ""}.` };
}

// ── Notes & bulletins des élèves-maîtres (CAFOP) ──

async function peutGererCafop(u: UtilisateurCourant, cafopId: string | null): Promise<boolean> {
  if (u.apercuActif || !cafopId) return false;
  if (u.roleReel === "admin") return true;
  if (u.roleReel === "cafop_admin") return u.portee.cafopId === cafopId;
  // Super Admin CAFOP : écriture sur tout CAFOP de SON pays (cloisonnement strict).
  if (u.roleReel === "super_admin_cafop") {
    const c = await prisma.cafop.findUnique({ where: { id: cafopId }, select: { pays: true } });
    return ecritureNationaleAutorisee(u, "super_admin_cafop", c?.pays);
  }
  return false;
}

async function cafopDeApprenant(apprenantId: string): Promise<string | null> {
  const a = await prisma.apprenant.findUnique({ where: { id: apprenantId }, select: { cohorte: { select: { cafopId: true } } } });
  return a?.cohorte.cafopId ?? null;
}

export async function ajouterNoteCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const apprenantId = String(formData.get("apprenantId") ?? "").trim();
  const moduleId = String(formData.get("moduleId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim() || "Devoir surveillé";
  const valeur = Number(String(formData.get("valeur") ?? "").replace(",", "."));
  const bareme = Number(String(formData.get("bareme") ?? "20").replace(",", ".")) || 20;
  const coefficient = Math.max(1, Math.round(Number(formData.get("coefficient") ?? 1)) || 1); // colonne Int
  const semestre = Number(formData.get("semestre") ?? 1) === 2 ? 2 : 1;

  if (!apprenantId || !moduleId) return { ok: false, message: "Élève et module obligatoires." };
  if (!Number.isFinite(valeur) || valeur < 0 || valeur > bareme) return { ok: false, message: `La note doit être comprise entre 0 et ${bareme}.` };
  if (!(await peutGererCafop(u, await cafopDeApprenant(apprenantId)))) return { ok: false, message: "Action non autorisée." };

  try {
    await prisma.noteCafop.create({ data: { apprenantId, moduleId, type, valeur, bareme, coefficient, semestre } });
    revalidatePath("/app/systeme/cafop");
  } catch (e) {
    console.error("[formation] ajout note CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Note enregistrée." };
}

export async function supprimerNoteCafop(id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const note = await prisma.noteCafop.findUnique({ where: { id }, select: { apprenantId: true } });
  if (!note) return { ok: false, message: "Note introuvable." };
  if (!(await peutGererCafop(u, await cafopDeApprenant(note.apprenantId)))) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.noteCafop.delete({ where: { id } });
    revalidatePath("/app/systeme/cafop");
  } catch (e) {
    console.error("[formation] suppression note CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Note supprimée." };
}

/**
 * Renomme la désignation d'un groupe-classe d'une promotion (ex. « A » → « F1 »).
 * Met à jour le champ `groupe` de tous les élèves-maîtres concernés. Portée : une année
 * précise si `annee` est fourni, sinon toutes les années de la promotion.
 */
export async function renommerGroupeClasseCafop(
  cohorteId: string,
  annee: number | null,
  ancien: string,
  nouveau: string,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const coh = await prisma.cohorte.findUnique({ where: { id: cohorteId }, select: { cafopId: true } });
  if (!coh) return { ok: false, message: "Promotion introuvable." };
  if (!(await peutGererCafop(u, coh.cafopId))) return { ok: false, message: "Action non autorisée." };

  const anc = ancien.trim();
  const nouv = nouveau.trim();
  if (!anc) return { ok: false, message: "Groupe-classe d'origine manquant." };
  if (nouv.length < 1 || nouv.length > 40) return { ok: false, message: "Désignation requise (1 à 40 caractères)." };
  if (anc === nouv) return { ok: true, message: "Désignation inchangée." };

  try {
    const res = await prisma.apprenant.updateMany({
      where: { cohorteId, groupe: anc, ...(annee != null ? { annee } : {}) },
      data: { groupe: nouv },
    });
    revalidatePath(`/app/systeme/cafop/${coh.cafopId}`);
    return { ok: true, message: `Groupe-classe « ${anc} » renommé « ${nouv} » (${res.count} élève-maître·s).` };
  } catch (e) {
    console.error("[formation] renommage groupe-classe CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function importerNotesCafopCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cohorteId = String(formData.get("cohorteId") ?? "").trim();
  const groupe = String(formData.get("groupe") ?? "").trim();
  const semestre = Number(formData.get("semestre") ?? 1) === 2 ? 2 : 1;

  const coh = await prisma.cohorte.findUnique({ where: { id: cohorteId }, select: { cafopId: true } });
  if (!coh) return { ok: false, message: "Promotion introuvable." };
  if (!(await peutGererCafop(u, coh.cafopId))) return { ok: false, message: "Action non autorisée." };

  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const lignes = parseCSV(contenu);
  if (lignes.length < 2) return { ok: false, message: "Le CSV doit contenir un en-tête et au moins une ligne." };
  const entete = lignes[0];
  const idx = (...alias: string[]) => entete.findIndex((h) => alias.includes(norm(h)));
  const col = {
    nom: idx("nom", "lastname"),
    prenoms: idx("prenoms", "prenom", "firstname"),
    module: idx("module", "matiere", "discipline"),
    type: idx("type", "evaluation", "typeevaluation"),
    note: idx("note", "valeur", "moyenne"),
    bareme: idx("bareme", "sur", "total"),
    coef: idx("coefficient", "coef"),
  };
  if (col.nom < 0 || col.module < 0 || col.note < 0) return { ok: false, message: "Colonnes attendues : nom, module, note (au minimum)." };

  const [eleves, modules] = await Promise.all([
    prisma.apprenant.findMany({ where: { cohorteId, ...(groupe ? { groupe } : {}) }, select: { id: true, nom: true, prenoms: true, annee: true } }),
    prisma.moduleCafop.findMany({ select: { id: true, nom: true, coefficient: true, annee: true } }),
  ]);
  const cle = (nom: string, prenoms: string) => norm(`${nom} ${prenoms}`.replace(/\s+/g, " "));
  const parEleve = new Map(eleves.map((e) => [cle(e.nom, e.prenoms ?? ""), e.id]));
  // Année de formation du groupe importé (si homogène) : lève l'ambiguïté entre modules homonymes de niveaux différents.
  const anneesGroupe = [...new Set(eleves.map((e) => e.annee).filter((a): a is number => a != null))];
  const anneeCible = anneesGroupe.length === 1 ? anneesGroupe[0] : null;
  const parModuleAnnee = new Map(modules.map((m) => [`${m.annee}::${norm(m.nom)}`, m]));
  const parModuleNom = new Map<string, (typeof modules)[number]>();
  for (const m of modules) if (!parModuleNom.has(norm(m.nom))) parModuleNom.set(norm(m.nom), m);
  const trouverModule = (nomMod: string) => {
    const n = norm(nomMod);
    if (anneeCible != null) {
      const m = parModuleAnnee.get(`${anneeCible}::${n}`);
      if (m) return m;
    }
    return parModuleNom.get(n);
  };
  const cell = (l: string[], i: number) => (i >= 0 && i < l.length ? l[i].trim() : "");

  const aCreer: { apprenantId: string; moduleId: string; type: string; valeur: number; bareme: number; coefficient: number; semestre: number }[] = [];
  let ignorees = 0;
  for (const l of lignes.slice(1)) {
    const nom = cell(l, col.nom);
    const prenoms = col.prenoms >= 0 ? cell(l, col.prenoms) : "";
    // Rapprochement par nom+prénoms ; repli sur le nom seul si prénoms absents/vides.
    const eleveId =
      parEleve.get(cle(nom, prenoms)) ?? (prenoms ? undefined : eleves.find((e) => norm(e.nom) === norm(nom))?.id);
    const mod = trouverModule(cell(l, col.module));
    const valeur = Number(cell(l, col.note).replace(",", "."));
    if (!eleveId || !mod || !Number.isFinite(valeur)) {
      ignorees++;
      continue;
    }
    const bareme = Number(cell(l, col.bareme).replace(",", ".")) || 20;
    aCreer.push({
      apprenantId: eleveId,
      moduleId: mod.id,
      type: cell(l, col.type) || "Devoir surveillé",
      valeur: Math.max(0, Math.min(bareme, valeur)),
      bareme,
      coefficient: Math.max(1, Math.round(Number(cell(l, col.coef))) || 1), // colonne Int
      semestre,
    });
  }
  if (aCreer.length === 0) return { ok: false, message: "Aucune note valide (élève/module introuvable ?)." };
  try {
    await prisma.noteCafop.createMany({ data: aCreer });
    revalidatePath("/app/systeme/cafop");
  } catch (e) {
    console.error("[formation] import notes CAFOP :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }
  return { ok: true, message: `${aCreer.length} note(s) importée(s)${ignorees ? `, ${ignorees} ignorée(s)` : ""}.` };
}

// ── Configuration d'un CAFOP (onglet « Configurer le CAFOP ») ──

export async function modifierCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const id = String(formData.get("id") ?? "").trim();
  if (!(await peutGererCafop(u, id))) return { ok: false, message: "Action non autorisée." };
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { ok: false, message: "Le nom du CAFOP est obligatoire." };
  const effRaw = Number(String(formData.get("effectif") ?? "").replace(/\D/g, ""));
  const pays = String(formData.get("pays") ?? "").trim();
  try {
    await prisma.cafop.update({
      where: { id },
      data: {
        nom,
        drena: String(formData.get("drena") ?? "").trim() || null,
        localite: String(formData.get("localite") ?? "").trim() || null,
        directeur: String(formData.get("directeur") ?? "").trim() || null,
        directeurTel: String(formData.get("directeurTel") ?? "").trim() || null,
        effectif: Number.isFinite(effRaw) ? effRaw : 0,
        // Sécurité : seul l'admin système peut changer le PAYS d'un CAFOP. Sans cela, un
        // Super Admin national pourrait « déplacer » un centre vers un autre pays (fuite de périmètre).
        ...(pays && u.roleReel === "admin" ? { pays } : {}),
      },
    });
    revalidatePath(`/app/systeme/cafop/${id}`);
  } catch (e) {
    console.error("[formation] modification CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "CAFOP mis à jour." };
}

/** Terme local désignant les CAFOP pour le pays (menu, titres, boutons…). Admin uniquement. */
export async function enregistrerTermeCafop(pays: string, terme: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };
  const p = pays.trim();
  if (!p) return { ok: false, message: "Pays introuvable." };
  const t = terme.trim() || "CAFOP";
  try {
    await prisma.parametreCafopPays.upsert({ where: { pays: p }, update: { terme: t }, create: { pays: p, terme: t } });
    revalidatePath("/app/systeme/cafop");
    revalidatePath("/app", "layout"); // rafraîchit le menu et le fil d'Ariane
  } catch (e) {
    console.error("[formation] terme CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Nom local enregistré." };
}

/** Terme local désignant les APFC pour le pays (menu, titres, boutons…). Admin uniquement. Miroir de `enregistrerTermeCafop`. */
export async function enregistrerTermeApfc(pays: string, terme: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!estAdmin(u)) return { ok: false, message: "Action réservée à l'administrateur." };
  const p = pays.trim();
  if (!p) return { ok: false, message: "Pays introuvable." };
  const t = terme.trim() || "APFC";
  try {
    await prisma.parametreCafopPays.upsert({ where: { pays: p }, update: { termeApfc: t }, create: { pays: p, termeApfc: t } });
    revalidatePath("/app/systeme/apfc");
    revalidatePath("/app", "layout"); // rafraîchit le menu et le fil d'Ariane
  } catch (e) {
    console.error("[formation] terme APFC :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Nom local enregistré." };
}

// ── Documents officiels du CAFOP (Vercel Blob) ──

const CHAMPS_DOC_CAFOP: Record<string, "emblemeUrl" | "logoUrl" | "cachetUrl" | "signatureUrl"> = {
  embleme: "emblemeUrl",
  logo: "logoUrl",
  cachet: "cachetUrl",
  signature: "signatureUrl",
};
const TAILLE_MAX_DOC = 4 * 1024 * 1024; // 4 Mo (plafond des fonctions Vercel)

export async function televerserDocumentCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const id = String(formData.get("cafopId") ?? "");
  const champ = CHAMPS_DOC_CAFOP[String(formData.get("type") ?? "")];
  if (!champ) return { ok: false, message: "Type de document invalide." };
  if (!(await peutGererCafop(u, id))) return { ok: false, message: "Action non autorisée." };
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Aucun fichier fourni." };
  if (!fichier.type.startsWith("image/")) return { ok: false, message: "Déposez une image (PNG, JPG, SVG…)." };
  if (fichier.size > TAILLE_MAX_DOC) return { ok: false, message: "L'image dépasse 4 Mo." };
  try {
    const ancien = (await prisma.cafop.findUnique({ where: { id }, select: { [champ]: true } }))?.[champ] as string | null | undefined;
    const ext = fichier.name.split(".").pop() ?? "png";
    const blob = await put(`cafops/${id}/${formData.get("type")}-${ext}`, fichier, { access: "public", addRandomSuffix: true });
    await prisma.cafop.update({ where: { id }, data: { [champ]: blob.url } });
    if (ancien) await del(ancien).catch(() => {}); // retire l'ancien fichier (best-effort)
    revalidatePath(`/app/systeme/cafop/${id}`);
  } catch (e) {
    console.error("[blob] CAFOP :", e);
    return { ok: false, message: "Téléversement impossible (configurez le stockage Blob)." };
  }
  return { ok: true, message: "Image téléversée." };
}

export async function supprimerDocumentCafop(formData: FormData): Promise<void> {
  const u = await getUtilisateurCourant();
  const id = String(formData.get("cafopId") ?? "");
  const champ = CHAMPS_DOC_CAFOP[String(formData.get("type") ?? "")];
  if (!u || !champ || !(await peutGererCafop(u, id))) return;
  try {
    await prisma.cafop.update({ where: { id }, data: { [champ]: null } });
    revalidatePath(`/app/systeme/cafop/${id}`);
  } catch (e) {
    console.error("[blob] suppression CAFOP :", e);
  }
}

// ── Cahier de texte CAFOP (séances) ──

/** Heure « HH:MM » valide, sinon null. */
function heureValide(v: string): string | null {
  const s = v.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

/** URL http(s) valide, sinon null. */
function urlValide(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

/** Parse les sous-titres hiérarchisés : [{ niveau: 1|2|3, texte }] — ignore les entrées vides. */
function parseSousTitres(brut: string): { niveau: number; texte: string }[] {
  try {
    const arr = JSON.parse(brut) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((e) => {
        const o = e as { niveau?: unknown; texte?: unknown };
        const niveau = Number(o?.niveau);
        return { niveau: niveau >= 1 && niveau <= 3 ? Math.round(niveau) : 1, texte: String(o?.texte ?? "").trim() };
      })
      .filter((e) => e.texte.length > 0)
      .slice(0, 60);
  } catch {
    return [];
  }
}

/** Parse une liste d'objectifs : [texte] — ignore les entrées vides. */
function parseObjectifs(brut: string): string[] {
  try {
    const arr = JSON.parse(brut) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => String(e ?? "").trim()).filter((e) => e.length > 0).slice(0, 60);
  } catch {
    return [];
  }
}

export async function creerSeanceCafop(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cafopId = String(formData.get("cafopId") ?? "").trim();
  if (!(await peutGererCafop(u, cafopId))) return { ok: false, message: "Action non autorisée." };
  const titre = String(formData.get("titre") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  if (!titre) return { ok: false, message: "Le titre de la séance est obligatoire." };
  const date = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Date invalide." };
  const heureDebut = heureValide(String(formData.get("heureDebut") ?? ""));
  const heureFin = heureValide(String(formData.get("heureFin") ?? ""));
  if ((heureDebut && !heureFin) || (!heureDebut && heureFin)) {
    return { ok: false, message: "Renseignez l'heure de début ET l'heure de fin, ou aucune des deux." };
  }
  if (heureDebut && heureFin && heureFin <= heureDebut) {
    return { ok: false, message: "L'heure de fin doit être postérieure à l'heure de début." };
  }
  const sousTitres = parseSousTitres(String(formData.get("sousTitres") ?? ""));
  const objectifs = parseObjectifs(String(formData.get("objectifs") ?? ""));
  const prochaineStr = String(formData.get("prochaineSeance") ?? "").trim();
  const prochaineSeance = prochaineStr ? new Date(prochaineStr) : null;
  if (prochaineSeance && Number.isNaN(prochaineSeance.getTime())) {
    return { ok: false, message: "Date de prochaine séance invalide." };
  }
  const exercices = String(formData.get("exercices") ?? "").trim().slice(0, 500) || null;
  const exercicesUrl = urlValide(String(formData.get("exercicesUrl") ?? ""));
  // Sélection MULTIPLE de composantes/thèmes (habiletés) — un champ répété par valeur cochée.
  const composantes = [...new Set(formData.getAll("composantes").map((x) => String(x).trim()).filter(Boolean))].slice(0, 50);
  const themes = [...new Set(formData.getAll("themes").map((x) => String(x).trim()).filter(Boolean))].slice(0, 100);
  try {
    await prisma.seanceCafop.create({
      data: {
        cafopId,
        moduleId: String(formData.get("moduleId") ?? "").trim() || null,
        groupe: String(formData.get("groupe") ?? "").trim() || null,
        composante: String(formData.get("composante") ?? "").trim() || composantes[0] || null,
        theme: String(formData.get("theme") ?? "").trim() || themes[0] || null,
        composantes: composantes.length ? composantes : undefined,
        themes: themes.length ? themes : undefined,
        discipline: String(formData.get("discipline") ?? "").trim() || null,
        date,
        heureDebut,
        heureFin,
        titre,
        sousTitres: sousTitres.length ? sousTitres : undefined,
        objectifs: objectifs.length ? objectifs : undefined,
        contenu: String(formData.get("contenu") ?? "").trim() || null,
        prochaineSeance,
        exercices,
        exercicesUrl,
      },
    });
    revalidatePath(`/app/systeme/cafop/${cafopId}/cahier-texte`);
  } catch (e) {
    console.error("[formation] création séance CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Séance enregistrée." };
}

export async function supprimerSeanceCafop(id: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const s = await prisma.seanceCafop.findUnique({ where: { id }, select: { cafopId: true } });
  if (!s) return { ok: false, message: "Séance introuvable." };
  if (!(await peutGererCafop(u, s.cafopId))) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.seanceCafop.delete({ where: { id } });
    revalidatePath(`/app/systeme/cafop/${s.cafopId}/cahier-texte`);
  } catch (e) {
    console.error("[formation] suppression séance CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Séance supprimée." };
}

// ── Cohortes ──

export async function creerCohorte(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const type = String(formData.get("type") ?? "");
  const cafopId = String(formData.get("cafopId") ?? "").trim() || null;
  const apfcId = String(formData.get("apfcId") ?? "").trim() || null;
  const libelle = String(formData.get("libelle") ?? "").trim();
  const anneeDebut = String(formData.get("anneeDebut") ?? "").trim();
  const anneeFin = String(formData.get("anneeFin") ?? "").trim();
  const lieu = String(formData.get("lieu") ?? "").trim() || null;

  if (!libelle) return { ok: false, message: "Le libellé est obligatoire." };
  if (type !== "cafop_promotion" && type !== "apfc_session") {
    return { ok: false, message: "Type de cohorte invalide." };
  }
  if (!peutGerer(u, { cafopId, apfcId })) return { ok: false, message: "Action non autorisée." };

  try {
    await prisma.cohorte.create({
      data: {
        type: type as "cafop_promotion" | "apfc_session",
        cafopId,
        apfcId,
        libelle,
        anneeDebut: anneeDebut ? Number(anneeDebut) : null,
        anneeFin: anneeFin ? Number(anneeFin) : null,
        lieu,
      },
    });
    revalidatePath(cafopId ? `/app/systeme/cafop/${cafopId}` : `/app/systeme/apfc/${apfcId}`);
  } catch (e) {
    console.error("[formation] création cohorte :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Cohorte créée." };
}

export async function supprimerCohorte(cohorteId: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const s = await structureDeCohorte(cohorteId);
  if (!s) return { ok: false, message: "Cohorte introuvable." };
  if (!peutGerer(u, s)) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.cohorte.delete({ where: { id: cohorteId } });
    revalidatePath(s.cafopId ? `/app/systeme/cafop/${s.cafopId}` : `/app/systeme/apfc/${s.apfcId}`);
  } catch (e) {
    console.error("[formation] suppression cohorte :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Cohorte supprimée." };
}

// ── Apprenants ──

export async function ajouterApprenant(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cohorteId = String(formData.get("cohorteId") ?? "");
  // Casse normalisée : NOM en MAJUSCULES, Prénoms en Casse Titre.
  const nom = nomEnMajuscules(String(formData.get("nom") ?? ""));
  const prenoms = prenomsEnTitre(String(formData.get("prenoms") ?? "")) || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const groupe = String(formData.get("groupe") ?? "").trim() || null;
  const anneeRaw = Number(formData.get("annee"));
  const annee = Number.isFinite(anneeRaw) && anneeRaw >= 1 ? Math.round(anneeRaw) : null;
  let matricule = String(formData.get("matricule") ?? "").trim() || null;
  if (!nom) return { ok: false, message: "Le nom est obligatoire." };
  const s = await structureDeCohorte(cohorteId);
  if (!s) return { ok: false, message: "Cohorte introuvable." };
  if (!peutGerer(u, s)) return { ok: false, message: "Action non autorisée." };
  if (!matricule) {
    // Matricule automatique : plus grand suffixe existant + 1 (stable aux suppressions, pas de réutilisation).
    const existants = await prisma.apprenant.findMany({ where: { cohorteId }, select: { matricule: true } });
    const maxSeq = existants.reduce((m, a) => {
      const n = Number(a.matricule?.match(/(\d+)\s*$/)?.[1] ?? 0);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    matricule = `EM-${cohorteId.slice(-4)}-${String(maxSeq + 1).padStart(3, "0")}`;
  }
  try {
    await prisma.apprenant.create({ data: { cohorteId, nom, prenoms, email, matricule, groupe, annee } });
    revalidatePath(s.cafopId ? `/app/systeme/cafop/${s.cafopId}` : `/app/systeme/apfc/${s.apfcId}`);
  } catch (e) {
    console.error("[formation] ajout apprenant :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Apprenant ajouté." };
}

export async function supprimerApprenant(apprenantId: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const ap = await prisma.apprenant.findUnique({
    where: { id: apprenantId },
    select: { cohorte: { select: { id: true, cafopId: true, apfcId: true } } },
  });
  if (!ap) return { ok: false, message: "Apprenant introuvable." };
  if (!peutGerer(u, ap.cohorte)) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.apprenant.delete({ where: { id: apprenantId } });
    revalidatePath(
      ap.cohorte.cafopId ? `/app/systeme/cafop/${ap.cohorte.cafopId}` : `/app/systeme/apfc/${ap.cohorte.apfcId}`,
    );
  } catch (e) {
    console.error("[formation] suppression apprenant :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Apprenant retiré." };
}

// ── Import CSV (compatible Moodle) ──

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Parse un CSV simple (délimiteur , ou ;) en lignes de cellules. */
function parseCSV(texte: string): string[][] {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length === 0) return [];
  const virgules = (lignes[0].match(/,/g) ?? []).length;
  const pointsVirgules = (lignes[0].match(/;/g) ?? []).length;
  const delim = pointsVirgules > virgules ? ";" : ",";
  return lignes.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
}

/** Mappe un en-tête CSV (Moodle ou français) vers nos champs. */
function indexerColonnes(entete: string[]) {
  const idx = (...alias: string[]) =>
    entete.findIndex((h) => alias.includes(norm(h)));
  return {
    nom: idx("nom", "lastname", "surname", "famille"),
    prenoms: idx("prenoms", "prenom", "firstname", "givenname"),
    email: idx("email", "mail", "adresse mail", "courriel"),
    matricule: idx("matricule", "idnumber", "id", "numero"),
    etablissement: idx("etablissement", "institution", "ecole", "origine", "etablissementorigine"),
  };
}

export async function importerApprenantsCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cohorteId = String(formData.get("cohorteId") ?? "");
  const s = await structureDeCohorte(cohorteId);
  if (!s) return { ok: false, message: "Cohorte introuvable." };
  if (!peutGerer(u, s)) return { ok: false, message: "Action non autorisée." };

  // Source : fichier téléversé ou texte collé.
  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) {
    contenu = await fichier.text();
  }
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const lignes = parseCSV(contenu);
  if (lignes.length < 2) return { ok: false, message: "Le CSV doit contenir un en-tête et au moins une ligne." };

  const cols = indexerColonnes(lignes[0]);
  if (cols.nom < 0 && cols.prenoms < 0) {
    return { ok: false, message: "Colonnes introuvables : attendu au moins « nom » (ou lastname)." };
  }

  const cell = (ligne: string[], i: number) => (i >= 0 && i < ligne.length ? ligne[i].trim() : "");
  const apprenants = lignes
    .slice(1)
    .map((l) => ({
      nom: cell(l, cols.nom) || cell(l, cols.prenoms),
      prenoms: cols.prenoms >= 0 ? cell(l, cols.prenoms) || null : null,
      email: cols.email >= 0 ? cell(l, cols.email) || null : null,
      matricule: cols.matricule >= 0 ? cell(l, cols.matricule) || null : null,
      etablissementOrigine: cols.etablissement >= 0 ? cell(l, cols.etablissement) || null : null,
      cohorteId,
    }))
    .filter((a) => a.nom.length > 0);

  if (apprenants.length === 0) return { ok: false, message: "Aucun apprenant valide détecté dans le CSV." };

  try {
    await prisma.apprenant.createMany({ data: apprenants });
    revalidatePath(s.cafopId ? `/app/systeme/cafop/${s.cafopId}` : `/app/systeme/apfc/${s.apfcId}`);
  } catch (e) {
    console.error("[formation] import CSV :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }
  return { ok: true, message: `${apprenants.length} apprenant(s) importé(s).` };
}

/** Mappe un en-tête CSV d'élèves-maîtres vers les champs de saisie (NOM, Prénoms, Année, Classe, Matricule). */
function indexerColonnesEleveMaitre(entete: string[]) {
  const idx = (...alias: string[]) => entete.findIndex((h) => alias.includes(norm(h)));
  return {
    nom: idx("nom", "noms", "lastname", "surname", "famille"),
    prenoms: idx("prenoms", "prenom", "firstname", "givenname"),
    annee: idx("annee", "annee de formation", "niveau", "année", "annee formation"),
    groupe: idx("classe", "groupe", "groupe-classe", "groupe classe", "section"),
    matricule: idx("matricule", "idnumber", "id", "numero", "no"),
  };
}

/** Convertit une cellule « année » (« 1 », « 1re », « 2e année »…) en entier 1–3, sinon null. */
function anneeDepuisCellule(v: string): number | null {
  const m = v.match(/\d+/);
  if (!m) return null;
  const n = Math.round(Number(m[0]));
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : null;
}

/**
 * Import CSV d'une cohorte d'élèves-maîtres dans la promotion sélectionnée.
 * Colonnes conformes aux champs de saisie : NOM, Prénoms, Année, Classe, Matricule.
 * Casse normalisée (NOM en majuscules, Prénoms en casse titre) et matricule auto si absent.
 */
export async function importerApprenantsCafopCSV(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const cohorteId = String(formData.get("cohorteId") ?? "");
  const s = await structureDeCohorte(cohorteId);
  if (!s) return { ok: false, message: "Sélectionnez d'abord une promotion." };
  if (!peutGerer(u, s)) return { ok: false, message: "Action non autorisée." };

  // Source : fichier déposé ou texte collé.
  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const lignes = parseCSV(contenu);
  if (lignes.length < 2) return { ok: false, message: "Le CSV doit contenir un en-tête et au moins une ligne." };

  const cols = indexerColonnesEleveMaitre(lignes[0]);
  if (cols.nom < 0) {
    return { ok: false, message: "Colonne « NOM » introuvable dans l'en-tête du CSV." };
  }
  const cell = (ligne: string[], i: number) => (i >= 0 && i < ligne.length ? ligne[i].trim() : "");

  // Séquence de départ pour les matricules automatiques (plus grand suffixe existant + 1).
  const existants = await prisma.apprenant.findMany({ where: { cohorteId }, select: { matricule: true } });
  let seq = existants.reduce((m, a) => {
    const n = Number(a.matricule?.match(/(\d+)\s*$/)?.[1] ?? 0);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);

  const apprenants = lignes
    .slice(1)
    .map((l) => {
      const nom = nomEnMajuscules(cell(l, cols.nom));
      if (!nom) return null;
      const prenoms = prenomsEnTitre(cell(l, cols.prenoms)) || null;
      const annee = anneeDepuisCellule(cell(l, cols.annee));
      const groupe = cell(l, cols.groupe) || null;
      let matricule = cell(l, cols.matricule) || null;
      if (!matricule) {
        seq += 1;
        matricule = `EM-${cohorteId.slice(-4)}-${String(seq).padStart(3, "0")}`;
      }
      return { cohorteId, nom, prenoms, matricule, groupe, annee };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  if (apprenants.length === 0) return { ok: false, message: "Aucun élève-maître valide détecté dans le CSV." };

  try {
    await prisma.apprenant.createMany({ data: apprenants });
    revalidatePath(s.cafopId ? `/app/systeme/cafop/${s.cafopId}` : `/app/systeme/apfc/${s.apfcId}`);
  } catch (e) {
    console.error("[formation] import CSV élèves-maîtres :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }
  return { ok: true, message: `${apprenants.length} élève(s)-maître(s) importé(s).` };
}

export async function viderApprenants(cohorteId: string): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const s = await structureDeCohorte(cohorteId);
  if (!s) return { ok: false, message: "Cohorte introuvable." };
  if (!peutGerer(u, s)) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.apprenant.deleteMany({ where: { cohorteId } });
    revalidatePath(s.cafopId ? `/app/systeme/cafop/${s.cafopId}` : `/app/systeme/apfc/${s.apfcId}`);
  } catch (e) {
    console.error("[formation] vider apprenants :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Liste vidée." };
}
