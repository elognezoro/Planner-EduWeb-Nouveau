"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import { journaliserFinance } from "./commun/audit";
import { MESSAGE_CONFLIT_VERSION, versionDepuisFormulaire } from "./commun/verrouillage";
// Garde UNIQUE du module (97-RBAC RM-2600/2601) : chaque action vérifie sa permission ATOMIQUE.
import { exigerPermissionFinance } from "./commun/rbac";
import { montantValide, modeValide, dateValide, dateFacultative, texteCourt } from "./commun/validation";
import { majStatutCreances } from "./scolarite/generation";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const CHEMIN = "/app/vie-scolaire/finances";

import { CATEGORIES_OHADA } from "./categories";

// Référentiels du paramétrage enrichi des frais (06-Scolarite).
const CYCLES_VALIDES = new Set(["prescolaire", "primaire", "college", "lycee"]);
const STATUTS_ELEVE_VALIDES = new Set(["interne", "externe", "demi_pensionnaire"]);
const MODES_CALCUL_VALIDES = new Set(["fixe", "mensuel", "trimestriel", "semestriel"]);

/** Élève actif de CET établissement (cloisonnement des paiements/remises). */
async function eleveDeLEtablissement(eleveId: string, etablissementId: string) {
  if (!eleveId) return null;
  return prisma.utilisateur.findFirst({
    where: { id: eleveId, etablissementId, roleActif: { nomTechnique: "eleve" } },
    select: { id: true, nom: true, prenoms: true },
  });
}

// ── Barèmes de frais (scolarité, inscription, cantine…) ──

