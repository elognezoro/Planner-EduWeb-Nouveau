"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { verifierMotDePasse, hacherMotDePasse } from "@/lib/auth/password";
import { creerCode2FA, verifierCode2FA } from "@/lib/auth/deux-facteurs";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritCode2FA } from "@/lib/email/templates";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";
import { motDePasseFort } from "@/lib/validation/mot-de-passe";
import { trouverPays } from "@/lib/referentiels/pays";
import { ROLES } from "@/lib/rbac";
import { estEncadreurPedagogique } from "@/lib/inspection/specialites";

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

/**
 * Enregistre les spécialités d'ENCADREMENT PÉDAGOGIQUE de l'utilisateur courant (bloc
 * « Ma spécialité » de Mon Profil — rôles inspecteur / conseiller pédagogique uniquement).
 * Les noms sont validés côté serveur contre le référentiel des disciplines SIMPLES
 * (les couples « X / Y » sont exclus). Stockés en JSON (tableau de noms) sur Utilisateur.
 */
export async function mettreAJourSpecialites(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  if (u.apercuActif) {
    return { ok: false, message: "Mode aperçu : modification désactivée (lecture seule)." };
  }
  if (!estEncadreurPedagogique(u.roleReel)) {
    return { ok: false, message: "Réservé aux rôles d'encadrement pédagogique (Inspecteur, Conseiller Pédagogique)." };
  }

  let brut: unknown;
  try {
    brut = JSON.parse(String(formData.get("specialites") ?? "[]"));
  } catch {
    return { ok: false, message: "Sélection illisible." };
  }
  if (!Array.isArray(brut) || brut.some((n) => typeof n !== "string")) {
    return { ok: false, message: "Sélection invalide." };
  }
  const retenues = [...new Set((brut as string[]).map((n) => n.trim()).filter(Boolean))];
  if (retenues.length > 20) return { ok: false, message: "Trop de spécialités sélectionnées." };

  try {
    // Ne jamais faire confiance au client : chaque nom doit exister au référentiel
    // et être une discipline SIMPLE (pas de couple contenant « / »).
    const disciplines = await prisma.discipline.findMany({ select: { nom: true } });
    const valides = new Set(disciplines.map((d) => d.nom).filter((n) => !n.includes("/")));
    if (retenues.some((n) => !valides.has(n))) {
      return { ok: false, message: "Une spécialité sélectionnée est inconnue du référentiel." };
    }

    await prisma.utilisateur.update({ where: { id: u.id }, data: { specialites: retenues } });
    revalidatePath("/app/mon-profil");
  } catch (e) {
    console.error("[profil-specialites] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  return { ok: true, message: "Spécialités enregistrées." };
}

const schemaMotDePasse = z
  .object({
    actuel: z.string().min(1, "Mot de passe actuel requis."),
    // Même politique de robustesse que l'inscription (@/lib/validation/mot-de-passe).
    nouveau: motDePasseFort,
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

// ─────────────────────────────────────────────────────────────
//  Double authentification (2FA) — opt-in, canal e-mail (Étape 1)
// ─────────────────────────────────────────────────────────────

/**
 * Étape 1 de l'activation : envoie un code de confirmation à l'e-mail du compte. La 2FA n'est
 * PAS encore active — elle ne le devient qu'après saisie correcte du code (confirmer ci-dessous).
 * Ce détour prouve que le canal e-mail fonctionne avant de verrouiller la connexion.
 */
export async function activerDeuxFacteurs(
  _prev: EtatForm,
  _formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  if (u.apercuActif) {
    return { ok: false, message: "Mode aperçu : modification désactivée (lecture seule)." };
  }

  try {
    const compte = await prisma.utilisateur.findUnique({
      where: { id: u.id },
      select: { deuxFacteursActif: true },
    });
    if (compte?.deuxFacteursActif) {
      return { ok: true, message: "La double authentification est déjà active." };
    }
    const code = await creerCode2FA(u.id, "activation_2fa");
    const { subject, html } = gabaritCode2FA(code, "activation", u.prenoms);
    await envoyerEmail({ to: u.email, subject, html });
  } catch (e) {
    console.error("[2fa-activer] erreur :", e);
    return {
      ok: false,
      message: "Impossible d'envoyer le code de vérification. Réessayez dans un instant.",
    };
  }

  return {
    ok: true,
    message:
      "Un code de vérification vous a été envoyé par e-mail. Saisissez-le ci-dessous pour activer la double authentification.",
  };
}

/** Étape 2 de l'activation : vérifie le code reçu et active réellement la 2FA. */
export async function confirmerDeuxFacteurs(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  if (u.apercuActif) {
    return { ok: false, message: "Mode aperçu : modification désactivée (lecture seule)." };
  }

  const code = String(formData.get("code") ?? "").trim();
  try {
    const valide = await verifierCode2FA(u.id, "activation_2fa", code);
    if (!valide) {
      return {
        ok: false,
        message: "Code incorrect ou expiré. Renvoyez un code et réessayez.",
        erreurs: { code: ["Code incorrect ou expiré."] },
      };
    }
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { deuxFacteursActif: true, deuxFacteursMethode: "email" },
    });
    revalidatePath("/app/mon-profil");
  } catch (e) {
    console.error("[2fa-confirmer] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  return {
    ok: true,
    message:
      "Double authentification activée. À chaque connexion, un code vous sera désormais demandé par e-mail.",
  };
}

/** Désactive la 2FA et invalide les codes en attente. */
export async function desactiverDeuxFacteurs(
  _prev: EtatForm,
  _formData: FormData,
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  if (u.apercuActif) {
    return { ok: false, message: "Mode aperçu : modification désactivée (lecture seule)." };
  }

  try {
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { deuxFacteursActif: false },
    });
    await prisma.jeton.updateMany({
      where: {
        utilisateurId: u.id,
        type: { in: ["connexion_2fa", "activation_2fa"] },
        utiliseLe: null,
      },
      data: { utiliseLe: new Date() },
    });
    revalidatePath("/app/mon-profil");
  } catch (e) {
    console.error("[2fa-desactiver] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  return { ok: true, message: "Double authentification désactivée." };
}
