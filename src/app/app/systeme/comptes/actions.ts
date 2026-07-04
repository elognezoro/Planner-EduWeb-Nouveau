"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { estRoleValide, filtreUtilisateurs } from "@/lib/rbac";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritInvitation } from "@/lib/email/templates";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

export interface ExportResultat {
  ok: boolean;
  message?: string;
  csv?: string;
  nom?: string;
}

const BASE = "/app/systeme/comptes";

/** URL publique de l'app (liens absolus dans les e-mails). */
function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Envoi tolérant : un e-mail en échec ne doit pas interrompre l'import. */
async function envoiTolerant(args: Parameters<typeof envoyerEmail>[0]) {
  try {
    await envoyerEmail(args);
  } catch (e) {
    console.error("[comptes] e-mail (poursuite) :", e);
  }
}
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
const ROLES_ETABLISSEMENT = [
  "chef_etablissement",
  "adjoint_chef_etablissement",
  "inspecteur_orientation",
  "enseignant",
  "educateur",
  "parent",
  "eleve",
];

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

/**
 * Analyseur CSV robuste (compatible export ↔ import) : gère les champs entre guillemets,
 * les délimiteurs/retours-ligne échappés, les guillemets doublés, et un éventuel BOM UTF-8.
 * Détecte automatiquement le délimiteur (« ; » ou « , ») sur la première ligne.
 */
function parseCSV(texte: string): string[][] {
  const t = texte.replace(/^﻿/, "");
  const premiere = t.split(/\r?\n/, 1)[0] ?? "";
  const nbPv = (premiere.match(/;/g) ?? []).length;
  const nbVirg = (premiere.match(/,/g) ?? []).length;
  const delim = nbPv >= nbVirg ? ";" : ",";

  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let enGuillemets = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          champ += '"';
          i++;
        } else enGuillemets = false;
      } else champ += c;
    } else if (c === '"') {
      enGuillemets = true;
    } else if (c === delim) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n") {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else if (c !== "\r") {
      champ += c;
    }
  }
  ligne.push(champ);
  lignes.push(ligne);
  return lignes
    .map((l) => l.map((v) => v.trim()))
    .filter((l) => l.some((v) => v.length > 0));
}

