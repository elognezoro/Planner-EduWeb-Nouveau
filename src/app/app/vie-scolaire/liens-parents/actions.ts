"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const ROLES_GESTION = ["admin", "chef_etablissement", "educateur"];

const schema = z.object({
  parentEmail: z.string().trim().toLowerCase().email("E-mail du parent invalide."),
  eleveEmail: z.string().trim().toLowerCase().email("E-mail de l'élève invalide."),
  lien: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function creerLien(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || !ROLES_GESTION.includes(u.roleReel)) {
    return { ok: false, message: "Action non autorisée (ou mode aperçu)." };
  }
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const { parentEmail, eleveEmail, lien } = parsed.data;
  if (parentEmail === eleveEmail) {
    return { ok: false, message: "Le parent et l'élève doivent être deux comptes distincts." };
  }

  try {
    const [parent, eleve] = await Promise.all([
      prisma.utilisateur.findUnique({ where: { email: parentEmail } }),
      prisma.utilisateur.findUnique({ where: { email: eleveEmail } }),
    ]);
    if (!parent) return { ok: false, message: "Aucun compte parent avec cet e-mail." };
    if (!eleve) return { ok: false, message: "Aucun compte élève avec cet e-mail." };

    // Périmètre : un chef/éducateur ne lie que des élèves inscrits dans son établissement.
    if (u.roleReel !== "admin") {
      const etabId = u.portee.etablissementId;
      if (!etabId) return { ok: false, message: "Aucun établissement rattaché à votre compte." };
      const inscrit = await prisma.inscription.findFirst({
        where: { eleveId: eleve.id, classe: { etablissementId: etabId } },
      });
      if (!inscrit) {
        return { ok: false, message: "Cet élève n'est pas inscrit dans votre établissement." };
      }
    }

    const existe = await prisma.lienParentEleve.findUnique({
      where: { parentId_eleveId: { parentId: parent.id, eleveId: eleve.id } },
    });
    if (existe) return { ok: false, message: "Ce lien existe déjà." };

    await prisma.lienParentEleve.create({
      data: { parentId: parent.id, eleveId: eleve.id, lien: lien || null },
    });
    revalidatePath("/app/vie-scolaire/liens-parents");
  } catch (e) {
    console.error("[lien] erreur :", e);
    return { ok: false, message: "Erreur technique (base de données connectée ?)." };
  }
  return { ok: true, message: "Lien créé." };
}

export async function supprimerLien(formData: FormData) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || !ROLES_GESTION.includes(u.roleReel)) return;
  if (refusEssaiPour(u)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const lien = await prisma.lienParentEleve.findUnique({ where: { id } });
  if (!lien) return;

  if (u.roleReel !== "admin") {
    const etabId = u.portee.etablissementId;
    if (!etabId) return;
    const inscrit = await prisma.inscription.findFirst({
      where: { eleveId: lien.eleveId, classe: { etablissementId: etabId } },
    });
    if (!inscrit) return;
  }

  await prisma.lienParentEleve.delete({ where: { id } });
  revalidatePath("/app/vie-scolaire/liens-parents");
}
