"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { ecritureNationaleAutorisee } from "@/lib/rbac/scope";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

/** Qui peut saisir/supprimer une absence d'enseignant pour CET établissement. */
async function peutGerer(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif) return null;
  if (u.roleReel === "admin") return u;
  if (
    (u.roleReel === "etablissements_admin" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  if (u.roleReel === "super_admin_etablissements") {
    const e = await prisma.etablissement.findUnique({ where: { id: etablissementId }, select: { pays: true } });
    if (ecritureNationaleAutorisee(u, "super_admin_etablissements", e?.pays)) return u;
  }
  return null;
}

const DEMI = ["journee", "matin", "apres_midi"] as const;
const STATUTS = ["autorisee", "non_autorisee", "justifiee"] as const;

const schemaAjout = z.object({
  etablissementId: z.string().min(1),
  enseignantId: z.string().min(1, "Sélectionnez un enseignant."),
  date: z.string().min(1, "Date requise."),
  demiJournee: z.enum(DEMI).default("journee"),
  statut: z.enum(STATUTS).default("autorisee"),
  motif: z.string().trim().max(240).optional(),
});

/** Enregistre une autorisation / absence d'un enseignant (saisie par le gestionnaire). */
export async function enregistrerAbsence(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const parsed = schemaAjout.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const { etablissementId, enseignantId, date, demiJournee, statut, motif } = parsed.data;

  const u = await peutGerer(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée (ou mode aperçu)." };

  const jour = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(jour.getTime())) return { ok: false, message: "Date invalide." };

  try {
    // Cloisonnement : l'enseignant doit appartenir à CET établissement.
    const ens = await prisma.utilisateur.findFirst({
      where: { id: enseignantId, etablissementId, roleActif: { nomTechnique: "enseignant" } },
      select: { id: true },
    });
    if (!ens) return { ok: false, message: "Enseignant hors de cet établissement." };

    await prisma.absenceEnseignant.create({
      data: {
        etablissementId,
        enseignantId,
        date: jour,
        demiJournee,
        statut,
        motif: motif || null,
        saisiParId: u.id,
      },
    });
    revalidatePath(`/app/systeme/etablissements/${etablissementId}/absences`);
    revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
    return { ok: true, message: "Absence enregistrée." };
  } catch (e) {
    console.error("[absence enseignant] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
}

/** Supprime une absence enregistrée (correction de saisie). */
export async function supprimerAbsence(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const etablissementId = String(formData.get("etablissementId") ?? "");
  if (!id || !etablissementId) return;
  const u = await peutGerer(etablissementId);
  if (!u) return;

  const abs = await prisma.absenceEnseignant.findUnique({ where: { id }, select: { etablissementId: true } });
  if (!abs || abs.etablissementId !== etablissementId) return;

  await prisma.absenceEnseignant.delete({ where: { id } });
  revalidatePath(`/app/systeme/etablissements/${etablissementId}/absences`);
  revalidatePath(`/app/systeme/etablissements/${etablissementId}`);
}
