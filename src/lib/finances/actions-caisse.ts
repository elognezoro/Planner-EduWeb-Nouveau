"use server";

/**
 * Actions serveur du sous-module CAISSE (09-Caisse + 05B/02B) : paramétrage des caisses,
 * sessions (ouverture → mouvements → comptage → clôture), écarts validés par un SECOND
 * acteur (séparation des responsabilités), mouvements internes avec seuils d'autorisation,
 * transferts entre caisses (paire liée).
 *
 * TOUTES les écritures : garde granulaire exigerPermissionFinance (permissions
 * finance.caisses.*), transaction + journaliserFinance, verrouillage optimiste,
 * annulations logiques. RM-500→505 respectées ; « ouverte/fermée » d'une caisse est DÉRIVÉ
 * (jamais stocké). Fichier "use server" : exports async uniquement (types dans caisse/types.ts).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
import { exigerPermissionFinance } from "./commun/rbac";
import { MESSAGE_SEPARATION_RESPONSABILITES } from "./commun/permissions";
import { montantValide, texteCourt } from "./commun/validation";
import { sessionOuverteDuCaissier, totauxSession } from "./caisse/serveur";
import {
  SEUILS_DECAISSEMENT, TYPES_MOUVEMENT_SAISISSABLES, sensMouvementCaisse,
  type TypeMouvementCaisse,
} from "./caisse/types";

const CHEMIN = "/app/vie-scolaire/finances";
const TYPES_CAISSE_VALIDES = new Set(["physique", "mobile_money", "virtuelle", "bancaire"]);

/** Montant POSITIF OU NUL (le fonds initial et le comptage peuvent être 0). */
function montantPositifOuNul(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? n : null;
}

// ─────────────────────────────────────────────────────────────
//  Paramétrage des caisses
// ─────────────────────────────────────────────────────────────

