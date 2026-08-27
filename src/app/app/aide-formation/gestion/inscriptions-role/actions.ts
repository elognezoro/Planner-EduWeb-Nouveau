"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";

export type ResultatInscriptions = { ok: boolean; message?: string; inscrits?: number; introuvables?: string[]; ambigus?: string[] };
export type ResultatLiens = { ok: boolean; message?: string; nonPublies?: string[] };

const PAGE = "/app/aide-formation/gestion/inscriptions-role";

/** Garde : admin système, hors mode aperçu. Renvoie l'id de l'admin (créateur des liens). */
async function gardeAdmin(): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur système." };
  return { ok: true, id: u.id };
}

/** Découpe la saisie libre (e-mails/noms) en entrées : séparateurs virgule, point-virgule, saut de ligne. */
function entreesDe(saisie: string): string[] {
  return [...new Set((saisie ?? "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 300);
}

/**
 * Inscrit EN MASSE des participants (saisis par e-mail ou nom) à PLUSIEURS formations, sous un STATUT :
 *  • « apprenant » (Élève/Apprenant) → InscriptionCours ;
 *  • « formateur » (Formateur/Tuteur) → TuteurCours (droits d'encadrement/correction).
 * Un e-mail est résolu exactement ; un nom est résolu par correspondance (ambiguïté signalée).
 */
export async function inscrireParticipants(coursIds: string[], statut: string, saisie: string): Promise<ResultatInscriptions> {
  const g = await gardeAdmin();
  if (!g.ok) return { ok: false, message: g.message };
  const ids = [...new Set((coursIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { ok: false, message: "Sélectionnez au moins une formation." };
  const estFormateur = statut === "formateur";
  const entrees = entreesDe(saisie);
  if (entrees.length === 0) return { ok: false, message: "Saisissez au moins un e-mail ou nom de participant." };

  const cours = await prisma.cours.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const coursValides = cours.map((c) => c.id);
  if (coursValides.length === 0) return { ok: false, message: "Formations introuvables." };

  const introuvables: string[] = [];
  const ambigus: string[] = [];
  const resolus: string[] = [];
  for (const e of entrees) {
    const users = e.includes("@")
      ? await prisma.utilisateur.findMany({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true }, take: 2 })
      : await prisma.utilisateur.findMany({
          where: { OR: [{ nom: { contains: e, mode: "insensitive" } }, { prenoms: { contains: e, mode: "insensitive" } }] },
          select: { id: true },
          take: 3,
        });
    if (users.length === 0) introuvables.push(e);
    else if (users.length > 1) ambigus.push(e);
    else resolus.push(users[0].id);
  }

  let inscrits = 0;
  try {
    for (const uid of [...new Set(resolus)]) {
      for (const cId of coursValides) {
        if (estFormateur) {
          await prisma.tuteurCours.upsert({
            where: { coursId_utilisateurId: { coursId: cId, utilisateurId: uid } },
            create: { coursId: cId, utilisateurId: uid },
            update: {},
          });
        } else {
          await prisma.inscriptionCours.upsert({
            where: { utilisateurId_coursId: { utilisateurId: uid, coursId: cId } },
            create: { utilisateurId: uid, coursId: cId, source: "nominative", roleCible: "apprenant" },
            update: { derniereActivite: new Date() },
          });
        }
        inscrits++;
      }
    }
    revalidatePath(PAGE);
  } catch (e) {
    console.error("[inscriptions-role] inscrireParticipants :", e);
    return { ok: false, message: "Erreur technique lors de l'inscription." };
  }
  const nb = new Set(resolus).size;
  return {
    ok: true,
    message: `${nb} participant(s) × ${coursValides.length} formation(s) = ${inscrits} inscription(s) comme ${estFormateur ? "formateur/tuteur" : "apprenant"}.`,
    inscrits,
    introuvables,
    ambigus,
  };
}

/** Met à jour la DATE (et heure) et la DURÉE d'une formation — affichées sur ses liens d'inscription. */
export async function majDateDuree(coursId: string, dateStr: string, dureeStr: string): Promise<{ ok: boolean; message?: string }> {
  const g = await gardeAdmin();
  if (!g.ok) return { ok: false, message: g.message };
  if (!coursId) return { ok: false, message: "Formation manquante." };
  const d = (dateStr ?? "").trim() ? new Date(dateStr) : null;
  const dateFormation = d && !isNaN(d.getTime()) ? d : null;
  const brut = (dureeStr ?? "").trim();
  const dureeMinutes = brut === "" ? null : Math.max(0, Math.round(Number(brut) || 0));
  try {
    await prisma.cours.update({ where: { id: coursId }, data: { dateFormation, dureeMinutes } });
    revalidatePath(PAGE);
  } catch (e) {
    console.error("[inscriptions-role] majDateDuree :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Date et durée enregistrées." };
}

/** Génère un lien d'inscription directe SCOPPÉ AU STATUT pour chaque formation PUBLIÉE sélectionnée. */
export async function genererLiensRole(coursIds: string[], statut: string): Promise<ResultatLiens> {
  const g = await gardeAdmin();
  if (!g.ok) return { ok: false, message: g.message };
  const ids = [...new Set((coursIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { ok: false, message: "Sélectionnez au moins une formation." };
  const roleCible = statut === "formateur" ? "formateur" : null; // null = apprenant (défaut)
  const cours = await prisma.cours.findMany({ where: { id: { in: ids } }, select: { id: true, titre: true, statut: true } });
  const publies = cours.filter((c) => c.statut === "publie");
  const nonPublies = cours.filter((c) => c.statut !== "publie").map((c) => c.titre);
  if (publies.length === 0) return { ok: false, message: "Aucune formation PUBLIÉE sélectionnée : un lien ne peut viser qu'un cours publié." };
  try {
    for (const c of publies) {
      await prisma.invitationCours.create({ data: { coursId: c.id, roleCible, creeParId: g.id } });
    }
    revalidatePath(PAGE);
  } catch (e) {
    console.error("[inscriptions-role] genererLiensRole :", e);
    return { ok: false, message: "Erreur technique lors de la génération des liens." };
  }
  return {
    ok: true,
    message: `${publies.length} lien(s) généré(s)${nonPublies.length ? ` — ${nonPublies.length} formation(s) non publiée(s) ignorée(s)` : ""}.`,
    nonPublies,
  };
}
