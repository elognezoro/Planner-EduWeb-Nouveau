"use server";

/**
 * DÉLÉGATIONS de permissions Finance (97-RBAC : RM-2603/2604 ; 04-Profils « Délégation de
 * pouvoirs ») : octroi et révocation, réservés aux détenteurs de « finance.delegations.gerer »
 * (direction / admins). Fin OBLIGATOIRE — l'expiration s'évalue à la vérification
 * (commun/rbac.ts), jamais par cron ; la révocation est une annulation logique (RM-004).
 * Toute création/révocation est journalisée DANS la transaction (RM-2603).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { estPermissionFinance, type PermissionFinance } from "./commun/permissions";
import { dateFacultative, texteCourt } from "./commun/validation";

const CHEMIN = "/app/vie-scolaire/finances";
const JOUR_MS = 86_400_000;
/** Durée maximale d'une délégation (97 : permissions TEMPORAIRES — pas de droits perpétuels). */
const DUREE_MAX_JOURS = 366;

export async function accorderDelegation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.delegations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const beneficiaireId = texteCourt(fd.get("beneficiaireId"), 50);
  const beneficiaire = await prisma.utilisateur.findFirst({
    where: {
      id: beneficiaireId,
      etablissementId,
      statutCompte: "actif",
      // Moindre privilège : jamais de délégation financière aux rôles famille (élève/parent).
      roleActif: { nomTechnique: { notIn: ["eleve", "parent"] } },
    },
    select: { id: true, nom: true, prenoms: true },
  });
  if (!beneficiaire) {
    return { ok: false, message: "Bénéficiaire introuvable dans le personnel de cet établissement." };
  }
  if (beneficiaire.id === u.id) {
    return { ok: false, message: "Vous ne pouvez pas vous accorder une délégation à vous-même." };
  }

  // Sous-ensemble STRICT du registre (97 : permissions explicites, RM-2600).
  const permissions = [...new Set(fd.getAll("permissions").map((p) => String(p)))]
    .filter((p): p is PermissionFinance => estPermissionFinance(p));
  if (permissions.length === 0) {
    return { ok: false, message: "Cochez au moins une permission du registre." };
  }

  const motif = texteCourt(fd.get("motif"), 300);
  if (!motif) return { ok: false, message: "Le motif de la délégation est obligatoire." };
  const debut = dateFacultative(fd.get("debut")) ?? new Date();
  const fin = dateFacultative(fd.get("fin"));
  if (!fin) return { ok: false, message: "La date de fin est OBLIGATOIRE : jamais de délégation sans terme." };
  if (fin <= debut) return { ok: false, message: "La fin de la délégation doit suivre son début." };
  if (fin.getTime() - debut.getTime() > DUREE_MAX_JOURS * JOUR_MS) {
    return { ok: false, message: `Durée maximale d'une délégation : ${DUREE_MAX_JOURS} jours.` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.delegationFinance.create({
        data: {
          etablissementId, beneficiaireId: beneficiaire.id, accordeParId: u.id,
          permissions, motif, debut, fin,
        },
      });
      // RM-2603 : toute modification des droits est journalisée, DANS la transaction.
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "delegation.creation",
        entite: "DelegationFinance", entiteId: creee.id,
        nouvelleValeur: { beneficiaireId: beneficiaire.id, permissions, motif, debut, fin },
      });
    });
    revalidatePath(CHEMIN);
    const nomBeneficiaire = [beneficiaire.prenoms, beneficiaire.nom].filter(Boolean).join(" ");
    return {
      ok: true,
      message: `Délégation accordée à ${nomBeneficiaire} (${permissions.length} permission(s)) jusqu'au ${fin.toLocaleDateString("fr-FR")} — expiration automatique à cette date.`,
    };
  } catch (e) {
    console.error("[finances] délégation :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Révocation = annulation logique (97 : délégation révocable ; RM-004) — auditée. */
export async function revoquerDelegation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const d = await prisma.delegationFinance.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true },
  });
  if (!d) return { ok: false, message: "Délégation introuvable (déjà révoquée ?)." };
  const u = await exigerPermissionFinance(d.etablissementId, "finance.delegations.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.delegationFinance.findFirst({ where: { id } });
      const maj = await tx.delegationFinance.updateMany({
        where: { id, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: d.etablissementId, utilisateurId: u.id, action: "delegation.revocation",
        entite: "DelegationFinance", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Délégation révoquée — les droits correspondants cessent immédiatement." };
  } catch (e) {
    console.error("[finances] révocation délégation :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