export async function enregistrerCaisse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.caisses.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const nom = texteCourt(fd.get("nom"), 80);
  if (!nom) return { ok: false, message: "Le nom de la caisse est obligatoire." };
  const type = texteCourt(fd.get("type"), 20);
  if (!TYPES_CAISSE_VALIDES.has(type)) return { ok: false, message: "Type de caisse invalide." };
  const responsableIdBrut = texteCourt(fd.get("responsableId"), 50);
  const responsableId = responsableIdBrut
    ? (
        await prisma.utilisateur.findFirst({
          where: { id: responsableIdBrut, etablissementId, statutCompte: "actif" },
          select: { id: true },
        })
      )?.id ?? null
    : null;
  const donnees = {
    nom, code: texteCourt(fd.get("code"), 20) || null, type, responsableId,
    plafond: montantValide(fd.get("plafond")),
    decouvertAutorise: String(fd.get("decouvertAutorise") ?? "non") === "oui",
  };
  const id = texteCourt(fd.get("id"), 50);
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.caisseEtablissement.findFirst({ where: { id, etablissementId, annuleLe: null } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.caisseEtablissement.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "caisse.modification",
          entite: "CaisseEtablissement", entiteId: id, ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Caisse introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const creee = await tx.caisseEtablissement.create({ data: { etablissementId, ...donnees } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "caisse.creation",
          entite: "CaisseEtablissement", entiteId: creee.id, nouvelleValeur: creee,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Caisse mise à jour." : "Caisse créée." };
  } catch (e) {
    console.error("[caisse] enregistrement :", e);
    return { ok: false, message: "Une caisse active porte peut-être déjà ce nom." };
  }
}

export async function basculerSuspensionCaisse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const c = await prisma.caisseEtablissement.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, statut: true, nom: true },
  });
  if (!c) return { ok: false, message: "Caisse introuvable." };
  const u = await exigerPermissionFinance(c.etablissementId, "finance.caisses.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const suspendre = c.statut === "active";
  if (suspendre) {
    const ouverte = await prisma.sessionCaisse.findFirst({
      where: { caisseId: id, statut: "ouverte", annuleLe: null },
      select: { id: true },
    });
    if (ouverte) return { ok: false, message: "Clôturez d'abord la session ouverte de cette caisse." };
  }
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.caisseEtablissement.updateMany({
        where: { id, version, annuleLe: null },
        data: { statut: suspendre ? "suspendue" : "active", version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: c.etablissementId, utilisateurId: u.id,
        action: suspendre ? "caisse.suspension" : "caisse.reactivation",
        entite: "CaisseEtablissement", entiteId: id,
        ancienneValeur: { statut: c.statut }, nouvelleValeur: { statut: suspendre ? "suspendue" : "active" },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: suspendre ? `Caisse « ${c.nom} » suspendue.` : `Caisse « ${c.nom} » réactivée.` };
  } catch (e) {
    console.error("[caisse] suspension :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerCaisse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const c = await prisma.caisseEtablissement.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, nom: true },
  });
  if (!c) return { ok: false, message: "Caisse introuvable." };
  const u = await exigerPermissionFinance(c.etablissementId, "finance.caisses.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const ouverte = await prisma.sessionCaisse.findFirst({
    where: { caisseId: id, statut: "ouverte", annuleLe: null },
    select: { id: true },
  });
  if (ouverte) return { ok: false, message: "Clôturez d'abord la session ouverte de cette caisse." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.caisseEtablissement.findFirst({ where: { id } });
      const maj = await tx.caisseEtablissement.updateMany({
        where: { id, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: c.etablissementId, utilisateurId: u.id, action: "caisse.annulation",
        entite: "CaisseEtablissement", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Caisse « ${c.nom} » archivée (l'historique de ses sessions est conservé).` };
  } catch (e) {
    console.error("[caisse] retrait :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Sessions : ouverture, clôture, validation d'écart
// ─────────────────────────────────────────────────────────────

export async function ouvrirSession(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const caisseId = texteCourt(fd.get("caisseId"), 50);
  const caisse = await prisma.caisseEtablissement.findFirst({
    where: { id: caisseId, annuleLe: null },
    select: { etablissementId: true, nom: true, statut: true },
  });
  if (!caisse) return { ok: false, message: "Caisse introuvable." };
  if (caisse.statut !== "active") return { ok: false, message: "Cette caisse est suspendue : réactivez-la d'abord." };
  const u = await exigerPermissionFinance(caisse.etablissementId, "finance.caisses.session");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const fondsInitial = montantPositifOuNul(fd.get("fondsInitial"));
  if (fondsInitial === null) return { ok: false, message: "Fonds initial invalide (0 accepté)." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // RM-502 : une seule session ouverte par caisse — et une par caissier (rattachement).
      const [surCaisse, duCaissier] = await Promise.all([
        tx.sessionCaisse.findFirst({ where: { caisseId, statut: "ouverte", annuleLe: null }, select: { id: true } }),
        tx.sessionCaisse.findFirst({
          where: { etablissementId: caisse.etablissementId, caissierId: u.id, statut: "ouverte", annuleLe: null },
          select: { id: true },
        }),
      ]);
      if (surCaisse) return { statut: "caisse_occupee" as const };
      if (duCaissier) return { statut: "caissier_occupe" as const };
      const session = await tx.sessionCaisse.create({
        data: {
          etablissementId: caisse.etablissementId, caisseId, caissierId: u.id,
          fondsInitial, observations: texteCourt(fd.get("observations"), 300) || null,
          dateComptable: new Date(),
        },
      });
      await journaliserFinance(tx, {
        etablissementId: caisse.etablissementId, utilisateurId: u.id, action: "session_caisse.ouverture",
        entite: "SessionCaisse", entiteId: session.id,
        nouvelleValeur: { caisse: caisse.nom, fondsInitial, observations: session.observations },
      });
      return { statut: "ok" as const };
    });
    if (resultat.statut === "caisse_occupee") return { ok: false, message: "Une session est déjà ouverte sur cette caisse (RM-502)." };
    if (resultat.statut === "caissier_occupe") return { ok: false, message: "Vous avez déjà une session ouverte : clôturez-la d'abord." };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Session ouverte sur « ${caisse.nom} » — fonds initial : ${fondsInitial.toLocaleString("fr-FR")} F.` };
  } catch (e) {
    console.error("[caisse] ouverture :", e);
    return { ok: false, message: "Une session est peut-être déjà ouverte sur cette caisse." };
  }
}

/**
 * CLÔTURE de session (09) : comptage physique (solde réel), totaux et solde théorique FIGÉS,
 * écart calculé (justification obligatoire) — l'écart est ensuite VALIDÉ par un second acteur.
 */
export async function cloturerSession(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const s = await prisma.sessionCaisse.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, caissierId: true, statut: true, fondsInitial: true, caisse: { select: { nom: true } } },
  });
  if (!s) return { ok: false, message: "Session introuvable." };
  if (s.statut !== "ouverte") return { ok: false, message: "Cette session est déjà clôturée (RM-505)." };
  const u = await exigerPermissionFinance(s.etablissementId, "finance.caisses.session");
  if (!u) return { ok: false, message: "Action non autorisée." };
  // Le caissier clôture SA session ; un superviseur (valider) peut clôturer celle d'autrui.
  if (s.caissierId !== u.id && !(await exigerPermissionFinance(s.etablissementId, "finance.caisses.valider"))) {
    return { ok: false, message: "Seul le caissier de la session (ou un superviseur) peut la clôturer." };
  }
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  const soldeReel = montantPositifOuNul(fd.get("soldeReel"));
  if (soldeReel === null) return { ok: false, message: "Comptage physique invalide (0 accepté)." };
  const motifEcart = texteCourt(fd.get("motifEcart"), 300);

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const totaux = await totauxSession(tx, id, s.fondsInitial);
      const ecart = soldeReel - totaux.soldeTheorique;
      if (ecart !== 0 && !motifEcart) return { statut: "motif" as const, ecart };
      const maj = await tx.sessionCaisse.updateMany({
        where: { id, version, statut: "ouverte", annuleLe: null },
        data: {
          statut: "cloturee",
          clotureeLe: new Date(),
          totalEncaissements: totaux.totalEncaissements,
          totalDecaissements: totaux.totalDecaissements,
          soldeTheorique: totaux.soldeTheorique,
          soldeReel,
          ecart,
          typeEcart: ecart === 0 ? null : ecart > 0 ? "excedent" : "deficit",
          motifEcart: ecart === 0 ? null : motifEcart,
          montantAVerser: soldeReel,
          version: { increment: 1 },
        },
      });
      if (maj.count === 0) return { statut: "conflit" as const, ecart };
      await journaliserFinance(tx, {
        etablissementId: s.etablissementId, utilisateurId: u.id, action: "session_caisse.cloture",
        entite: "SessionCaisse", entiteId: id,
        nouvelleValeur: { ...totaux, soldeReel, ecart, motifEcart: motifEcart || null },
      });
      return { statut: "ok" as const, ecart, theorique: totaux.soldeTheorique };
    });
    if (resultat.statut === "motif") {
      return { ok: false, message: `Écart constaté de ${resultat.ecart.toLocaleString("fr-FR")} F : la justification est obligatoire.` };
    }
    if (resultat.statut === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message:
        `Session de « ${s.caisse.nom} » clôturée — théorique : ${resultat.theorique.toLocaleString("fr-FR")} F, réel : ${soldeReel.toLocaleString("fr-FR")} F` +
        (resultat.ecart === 0
          ? ", aucun écart."
          : ` — écart de ${resultat.ecart.toLocaleString("fr-FR")} F à faire VALIDER par un second acteur.`),
    };
  } catch (e) {
    console.error("[caisse] clôture :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Validation d'un écart par un SECOND acteur (09/04 : séparation des responsabilités). */
export async function validerEcartSession(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const s = await prisma.sessionCaisse.findFirst({
    where: { id, annuleLe: null },
    select: { etablissementId: true, caissierId: true, statut: true, ecart: true, ecartValideParId: true },
  });
  if (!s) return { ok: false, message: "Session introuvable." };
  if (s.statut !== "cloturee" || s.ecart === null || s.ecart === 0) {
    return { ok: false, message: "Aucun écart à valider sur cette session." };
  }
  if (s.ecartValideParId) return { ok: false, message: "Écart déjà validé." };
  const u = await exigerPermissionFinance(s.etablissementId, "finance.caisses.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  if (u.id === s.caissierId) return { ok: false, message: MESSAGE_SEPARATION_RESPONSABILITES };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.sessionCaisse.updateMany({
        where: { id, version, statut: "cloturee", ecartValideParId: null, annuleLe: null },
        data: { ecartValideParId: u.id, ecartValideLe: new Date(), version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: s.etablissementId, utilisateurId: u.id, action: "session_caisse.ecart_validation",
        entite: "SessionCaisse", entiteId: id, nouvelleValeur: { ecart: s.ecart },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Écart validé — il alimente les rapports d'audit." };
  } catch (e) {
    console.error("[caisse] validation écart :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ─────────────────────────────────────────────────────────────
//  Mouvements internes & transferts
// ─────────────────────────────────────────────────────────────

const MOTIF_OBLIGATOIRE: readonly TypeMouvementCaisse[] = ["decaissement", "regularisation_plus", "regularisation_moins"];

export async function enregistrerMouvementCaisse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const sessionId = texteCourt(fd.get("sessionId"), 50);
  const s = await prisma.sessionCaisse.findFirst({
    where: { id: sessionId, annuleLe: null },
    select: { etablissementId: true, statut: true, fondsInitial: true, caisse: { select: { nom: true, decouvertAutorise: true } } },
  });
  if (!s) return { ok: false, message: "Session introuvable." };
  if (s.statut !== "ouverte") return { ok: false, message: "Session clôturée : plus aucun mouvement (RM-505)." };
  const u = await exigerPermissionFinance(s.etablissementId, "finance.caisses.session");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const type = texteCourt(fd.get("type"), 30) as TypeMouvementCaisse;
  if (!TYPES_MOUVEMENT_SAISISSABLES.includes(type)) return { ok: false, message: "Type de mouvement invalide." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const motif = texteCourt(fd.get("motif"), 300);
  if (MOTIF_OBLIGATOIRE.includes(type) && !motif) return { ok: false, message: "Le motif est obligatoire pour ce mouvement." };
  const beneficiaire = texteCourt(fd.get("beneficiaire"), 120);
  if (type === "decaissement" && !beneficiaire) return { ok: false, message: "Le bénéficiaire du décaissement est obligatoire." };

  // Seuils d'autorisation (09) : ≤ 50 000 automatique ; > 50 000 valider ; > 500 000 approuver.
  let valideParId: string | null = null;
  if (type === "decaissement" && montant > SEUILS_DECAISSEMENT.validation) {
    const permission = montant > SEUILS_DECAISSEMENT.direction ? "finance.caisses.approuver" : "finance.caisses.valider";
    const validateur = await exigerPermissionFinance(s.etablissementId, permission);
    if (!validateur) {
      return {
        ok: false,
        message:
          montant > SEUILS_DECAISSEMENT.direction
            ? `Décaissement supérieur à ${SEUILS_DECAISSEMENT.direction.toLocaleString("fr-FR")} F : approbation de la DIRECTION requise.`
            : `Décaissement supérieur à ${SEUILS_DECAISSEMENT.validation.toLocaleString("fr-FR")} F : validation du GESTIONNAIRE requise.`,
      };
    }
    valideParId = validateur.id;
  }

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // Contrôle de solde DANS la transaction (versement toujours ≤ solde ; découvert selon caisse).
      const sens = sensMouvementCaisse(type);
      if (sens < 0) {
        const totaux = await totauxSession(tx, sessionId, s.fondsInitial);
        const resultant = totaux.soldeTheorique - montant;
        if (type === "versement_banque" && montant > totaux.soldeTheorique) {
          return { statut: "solde" as const, message: `Versement supérieur au solde en caisse (${totaux.soldeTheorique.toLocaleString("fr-FR")} F).` };
        }
        if (resultant < 0 && !s.caisse.decouvertAutorise) {
          return { statut: "solde" as const, message: `Solde insuffisant : ${totaux.soldeTheorique.toLocaleString("fr-FR")} F en caisse (découvert non autorisé).` };
        }
      }
      const mouvement = await tx.mouvementCaisse.create({
        data: {
          etablissementId: s.etablissementId, sessionId, type, montant,
          beneficiaire: beneficiaire || null, motif: motif || null,
          pieceJustificative: texteCourt(fd.get("pieceJustificative"), 120) || null,
          valideParId, saisiParId: u.id, dateComptable: new Date(),
        },
      });
      await journaliserFinance(tx, {
        etablissementId: s.etablissementId, utilisateurId: u.id, action: "caisse.mouvement",
        entite: "MouvementCaisse", entiteId: mouvement.id, nouvelleValeur: mouvement,
      });
      return { statut: "ok" as const };
    });
    if (resultat.statut === "solde") return { ok: false, message: resultat.message };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Mouvement enregistré sur « ${s.caisse.nom} » — le solde théorique est à jour (RM-503).` };
  } catch (e) {
    console.error("[caisse] mouvement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** TRANSFERT entre caisses (09) : décaissement + encaissement correspondants, créés ensemble. */
export async function transfertEntreCaisses(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const sessionSourceId = texteCourt(fd.get("sessionSourceId"), 50);
  const caisseCibleId = texteCourt(fd.get("caisseCibleId"), 50);
  const source = await prisma.sessionCaisse.findFirst({
    where: { id: sessionSourceId, statut: "ouverte", annuleLe: null },
    select: { etablissementId: true, caisseId: true, fondsInitial: true, caisse: { select: { nom: true, decouvertAutorise: true } } },
  });
  if (!source) return { ok: false, message: "Session source introuvable ou clôturée." };
  if (source.caisseId === caisseCibleId) return { ok: false, message: "Choisissez une caisse cible différente." };
  const u = await exigerPermissionFinance(source.etablissementId, "finance.caisses.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const motif = texteCourt(fd.get("motif"), 300) || "Transfert entre caisses";

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // RM-500 : la caisse cible ne reçoit que si une session y est OUVERTE.
      const cible = await tx.sessionCaisse.findFirst({
        where: { caisseId: caisseCibleId, etablissementId: source.etablissementId, statut: "ouverte", annuleLe: null },
        select: { id: true, caisse: { select: { nom: true } } },
      });
      if (!cible) return { statut: "cible" as const };
      const totaux = await totauxSession(tx, sessionSourceId, source.fondsInitial);
      if (totaux.soldeTheorique - montant < 0 && !source.caisse.decouvertAutorise) {
        return { statut: "solde" as const, solde: totaux.soldeTheorique };
      }
      const sortie = await tx.mouvementCaisse.create({
        data: {
          etablissementId: source.etablissementId, sessionId: sessionSourceId, type: "transfert_sortie",
          montant, motif: `${motif} → ${cible.caisse.nom}`, valideParId: u.id, saisiParId: u.id, dateComptable: new Date(),
        },
      });
      const entree = await tx.mouvementCaisse.create({
        data: {
          etablissementId: source.etablissementId, sessionId: cible.id, type: "transfert_entree",
          montant, motif: `${motif} ← ${source.caisse.nom}`, valideParId: u.id, saisiParId: u.id,
          lieMouvementId: sortie.id, dateComptable: new Date(),
        },
      });
      await tx.mouvementCaisse.updateMany({ where: { id: sortie.id }, data: { lieMouvementId: entree.id } });
      await journaliserFinance(tx, {
        etablissementId: source.etablissementId, utilisateurId: u.id, action: "caisse.transfert",
        entite: "MouvementCaisse", entiteId: sortie.id,
        nouvelleValeur: { montant, source: source.caisse.nom, cible: cible.caisse.nom, motif },
      });
      return { statut: "ok" as const, cible: cible.caisse.nom };
    });
    if (resultat.statut === "cible") return { ok: false, message: "Aucune session ouverte sur la caisse cible (RM-500) : ouvrez-y d'abord une session." };
    if (resultat.statut === "solde") return { ok: false, message: `Solde insuffisant : ${resultat.solde.toLocaleString("fr-FR")} F en caisse source.` };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Transfert de ${montant.toLocaleString("fr-FR")} F vers « ${resultat.cible} » effectué (paire de mouvements liée).` };
  } catch (e) {
    console.error("[caisse] transfert :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Annulation LOGIQUE d'un mouvement (RM-004) — refusée si la session est clôturée (RM-505). */
export async function annulerMouvementCaisse(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = texteCourt(fd.get("id"), 50);
  const m = await prisma.mouvementCaisse.findFirst({
    where: { id, annuleLe: null },
    select: {
      etablissementId: true, lieMouvementId: true, type: true,
      session: { select: { statut: true } },
    },
  });
  if (!m) return { ok: false, message: "Mouvement introuvable (déjà annulé ?)." };
  if (m.session.statut !== "ouverte") return { ok: false, message: "Session clôturée : mouvement non modifiable (RM-505) — passez une régularisation." };
  const u = await exigerPermissionFinance(m.etablissementId, "finance.caisses.valider");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // Transfert : le mouvement MIROIR doit lui aussi appartenir à une session ouverte.
      if (m.lieMouvementId) {
        const miroir = await tx.mouvementCaisse.findFirst({
          where: { id: m.lieMouvementId, annuleLe: null },
          select: { id: true, session: { select: { statut: true } } },
        });
        if (miroir && miroir.session.statut !== "ouverte") return "miroir" as const;
        if (miroir) {
          await tx.mouvementCaisse.updateMany({
            where: { id: miroir.id, annuleLe: null },
            data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
          });
        }
      }
      const avant = await tx.mouvementCaisse.findFirst({ where: { id } });
      const maj = await tx.mouvementCaisse.updateMany({
        where: { id, version, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: m.etablissementId, utilisateurId: u.id, action: "caisse.mouvement_annulation",
        entite: "MouvementCaisse", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat === "miroir") return { ok: false, message: "Le mouvement miroir du transfert appartient à une session clôturée (RM-505) : passez une régularisation." };
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Mouvement annulé — solde théorique recalculé." };
  } catch (e) {
    console.error("[caisse] annulation mouvement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
