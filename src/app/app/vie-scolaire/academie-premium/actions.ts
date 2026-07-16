"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant, type UtilisateurCourant } from "@/lib/auth/session";
import { creerNotification, creerNotifications } from "@/lib/notifications/creer";
import { FORMULES, type FormuleId } from "@/lib/premium/formules";
import { estHabiliteRabais, instruireDemandePromo, lireHabilitesRabais } from "@/lib/premium/rabais";

export interface EtatForm {
  ok: boolean;
  message?: string;
}
export interface EtatCode {
  ok: boolean;
  message?: string;
  code?: string;
  libelle?: string;
  pourcentage?: number;
}

const BASE = "/app/vie-scolaire/academie-premium";
const MODES = ["carte", "wave", "orange", "mtn", "moov"] as const;
const ROLES_SOUSCRIPTION = ["admin", "etablissements_admin", "chef_etablissement"];

function peutSouscrire(u: UtilisateurCourant): boolean {
  return !u.apercuActif && ROLES_SOUSCRIPTION.includes(u.roleReel);
}

/** Valide un code promo et renvoie sa remise (appelé à l'application du code). */
export async function appliquerCode(code: string): Promise<EtatCode> {
  const propre = code.trim().toUpperCase();
  if (!propre) return { ok: false, message: "Saisissez un code." };
  const cp = await prisma.codePromo.findFirst({ where: { code: propre, actif: true } });
  if (!cp) return { ok: false, message: "Code promo invalide ou expiré." };
  return { ok: true, code: cp.code, libelle: cp.libelle, pourcentage: cp.pourcentage };
}

