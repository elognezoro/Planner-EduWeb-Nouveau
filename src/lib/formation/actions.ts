"use server";

import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { nomEnMajuscules, prenomsEnTitre } from "@/lib/convertisseur/format-noms";

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
  if (u.apercuActif || u.roleReel !== "admin") {
    return { ok: false, message: "Action réservée à l'administrateur." };
  }
  const libelle = nom.trim();
  if (!libelle) return { ok: false, message: "Le nom est obligatoire." };
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

// ── Notes & bulletins des élèves-maîtres (CAFOP) ──

function peutGererCafop(u: UtilisateurCourant, cafopId: string | null): boolean {
  if (u.apercuActif || !cafopId) return false;
  if (u.roleReel === "admin") return true;
  if (u.roleReel === "cafop_admin") return u.portee.cafopId === cafopId;
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
        ...(pays ? { pays } : {}),
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
  try {
    await prisma.seanceCafop.create({
      data: {
        cafopId,
        moduleId: String(formData.get("moduleId") ?? "").trim() || null,
        groupe: String(formData.get("groupe") ?? "").trim() || null,
        date,
        titre,
        contenu: String(formData.get("contenu") ?? "").trim() || null,
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

// ── Registre d'appel CAFOP (présences) ──

const STATUTS_PRESENCE = new Set(["present", "absent", "retard", "justifie"]);

export async function enregistrerPresencesCafop(
  cohorteId: string,
  dateISO: string,
  entrees: { apprenantId: string; statut: string }[],
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const coh = await prisma.cohorte.findUnique({ where: { id: cohorteId }, select: { cafopId: true } });
  if (!coh) return { ok: false, message: "Promotion introuvable." };
  if (!(await peutGererCafop(u, coh.cafopId))) return { ok: false, message: "Action non autorisée." };
  const jour = new Date(dateISO);
  if (Number.isNaN(jour.getTime())) return { ok: false, message: "Date invalide." };
  jour.setUTCHours(0, 0, 0, 0); // minuit UTC — cohérent avec la lecture toISOString().slice(0,10)

  // On restreint aux élèves de la promotion (sécurité de périmètre).
  const valides = new Set((await prisma.apprenant.findMany({ where: { cohorteId }, select: { id: true } })).map((a) => a.id));
  const lignes = entrees.filter((e) => valides.has(e.apprenantId) && STATUTS_PRESENCE.has(e.statut));
  if (lignes.length === 0) return { ok: false, message: "Aucune présence valide à enregistrer." };

  try {
    await prisma.$transaction(
      lignes.map((e) =>
        prisma.presenceCafop.upsert({
          where: { apprenantId_date: { apprenantId: e.apprenantId, date: jour } },
          update: { statut: e.statut },
          create: { apprenantId: e.apprenantId, date: jour, statut: e.statut },
        }),
      ),
    );
    revalidatePath(`/app/systeme/cafop/${coh.cafopId}/registre-appel`);
  } catch (e) {
    console.error("[formation] enregistrement présences CAFOP :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `${lignes.length} présence(s) enregistrée(s).` };
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