export async function enregistrerFrais(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.frais.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const libelle = String(fd.get("libelle") ?? "").trim().slice(0, 120);
  const montant = montantValide(fd.get("montant"));
  if (!libelle) return { ok: false, message: "Le libellé du frais est obligatoire." };
  if (!montant) return { ok: false, message: "Montant invalide." };
  const niveauId = String(fd.get("niveauId") ?? "").trim() || null;
  const obligatoire = String(fd.get("obligatoire") ?? "") !== "non";

  // Échéancier facultatif : tranches [{libelle, montant, dateLimite?}] ; la somme doit égaler le montant.
  let tranches: { libelle: string; montant: number; dateLimite?: string }[] = [];
  try {
    const brut = JSON.parse(String(fd.get("tranches") ?? "[]"));
    if (Array.isArray(brut)) {
      tranches = brut
        .map((t) => ({
          libelle: String(t?.libelle ?? "").trim().slice(0, 80),
          montant: Math.trunc(Number(t?.montant)) || 0,
          ...(String(t?.dateLimite ?? "").trim() ? { dateLimite: String(t.dateLimite).trim() } : {}),
        }))
        .filter((t) => t.libelle && t.montant > 0)
        .slice(0, 12);
    }
  } catch {
    return { ok: false, message: "Échéancier illisible." };
  }
  if (tranches.length > 0) {
    const somme = tranches.reduce((s, t) => s + t.montant, 0);
    if (somme !== montant) {
      return { ok: false, message: `La somme des tranches (${somme.toLocaleString("fr-FR")} F) doit égaler le montant total (${montant.toLocaleString("fr-FR")} F).` };
    }
  }

  // ── Paramétrage enrichi (06-Scolarite) : code, catégorie, série/cycle/statut, validité, mode ──
  const cycleBrut = String(fd.get("cycle") ?? "").trim();
  const statutEleveBrut = String(fd.get("statutEleve") ?? "").trim();
  const modeCalculBrut = String(fd.get("modeCalcul") ?? "fixe").trim();
  const categorieIdBrut = String(fd.get("categorieId") ?? "").trim();
  const categorieId = categorieIdBrut
    ? (await prisma.categorieFrais.findFirst({ where: { id: categorieIdBrut, etablissementId, annuleLe: null }, select: { id: true } }))?.id ?? null
    : null;
  const dateDebut = dateFacultative(fd.get("dateDebut"));
  const dateFin = dateFacultative(fd.get("dateFin"));
  if (dateDebut && dateFin && dateFin < dateDebut) {
    return { ok: false, message: "La fin de validité doit suivre le début de validité." };
  }

  const anneeActive = await prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } });
  const donnees = {
    libelle, montant, niveauId, obligatoire,
    anneeScolaireId: anneeActive?.id ?? null,
    code: texteCourt(fd.get("code"), 20) || null,
    description: texteCourt(fd.get("description"), 500) || null,
    categorieId,
    serie: texteCourt(fd.get("serie"), 20) || null,
    cycle: CYCLES_VALIDES.has(cycleBrut) ? cycleBrut : null,
    statutEleve: STATUTS_ELEVE_VALIDES.has(statutEleveBrut) ? statutEleveBrut : null,
    dateDebut, dateFin,
    modeCalcul: MODES_CALCUL_VALIDES.has(modeCalculBrut) ? modeCalculBrut : "fixe",
  };
  const id = String(fd.get("id") ?? "").trim();
  try {
    if (id) {
      // RM-019 : le formulaire transmet la version courante — conflit si elle a changé depuis.
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.fraisScolarite.findFirst({ where: { id, etablissementId } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.fraisScolarite.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, tranches: tranches.length ? tranches : [], version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "frais.modification",
          entite: "FraisScolarite", entiteId: id,
          ancienneValeur: avant, nouvelleValeur: { ...donnees, tranches },
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Frais introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.fraisScolarite.create({
          data: { etablissementId, ...donnees, tranches: tranches.length ? tranches : undefined },
        });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "frais.creation",
          entite: "FraisScolarite", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Frais mis à jour." : "Frais ajouté au barème." };
  } catch (e) {
    console.error("[finances] frais :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function basculerFrais(id: string, actif: boolean): Promise<EtatForm> {
  const f = await prisma.fraisScolarite.findUnique({ where: { id }, select: { etablissementId: true } });
  if (!f) return { ok: false, message: "Frais introuvable." };
  const u = await exigerPermissionFinance(f.etablissementId, "finance.frais.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  try {
    await prisma.$transaction(async (tx) => {
      const avant = await tx.fraisScolarite.findFirst({ where: { id }, select: { actif: true } });
      await tx.fraisScolarite.updateMany({ where: { id }, data: { actif, version: { increment: 1 } } });
      await journaliserFinance(tx, {
        etablissementId: f.etablissementId, utilisateurId: u.id,
        action: actif ? "frais.reactivation" : "frais.desactivation",
        entite: "FraisScolarite", entiteId: id,
        ancienneValeur: { actif: avant?.actif }, nouvelleValeur: { actif },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: actif ? "Frais réactivé." : "Frais désactivé." };
  } catch (e) {
    console.error("[finances] bascule frais :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Remises & bourses ──

export async function accorderRemise(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.remises.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await eleveDeLEtablissement(String(fd.get("eleveId") ?? "").trim(), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const type = String(fd.get("type") ?? "remise") === "bourse" ? "bourse" : "remise";
  const libelle = String(fd.get("libelle") ?? "").trim().slice(0, 120) || (type === "bourse" ? "Bourse" : "Remise");
  const montant = montantValide(fd.get("montant"));
  const pctBrut = Math.trunc(Number(fd.get("pourcentage")));
  const pourcentage = Number.isFinite(pctBrut) && pctBrut >= 1 && pctBrut <= 100 ? pctBrut : null;
  if (!montant && !pourcentage) return { ok: false, message: "Indiquez un montant OU un pourcentage." };
  const fraisId = String(fd.get("fraisId") ?? "").trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.remiseEleve.create({
        data: {
          etablissementId, eleveId: eleve.id, fraisId, type, libelle,
          montant: pourcentage ? null : montant, pourcentage, accordeParId: u.id,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "remise.creation",
        entite: "RemiseEleve", entiteId: creee.id, nouvelleValeur: creee,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `${type === "bourse" ? "Bourse" : "Remise"} accordée à ${[eleve.prenoms, eleve.nom].filter(Boolean).join(" ")}.` };
  } catch (e) {
    console.error("[finances] remise :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** RM-004 : le retrait d'une remise est une ANNULATION logique — la remise reste en base pour l'audit. */
export async function supprimerRemise(id: string): Promise<EtatForm> {
  const r = await prisma.remiseEleve.findUnique({ where: { id }, select: { etablissementId: true, annuleLe: true } });
  if (!r || r.annuleLe) return { ok: false, message: "Remise introuvable." };
  const u = await exigerPermissionFinance(r.etablissementId, "finance.remises.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.remiseEleve.findFirst({ where: { id, etablissementId: r.etablissementId } });
      if (!avant || avant.annuleLe) return "introuvable" as const;
      const maj = await tx.remiseEleve.updateMany({
        where: { id, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id },
      });
      if (maj.count === 0) return "introuvable" as const;
      await journaliserFinance(tx, {
        etablissementId: r.etablissementId, utilisateurId: u.id, action: "remise.annulation",
        entite: "RemiseEleve", entiteId: id, ancienneValeur: avant,
      });
      return "ok" as const;
    });
    if (resultat !== "ok") return { ok: false, message: "Remise introuvable." };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Remise retirée." };
  } catch (e) {
    console.error("[finances] retrait remise :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Encaissements de scolarité (reçus numérotés) ──

export async function encaisserPaiement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.paiements.encaisser");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await eleveDeLEtablissement(String(fd.get("eleveId") ?? "").trim(), etablissementId);
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const libelle = String(fd.get("libelle") ?? "").trim().slice(0, 160) || "Scolarité";
  const fraisId = String(fd.get("fraisId") ?? "").trim() || null;
  const mode = modeValide(fd.get("mode"));
  const reference = String(fd.get("reference") ?? "").trim().slice(0, 80) || null;
  const date = dateValide(fd.get("date"));
  const clos = await finExerciceClos(etablissementId);
  if (clos && date <= clos) return { ok: false, message: "Cette date appartient à un exercice CLÔTURÉ — écriture refusée." };

  try {
    // Numéro de reçu séquentiel PAR ÉTABLISSEMENT — attribué dans la transaction.
    const paiement = await prisma.$transaction(async (tx) => {
      const dernier = await tx.paiementScolarite.findFirst({
        where: { etablissementId },
        orderBy: { numeroRecu: "desc" },
        select: { numeroRecu: true },
      });
      const cree = await tx.paiementScolarite.create({
        data: {
          etablissementId, eleveId: eleve.id, fraisId, libelle, montant, mode, reference, date,
          dateComptable: date, // RM-008 : date comptable posée dès la création
          numeroRecu: (dernier?.numeroRecu ?? 0) + 1, encaisseParId: u.id,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "paiement.creation",
        entite: "PaiementScolarite", entiteId: cree.id, nouvelleValeur: cree,
      });
      // 06-Scolarite : met à jour le statut des créances du frais réglé (soldée/partielle).
      if (fraisId) await majStatutCreances(tx, { etablissementId, eleveId: eleve.id, fraisId });
      return cree;
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Encaissement enregistré — reçu n° ${String(paiement.numeroRecu).padStart(6, "0")}.` };
  } catch (e) {
    console.error("[finances] paiement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Un paiement ne se SUPPRIME jamais : il s'ANNULE avec motif (traçabilité du journal). */
export async function annulerPaiement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = String(fd.get("id") ?? "").trim();
  const motif = String(fd.get("motif") ?? "").trim().slice(0, 300);
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  const p = await prisma.paiementScolarite.findUnique({ where: { id }, select: { etablissementId: true, annule: true, date: true } });
  if (!p) return { ok: false, message: "Paiement introuvable." };
  if (p.annule) return { ok: false, message: "Paiement déjà annulé." };
  const u = await exigerPermissionFinance(p.etablissementId, "finance.paiements.annuler");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const clos = await finExerciceClos(p.etablissementId);
  if (clos && p.date <= clos) return { ok: false, message: "Écriture d'un exercice CLÔTURÉ — annulation impossible (rouvrez l'exercice d'abord)." };
  // RM-019 : version transmise en champ caché par le formulaire d'annulation.
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.paiementScolarite.findFirst({ where: { id, etablissementId: p.etablissementId } });
      if (!avant || avant.annule) return "conflit" as const;
      const maj = await tx.paiementScolarite.updateMany({
        where: { id, version, annule: false },
        data: { annule: true, motifAnnulation: motif, annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: p.etablissementId, utilisateurId: u.id, action: "paiement.annulation",
        entite: "PaiementScolarite", entiteId: id,
        ancienneValeur: avant, nouvelleValeur: { annule: true, motifAnnulation: motif },
      });
      // 06-Scolarite : recalcule le statut des créances du frais concerné.
      if (avant.fraisId) {
        await majStatutCreances(tx, { etablissementId: p.etablissementId, eleveId: avant.eleveId, fraisId: avant.fraisId });
      }
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Paiement annulé (le reçu reste tracé)." };
  } catch (e) {
    console.error("[finances] annulation paiement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Journal recettes / dépenses (caisse & banque) ──

export async function enregistrerOperation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.operations.creer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const sens = String(fd.get("sens") ?? "") === "recette" ? "recette" : "depense";
  const categorie = String(fd.get("categorie") ?? "").trim();
  if (!CATEGORIES_OHADA.some((c) => c.code === categorie && c.sens === sens)) {
    return { ok: false, message: "Catégorie comptable invalide pour ce sens d'opération." };
  }
  const libelle = String(fd.get("libelle") ?? "").trim().slice(0, 200);
  if (!libelle) return { ok: false, message: "Le libellé est obligatoire." };
  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const dateOp = dateValide(fd.get("date"));
  const clos = await finExerciceClos(etablissementId);
  if (clos && dateOp <= clos) return { ok: false, message: "Cette date appartient à un exercice CLÔTURÉ — écriture refusée." };

  try {
    await prisma.$transaction(async (tx) => {
      const creee = await tx.operationFinanciere.create({
        data: {
          etablissementId, sens, categorie, libelle, montant,
          mode: modeValide(fd.get("mode")),
          reference: String(fd.get("reference") ?? "").trim().slice(0, 80) || null,
          date: dateOp,
          dateComptable: dateOp, // RM-008
          saisiParId: u.id,
        },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: `${sens}.creation`,
        entite: "OperationFinanciere", entiteId: creee.id, nouvelleValeur: creee,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: sens === "recette" ? "Recette enregistrée." : "Dépense enregistrée." };
  } catch (e) {
    console.error("[finances] opération :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function annulerOperation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const id = String(fd.get("id") ?? "").trim();
  const motif = String(fd.get("motif") ?? "").trim().slice(0, 300);
  if (!motif) return { ok: false, message: "Le motif d'annulation est obligatoire." };
  const o = await prisma.operationFinanciere.findUnique({ where: { id }, select: { etablissementId: true, annule: true, date: true, sens: true } });
  if (!o) return { ok: false, message: "Opération introuvable." };
  if (o.annule) return { ok: false, message: "Opération déjà annulée." };
  const u = await exigerPermissionFinance(o.etablissementId, "finance.operations.annuler");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const clos = await finExerciceClos(o.etablissementId);
  if (clos && o.date <= clos) return { ok: false, message: "Écriture d'un exercice CLÔTURÉ — annulation impossible (rouvrez l'exercice d'abord)." };
  const version = versionDepuisFormulaire(fd.get("version"));
  if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const avant = await tx.operationFinanciere.findFirst({ where: { id, etablissementId: o.etablissementId } });
      if (!avant || avant.annule) return "conflit" as const;
      const maj = await tx.operationFinanciere.updateMany({
        where: { id, version, annule: false },
        data: { annule: true, motifAnnulation: motif, annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: o.etablissementId, utilisateurId: u.id, action: `${avant.sens}.annulation`,
        entite: "OperationFinanciere", entiteId: id,
        ancienneValeur: avant, nouvelleValeur: { annule: true, motifAnnulation: motif },
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: "Opération annulée (elle reste tracée au journal)." };
  } catch (e) {
    console.error("[finances] annulation opération :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Économat : articles, stocks et ventes ──

export async function enregistrerArticle(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.articles.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const nom = String(fd.get("nom") ?? "").trim().slice(0, 120);
  if (!nom) return { ok: false, message: "Le nom de l'article est obligatoire." };
  const prixVente = montantValide(fd.get("prixVente"));
  if (!prixVente) return { ok: false, message: "Prix de vente invalide." };
  const prixAchat = montantValide(fd.get("prixAchat"));
  const seuilBrut = Math.trunc(Number(fd.get("seuilAlerte")));
  const donnees = {
    nom, prixVente, prixAchat,
    categorie: String(fd.get("categorie") ?? "").trim().slice(0, 80) || null,
    seuilAlerte: Number.isFinite(seuilBrut) && seuilBrut >= 0 ? seuilBrut : 5,
  };
  const id = String(fd.get("id") ?? "").trim();
  try {
    if (id) {
      const version = versionDepuisFormulaire(fd.get("version"));
      if (version === null) return { ok: false, message: MESSAGE_CONFLIT_VERSION };
      const resultat = await prisma.$transaction(async (tx) => {
        const avant = await tx.articleEconomat.findFirst({ where: { id, etablissementId } });
        if (!avant) return "introuvable" as const;
        const maj = await tx.articleEconomat.updateMany({
          where: { id, etablissementId, version },
          data: { ...donnees, version: { increment: 1 } },
        });
        if (maj.count === 0) return "conflit" as const;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "article.modification",
          entite: "ArticleEconomat", entiteId: id,
          ancienneValeur: avant, nouvelleValeur: donnees,
        });
        return "ok" as const;
      });
      if (resultat === "introuvable") return { ok: false, message: "Article introuvable." };
      if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    } else {
      await prisma.$transaction(async (tx) => {
        const cree = await tx.articleEconomat.create({ data: { etablissementId, ...donnees } });
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "article.creation",
          entite: "ArticleEconomat", entiteId: cree.id, nouvelleValeur: cree,
        });
      });
    }
    revalidatePath(CHEMIN);
    return { ok: true, message: id ? "Article mis à jour." : "Article ajouté à l'économat." };
  } catch (e) {
    console.error("[finances] article :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Entrée de stock, vente (décrémente + encaisse) ou ajustement d'inventaire. */
export async function mouvementStock(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const articleId = String(fd.get("articleId") ?? "").trim();
  const article = await prisma.articleEconomat.findUnique({
    where: { id: articleId },
    select: { id: true, etablissementId: true, stock: true, prixVente: true, nom: true },
  });
  if (!article) return { ok: false, message: "Article introuvable." };
  const u = await exigerPermissionFinance(article.etablissementId, "finance.stocks.mouvementer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const type = String(fd.get("type") ?? "");
  if (!["entree", "vente", "ajustement"].includes(type)) return { ok: false, message: "Type de mouvement invalide." };
  const quantite = Math.trunc(Number(fd.get("quantite")));
  if (!Number.isFinite(quantite) || quantite < 0 || (type !== "ajustement" && quantite === 0)) {
    return { ok: false, message: "Quantité invalide." };
  }
  if (type === "vente" && quantite > article.stock) {
    return { ok: false, message: `Stock insuffisant : ${article.stock} « ${article.nom} » en réserve.` };
  }

  const eleveIdBrut = String(fd.get("eleveId") ?? "").trim();
  const eleve = eleveIdBrut ? await eleveDeLEtablissement(eleveIdBrut, article.etablissementId) : null;
  const montant =
    type === "vente"
      ? montantValide(fd.get("montant")) ?? article.prixVente * quantite
      : montantValide(fd.get("montant"));
  const dateMouvement = dateValide(fd.get("date"));

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      if (type === "vente") {
        // Le décrément est conditionné au stock disponible DANS la transaction (RM-016).
        const maj = await tx.articleEconomat.updateMany({
          where: { id: article.id, stock: { gte: quantite } },
          data: { stock: { decrement: quantite } },
        });
        if (maj.count === 0) return "stock" as const;
      } else {
        await tx.articleEconomat.update({
          where: { id: article.id },
          data: { stock: type === "entree" ? { increment: quantite } : quantite },
        });
      }
      const mouvement = await tx.mouvementStock.create({
        data: {
          articleId: article.id, etablissementId: article.etablissementId, type, quantite, montant,
          mode: type === "vente" ? modeValide(fd.get("mode")) : null,
          eleveId: eleve?.id ?? null,
          acheteur: String(fd.get("acheteur") ?? "").trim().slice(0, 120) || null,
          date: dateMouvement,
          dateComptable: dateMouvement, // RM-008
          saisiParId: u.id,
        },
      });
      await journaliserFinance(tx, {
        etablissementId: article.etablissementId, utilisateurId: u.id, action: `stock.${type}`,
        entite: "MouvementStock", entiteId: mouvement.id,
        ancienneValeur: { articleId: article.id, stock: article.stock }, nouvelleValeur: mouvement,
      });
      return "ok" as const;
    });
    if (resultat === "stock") {
      return { ok: false, message: `Stock insuffisant : ${article.stock} « ${article.nom} » en réserve.` };
    }
    revalidatePath(CHEMIN);
    return {
      ok: true,
      message:
        type === "entree" ? `Entrée de ${quantite} « ${article.nom} » enregistrée.`
        : type === "vente" ? `Vente de ${quantite} « ${article.nom} » encaissée (${(montant ?? 0).toLocaleString("fr-FR")} F).`
        : `Stock de « ${article.nom} » ajusté à ${quantite}.`,
    };
  } catch (e) {
    console.error("[finances] mouvement :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Phase 2 : rapprochement bancaire & budget prévisionnel ──

/** Pointe / dépointe une écriture bancaire sur le relevé (rapprochement). */
export async function basculerPointage(cibleType: "paiement" | "operation", id: string): Promise<EtatForm> {
  const cible =
    cibleType === "paiement"
      ? await prisma.paiementScolarite.findUnique({ where: { id }, select: { etablissementId: true, pointeLe: true } })
      : await prisma.operationFinanciere.findUnique({ where: { id }, select: { etablissementId: true, pointeLe: true } });
  if (!cible) return { ok: false, message: "Écriture introuvable." };
  const u = await exigerPermissionFinance(cible.etablissementId, "finance.rapprochement.pointer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const pointeLe = cible.pointeLe ? null : new Date();
  try {
    await prisma.$transaction(async (tx) => {
      if (cibleType === "paiement") await tx.paiementScolarite.update({ where: { id }, data: { pointeLe } });
      else await tx.operationFinanciere.update({ where: { id }, data: { pointeLe } });
      await journaliserFinance(tx, {
        etablissementId: cible.etablissementId, utilisateurId: u.id,
        action: `${cibleType}.${pointeLe ? "pointage" : "depointage"}`,
        entite: cibleType === "paiement" ? "PaiementScolarite" : "OperationFinanciere", entiteId: id,
        ancienneValeur: { pointeLe: cible.pointeLe }, nouvelleValeur: { pointeLe },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: pointeLe ? "Écriture pointée sur le relevé." : "Pointage retiré." };
  } catch (e) {
    console.error("[finances] pointage :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Enregistre le solde du relevé bancaire d'un mois (« AAAA-MM »). */
export async function enregistrerReleve(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.rapprochement.pointer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const mois = String(fd.get("mois") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(mois)) return { ok: false, message: "Mois invalide (format AAAA-MM)." };
  const soldeBrut = Math.trunc(Number(String(fd.get("solde") ?? "").replace(/[\s ]/g, "")));
  if (!Number.isFinite(soldeBrut)) return { ok: false, message: "Solde de relevé invalide." };
  try {
    await prisma.$transaction(async (tx) => {
      const avant = await tx.releveBancaire.findUnique({
        where: { etablissementId_mois: { etablissementId, mois } },
        select: { id: true, mois: true, solde: true },
      });
      const releve = await tx.releveBancaire.upsert({
        where: { etablissementId_mois: { etablissementId, mois } },
        create: { etablissementId, mois, solde: soldeBrut },
        update: { solde: soldeBrut, version: { increment: 1 } },
      });
      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "releve.enregistrement",
        entite: "ReleveBancaire", entiteId: releve.id,
        ancienneValeur: avant ?? undefined, nouvelleValeur: { mois, solde: soldeBrut },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Solde du relevé de ${mois} enregistré.` };
  } catch (e) {
    console.error("[finances] relevé :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

/** Enregistre le budget prévisionnel d'un exercice : lignes = [{categorie, sens, montantPrevu}]. */
export async function enregistrerBudget(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.budgets.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const exercice = String(fd.get("exercice") ?? "").trim().slice(0, 20);
  if (!exercice) return { ok: false, message: "Exercice manquant." };
  let lignes: { categorie: string; sens: string; montantPrevu: number }[] = [];
  try {
    const brut = JSON.parse(String(fd.get("lignes") ?? "[]"));
    if (Array.isArray(brut)) {
      lignes = brut
        .map((l) => ({
          categorie: String(l?.categorie ?? "").trim(),
          sens: String(l?.sens ?? "").trim(),
          montantPrevu: Math.max(0, Math.trunc(Number(l?.montantPrevu)) || 0),
        }))
        .filter((l) => CATEGORIES_OHADA.some((c) => c.code === l.categorie && c.sens === l.sens));
    }
  } catch {
    return { ok: false, message: "Lignes de budget illisibles." };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const avant = await tx.budgetLigne.findMany({
        where: { etablissementId, exercice, annuleLe: null },
        select: { categorie: true, sens: true, montantPrevu: true },
      });
      for (const l of lignes) {
        await tx.budgetLigne.upsert({
          where: {
            etablissementId_exercice_categorie_sens: {
              etablissementId, exercice, categorie: l.categorie, sens: l.sens,
            },
          },
          create: { etablissementId, exercice, ...l },
          update: { montantPrevu: l.montantPrevu, version: { increment: 1 } },
        });
      }
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "budget.enregistrement",
        entite: "BudgetLigne", entiteId: exercice,
        ancienneValeur: avant, nouvelleValeur: lignes,
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Budget ${exercice} enregistré (${lignes.length} ligne(s)).` };
  } catch (e) {
    console.error("[finances] budget :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Phase 3 : clôture d'exercice (à-nouveaux) ──

/**
 * Dernière date de fin d'exercice clôturé (les écritures antérieures sont VERROUILLÉES).
 * RM-004 : les clôtures ANNULÉES (exercices rouverts) ne comptent pas.
 */
async function finExerciceClos(etablissementId: string): Promise<Date | null> {
  const derniere = await prisma.clotureExercice.findFirst({
    where: { etablissementId, annuleLe: null },
    orderBy: { finPeriode: "desc" },
    select: { finPeriode: true },
  });
  return derniere?.finPeriode ?? null;
}

/**
 * Clôture un exercice : calcule le résultat (produits − charges de la période), fige les
 * soldes de trésorerie et les créances en À-NOUVEAUX, et verrouille les écritures de la période.
 */
export async function cloturerExercice(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await exigerPermissionFinance(etablissementId, "finance.clotures.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const exercice = String(fd.get("exercice") ?? "").trim().slice(0, 20);
  if (!exercice) return { ok: false, message: "Exercice manquant." };
  const finPeriode = dateValide(fd.get("finPeriode"));
  const debut = await finExerciceClos(etablissementId);
  if (debut && finPeriode <= debut) {
    return { ok: false, message: "La date de clôture doit être postérieure à la dernière clôture." };
  }
  const periode = { gt: debut ?? undefined, lte: finPeriode };
  try {
    const [scolarite, ventes, operations, clotures] = await Promise.all([
      prisma.paiementScolarite.groupBy({ by: ["mode"], where: { etablissementId, annule: false, date: periode }, _sum: { montant: true } }),
      prisma.mouvementStock.groupBy({ by: ["mode"], where: { etablissementId, type: "vente", date: periode }, _sum: { montant: true } }),
      prisma.operationFinanciere.groupBy({ by: ["mode", "sens"], where: { etablissementId, annule: false, date: periode }, _sum: { montant: true } }),
      prisma.clotureExercice.findMany({ where: { etablissementId, annuleLe: null }, select: { resultat: true, soldes: true } }),
    ]);
    const COMPTE: Record<string, { compte: string; libelle: string }> = {
      especes: { compte: "571", libelle: "Caisse" },
      mobile_money: { compte: "551", libelle: "Monnaie électronique" },
      cheque: { compte: "521", libelle: "Banque" },
      virement: { compte: "521", libelle: "Banque" },
    };
    // Soldes de trésorerie de la PÉRIODE + report des à-nouveaux précédents.
    const treso = new Map<string, { compte: string; libelle: string; solde: number }>();
    const ajouter = (mode: string | null, montant: number) => {
      const c = COMPTE[mode ?? "especes"] ?? COMPTE.especes;
      const cle = c.compte;
      treso.set(cle, { ...c, solde: (treso.get(cle)?.solde ?? 0) + montant });
    };
    let produits = 0, charges = 0;
    for (const r of scolarite) { ajouter(r.mode, r._sum.montant ?? 0); produits += r._sum.montant ?? 0; }
    for (const r of ventes) { ajouter(r.mode, r._sum.montant ?? 0); produits += r._sum.montant ?? 0; }
    for (const r of operations) {
      const m = r._sum.montant ?? 0;
      if (r.sens === "recette") { ajouter(r.mode, m); produits += m; }
      else { ajouter(r.mode, -m); charges += m; }
    }
    for (const cl of clotures) {
      const soldes = Array.isArray(cl.soldes) ? (cl.soldes as { compte?: string; libelle?: string; solde?: number }[]) : [];
      for (const s of soldes) {
        if (!s?.compte || s.compte === "12" || s.compte === "411") continue;
        treso.set(s.compte, { compte: s.compte, libelle: String(s.libelle ?? s.compte), solde: (treso.get(s.compte)?.solde ?? 0) + (s.solde ?? 0) });
      }
    }
    const resultat = produits - charges;
    const reportAnterieur = clotures.reduce((s, c) => s + c.resultat, 0);
    const soldes = [
      ...[...treso.values()].filter((t) => t.solde !== 0),
      { compte: "12", libelle: "Report à nouveau (résultats cumulés)", solde: reportAnterieur + resultat },
    ];
    await prisma.$transaction(async (tx) => {
      const cloture = await tx.clotureExercice.create({
        data: {
          etablissementId, exercice, finPeriode, resultat,
          soldes, notes: String(fd.get("notes") ?? "").trim().slice(0, 500) || null,
          clotureParId: u.id,
          dateValidation: new Date(), // RM-008 : la clôture est validée au moment de sa création
        },
      });
      await journaliserFinance(tx, {
        etablissementId, exerciceId: exercice, utilisateurId: u.id, action: "cloture.creation",
        entite: "ClotureExercice", entiteId: cloture.id,
        nouvelleValeur: { exercice, finPeriode, resultat, soldes, notes: cloture.notes },
      });
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Exercice ${exercice} clôturé — résultat : ${resultat.toLocaleString("fr-FR")} F. Les écritures antérieures au ${finPeriode.toLocaleDateString("fr-FR")} sont verrouillées.` };
  } catch (e) {
    console.error("[finances] clôture :", e);
    return { ok: false, message: "Un exercice porte peut-être déjà ce libellé — vérifiez la liste des clôtures." };
  }
}

/**
 * Rouvre le DERNIER exercice clôturé. RM-004 : la clôture n'est plus SUPPRIMÉE mais ANNULÉE
 * logiquement (annuleLe/annuleParId) — l'instantané reste en base pour l'audit, les à-nouveaux
 * disparaissent des lectures (filtrées annuleLe: null).
 */
export async function rouvrirExercice(id: string): Promise<EtatForm> {
  const cl = await prisma.clotureExercice.findUnique({ where: { id } });
  if (!cl || cl.annuleLe) return { ok: false, message: "Clôture introuvable." };
  const u = await exigerPermissionFinance(cl.etablissementId, "finance.clotures.gerer");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const derniere = await finExerciceClos(cl.etablissementId);
  if (!derniere || derniere.getTime() !== cl.finPeriode.getTime()) {
    return { ok: false, message: "Seul le DERNIER exercice clôturé peut être rouvert." };
  }
  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const maj = await tx.clotureExercice.updateMany({
        where: { id, annuleLe: null },
        data: { annuleLe: new Date(), annuleParId: u.id, version: { increment: 1 } },
      });
      if (maj.count === 0) return "conflit" as const;
      await journaliserFinance(tx, {
        etablissementId: cl.etablissementId, exerciceId: cl.exercice, utilisateurId: u.id,
        action: "cloture.annulation", entite: "ClotureExercice", entiteId: id,
        ancienneValeur: cl,
      });
      return "ok" as const;
    });
    if (resultat === "conflit") return { ok: false, message: MESSAGE_CONFLIT_VERSION };
    revalidatePath(CHEMIN);
    return { ok: true, message: `Exercice ${cl.exercice} rouvert — écritures déverrouillées.` };
  } catch (e) {
    console.error("[finances] réouverture :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
