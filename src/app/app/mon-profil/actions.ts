"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { verifierMotDePasse, hacherMotDePasse } from "@/lib/auth/password";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";
import { trouverPays } from "@/lib/referentiels/pays";
import { ROLES } from "@/lib/rbac";

export interface EtatForm {
  ok: boolean;
  message?: string;
  erreurs?: Record<string, string[] | undefined>;
}

const schema = z.object({
  // Même convention de casse qu'à l'inscription : Prénoms capitalisés, NOM en majuscules.
  prenoms: z.string().trim().min(1, "Prénoms requis.").max(80).transform(capitaliserPrenoms),
  nom: z.string().trim().min(1, "Nom requis.").max(80).transform(majusculesNom),
  telephone: z.string().trim().max(30).optional().or(z.literal("")),
  pays: z
    .string()
    .trim()
    .max(60)
    .refine((v) => v === "" || trouverPays(v) !== null, { message: "Pays inconnu." })
    .optional()
    .or(z.literal("")),
  langue: z.enum(["fr", "en"]),
});

export async function mettreAJourProfil(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  if (u.apercuActif) {
    return { ok: false, message: "Mode aperçu : modification désactivée (lecture seule)." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Veuillez corriger les champs signalés.",
      erreurs: parsed.error.flatten().fieldErrors,
    };
  }

  // SÉCURITÉ : pour un rôle à périmètre « pays » (Super Admin CAFOP/Établissements/APFC,
  // Représentant-Pays, DELC), le `pays` détermine le CLOISONNEMENT RBAC — il ne doit pas être
  // auto-modifiable (sinon franchissement inter-pays). Il n'est fixé que par l'admin / l'approbation.
  const paysVerrouille = ROLES[u.roleReel]?.portee === "pays";

  try {
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: {
        prenoms: parsed.data.prenoms,
        nom: parsed.data.nom,
        telephone: parsed.data.telephone || null,
        ...(paysVerrouille ? {} : { pays: parsed.data.pays || null }),
        langue: parsed.data.langue,
      },
    });
    revalidatePath("/app/mon-profil");
    revalidatePath("/app/mon-identification");
  } catch (e) {
    console.error("[profil] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  return { ok: true, message: "Profil mis à jour avec succès." };
}

const schemaMotDePasse = z
  .object({
    actuel: z.string().min(1, "Mot de passe actuel requis."),
    nouveau: z
      .string()
      .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères.")
      .max(100, "Mot de passe trop long."),
    confirmation: z.string(),
  })
  .refine((d) => d.nouveau === d.confirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

/** Changement de mot de passe par l'utilisateur lui-même (vérifie l'ancien mot de passe). */
export async function changerMotDePasse(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  if (u.apercuActif) {
    return { ok: false, message: "Mode aperçu : modification désactivée (lecture seule)." };
  }

  const parsed = schemaMotDePasse.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Veuillez corriger les champs signalés.",
      erreurs: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const compte = await prisma.utilisateur.findUnique({
      where: { id: u.id },
      select: { motDePasseHash: true },
    });
    if (!compte) return { ok: false, message: "Compte introuvable." };

    const ancienValide = await verifierMotDePasse(parsed.data.actuel, compte.motDePasseHash);
    if (!ancienValide) {
      return {
        ok: false,
        message: "Le mot de passe actuel est incorrect.",
        erreurs: { actuel: ["Mot de passe actuel incorrect."] },
      };
    }

    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { motDePasseHash: await hacherMotDePasse(parsed.data.nouveau) },
    });
  } catch (e) {
    console.error("[profil-mdp] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  return { ok: true, message: "Mot de passe modifié avec succès." };
}
