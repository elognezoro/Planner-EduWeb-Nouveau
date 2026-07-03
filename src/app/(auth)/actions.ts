"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { hacherMotDePasse } from "@/lib/auth/password";
import {
  creerJeton,
  consommerJeton,
  DUREE_VERIFICATION_MS,
  DUREE_REINITIALISATION_MS,
} from "@/lib/auth/tokens";
import { envoyerEmail } from "@/lib/email/send";
import { gabaritVerification, gabaritReinitialisation } from "@/lib/email/templates";
import {
  schemaInscription,
  schemaConnexion,
  schemaDemandeReset,
  schemaReset,
} from "@/lib/validation/auth";
import { ROLE_PAR_DEFAUT } from "@/lib/rbac";
import { paysDetecte } from "@/lib/geo";

export interface EtatForm {
  ok: boolean;
  message?: string;
  erreurs?: Record<string, string[] | undefined>;
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Envoi tolérant : un échec d'e-mail ne doit pas faire échouer l'opération métier. */
async function envoiTolerant(args: Parameters<typeof envoyerEmail>[0]) {
  try {
    await envoyerEmail(args);
  } catch (e) {
    console.error("[email] échec d'envoi (poursuite) :", e);
  }
}

// ─────────────────────────────────────────────────────────────
//  Inscription (cahier §6.2)
// ─────────────────────────────────────────────────────────────
export async function sinscrire(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const parsed = schemaInscription.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Veuillez corriger les champs signalés.",
      erreurs: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  try {
    const existant = await prisma.utilisateur.findUnique({ where: { email: d.email } });
    if (existant) {
      return { ok: false, message: "Un compte existe déjà avec cette adresse e-mail." };
    }

    const [roleEleve, roleSouhaite] = await Promise.all([
      prisma.role.findUnique({ where: { nomTechnique: ROLE_PAR_DEFAUT } }),
      prisma.role.findUnique({ where: { nomTechnique: d.roleSouhaite } }),
    ]);
    if (!roleEleve || !roleSouhaite) {
      return {
        ok: false,
        message:
          "Les rôles ne sont pas initialisés en base. Exécutez « npm run db:seed ».",
      };
    }

    const hash = await hacherMotDePasse(d.motDePasse);
    // Pays supposé de l'utilisateur (géolocalisation de la requête) — modifiable au profil.
    const pays = await paysDetecte();
    const utilisateur = await prisma.utilisateur.create({
      data: {
        email: d.email,
        motDePasseHash: hash,
        prenoms: d.prenoms,
        nom: d.nom,
        telephone: d.telephone || null,
        pays: pays.nom,
        statutCompte: "en_attente_verification",
        roleActifId: roleEleve.id, // rôle technique par défaut : eleve
        demandes: {
          create: {
            roleDemandeId: roleSouhaite.id,
            statut: "en_attente",
            structureDeclaree: d.structureDeclaree || null,
          },
        },
      },
    });

    const token = await creerJeton(utilisateur.id, "verification_email", DUREE_VERIFICATION_MS);
    const lien = `${baseUrl()}/verification-email?token=${token}`;
    const { subject, html } = gabaritVerification(lien, d.prenoms);
    await envoiTolerant({ to: d.email, subject, html, lienDebug: lien });
  } catch (e) {
    console.error("[inscription] erreur :", e);
    return {
      ok: false,
      message:
        "Une erreur technique est survenue. La base de données est-elle bien connectée (DATABASE_URL) ?",
    };
  }

  redirect(`/verification-email?envoye=1&email=${encodeURIComponent(d.email)}`);
}

// ─────────────────────────────────────────────────────────────
//  Renvoi de l'e-mail de confirmation (compte non encore activé)
// ─────────────────────────────────────────────────────────────
export async function renvoyerConfirmation(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const parsed = schemaDemandeReset.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Adresse e-mail invalide." };
  }

  try {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { email: parsed.data.email },
    });
    // On ne renvoie un lien que si le compte existe ET n'est pas encore confirmé.
    // Message toujours identique : ne jamais révéler l'existence ni le statut du compte.
    if (utilisateur && utilisateur.statutCompte === "en_attente_verification") {
      const token = await creerJeton(
        utilisateur.id,
        "verification_email",
        DUREE_VERIFICATION_MS,
      );
      const lien = `${baseUrl()}/verification-email?token=${token}`;
      const { subject, html } = gabaritVerification(lien, utilisateur.prenoms);
      await envoiTolerant({ to: utilisateur.email, subject, html, lienDebug: lien });
    }
  } catch (e) {
    console.error("[renvoi-confirmation] erreur :", e);
  }

  return {
    ok: true,
    message:
      "Si un compte non confirmé est associé à cette adresse, un nouvel e-mail de confirmation vient d'être envoyé.",
  };
}

// ─────────────────────────────────────────────────────────────
//  Connexion
// ─────────────────────────────────────────────────────────────
export async function seConnecter(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const parsed = schemaConnexion.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Identifiants invalides." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      motDePasse: parsed.data.motDePasse,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message:
          "E-mail ou mot de passe incorrect, ou compte non encore confirmé par e-mail.",
      };
    }
    throw error; // redirection interne (NEXT_REDIRECT) : doit se propager.
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  Demande de réinitialisation de mot de passe (cahier §6.5)
// ─────────────────────────────────────────────────────────────
export async function demanderReinitialisation(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const parsed = schemaDemandeReset.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Adresse e-mail invalide." };
  }

  try {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { email: parsed.data.email },
    });
    // Ne pas révéler si le compte existe : on renvoie toujours le même message.
    if (utilisateur) {
      const token = await creerJeton(
        utilisateur.id,
        "reinitialisation_mot_de_passe",
        DUREE_REINITIALISATION_MS,
      );
      const lien = `${baseUrl()}/reinitialiser-mot-de-passe?token=${token}`;
      const { subject, html } = gabaritReinitialisation(lien, utilisateur.prenoms);
      await envoiTolerant({ to: utilisateur.email, subject, html, lienDebug: lien });
    }
  } catch (e) {
    console.error("[reset] erreur :", e);
  }

  return {
    ok: true,
    message:
      "Si un compte est associé à cette adresse, un e-mail de réinitialisation vient d'être envoyé.",
  };
}

// ─────────────────────────────────────────────────────────────
//  Application d'un nouveau mot de passe
// ─────────────────────────────────────────────────────────────
export async function reinitialiserMotDePasse(
  _prev: EtatForm,
  formData: FormData,
): Promise<EtatForm> {
  const parsed = schemaReset.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Veuillez corriger les champs.",
      erreurs: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const resultat = await consommerJeton(parsed.data.token, "reinitialisation_mot_de_passe");
    if (!resultat) {
      return { ok: false, message: "Lien invalide ou expiré. Refaites une demande." };
    }
    const hash = await hacherMotDePasse(parsed.data.motDePasse);
    await prisma.utilisateur.update({
      where: { id: resultat.utilisateurId },
      data: { motDePasseHash: hash },
    });
  } catch (e) {
    console.error("[reset-apply] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  redirect("/connexion?reinitialise=1");
}