/** Échappe une valeur pour un CSV délimité par « ; ». */
function champCsv(v: string): string {
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Sérialise des lignes en CSV « ; » avec BOM UTF-8 (ouverture correcte dans Excel). */
function versCsv(lignes: string[][]): string {
  return "﻿" + lignes.map((l) => l.map(champCsv).join(";")).join("\r\n") + "\r\n";
}

/** Normalise la valeur « statut » du CSV → enum StatutCompte. Défaut : actif. null = inconnu. */
function normaliserStatut(v: string): "actif" | "en_attente_verification" | "suspendu" | null {
  const s = norm(v);
  if (!s) return "actif";
  if (["actif", "active", "valide", "ok"].includes(s)) return "actif";
  if (["suspendu", "suspended", "suspend", "bloque", "desactive", "inactif"].includes(s)) {
    return "suspendu";
  }
  if (
    [
      "en attente",
      "en_attente_verification",
      "en attente de verification",
      "non confirme",
      "a verifier",
      "pending",
    ].includes(s)
  ) {
    return "en_attente_verification";
  }
  return null;
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
  const cPrenom = idx("prenom", "prenoms", "firstname");
  const cNom = idx("nom", "lastname");
  const cEmail = idx("email", "mail", "e-mail", "courriel");
  const cTel = idx("telephone", "tel", "phone", "mobile", "gsm", "numero");
  const cRole = idx("role", "profil");
  const cStatut = idx("statut", "status", "etat", "statut_compte");
  const cPays = idx("pays", "country");
  const cCode = idx("code_etablissement", "codeetablissement", "code_etab", "code", "code_ecole");
  const cEtabNom = idx("etablissement", "etablissements", "etab", "ecole", "nom_etablissement", "school");
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

  // Résolution d'un établissement : par code unique (recommandé) puis par nom exact,
  // éventuellement désambiguïsé par le pays ; refus explicite si le nom reste ambigu.
  const cacheEtab = new Map<string, string | null | "ambigu">();
  async function resoudreEtablissement(
    code: string,
    nom: string,
    pays: string,
  ): Promise<string | null | "ambigu"> {
    const kcode = code.trim();
    const knom = nom.trim();
    const kpays = pays.trim();
    if (!kcode && !knom) return null;
    const cacheKey = `${kcode}|${knom}|${kpays}`.toLowerCase();
    const enCache = cacheEtab.get(cacheKey);
    if (enCache !== undefined) return enCache;

    let res: string | null | "ambigu";
    if (kcode) {
      const e = await prisma.etablissement.findFirst({
        where: { code: { equals: kcode, mode: "insensitive" } },
        select: { id: true },
      });
      res = e ? e.id : null;
    } else {
      const parNom = await prisma.etablissement.findMany({
        where: kpays
          ? { nom: { equals: knom, mode: "insensitive" }, pays: { equals: kpays, mode: "insensitive" } }
          : { nom: { equals: knom, mode: "insensitive" } },
        select: { id: true },
        take: 2,
      });
      res = parNom.length > 1 ? "ambigu" : (parNom[0]?.id ?? null);
    }
    cacheEtab.set(cacheKey, res);
    return res;
  }

  const invitations: { email: string; prenom: string | null }[] = [];
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
      // Statut du compte (colonne « statut » ; défaut : actif).
      const statut = normaliserStatut(cell(l, cStatut));
      if (statut === null) {
        if (erreurs.length < 3) erreurs.push(`Statut inconnu (« ${cell(l, cStatut)} ») pour ${email}`);
        ignores += 1;
        continue;
      }
      // Établissement : seul l'admin système le fixe par ligne (colonnes code_etablissement /
      // etablissement / pays). Un gestionnaire d'établissement reste cloisonné à SON périmètre
      // (colonnes ignorées) — règle « refusé par défaut » du cloisonnement.
      let perimLigne = perim;
      if (u.roleReel === "admin") {
        const code = cell(l, cCode);
        const nomEtab = cell(l, cEtabNom);
        const resolu = await resoudreEtablissement(code, nomEtab, cell(l, cPays));
        if (resolu === "ambigu") {
          if (erreurs.length < 3) erreurs.push(`Établissement ambigu (« ${nomEtab || code} ») pour ${email}`);
          ignores += 1;
          continue;
        }
        if (resolu) {
          perimLigne = { etablissementId: resolu };
        } else if (code || nomEtab) {
          if (erreurs.length < 3) erreurs.push(`Établissement inconnu (« ${code || nomEtab} ») pour ${email}`);
          ignores += 1;
          continue;
        } else {
          perimLigne = {};
        }
      }
      const existe = await prisma.utilisateur.findUnique({ where: { email }, select: { id: true } });
      if (existe) {
        ignores += 1;
        continue;
      }
      const prenom = cPrenom >= 0 ? cell(l, cPrenom) || null : null;
      await prisma.utilisateur.create({
        data: {
          email,
          prenoms: prenom,
          nom: cNom >= 0 ? cell(l, cNom) || null : null,
          telephone: cTel >= 0 ? cell(l, cTel) || null : null,
          motDePasseHash: hash,
          statutCompte: statut,
          emailVerifieLe: statut === "en_attente_verification" ? null : new Date(),
          roleActifId: roleId,
          ...perimLigne,
        },
      });
      invitations.push({ email, prenom });
      crees += 1;
    }
    revalidatePath(BASE);
  } catch (e) {
    console.error("[comptes] import :", e);
    return { ok: false, message: "Erreur technique lors de l'import." };
  }

  // Invitations : e-mail avec le mot de passe temporaire (tolérant aux échecs d'envoi Resend).
  const lien = `${baseUrl()}/connexion`;
  await Promise.allSettled(
    invitations.map((inv) =>
      envoiTolerant({ to: inv.email, ...gabaritInvitation(inv.email, motDePasse, lien, inv.prenom) }),
    ),
  );

  const suffixe = erreurs.length > 0 ? ` (${erreurs.join(" ; ")})` : "";
  const invite = crees > 0 ? " Invitations envoyées par e-mail." : "";
  return { ok: true, message: `${crees} compte(s) créé(s), ${ignores} ignoré(s)${suffixe}.${invite}` };
}

/**
 * Export CSV des comptes du périmètre du gestionnaire (l'admin système : tous les comptes).
 * Colonnes : prenom;nom;email;telephone;role;statut;pays;code_etablissement;etablissement.
 */
export async function exporterComptes(): Promise<ExportResultat> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutGerer(u)) return { ok: false, message: "Action réservée à l'administration (ou mode aperçu)." };

  try {
    const utilisateurs = await prisma.utilisateur.findMany({
      where: filtreUtilisateurs(u.portee),
      orderBy: [{ nom: "asc" }, { prenoms: "asc" }],
      include: {
        roleActif: { select: { nomTechnique: true } },
        etablissement: { select: { pays: true, code: true, nom: true } },
      },
    });
    const entete = [
      "prenom",
      "nom",
      "email",
      "telephone",
      "role",
      "statut",
      "pays",
      "code_etablissement",
      "etablissement",
    ];
    const lignes = utilisateurs.map((x) => [
      x.prenoms ?? "",
      x.nom ?? "",
      x.email,
      x.telephone ?? "",
      x.roleActif.nomTechnique,
      x.statutCompte,
      x.etablissement?.pays ?? "",
      x.etablissement?.code ?? "",
      x.etablissement?.nom ?? "",
    ]);
    return { ok: true, csv: versCsv([entete, ...lignes]), nom: `comptes-eduweb-${utilisateurs.length}.csv` };
  } catch (e) {
    console.error("[comptes] export :", e);
    return { ok: false, message: "Erreur technique lors de l'export." };
  }
}
