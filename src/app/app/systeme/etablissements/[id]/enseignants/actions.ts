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
const ROLES_IMPORT = ["enseignant", "educateur", "chef_etablissement", "parent", "eleve"] as const;

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
  if (u.roleReel === "etablissements_admin" && u.portee.etablissementId === etablissementId) return u;
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
  await prisma.competenceEnseignant.deleteMany({ where: { enseignantId, etablissementId } });
  await prisma.niveauEnseignant.deleteMany({ where: { enseignantId, etablissementId } });
  if (disciplineIds.length > 0) {
    await prisma.competenceEnseignant.createMany({
      data: disciplineIds.map((disciplineId) => ({ enseignantId, disciplineId, etablissementId })),
      skipDuplicates: true,
    });
  }
  if (niveauIds.length > 0) {
    await prisma.niveauEnseignant.createMany({
      data: niveauIds.map((niveauId) => ({ enseignantId, niveauId, etablissementId })),
      skipDuplicates: true,
    });
  }
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
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
      prisma.niveau.findMany({ select: { id: true, nom: true } }),
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
        const nivIds: string[] = [];
        for (const n of l.niveaux) {
          const nid = nivParNom.get(norm(n));
          if (nid) nivIds.push(nid);
          else inconnus.add(`niveau « ${n} »`);
        }
        await appliquerCompetences(r.id, etablissementId, discIds, nivIds);
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
