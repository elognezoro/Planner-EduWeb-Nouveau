import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { creerNotification } from "@/lib/notifications/creer";
import type { UtilisateurCourant } from "@/lib/auth/session";

/**
 * Rabais de l'Académie Premium — habilitation et instruction des demandes.
 *
 * Qui instruit ? L'ADMIN SYSTÈME, ou tout utilisateur dont l'e-mail figure dans
 * `Configuration.emailsHabilitesRabais` (habilitation expresse donnée par l'admin).
 * Ces mêmes personnes sont les seules à voir la rubrique « Réductions disponibles ».
 *
 * À l'approbation : le taux accordé provient d'un code prédéfini OU du champ d'incrément
 * (taux personnalisé) → un code dédié unique est alors généré. Le demandeur est notifié
 * avec le LIEN DE PAIEMENT pré-appliquant le code (donc le taux accordé).
 */

export const LIEN_PREMIUM = "/app/vie-scolaire/academie-premium";

/** Liste normalisée (minuscules) des e-mails habilités à instruire les rabais. */
export async function lireHabilitesRabais(): Promise<string[]> {
  try {
    const cfg = await prisma.configuration.findUnique({
      where: { id: "global" },
      select: { emailsHabilitesRabais: true },
    });
    return (cfg?.emailsHabilitesRabais ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));
  } catch (e) {
    console.error("[rabais] lecture habilités :", e);
    return [];
  }
}

/** L'utilisateur peut-il voir les réductions et instruire les demandes de rabais ? */
export async function estHabiliteRabais(u: UtilisateurCourant | null): Promise<boolean> {
  if (!u || u.apercuActif) return false;
  if (u.roleReel === "admin") return true;
  const habilites = await lireHabilitesRabais();
  return habilites.includes(u.email.toLowerCase());
}

function nomDe(p: { prenoms: string | null; nom: string | null; email: string }): string {
  return [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || p.email;
}

async function journaliser(acteur: UtilisateurCourant, action: string, cible: string, details: object) {
  try {
    await prisma.journalActivite.create({
      data: { utilisateurId: acteur.id, acteurEmail: acteur.email, action, cible, details: details as never },
    });
  } catch (e) {
    console.error("[journal] non écrit :", e);
  }
}

export interface ResultatInstruction {
  ok: boolean;
  message?: string;
}

/**
 * Instruit une demande de rabais (approbation / refus). À l'approbation, le taux retenu est,
 * dans l'ordre : le code prédéfini choisi > le taux personnalisé (champ d'incrément) > le taux
 * demandé. Sans code prédéfini, un CODE DÉDIÉ unique est créé au taux accordé. Le demandeur est
 * notifié avec le lien de paiement pré-appliquant le code.
 */
export async function instruireDemandePromo(opts: {
  acteur: UtilisateurCourant;
  demandeId: string;
  approuver: boolean;
  code?: string | null;
  taux?: number | null;
}): Promise<ResultatInstruction> {
  const demande = await prisma.demandeCodePromo.findUnique({
    where: { id: opts.demandeId },
    include: { demandeur: { select: { prenoms: true, nom: true, email: true } } },
  });
  if (!demande || demande.statut !== "en_attente") {
    return { ok: false, message: "Demande introuvable ou déjà traitée." };
  }

  // ── Refus ──
  if (!opts.approuver) {
    await prisma.demandeCodePromo.update({
      where: { id: demande.id },
      data: { statut: "refusee", traiteLe: new Date() },
    });
    await journaliser(opts.acteur, "demande_promo.refusee", `DemandeCodePromo:${demande.id}`, {
      demandeur: demande.demandeur.email,
    });
    await creerNotification({
      destinataireId: demande.demandeurId,
      type: "alerte",
      titre: "Demande de rabais refusée",
      message:
        "Votre demande de rabais n'a pas été retenue. Vous pouvez souscrire au tarif en vigueur ou déposer une nouvelle demande.",
      lien: LIEN_PREMIUM,
    });
    return { ok: true, message: "Demande refusée — le demandeur a été notifié." };
  }

  // ── Approbation : code prédéfini choisi, sinon taux personnalisé / demandé → code dédié ──
  let codePromo: { id: string; code: string; pourcentage: number } | null = null;
  if (opts.code) {
    const existant = await prisma.codePromo.findUnique({ where: { code: opts.code.trim().toUpperCase() } });
    if (!existant || !existant.actif) return { ok: false, message: "Code promo introuvable ou inactif." };
    codePromo = existant;
  } else {
    const brut = opts.taux ?? demande.tauxDemande;
    const taux = Number(brut);
    if (!Number.isFinite(taux) || taux < 1 || taux > 100) {
      return { ok: false, message: "Choisissez un code prédéfini ou fixez le taux de rabais accordé (1–100 %)." };
    }
    const pourcentage = Math.round(taux);
    // Code dédié unique (retente en cas de collision improbable du suffixe).
    for (let essai = 0; essai < 4 && !codePromo; essai++) {
      const suffixe = randomBytes(2).toString("hex").toUpperCase();
      try {
        codePromo = await prisma.codePromo.create({
          data: {
            code: `RABAIS${pourcentage}-${suffixe}`,
            libelle: `Rabais accordé — ${nomDe(demande.demandeur)}`,
            pourcentage,
          },
        });
      } catch {
        /* collision de code : nouveau suffixe */
      }
    }
    if (!codePromo) return { ok: false, message: "Impossible de générer le code dédié — réessayez." };
  }

  await prisma.demandeCodePromo.update({
    where: { id: demande.id },
    data: { statut: "approuvee", codeAttribue: codePromo.code, tauxAccorde: codePromo.pourcentage, traiteLe: new Date() },
  });
  await journaliser(opts.acteur, "demande_promo.approuvee", `DemandeCodePromo:${demande.id}`, {
    demandeur: demande.demandeur.email,
    code: codePromo.code,
    pourcentage: codePromo.pourcentage,
  });

  // Lien de paiement : la page Académie Premium pré-applique le code (donc le taux accordé).
  const lienPaiement = `${LIEN_PREMIUM}?code=${encodeURIComponent(codePromo.code)}`;
  await creerNotification({
    destinataireId: demande.demandeurId,
    type: "succes",
    titre: `Rabais de ${codePromo.pourcentage} % accordé`,
    message: `Votre demande de rabais a été approuvée (code « ${codePromo.code} », −${codePromo.pourcentage} %). Ouvrez le lien de paiement pour souscrire au tarif réduit.`,
    lien: lienPaiement,
  });
  return { ok: true, message: `Rabais de ${codePromo.pourcentage} % accordé — le demandeur a reçu le lien de paiement.` };
}
