"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { hacherMotDePasse, verifierMotDePasse } from "@/lib/auth/password";
import { creerCode2FA } from "@/lib/auth/deux-facteurs";
import { journaliserSecurite } from "@/lib/audit/journal";
import { avecRetour, cheminRetourSur } from "@/lib/auth/retour";
import {
  creerJeton,
  consommerJeton,
  DUREE_VERIFICATION_MS,
  DUREE_REINITIALISATION_MS,
} from "@/lib/auth/tokens";
import { envoyerEmail } from "@/lib/email/send";
import {
  gabaritVerification,
  gabaritReinitialisation,
  gabaritCode2FA,
} from "@/lib/email/templates";
import {
  schemaInscription,
  schemaConnexion,
  schemaDemandeReset,
  schemaReset,
} from "@/lib/validation/auth";
import { ROLE_PAR_DEFAUT } from "@/lib/rbac";
import { paysDetecte } from "@/lib/geo";
import { trouverPays } from "@/lib/referentiels/pays";
import { resoudreParrain } from "@/lib/parrainage/parrainage";

export interface EtatForm {
  ok: boolean;
  message?: string;
  erreurs?: Record<string, string[] | undefined>;
  /** Connexion en deux temps : « 2fa » signale qu'un code de vérification est attendu. */
  etape?: "2fa";
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

/**
 * Ré-résout le rattachement déclaré à l'inscription CÔTÉ SERVEUR (l'identifiant transmis par le
 * client n'est jamais pris tel quel) : vérifie que l'établissement / la région appartiennent bien
 * au pays choisi, résout l'établissement par code si nécessaire (identification précise), et
 * renvoie les identifiants + le nom canoniques à stocker sur la DemandeRole.
 */
async function resoudreRattachement(
  paysNom: string,
  etablissementId: string,
  code: string,
  regionId: string,
): Promise<{ etablissementId: string | null; regionId: string | null; nom: string | null }> {
  const pays = { equals: paysNom, mode: "insensitive" as const };

  if (etablissementId) {
    const e = await prisma.etablissement.findFirst({
      where: { id: etablissementId, pays },
      select: { id: true, nom: true, regionId: true },
    });
    if (e) return { etablissementId: e.id, regionId: e.regionId, nom: e.nom };
  }

  if (code) {
    const e = await prisma.etablissement.findFirst({
      where: { code: { equals: code, mode: "insensitive" }, pays },
      select: { id: true, nom: true, regionId: true },
    });
    if (e) return { etablissementId: e.id, regionId: e.regionId, nom: e.nom };
  }

  if (regionId) {
    const r = await prisma.region.findFirst({ where: { id: regionId, pays }, select: { id: true } });
    if (r) return { etablissementId: null, regionId: r.id, nom: null };
  }

  return { etablissementId: null, regionId: null, nom: null };
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
  // PARRAINAGE : code lu directement dans le formulaire (hors schéma), résolu en identifiant de
  // parrain. Une invitation invalide est ignorée, jamais bloquante pour l'inscription.
  const parrainId = await resoudreParrain(String(formData.get("parrain") ?? ""));
  // Page à retrouver après confirmation puis connexion (ex. invitation à une formation) —
  // re-validée ici (anti open-redirect), propagée dans le lien de vérification par e-mail.
  const retour = cheminRetourSur(formData.get("retour"));

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
    // Pays de rattachement : celui choisi dans le formulaire (validé sur le référentiel ONU),
    // sinon la géolocalisation de la requête — modifiable ensuite au profil.
    const paysDefaut = await paysDetecte();
    const paysChoisi = d.paysChoisi ? trouverPays(d.paysChoisi) : null;
    const paysNom = paysChoisi?.nom ?? paysDefaut.nom;

    // Rattachement déclaré (établissement / région) ré-résolu côté serveur.
    const rattachement = await resoudreRattachement(
      paysNom,
      d.etablissementDeclareId || "",
      d.codeEtablissement || "",
      d.regionDeclareeId || "",
    );
    const structureDeclaree =
      rattachement.nom ||
      (d.structureDeclaree || "").trim() ||
      (d.codeEtablissement ? `Code établissement : ${d.codeEtablissement.trim()}` : "") ||
      null;

    const utilisateur = await prisma.utilisateur.create({
      data: {
        email: d.email,
        motDePasseHash: hash,
        prenoms: d.prenoms,
        nom: d.nom,
        telephone: d.telephone || null,
        pays: paysNom,
        statutCompte: "en_attente_verification",
        roleActifId: roleEleve.id, // rôle technique par défaut : eleve
        parrainId, // rattachement au parrain (nul si pas d'invitation) — fixé une seule fois
        demandes: {
          create: {
            roleDemandeId: roleSouhaite.id,
            statut: "en_attente",
            structureDeclaree,
            etablissementDeclareId: rattachement.etablissementId,
            regionDeclareeId: rattachement.regionId,
          },
        },
      },
    });

    const token = await creerJeton(utilisateur.id, "verification_email", DUREE_VERIFICATION_MS);
    const lien = avecRetour(`${baseUrl()}/verification-email?token=${token}`, retour);
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

  redirect(avecRetour(`/verification-email?envoye=1&email=${encodeURIComponent(d.email)}`, retour));
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
  // Fil de RETOUR (ex. invitation à une formation) : re-validé, propagé dans le nouveau lien
  // pour que le renvoi ne fasse pas perdre la page à retrouver après connexion.
  const retour = cheminRetourSur(formData.get("retour"));

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
      const lien = avecRetour(`${baseUrl()}/verification-email?token=${token}`, retour);
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
  const { email, motDePasse } = parsed.data;
  const codeSaisi = (parsed.data.code ?? "").trim();

  // ── Étape 1 (aucun code encore saisi) ────────────────────────────────────────
  // Si le compte a la 2FA active ET que le mot de passe est correct, on envoie un code et on
  // demande sa saisie. Le mot de passe est vérifié AVANT tout envoi (le code ne peut donc pas
  // servir à spammer une boîte e-mail). Sinon (pas de 2FA), on laisse signIn faire son office.
  if (!codeSaisi) {
    try {
      const utilisateur = await prisma.utilisateur.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          prenoms: true,
          statutCompte: true,
          motDePasseHash: true,
          deuxFacteursActif: true,
        },
      });
      if (
        utilisateur &&
        utilisateur.statutCompte === "actif" &&
        utilisateur.deuxFacteursActif &&
        (await verifierMotDePasse(motDePasse, utilisateur.motDePasseHash))
      ) {
        // Canal e-mail (Étape 1 ; SMS/WhatsApp seront branchés quand les fournisseurs seront prêts).
        const code = await creerCode2FA(utilisateur.id, "connexion_2fa");
        const { subject, html } = gabaritCode2FA(code, "connexion", utilisateur.prenoms);
        await envoiTolerant({ to: utilisateur.email, subject, html });
        await journaliserSecurite("2fa_code_envoye", {
          utilisateurId: utilisateur.id,
          acteurEmail: utilisateur.email,
          cible: `Utilisateur:${utilisateur.id}`,
        });
        return {
          ok: false,
          etape: "2fa",
          message:
            "Un code de vérification à 6 chiffres vient de vous être envoyé par e-mail. Saisissez-le pour terminer la connexion.",
        };
      }
    } catch (e) {
      // Ne pas interrompre : signIn ci-dessous renverra l'erreur générique appropriée.
      console.error("[connexion-2fa] erreur :", e);
    }
  }

  // ── Connexion effective ──────────────────────────────────────────────────────
  // Étape 2 (code présent) : authorize revérifie le mot de passe ET le code (et le consomme).
  // Page de RETOUR (déconnexion pour inactivité, ou invitation à une formation) : re-validée
  // ici — seul un chemin interne « /app… » ou « /invitation/<jeton> » est honoré (anti
  // open-redirect), sinon accueil /app.
  const retour = cheminRetourSur(formData.get("retour"));
  try {
    await signIn("credentials", {
      email,
      motDePasse,
      code: codeSaisi,
      redirectTo: retour ?? "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (codeSaisi) {
        return {
          ok: false,
          etape: "2fa",
          message:
            "Code incorrect ou expiré. Vérifiez le code reçu par e-mail (valable 10 minutes).",
        };
      }
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
  // Fil de RETOUR (ex. invitation à une formation) : re-validé, propagé dans le lien de
  // réinitialisation pour que le détour « mot de passe oublié » ne perde pas la page visée.
  const retour = cheminRetourSur(formData.get("retour"));

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
      const lien = avecRetour(`${baseUrl()}/reinitialiser-mot-de-passe?token=${token}`, retour);
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

  // Fil de RETOUR (ex. invitation à une formation) : re-validé, rendu à la page de connexion.
  const retour = cheminRetourSur(formData.get("retour"));

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
    await journaliserSecurite("mot_de_passe_reinitialise", {
      utilisateurId: resultat.utilisateurId,
      cible: `Utilisateur:${resultat.utilisateurId}`,
    });
  } catch (e) {
    console.error("[reset-apply] erreur :", e);
    return { ok: false, message: "Une erreur technique est survenue." };
  }

  redirect(avecRetour("/connexion?reinitialise=1", retour));
}
