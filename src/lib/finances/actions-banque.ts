"use server";

/**
 * Actions serveur du sous-module BANQUE (10-Banque + 05B/02B) : comptes bancaires,
 * mouvements (dépôts issus des caisses — RM-600 —, retraits, virements internes en paire
 * liée, prélèvements, frais → OperationFinanciere cat. 63 (RM-604), intérêts → cat. 77
 * (RM-605)), registre des chèques (transitions historisées), pointage de rapprochement.
 *
 * TOUTES les écritures : garde granulaire (finance.banques.*, pointage =
 * finance.rapprochement.pointer — le comptable rapproche, 04), transaction +
 * journaliserFinance, verrouillage optimiste, annulations logiques. RM-601 : un compte
 * fermé/suspendu ne reçoit plus d'opérations. Pièce justificative OBLIGATOIRE (10).
 * Fichier "use server" : exports async uniquement (types dans banque/types.ts).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { montantValide, texteCourt } from "./commun/validation";
import { etablissementUtiliseCaisses } from "./caisse/serveur";
import { soldeCompte } from "./banque/serveur";
import {
  SEUIL_VALIDATION_BANCAIRE, TYPES_MOUVEMENT_BANCAIRE_SAISISSABLES, sensMouvementBancaire,
  type TypeMouvementBancaire,
} from "./banque/types";

const CHEMIN = "/app/vie-scolaire/finances";
const TYPES_COMPTE_VALIDES = new Set(["courant", "epargne", "mobile_money", "virtuel"]);
const STATUTS_COMPTE_VALIDES = new Set(["actif", "suspendu", "ferme"]);

function montantPositifOuNul(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? n : null;
}

/** Compte ACTIF requis pour toute opération (RM-601). */
async function compteOperable(compteId: string) {
  return prisma.compteBancaire.findFirst({
    where: { id: compteId, annuleLe: null },
    select: { id: true, etablissementId: true, nom: true, statut: true, soldeInitial: true, devise: true },
  });
}

// ─────────────────────────────────────────────────────────────
//  Comptes bancaires
// ─────────────────────────────────────────────────────────────