export async function souscrire(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!peutSouscrire(u)) {
    return { ok: false, message: "Souscription réservée aux responsables d'établissement." };
  }

  const formule = String(formData.get("formule") ?? "") as FormuleId;
  const modePaiement = String(formData.get("modePaiement") ?? "carte") as (typeof MODES)[number];
  const code = String(formData.get("code") ?? "").trim().toUpperCase() || null;
  let etablissementId = String(formData.get("etablissementId") ?? "").trim() || null;

  if (!FORMULES[formule]) return { ok: false, message: "Formule invalide." };
  if (!MODES.includes(modePaiement)) return { ok: false, message: "Moyen de paiement invalide." };

  // Résolution / contrôle de l'établissement selon le rôle.
  if (u.roleReel === "chef_etablissement" || u.roleReel === "etablissements_admin") {
    if (!u.portee.etablissementId) return { ok: false, message: "Aucun établissement rattaché à votre compte." };
    etablissementId = u.portee.etablissementId;
  } else if (u.roleReel === "admin") {
    if (!etablissementId) return { ok: false, message: "Choisissez un établissement." };
  }

  const base = FORMULES[formule].fcfa;
  let pourcentage = 0;
  let codePromoId: string | null = null;
  if (code) {
    const cp = await prisma.codePromo.findFirst({ where: { code, actif: true } });
    if (!cp) return { ok: false, message: "Code promo invalide." };
    pourcentage = cp.pourcentage;
    codePromoId = cp.id;
  }
  const montantFinal = Math.round(base * (1 - pourcentage / 100));

  try {
    const dateFin = new Date();
    dateFin.setFullYear(dateFin.getFullYear() + 1);
    await prisma.abonnementPremium.create({
      data: {
        etablissementId,
        souscritParId: u.id,
        formule,
        montantBase: base,
        codePromoId,
        pourcentageReduction: pourcentage,
        montantFinal,
        modePaiement,
        statut: "actif", // mode démo : paiement simulé réussi
        dateFin,
      },
    });
    await creerNotification({
      destinataireId: u.id,
      type: "succes",
      titre: "Académie Premium activée",
      message: `Votre abonnement « ${FORMULES[formule].libelle} » est actif (paiement simulé en mode démo).`,
      lien: BASE,
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[premium] souscription :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Paiement confirmé (démo) — abonnement Premium activé." };
}

export async function demanderCode(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif) return { ok: false, message: "Action non autorisée en mode aperçu." };

  const etablissementNom = String(formData.get("etablissementNom") ?? "").trim() || null;
  const motif = String(formData.get("motif") ?? "").trim();
  if (!motif) return { ok: false, message: "Précisez le motif de votre demande." };
  // Expression du taux de rabais souhaité (facultative côté serveur, bornée 1–100 %).
  const tauxBrut = String(formData.get("taux") ?? "").trim();
  let tauxDemande: number | null = null;
  if (tauxBrut) {
    const t = Number(tauxBrut);
    if (!Number.isFinite(t) || t < 1 || t > 100) {
      return { ok: false, message: "Taux de rabais invalide (entre 1 et 100 %)." };
    }
    tauxDemande = Math.round(t);
  }

  try {
    await prisma.demandeCodePromo.create({ data: { demandeurId: u.id, etablissementNom, motif, tauxDemande } });
    // Notifie l'admin système ET les utilisateurs expressément habilités à instruire.
    const habilites = await lireHabilitesRabais();
    const destinataires = await prisma.utilisateur.findMany({
      where: {
        OR: [
          { roleActif: { nomTechnique: "admin" } },
          ...(habilites.length > 0 ? [{ email: { in: habilites, mode: "insensitive" as const } }] : []),
        ],
      },
      select: { id: true },
    });
    await creerNotifications(
      destinataires.map((a) => a.id),
      {
        type: "info",
        titre: "Demande de rabais Premium",
        message: `${u.nomComplet} demande un rabais${tauxDemande != null ? ` de ${tauxDemande} %` : ""} sur l'Académie Premium.`,
        lien: BASE,
      },
    );
    revalidatePath(BASE);
  } catch (e) {
    console.error("[premium] demande code :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return { ok: true, message: "Demande envoyée. Elle sera instruite et vous serez notifié de la décision." };
}

// ── Administration des codes promo ──

export async function genererCode(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur." };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const libelle = String(formData.get("libelle") ?? "").trim();
  const pourcentage = Number(String(formData.get("pourcentage") ?? "").trim());
  const partenaire = formData.get("partenaire") === "on";

  if (!code) return { ok: false, message: "Le code est obligatoire." };
  if (!libelle) return { ok: false, message: "Le libellé est obligatoire." };
  if (!Number.isFinite(pourcentage) || pourcentage < 0 || pourcentage > 100) {
    return { ok: false, message: "Pourcentage invalide (0–100)." };
  }
  try {
    await prisma.codePromo.create({ data: { code, libelle, pourcentage, partenaire } });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[premium] génération code :", e);
    return { ok: false, message: "Erreur (code déjà existant ?)." };
  }
  return { ok: true, message: `Code ${code} créé.` };
}

/**
 * Instruit une demande de rabais depuis le bloc « Demandes en attente » de la page.
 * Ouvert à l'ADMIN SYSTÈME et aux utilisateurs expressément HABILITÉS. À l'approbation,
 * `code` (prédéfini) prime, sinon `taux` (champ d'incrément), sinon le taux demandé.
 */
export async function traiterDemandePromo(
  demandeId: string,
  approuver: boolean,
  options?: { code?: string; taux?: number },
): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (!(await estHabiliteRabais(u))) {
    return { ok: false, message: "Action réservée à l'administrateur ou aux utilisateurs habilités." };
  }

  try {
    const r = await instruireDemandePromo({
      acteur: u,
      demandeId,
      approuver,
      code: options?.code || null,
      taux: options?.taux ?? null,
    });
    revalidatePath(BASE);
    revalidatePath("/app/systeme/approbations-promo");
    return r;
  } catch (e) {
    console.error("[premium] traitement demande :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/**
 * Enregistre la liste des e-mails HABILITÉS à voir les réductions et instruire les rabais
 * (en plus de l'admin système) — réservé à l'admin système.
 */
export async function enregistrerHabilitesRabais(_prev: EtatForm, formData: FormData): Promise<EtatForm> {
  const u = await getUtilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  if (u.apercuActif || u.roleReel !== "admin") return { ok: false, message: "Action réservée à l'administrateur." };

  // Normalisation : e-mails séparés par virgules / points-virgules / retours à la ligne.
  const brut = String(formData.get("emails") ?? "");
  const emails = [...new Set(
    brut.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")),
  )];

  try {
    await prisma.configuration.upsert({
      where: { id: "global" },
      update: { emailsHabilitesRabais: emails.join("\n") || null },
      create: { id: "global", emailsHabilitesRabais: emails.join("\n") || null },
    });
    revalidatePath(BASE);
  } catch (e) {
    console.error("[premium] habilités rabais :", e);
    return { ok: false, message: "Erreur technique." };
  }
  return {
    ok: true,
    message: emails.length > 0
      ? `${emails.length} utilisateur(s) habilité(s) à instruire les rabais.`
      : "Liste vidée — seul l'admin système instruit les rabais.",
  };
}
