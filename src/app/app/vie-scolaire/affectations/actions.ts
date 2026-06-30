"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { peutGererEtablissement } from "@/lib/vie-scolaire/contexte";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

export async function creerAffectation(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };

  const etablissementId = String(formData.get("etablissementId") ?? "");
  const enseignantId = String(formData.get("enseignantId") ?? "");
  const classeId = String(formData.get("classeId") ?? "");
  const disciplineId = String(formData.get("disciplineId") ?? "");
  if (!etablissementId || !enseignantId || !classeId || !disciplineId) {
    return { ok: false, message: "Tous les champs sont requis." };
  }
  if (!peutGererEtablissement(u, etablissementId)) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }

  try {
    // Vérification de cohérence de périmètre.
    const [enseignant, classe] = await Promise.all([
      prisma.utilisateur.findUnique({ where: { id: enseignantId } }),
      prisma.classe.findUnique({ where: { id: classeId } }),
    ]);
    if (!enseignant || enseignant.etablissementId !== etablissementId) {
      return { ok: false, message: "Enseignant hors de cet établissement." };
    }
    if (!classe || classe.etablissementId !== etablissementId) {
      return { ok: false, message: "Classe hors de cet établissement." };
    }

    const existe = await prisma.affectationEnseignant.findUnique({
      where: { enseignantId_classeId_disciplineId: { enseignantId, classeId, disciplineId } },
    });
    if (existe) return { ok: false, message: "Cette affectation existe déjà." };

    await prisma.affectationEnseignant.create({
      data: { enseignantId, classeId, disciplineId },
    });
    revalidatePath("/app/vie-scolaire/affectations");
  } catch (e) {
    console.error("[affectation] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Affectation enregistrée." };
}

export async function supprimerAffectation(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const aff = await prisma.affectationEnseignant.findUnique({
    where: { id },
    include: { classe: true },
  });
  if (!aff) return;
  if (!peutGererEtablissement(u, aff.classe.etablissementId)) return;

  await prisma.affectationEnseignant.delete({ where: { id } });
  revalidatePath("/app/vie-scolaire/affectations");
}
