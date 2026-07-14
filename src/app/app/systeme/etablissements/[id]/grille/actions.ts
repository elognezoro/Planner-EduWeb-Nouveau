"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin") return u;
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
 * Enregistre la grille (séances + coefficient) d'un NIVEAU pour un établissement (Étape 3).
 * Le volume hebdomadaire est dérivé de la somme des durées de séances.
 */
export async function enregistrerSeances(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const etablissementId = String(formData.get("etablissementId") ?? "");
  const niveauId = String(formData.get("niveauId") ?? "");
  const brut = String(formData.get("payload") ?? "");
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
    const idsGardes = aGarder.map((g) => g.disciplineId);

    // La grille de l'établissement pour ce niveau devient EXACTEMENT ce qui est saisi :
    // on supprime les surcharges des disciplines retirées / vidées.
    await prisma.grilleHoraire.deleteMany({
      where: { etablissementId, niveauId, disciplineId: { notIn: idsGardes.length > 0 ? idsGardes : ["__aucune__"] } },
    });

    await Promise.all(
      aGarder.map((g) => {
        const heuresHebdo = g.seances.reduce((a, b) => a + b, 0) / 60;
        return prisma.grilleHoraire.upsert({
          where: { niveauId_disciplineId_etablissementId: { niveauId, disciplineId: g.disciplineId, etablissementId } },
          update: { seancesMinutes: g.seances, coefficient: g.coef, heuresHebdo, nbSeances: g.seances.length },
          create: { niveauId, disciplineId: g.disciplineId, etablissementId, seancesMinutes: g.seances, coefficient: g.coef, heuresHebdo, nbSeances: g.seances.length },
        });
      }),
    );

    // On revalide la PAGE DE CONFIG (où vit le bloc Volumes) ET la sous-page grille.
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/grille`);
  } catch (e) {
    console.error("[seances] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Grille enregistrée." };
}
