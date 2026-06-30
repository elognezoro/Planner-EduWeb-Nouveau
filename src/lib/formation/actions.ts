"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";

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

export async function creerStructure(
  type: "cafop" | "apfc",
  nom: string,
  regionId?: string | null,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") {
    return { ok: false, message: "Action réservée à l'administrateur." };
  }
  const libelle = nom.trim();
  if (!libelle) return { ok: false, message: "Le nom est obligatoire." };
  try {
    const data = { nom: libelle, regionId: regionId || null };
    if (type === "cafop") await prisma.cafop.create({ data });
    else await prisma.apfc.create({ data });
    revalidatePath(`/app/systeme/${type}`);
  } catch (e) {
    console.error("[formation] création structure :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: type === "cafop" ? "CAFOP créé." : "APFC créée." };
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
  const nom = String(formData.get("nom") ?? "").trim();
  const prenoms = String(formData.get("prenoms") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const matricule = String(formData.get("matricule") ?? "").trim() || null;
  if (!nom) return { ok: false, message: "Le nom est obligatoire." };
  const s = await structureDeCohorte(cohorteId);
  if (!s) return { ok: false, message: "Cohorte introuvable." };
  if (!peutGerer(u, s)) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.apprenant.create({ data: { cohorteId, nom, prenoms, email, matricule } });
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
