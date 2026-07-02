"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { estRoleValide } from "@/lib/rbac";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const BASE = "/app/systeme/comptes";
// Rôles autorisés à gérer des comptes. Chef & admin d'établissement sont cloisonnés à LEUR
// établissement (voir `perimetreCreateur`) ; seul l'admin système est global.
const ROLES_ADMIN = ["admin", "etablissements_admin", "cafop_admin", "apfc_admin", "chef_etablissement"];

function peutGerer(u: UtilisateurCourant): boolean {
  if (u.apercuActif || !ROLES_ADMIN.includes(u.roleReel)) return false;
  // Un rôle rattaché à un établissement doit réellement avoir un établissement de périmètre.
  if ((u.roleReel === "etablissements_admin" || u.roleReel === "chef_etablissement") && !u.portee.etablissementId) return false;
  return true;
}

/** Périmètre imposé aux comptes créés — REFUSÉ PAR DÉFAUT hors admin système. */
function perimetreCreateur(u: UtilisateurCourant) {
  if (u.roleReel === "admin") return {};
  if (u.roleReel === "etablissements_admin" || u.roleReel === "chef_etablissement") return { etablissementId: u.portee.etablissementId };
  if (u.roleReel === "cafop_admin") return { cafopId: u.portee.cafopId };
  if (u.roleReel === "apfc_admin") return { apfcId: u.portee.apfcId };
  return { etablissementId: "__aucun__" }; // périmètre inconnu → rattachement impossible
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Rôles qu'un gestionnaire NON-admin (chef / admin d'établissement) peut attribuer.
// Interdit toute escalade de privilège (admin, drena, inspecteur, cafop/apfc…).
const ROLES_ETABLISSEMENT = ["chef_etablissement", "enseignant", "educateur", "parent", "eleve"];

/** Un gestionnaire a-t-il le droit d'attribuer ce rôle ? (l'admin système : tous.) */
function peutAttribuerRole(u: UtilisateurCourant, roleTech: string): boolean {
  if (u.roleReel === "admin") return true;
  return ROLES_ETABLISSEMENT.includes(roleTech);
}

export async function creerCompte(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutGerer(u)) return { ok: false, message: "Action réservée à l'administration (ou mode aperçu)." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const prenoms = String(formData.get("prenoms") ?? "").trim() || null;
  const nom = String(formData.get("nom") ?? "").trim() || null;
  const roleTech = String(formData.get("role") ?? "").trim();
  const motDePasse = String(formData.get("motDePasse") ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "E-mail invalide." };
  if (!estRoleValide(roleTech)) return { ok: false, message: "Rôle invalide." };
  if (!peutAttribuerRole(u, roleTech)) return { ok: false, message: "Vous ne pouvez créer que des comptes de votre établissement (enseignant, éducateur, parent, élève, chef)." };
  if (motDePasse.length < 8) return { ok: false, message: "Le mot de passe doit faire au moins 8 caractères." };

  try {
    const existe = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
    if (existe) return { ok: false, message: "Un compte existe déjà avec cet e-mail." };
    const role = await prisma.role.findUnique({ where: { nomTechnique: roleTech }, select: { id: true } });
    if (!role) return { ok: false, message: "Rôle introuvable." };

    await prisma.utilisateur.create({
      data: {
        email,
        prenoms,
        nom,
        motDePasseHash: await bcrypt.hash(motDePasse, 12),
        statutCompte: "actif",
        emailVerifieLe: new Date(),
        roleActifId: role.id,
        ...perimetreCreateur(u),
      },
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[comptes] création :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: `Compte ${email} créé.` };
}

function parseCSV(texte: string): string[][] {
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length === 0) return [];
  const virg = (lignes[0].match(/,/g) ?? []).length;
  const pv = (lignes[0].match(/;/g) ?? []).length;
  const delim = pv > virg ? ";" : ",";
  return lignes.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export async function importerComptes(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutGerer(u)) return { ok: false, message: "Action réservée à l'administration (ou mode aperçu)." };

  const motDePasse = String(formData.get("motDePasse") ?? "");
  if (motDePasse.length < 8) return { ok: false, message: "Le mot de passe temporaire doit faire au moins 8 caractères." };

  let contenu = String(formData.get("texte") ?? "");
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) contenu = await fichier.text();
  if (!contenu.trim()) return { ok: false, message: "Aucune donnée CSV fournie." };

  const lignes = parseCSV(contenu);
  if (lignes.length < 2) return { ok: false, message: "Le CSV doit contenir un en-tête et au moins une ligne." };

  const entete = lignes[0].map(norm);
  const idx = (...alias: string[]) => entete.findIndex((h) => alias.includes(h));
  const cPrenoms = idx("prenoms", "prenom", "firstname");
  const cNom = idx("nom", "lastname");
  const cEmail = idx("email", "mail", "courriel");
  const cRole = idx("role", "profil");
  if (cEmail < 0 || cRole < 0) {
    return { ok: false, message: "Colonnes requises : « email » et « role »." };
  }

  // Résolution des rôles (par identifiant technique ou libellé).
  const roles = await prisma.role.findMany({ select: { id: true, nomTechnique: true, libelle: true } });
  const roleParCle = new Map<string, string>();
  const techParId = new Map<string, string>();
  for (const r of roles) {
    roleParCle.set(norm(r.nomTechnique), r.id);
    roleParCle.set(norm(r.libelle), r.id);
    techParId.set(r.id, r.nomTechnique);
  }

  const cell = (l: string[], i: number) => (i >= 0 && i < l.length ? l[i].trim() : "");
  const hash = await bcrypt.hash(motDePasse, 12);
  const perim = perimetreCreateur(u);

  let crees = 0;
  let ignores = 0;
  const erreurs: string[] = [];
  try {
    for (const l of lignes.slice(1)) {
      const email = cell(l, cEmail).toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        ignores += 1;
        continue;
      }
      const roleId = roleParCle.get(norm(cell(l, cRole)));
      if (!roleId) {
        if (erreurs.length < 3) erreurs.push(`Rôle inconnu pour ${email}`);
        ignores += 1;
        continue;
      }
      // Anti-escalade : un gestionnaire non-admin ne peut importer que des rôles d'établissement.
      if (!peutAttribuerRole(u, techParId.get(roleId) ?? "")) {
        if (erreurs.length < 3) erreurs.push(`Rôle non autorisé pour ${email}`);
        ignores += 1;
        continue;
      }
      const existe = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
      if (existe) {
        ignores += 1;
        continue;
      }
      await prisma.utilisateur.create({
        data: {
          email,
          prenoms: cPrenoms >= 0 ? cell(l, cPrenoms) || null : null,
          nom: cNom >= 0 ? cell(l, cNom) || null : null,
          motDePasseHash: hash,
          statutCompte: "actif",
          emailVerifieLe: new Date(),
          roleActifId: roleId,
          ...perim,
        },
      });
      crees += 1;
    }
    revalidatePath(BASE);
  } catch (e) {
    console.error("[comptes] import :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }
  const suffixe = erreurs.length > 0 ? ` (${erreurs.join(" ; ")})` : "";
  return { ok: true, message: `${crees} compte(s) créé(s), ${ignores} ignoré(s)${suffixe}.` };
}
