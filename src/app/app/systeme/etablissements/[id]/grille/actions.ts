"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";
import { cibleLV2 } from "@/lib/disciplines/lv2";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin" || u.roleReel === "superviseur_international") return u;
  // Le gestionnaire de l'établissement (admin d'établissements ou chef) configure LE SIEN.
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

interface LignePayload {
  coef: number;
  seances: number[];
}

/**
 * Cœur de l'enregistrement de la grille d'un NIVEAU — partagé par les deux entrées :
 * l'enregistrement MANUEL (bouton, revalide la page) et l'enregistrement AUTOMATIQUE (saisie au
 * fil de l'eau, silencieux). `revalider` distingue les deux : révalider à chaque frappe
 * relancerait le rendu serveur de toute la page de configuration, ce qui serait inutilement lourd.
 */
async function ecrireGrilleNiveau(
  etablissementId: string,
  niveauId: string,
  brut: string,
  revalider: boolean,
): Promise<EtatForm> {
  if (!etablissementId || !niveauId) return { ok: false, message: "Données invalides." };

  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };


  let payload: Record<string, LignePayload>;
  try {
    payload = JSON.parse(brut);
  } catch {
    return { ok: false, message: "Données du formulaire illisibles." };
  }

  try {
    // Disciplines RÉELLEMENT configurées (au moins une séance > 0) : elles seules sont conservées.
    const aGarder: { disciplineId: string; seances: number[]; coef: number }[] = [];
    for (const [disciplineId, ligne] of Object.entries(payload)) {
      const seances = (ligne.seances ?? [])
        .map((m) => Math.max(0, Math.round(Number(m) || 0)))
        .filter((m) => m > 0);
      if (seances.length === 0) continue;
      aGarder.push({ disciplineId, seances, coef: Math.max(0, Number(ligne.coef) || 0) });
    }
    // CLOISONNEMENT + règle LV2 : seules les disciplines VISIBLES ici (national + celles de
    // CET établissement) sont acceptées, et une variante NUE (« Allemand »/« Espagnol ») est
    // RE-POINTÉE sur sa discipline « LV2-x » — la grille des volumes horaires reste ainsi
    // SYNCHRONISÉE avec le tableau « Effectifs des enseignants par cycle et spécialité »
    // (une ancienne ligne « Allemand » migre d'elle-même au premier enregistrement).
    const refs = await prisma.discipline.findMany({
      where: { OR: [{ etablissementId: null }, { etablissementId }] },
      select: { id: true, nom: true },
    });
    const parId = new Map(refs.map((d) => [d.id, d]));
    const normNom = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    const idParNorm = new Map(refs.map((d) => [normNom(d.nom), d.id]));
    const gardees = new Map<string, { disciplineId: string; seances: number[]; coef: number }>();
    for (const g of aGarder) {
      const d = parId.get(g.disciplineId);
      if (!d) continue; // hors périmètre (autre école, inexistante) : ignorée
      const canon = cibleLV2(d.nom);
      const cible =
        canon && normNom(d.nom) !== normNom(canon) ? (idParNorm.get(normNom(canon)) ?? g.disciplineId) : g.disciplineId;
      // Doublon après re-pointage (« Allemand » ET « LV2-Allemand » saisis) : la première prime.
      if (!gardees.has(cible)) gardees.set(cible, { ...g, disciplineId: cible });
    }
    const lignes = [...gardees.values()];
    const idsGardes = lignes.map((g) => g.disciplineId);

    // La grille de l'établissement pour ce niveau devient EXACTEMENT ce qui est saisi :
    // on supprime les surcharges des disciplines retirées / vidées.
    await prisma.grilleHoraire.deleteMany({
      where: { etablissementId, niveauId, disciplineId: { notIn: idsGardes.length > 0 ? idsGardes : ["__aucune__"] } },
    });

    await Promise.all(
      lignes.map((g) => {
        const heuresHebdo = g.seances.reduce((a, b) => a + b, 0) / 60;
        return prisma.grilleHoraire.upsert({
          where: { niveauId_disciplineId_etablissementId: { niveauId, disciplineId: g.disciplineId, etablissementId } },
          update: { seancesMinutes: g.seances, coefficient: g.coef, heuresHebdo, nbSeances: g.seances.length },
          create: { niveauId, disciplineId: g.disciplineId, etablissementId, seancesMinutes: g.seances, coefficient: g.coef, heuresHebdo, nbSeances: g.seances.length },
        });
      }),
    );

    // On revalide la PAGE DE CONFIG (où vit le bloc Volumes) ET la sous-page grille.
    // Sauté en enregistrement automatique : le client détient déjà l'état à jour, et un rendu
    // serveur complet à chaque frappe serait coûteux. Le bouton manuel, lui, revalide.
    if (revalider) {
      revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
      revalidatePath(`/app/systeme/etablissements/${etablissementId}/grille`);
    }
  } catch (e) {
    console.error("[seances] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Grille enregistrée." };
}

/**
 * Enregistre la grille (séances + coefficient) d'un NIVEAU pour un établissement (Étape 3).
 * Le volume hebdomadaire est dérivé de la somme des durées de séances.
 */
export async function enregistrerSeances(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  return ecrireGrilleNiveau(
    String(formData.get("etablissementId") ?? ""),
    String(formData.get("niveauId") ?? ""),
    String(formData.get("payload") ?? ""),
    true,
  );
}

/**
 * Enregistrement AUTOMATIQUE, appelé au fil de la saisie (débounce côté client).
 * Mêmes contrôles d'autorisation et mêmes règles métier que l'enregistrement manuel — c'est la
 * MÊME fonction : une sauvegarde silencieuse ne doit jamais être une porte dérobée.
 * Seule différence : pas de revalidation de page.
 */
export async function enregistrerSeancesAuto(
  etablissementId: string,
  niveauId: string,
  payload: string,
): Promise<EtatForm> {
  return ecrireGrilleNiveau(etablissementId, niveauId, payload, false);
}