export async function enregistrerCompteBancaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.banques.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const nom = texteCourt(fd.get("nom"), 80);
  const banque = texteCourt(fd.get("banque"), 80);
  if (!nom || !banque) return { ok: false, message: "Le nom du compte et la banque sont obligatoires." };
  const type = texteCourt(fd.get("type"), 20);
  if (!TYPES_COMPTE_VALIDES.has(type)) return { ok: false, message: "Type de compte invalide." };
  const responsableIdBrut = texteCourt(fd.get("responsableId"), 50);
  const responsableId = responsableIdBrut
    ? (
        await prisma.utilisateur.findFirst({
          where: { id: responsableIdBrut, etablissementId, statutCompte: "actif" },
          select: { id: true },
        })
      )?.id ?? null
    : null;
  const soldeInitial = montantPositifOuNul(fd.get("soldeInitial"));
  const donnees = {
    nom, banque, type,
    code: texteCourt(fd.get("code"), 20) || null,
    agence: texteCourt(fd.get("agence"), 80) || null,
    numeroCompte: texteCourt(fd.get("numeroCompte"), 40) || null,
    iban: texteCourt(fd.get("iban"), 40) || null,
    swift: texteCourt(fd.get("swift"), 20) || null,
    responsableId,
    seuilAlerte: montantValide(fd.get("seuilAlerte")),
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.compteBancaire.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        // Le solde initial ne se modifie plus après création (le suivi part de là).
        const maj = await tx.compteBancaire.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "compte_bancaire.modification",
          entite: "CompteBancaire", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Compte introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.compteBancaire.create({
          data: { etablissementId, ...donnees, soldeInitial: soldeInitial ?? 0, dateOuverture: new Date() },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "compte_bancaire.creation",
          entite: "CompteBancaire", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Compte bancaire mis à jour." : "Compte bancaire créé." };
  } catch (e) {
    console.error("[banque] compte :", e);
    return { ok: false, message: "Un compte actif porte peut-être déjà ce nom." };
  }
}

export async function changerStatutCompte(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const cible = texteCourt(fd.get("statut"), 20);
  if (!STATUTS_COMPTE_VALIDES.has(cible)) return { ok: false, message: "Statut invalide." };
  const c = await prisma.compteBancaire.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, statut: true, nom: true },
  });
  if (!c) return { ok: false, message: "Compte introuvable." };
  const u = await exigerPermissionFinance(c.etablissementId, "finance.banques.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.compteBancaire.updateMany({
        where: { id, version, annuleLe: null },
        data: {
          statut: cible,
          ...(cible === "ferme" ? { dateFermeture: new Date() } : {}),
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: c.etablissementId, utilisateurId: u.id, action: "compte_bancaire.statut",
        entite: "CompteBancaire", entiteId: id,
        ancienneValeur: { statut: c.statut }, nouvelleValeur: { statut: cible },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Compte « ${c.nom} » : statut « ${cible} » (RM-601 : un compte fermé ne reçoit plus d'opérations).` };
  } catch (e) {
    console.error("[banque] statut compte :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerCompteBancaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const c = await prisma.compteBancaire.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, nom: true },
  });
  if (!c) return { ok: false, message: "Compte introuvable." };
  const u = await exigerPermissionFinance(c.etablissementId, "finance.banques.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.compteBancaire.findFirst({ where: { id } });
      const maj = await tx.compteBancaire.updateMany({
        where: { id, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: c.etablissementId, utilisateurId: u.id, action: "compte_bancaire.annulation",
        entite: "CompteBancaire", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Compte « ${c.nom} » archivé (l'historique de ses mouvements est conservé).` };
  } catch (e) {
    console.error("[banque] retrait compte :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Mouvements bancaires
// ─────────────────────────────────────────────────────────────

export async function enregistrerMouvementBancaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const compteId = texteCourt(fd.get("compteId"), 50);
  const compte = await compteOperable(compteId);
  if (!compte) return { ok: false, message: "Compte introuvable." };
  if (compte.statut !== "actif") return { ok: false, message: "Compte fermé ou suspendu : plus d'opérations (RM-601)." };
  const u = await exigerPermissionFinance(compte.etablissementId, "finance.banques.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const type = texteCourt(fd.get("type"), 40) as TypeMouvementBancaire;
  if (!TYPES_MOUVEMENT_BANCAIRE_SAISISSABLES.includes(type)) return { ok: false, message: "Type de mouvement invalide." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const libelle = texteCourt(fd.get("libelle"), 200);
  if (!libelle) return { ok: false, message: "Le libellé est obligatoire." };
  // 10 : « Aucune opération bancaire ne peut exister sans pièce justificative. »
  const pieceJustificative = texteCourt(fd.get("pieceJustificative"), 120);
  if (!pieceJustificative) return { ok: false, message: "La pièce justificative est OBLIGATOIRE (référence du bordereau, avis, relevé…)." };

  // RM-600 : un DÉPÔT provient d'une caisse ou d'une autre banque — si l'établissement
  // utilise des caisses, le dépôt manuel est refusé (passer par la confirmation de versement).
  if (type === "depot" && (await etablissementUtiliseCaisses(prisma, compte.etablissementId))) {
    return { ok: false, message: "RM-600 : les dépôts proviennent des caisses — confirmez le versement de caisse correspondant (bloc « Versements en attente »)." };
  }

  // Validation hiérarchique des SORTIES au-delà du seuil (10 — V1 : permission supérieure).
  const sens = sensMouvementBancaire(type);
  let valideParId: string | null = null;
  if (sens < 0 && montant > SEUIL_VALIDATION_BANCAIRE) {
    const validateur = await exigerPermissionFinance(compte.etablissementId, "finance.banques.gerer");
    if (!validateur) {
      return { ok: false, message: `Sortie supérieure à ${SEUIL_VALIDATION_BANCAIRE.toLocaleString("fr-FR")} F : validation hiérarchique requise (gestion des comptes).` };
    }
    valideParId = validateur.id;
  }

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (sens < 0) {
        const solde = await soldeCompte(tx, compteId, compte.soldeInitial);
        if (solde - montant < 0) {
          return { statut: "solde" as const, solde };
        }
      }
      const maintenant = new Date();
      const mouvement = await tx.mouvementBancaire.create({
        data: {
          etablissementId: compte.etablissementId, compteId, type, montant, libelle,
          reference: texteCourt(fd.get("reference"), 80) || null,
          pieceJustificative,
          beneficiaire: texteCourt(fd.get("beneficiaire"), 120) || null,
          saisiParId: u.id, valideParId, dateComptable: maintenant,
        },
      });
      // RM-604/605 : frais et intérêts sont COMPTABILISÉS automatiquement au journal OHADA.
      if (type === "frais_bancaires" || type === "interets") {
        const operation = await tx.operationFinanciere.create({
          data: {
            etablissementId: compte.etablissementId,
            sens: type === "interets" ? "recette" : "depense",
            categorie: type === "interets" ? "77" : "63",
            libelle: `${type === "interets" ? "Intérêts créditeurs" : "Frais bancaires"} — ${compte.nom} : ${libelle}`,
            montant, mode: "virement",
            reference: pieceJustificative,
            date: maintenant, dateComptable: maintenant, saisiParId: u.id,
          },
        });
        await tx.mouvementBancaire.updateMany({ where: { id: mouvement.id }, data: { operationId: operation.id } });
      }
      await journaliserFinance(tx, {
        etablissementId: compte.etablissementId, utilisateurId: u.id, action: "banque.mouvement",
        entite: "MouvementBancaire", entiteId: mouvement.id, nouvelleValeur: mouvement,
      });
      return { statut: "ok" as const };
    });
    if (resultat.statut === "solde") {
      return { ok: false, message: `Solde insuffisant : ${resultat.solde.toLocaleString("fr-FR")} F sur « ${compte.nom} ».` };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: `Mouvement enregistré sur « ${compte.nom} » — solde recalculé.` };
  } catch (e) {
    console.error("[banque] mouvement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** CONFIRMATION d'un versement de caisse (09 → 10, RM-600) : crée le dépôt bancaire lié. */
export async function confirmerVersementCaisse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const mouvementCaisseId = texteCourt(fd.get("mouvementCaisseId"), 50);
  const compteId = texteCourt(fd.get("compteId"), 50);
  const versement = await prisma.mouvementCaisse.findFirst({
    where: { id: mouvementCaisseId, type: "versement_banque", annuleLe: null },
    select: {
      etablissementId: true, montant: true, motif: true,
      session: { select: { caisse: { select: { nom: true } } } },
    },
  });
  if (!versement) return { ok: false, message: "Versement de caisse introuvable." };
  const compte = await compteOperable(compteId);
  if (!compte || compte.etablissementId !== versement.etablissementId) {
    return { ok: false, message: "Compte bancaire introuvable." };
  }
  if (compte.statut !== "actif") return { ok: false, message: "Compte fermé ou suspendu : plus d'opérations (RM-601)." };
  const u = await exigerPermissionFinance(compte.etablissementId, "finance.banques.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const pieceJustificative = texteCourt(fd.get("pieceJustificative"), 120);
  if (!pieceJustificative) return { ok: false, message: "La pièce justificative est OBLIGATOIRE (bordereau de versement)." };

  try {
    await prisma.$transaction(async (tx) => {
      const maintenant = new Date();
      // L'index unique partiel garantit qu'un versement n'est confirmé qu'UNE fois.
      const depot = await tx.mouvementBancaire.create({
        data: {
          etablissementId: compte.etablissementId, compteId, type: "depot",
          montant: versement.montant,
          libelle: `Versement de la caisse « ${versement.session.caisse.nom} »`,
          pieceJustificative, mouvementCaisseId,
          saisiParId: u.id, dateComptable: maintenant,
        },
      });
      await journaliserFinance(tx, {
        etablissementId: compte.etablissementId, utilisateurId: u.id, action: "banque.depot_caisse",
        entite: "MouvementBancaire", entiteId: depot.id,
        nouvelleValeur: { mouvementCaisseId, compte: compte.nom, montant: versement.montant },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Versement de ${versement.montant.toLocaleString("fr-FR")} F confirmé sur « ${compte.nom} » (RM-600).` };
  } catch (e) {
    console.error("[banque] confirmation versement :", e);
    return { ok: false, message: "Ce versement est peut-être déjà confirmé en banque." };
  }
}

/** VIREMENT INTERNE (10) : une action → débit + crédit liés (paire, même transaction). */
export async function virementInterneBancaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const compteSourceId = texteCourt(fd.get("compteSourceId"), 50);
  const compteCibleId = texteCourt(fd.get("compteCibleId"), 50);
  if (compteSourceId === compteCibleId) return { ok: false, message: "Choisissez deux comptes différents." };
  const [source, cible] = await Promise.all([compteOperable(compteSourceId), compteOperable(compteCibleId)]);
  if (!source || !cible || source.etablissementId !== cible.etablissementId) {
    return { ok: false, message: "Comptes introuvables." };
  }
  if (source.statut !== "actif" || cible.statut !== "actif") {
    return { ok: false, message: "Compte fermé ou suspendu : plus d'opérations (RM-601)." };
  }
  if (source.devise !== cible.devise) {
    return { ok: false, message: "Devise incompatible entre les deux comptes (conversions : spécification suivante)." };
  }
  const u = await exigerPermissionFinance(source.etablissementId, "finance.banques.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const pieceJustificative = texteCourt(fd.get("pieceJustificative"), 120);
  if (!pieceJustificative) return { ok: false, message: "La pièce justificative est OBLIGATOIRE (ordre de virement)." };
  let valideParId: string | null = null;
  if (montant > SEUIL_VALIDATION_BANCAIRE) {
    const validateur = await exigerPermissionFinance(source.etablissementId, "finance.banques.gerer");
    if (!validateur) {
      return { ok: false, message: `Virement supérieur à ${SEUIL_VALIDATION_BANCAIRE.toLocaleString("fr-FR")} F : validation hiérarchique requise.` };
    }
    valideParId = validateur.id;
  }

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const solde = await soldeCompte(tx, compteSourceId, source.soldeInitial);
      if (solde - montant < 0) return { statut: "solde" as const, solde };
      const maintenant = new Date();
      const libelle = texteCourt(fd.get("libelle"), 200) || "Virement interne";
      const sortie = await tx.mouvementBancaire.create({
        data: {
          etablissementId: source.etablissementId, compteId: compteSourceId,
          type: "virement_interne_sortie", montant,
          libelle: `${libelle} → ${cible.nom}`, pieceJustificative,
          saisiParId: u.id, valideParId, dateComptable: maintenant,
        },
      });
      const entree = await tx.mouvementBancaire.create({
        data: {
          etablissementId: source.etablissementId, compteId: compteCibleId,
          type: "virement_interne_entree", montant,
          libelle: `${libelle} ← ${source.nom}`, pieceJustificative,
          lieMouvementId: sortie.id, saisiParId: u.id, valideParId, dateComptable: maintenant,
        },
      });
      await tx.mouvementBancaire.updateMany({ where: { id: sortie.id }, data: { lieMouvementId: entree.id } });
      await journaliserFinance(tx, {
        etablissementId: source.etablissementId, utilisateurId: u.id, action: "banque.virement_interne",
        entite: "MouvementBancaire", entiteId: sortie.id,
        nouvelleValeur: { montant, source: source.nom, cible: cible.nom, pieceJustificative },
      });
      return { statut: "ok" as const };
    });
    if (resultat.statut === "solde") {
      return { ok: false, message: `Solde insuffisant : ${resultat.solde.toLocaleString("fr-FR")} F sur « ${source.nom} ».` };
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: `Virement interne de ${montant.toLocaleString("fr-FR")} F : « ${source.nom} » → « ${cible.nom} » (paire liée).` };
  } catch (e) {
    console.error("[banque] virement interne :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Annulation LOGIQUE d'un mouvement (miroir et opération comptable liée inclus). */
export async function annulerMouvementBancaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const m = await prisma.mouvementBancaire.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, lieMouvementId: true, operationId: true, pointeLe: true },
  });
  if (!m) return { ok: false, message: "Mouvement introuvable (déjà annulé ?)." };
  if (m.pointeLe) return { ok: false, message: "Mouvement déjà RAPPROCHÉ : dépointez-le avant toute annulation." };
  const u = await exigerPermissionFinance(m.etablissementId, "finance.banques.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.mouvementBancaire.findFirst({ where: { id } });
      const maj = await tx.mouvementBancaire.updateMany({
        where: { id, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      // Virement interne : le miroir est annulé AVEC (refus s'il est déjà rapproché).
      if (m.lieMouvementId) {
        const miroir = await tx.mouvementBancaire.findFirst({
          where: { id: m.lieMouvementId, annuleLe: null },
          select: { id: true, pointeLe: true },
        });
        if (miroir?.pointeLe) return "miroir" as const;
        if (miroir) {
          await tx.mouvementBancaire.updateMany({
            where: { id: miroir.id, annuleLe: null },
            data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
          });
        }
      }
      // Frais/intérêts : l'OperationFinanciere liée est annulée aussi (cohérence comptable).
      if (m.operationId) {
        await tx.operationFinanciere.updateMany({
          where: { id: m.operationId, annule: false },
          data: {
            annule: true, motifAnnulation: "Mouvement bancaire annulé",
            annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 },
          },
        });
      }
      await journaliserFinance(tx, {
        etablissementId: m.etablissementId, utilisateurId: u.id, action: "banque.mouvement_annulation",
        entite: "MouvementBancaire", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "miroir") return { ok: false, message: "Le mouvement miroir du virement est déjà rapproché : dépointez-le d'abord." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Mouvement annulé — solde recalculé." };
  } catch (e) {
    console.error("[banque] annulation mouvement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Pointage de rapprochement d'un mouvement bancaire (le comptable rapproche — 04). */
export async function basculerPointageMouvementBancaire(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const m = await prisma.mouvementBancaire.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, pointeLe: true },
  });
  if (!m) return { ok: false, message: "Mouvement introuvable." };
  const u = await exigerPermissionFinance(m.etablissementId, "finance.rapprochement.pointer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const pointeLe = m.pointeLe ? null : new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.mouvementBancaire.updateMany({ where: { id }, data: { pointeLe } });
      await journaliserFinance(tx, {
        etablissementId: m.etablissementId, utilisateurId: u.id,
        action: pointeLe ? "banque.pointage" : "banque.depointage",
        entite: "MouvementBancaire", entiteId: id,
        ancienneValeur: { pointeLe: m.pointeLe }, nouvelleValeur: { pointeLe },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: pointeLe ? "Mouvement pointé sur le relevé." : "Pointage retiré." };
  } catch (e) {
    console.error("[banque] pointage :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Registre des chèques
// ─────────────────────────────────────────────────────────────

export async function enregistrerCheque(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.banques.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const sens = texteCourt(fd.get("sens"), 10) === "emis" ? "emis" : "recu";
  const numero = texteCourt(fd.get("numero"), 40);
  if (!numero) return { ok: false, message: "Le numéro du chèque est obligatoire." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const compteIdBrut = texteCourt(fd.get("compteId"), 50);
  const compteId = compteIdBrut
    ? (await prisma.compteBancaire.findFirst({ where: { id: compteIdBrut, etablissementId, annuleLe: null }, select: { id: true } }))?.id ?? null
    : null;

  try {
    await prisma.$transaction(async (tx) => {
      const cree = await tx.cheque.create({
        data: {
          etablissementId, compteId, sens, numero, montant,
          banque: texteCourt(fd.get("banque"), 80) || null,
          emetteur: texteCourt(fd.get("emetteur"), 120) || null,
          beneficiaire: texteCourt(fd.get("beneficiaire"), 120) || null,
          dateComptable: new Date(),
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "cheque.creation",
        entite: "Cheque", entiteId: cree.id, nouvelleValeur: cree,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Chèque ${sens === "emis" ? "émis" : "reçu"} n° ${numero} enregistré (en circulation).` };
  } catch (e) {
    console.error("[banque] chèque :", e);
    return { ok: false, message: "Un chèque actif porte peut-être déjà ce numéro." };
  }
}

/**
 * Transition d'un chèque EN CIRCULATION : « encaisse » (mouvement bancaire lié créé — dépôt
 * pour un chèque reçu, retrait pour un chèque émis débité), « rejete » ou « annule »
 * (motif obligatoire). Transitions historisées (10).
 */
export async function changerStatutCheque(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const cible = texteCourt(fd.get("statut"), 20);
  if (!["encaisse", "rejete", "annule"].includes(cible)) return { ok: false, message: "Statut de chèque invalide." };
  const cheque = await prisma.cheque.findFirst({
    where: { id, annuleLe: null },
    select: {
      etablissementId: true, sens: true, numero: true, montant: true, statut: true,
      banque: true, emetteur: true, beneficiaire: true, paiementId: true, compteId: true,
    },
  });
  if (!cheque) return { ok: false, message: "Chèque introuvable." };
  if (cheque.statut !== "en_circulation") return { ok: false, message: "Seul un chèque EN CIRCULATION peut changer d'état." };
  const u = await exigerPermissionFinance(cheque.etablissementId, "finance.banques.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const motif = texteCourt(fd.get("motif"), 300);
  if ((cible === "rejete" || cible === "annule") && !motif) {
    return { ok: false, message: "Le motif est obligatoire pour un rejet ou une annulation." };
  }

  // Encaissement : un compte bancaire ACTIF est requis (le mouvement y est créé).
  let compte: Awaited<ReturnType<typeof compteOperable>> = null;
  if (cible === "encaisse") {
    const compteId = texteCourt(fd.get("compteId"), 50) || cheque.compteId || "";
    compte = compteId ? await compteOperable(compteId) : null;
    if (!compte || compte.etablissementId !== cheque.etablissementId || compte.statut !== "actif") {
      return { ok: false, message: "Choisissez un compte bancaire ACTIF pour encaisser ce chèque." };
    }
  }

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.cheque.updateMany({
        where: { id, version, statut: "en_circulation", annuleLe: null },
        data: {
          statut: cible,
          motifStatut: motif || null,
          ...(cible === "annule" ? { annuleLe: new Date(), annuleParId: u.id } : {}),
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return "conflit" as const;
      if (cible === "encaisse" && compte) {
        // Chèque reçu → DÉPÔT (pièce = le chèque) ; chèque émis débité → RETRAIT.
        if (cheque.sens === "emis") {
          const solde = await soldeCompte(tx, compte.id, compte.soldeInitial);
          if (solde - cheque.montant < 0) return "solde" as const;
        }
        const mouvement = await tx.mouvementBancaire.create({
          data: {
            etablissementId: cheque.etablissementId, compteId: compte.id,
            type: cheque.sens === "recu" ? "depot" : "retrait",
            montant: cheque.montant,
            libelle: `Chèque ${cheque.sens === "recu" ? "reçu" : "émis"} n° ${cheque.numero}${cheque.emetteur ? ` — ${cheque.emetteur}` : ""}${cheque.beneficiaire ? ` — ${cheque.beneficiaire}` : ""}`,
            pieceJustificative: `Chèque n° ${cheque.numero}${cheque.banque ? ` (${cheque.banque})` : ""}`,
            chequeId: id, saisiParId: u.id, dateComptable: new Date(),
          },
        });
        await tx.cheque.updateMany({ where: { id }, data: { compteId: compte.id } });
        await journaliserFinance(tx, {
          etablissementId: cheque.etablissementId, utilisateurId: u.id, action: "banque.mouvement",
          entite: "MouvementBancaire", entiteId: mouvement.id, nouvelleValeur: mouvement,
        });
      }
      await journaliserFinance(tx, {
        etablissementId: cheque.etablissementId, utilisateurId: u.id,
        action: cible === "encaisse" ? "cheque.encaissement" : cible === "rejete" ? "cheque.rejet" : "cheque.annulation",
        entite: "Cheque", entiteId: id,
        ancienneValeur: { statut: "en_circulation" }, nouvelleValeur: { statut: cible, motif: motif || null },
      });
      return "ok" as const;
    });
    if (resultat === "solde") return { ok: false, message: "Solde insuffisant sur le compte pour débiter ce chèque émis." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    const suffixe =
      cible === "rejete" && cheque.sens === "recu" && cheque.paiementId
        ? " Pensez à ANNULER le paiement de scolarité correspondant (motif : chèque rejeté)."
        : "";
    return { ok: true, message: `Chèque n° ${cheque.numero} : ${cible === "encaisse" ? "encaissé" : cible === "rejete" ? "rejeté" : "annulé"}.${suffixe}` };
  } catch (e) {
    console.error("[banque] statut chèque :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
