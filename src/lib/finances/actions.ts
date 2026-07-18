"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUtilisateurCourant } from "@/lib/auth/session";
import { refusEssaiPour } from "@/lib/premium/garde-essai";

export interface EtatForm {
  ok: boolean;
  message?: string;
}

const CHEMIN = "/app/vie-scolaire/finances";
const MODES = new Set(["especes", "mobile_money", "cheque", "virement"]);

import { CATEGORIES_OHADA } from "./categories";

/**
 * Qui gère les FINANCES de cet établissement : admin système, et — pour LEUR établissement —
 * l'Économe, le Chef, l'ACE et l'Admin Établissements. Aperçu de rôle = jamais d'écriture.
 */
async function peutGererFinances(etablissementId: string) {
  const u = await getUtilisateurCourant();
  if (!u || u.apercuActif || !etablissementId) return null;
  if (u.roleReel === "admin") return u;
  if (
    (u.roleReel === "econome" ||
      u.roleReel === "chef_etablissement" ||
      u.roleReel === "adjoint_chef_etablissement" ||
      u.roleReel === "etablissements_admin") &&
    u.portee.etablissementId === etablissementId
  ) {
    return u;
  }
  return null;
}

function montantValide(v: FormDataEntryValue | null): number | null {
  const n = Math.trunc(Number(String(v ?? "").replace(/[\s ]/g, "")));
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 ? n : null;
}
function modeValide(v: FormDataEntryValue | null): string {
  const m = String(v ?? "").trim();
  return MODES.has(m) ? m : "especes";
}
function dateValide(v: FormDataEntryValue | null): Date {
  const s = String(v ?? "").trim();
  const d = s ? new Date(s) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

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
  const u = await peutGererFinances(etablissementId);
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

  const anneeActive = await prisma.anneeScolaire.findFirst({ where: { active: true }, select: { id: true } });
  const donnees = {
    libelle, montant, niveauId, obligatoire,
    tranches: tranches.length ? tranches : undefined,
    anneeScolaireId: anneeActive?.id ?? null,
  };
  const id = String(fd.get("id") ?? "").trim();
  try {
    if (id) {
      const existant = await prisma.fraisScolarite.findFirst({ where: { id, etablissementId }, select: { id: true } });
      if (!existant) return { ok: false, message: "Frais introuvable." };
      await prisma.fraisScolarite.update({ where: { id }, data: { ...donnees, tranches: tranches.length ? tranches : [] } });
    } else {
      await prisma.fraisScolarite.create({ data: { etablissementId, ...donnees } });
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
  if (!(await peutGererFinances(f.etablissementId))) return { ok: false, message: "Action non autorisée." };
  await prisma.fraisScolarite.update({ where: { id }, data: { actif } });
  revalidatePath(CHEMIN);
  return { ok: true, message: actif ? "Frais réactivé." : "Frais désactivé." };
}

// ── Remises & bourses ──

export async function accorderRemise(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await peutGererFinances(etablissementId);
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
    await prisma.remiseEleve.create({
      data: {
        etablissementId, eleveId: eleve.id, fraisId, type, libelle,
        montant: pourcentage ? null : montant, pourcentage, accordeParId: u.id,
      },
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `${type === "bourse" ? "Bourse" : "Remise"} accordée à ${[eleve.prenoms, eleve.nom].filter(Boolean).join(" ")}.` };
  } catch (e) {
    console.error("[finances] remise :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

export async function supprimerRemise(id: string): Promise<EtatForm> {
  const r = await prisma.remiseEleve.findUnique({ where: { id }, select: { etablissementId: true } });
  if (!r) return { ok: false, message: "Remise introuvable." };
  if (!(await peutGererFinances(r.etablissementId))) return { ok: false, message: "Action non autorisée." };
  await prisma.remiseEleve.delete({ where: { id } });
  revalidatePath(CHEMIN);
  return { ok: true, message: "Remise retirée." };
}

// ── Encaissements de scolarité (reçus numérotés) ──

export async function encaisserPaiement(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await peutGererFinances(etablissementId);
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
      return tx.paiementScolarite.create({
        data: {
          etablissementId, eleveId: eleve.id, fraisId, libelle, montant, mode, reference, date,
          numeroRecu: (dernier?.numeroRecu ?? 0) + 1, encaisseParId: u.id,
        },
        select: { numeroRecu: true },
      });
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
  if (!(await peutGererFinances(p.etablissementId))) return { ok: false, message: "Action non autorisée." };
  const clos = await finExerciceClos(p.etablissementId);
  if (clos && p.date <= clos) return { ok: false, message: "Écriture d'un exercice CLÔTURÉ — annulation impossible (rouvrez l'exercice d'abord)." };
  await prisma.paiementScolarite.update({ where: { id }, data: { annule: true, motifAnnulation: motif } });
  revalidatePath(CHEMIN);
  return { ok: true, message: "Paiement annulé (le reçu reste tracé)." };
}

// ── Journal recettes / dépenses (caisse & banque) ──

export async function enregistrerOperation(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await peutGererFinances(etablissementId);
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
    await prisma.operationFinanciere.create({
      data: {
        etablissementId, sens, categorie, libelle, montant,
        mode: modeValide(fd.get("mode")),
        reference: String(fd.get("reference") ?? "").trim().slice(0, 80) || null,
        date: dateValide(fd.get("date")), saisiParId: u.id,
      },
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
  const o = await prisma.operationFinanciere.findUnique({ where: { id }, select: { etablissementId: true, annule: true, date: true } });
  if (!o) return { ok: false, message: "Opération introuvable." };
  if (o.annule) return { ok: false, message: "Opération déjà annulée." };
  if (!(await peutGererFinances(o.etablissementId))) return { ok: false, message: "Action non autorisée." };
  const clos = await finExerciceClos(o.etablissementId);
  if (clos && o.date <= clos) return { ok: false, message: "Écriture d'un exercice CLÔTURÉ — annulation impossible (rouvrez l'exercice d'abord)." };
  await prisma.operationFinanciere.update({ where: { id }, data: { annule: true, motifAnnulation: motif } });
  revalidatePath(CHEMIN);
  return { ok: true, message: "Opération annulée (elle reste tracée au journal)." };
}

// ── Économat : articles, stocks et ventes ──

export async function enregistrerArticle(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await peutGererFinances(etablissementId);
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
      const existant = await prisma.articleEconomat.findFirst({ where: { id, etablissementId }, select: { id: true } });
      if (!existant) return { ok: false, message: "Article introuvable." };
      await prisma.articleEconomat.update({ where: { id }, data: donnees });
    } else {
      await prisma.articleEconomat.create({ data: { etablissementId, ...donnees } });
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
  const u = await peutGererFinances(article.etablissementId);
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

  try {
    await prisma.$transaction([
      prisma.articleEconomat.update({
        where: { id: article.id },
        data: { stock: type === "entree" ? { increment: quantite } : type === "vente" ? { decrement: quantite } : quantite },
      }),
      prisma.mouvementStock.create({
        data: {
          articleId: article.id, etablissementId: article.etablissementId, type, quantite, montant,
          mode: type === "vente" ? modeValide(fd.get("mode")) : null,
          eleveId: eleve?.id ?? null,
          acheteur: String(fd.get("acheteur") ?? "").trim().slice(0, 120) || null,
          date: dateValide(fd.get("date")), saisiParId: u.id,
        },
      }),
    ]);
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
  const u = await peutGererFinances(cible.etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée." };
  const pointeLe = cible.pointeLe ? null : new Date();
  if (cibleType === "paiement") await prisma.paiementScolarite.update({ where: { id }, data: { pointeLe } });
  else await prisma.operationFinanciere.update({ where: { id }, data: { pointeLe } });
  revalidatePath(CHEMIN);
  return { ok: true, message: pointeLe ? "Écriture pointée sur le relevé." : "Pointage retiré." };
}

/** Enregistre le solde du relevé bancaire d'un mois (« AAAA-MM »). */
export async function enregistrerReleve(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = String(fd.get("etablissementId") ?? "").trim();
  const u = await peutGererFinances(etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };
  const mois = String(fd.get("mois") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(mois)) return { ok: false, message: "Mois invalide (format AAAA-MM)." };
  const soldeBrut = Math.trunc(Number(String(fd.get("solde") ?? "").replace(/[\s ]/g, "")));
  if (!Number.isFinite(soldeBrut)) return { ok: false, message: "Solde de relevé invalide." };
  try {
    await prisma.releveBancaire.upsert({
      where: { etablissementId_mois: { etablissementId, mois } },
      create: { etablissementId, mois, solde: soldeBrut },
      update: { solde: soldeBrut },
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
  const u = await peutGererFinances(etablissementId);
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
    await prisma.$transaction(
      lignes.map((l) =>
        prisma.budgetLigne.upsert({
          where: {
            etablissementId_exercice_categorie_sens: {
              etablissementId, exercice, categorie: l.categorie, sens: l.sens,
            },
          },
          create: { etablissementId, exercice, ...l },
          update: { montantPrevu: l.montantPrevu },
        }),
      ),
    );
    revalidatePath(CHEMIN);
    return { ok: true, message: `Budget ${exercice} enregistré (${lignes.length} ligne(s)).` };
  } catch (e) {
    console.error("[finances] budget :", e);
    return { ok: false, message: "Erreur technique." };
  }
}

// ── Phase 3 : clôture d'exercice (à-nouveaux) ──

/** Dernière date de fin d'exercice clôturé (les écritures antérieures sont VERROUILLÉES). */
async function finExerciceClos(etablissementId: string): Promise<Date | null> {
  const derniere = await prisma.clotureExercice.findFirst({
    where: { etablissementId },
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
  const u = await peutGererFinances(etablissementId);
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
      prisma.clotureExercice.findMany({ where: { etablissementId }, select: { resultat: true, soldes: true } }),
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
    await prisma.clotureExercice.create({
      data: {
        etablissementId, exercice, finPeriode, resultat,
        soldes, notes: String(fd.get("notes") ?? "").trim().slice(0, 500) || null,
        clotureParId: u.id,
      },
    });
    revalidatePath(CHEMIN);
    return { ok: true, message: `Exercice ${exercice} clôturé — résultat : ${resultat.toLocaleString("fr-FR")} F. Les écritures antérieures au ${finPeriode.toLocaleDateString("fr-FR")} sont verrouillées.` };
  } catch (e) {
    console.error("[finances] clôture :", e);
    return { ok: false, message: "Un exercice porte peut-être déjà ce libellé — vérifiez la liste des clôtures." };
  }
}

/** Rouvre le DERNIER exercice clôturé (supprime l'instantané ; les à-nouveaux disparaissent). */
export async function rouvrirExercice(id: string): Promise<EtatForm> {
  const cl = await prisma.clotureExercice.findUnique({ where: { id }, select: { etablissementId: true, finPeriode: true, exercice: true } });
  if (!cl) return { ok: false, message: "Clôture introuvable." };
  const u = await peutGererFinances(cl.etablissementId);
  if (!u) return { ok: false, message: "Action non autorisée." };
  const derniere = await finExerciceClos(cl.etablissementId);
  if (!derniere || derniere.getTime() !== cl.finPeriode.getTime()) {
    return { ok: false, message: "Seul le DERNIER exercice clôturé peut être rouvert." };
  }
  await prisma.clotureExercice.delete({ where: { id } });
  revalidatePath(CHEMIN);
  return { ok: true, message: `Exercice ${cl.exercice} rouvert — écritures déverrouillées.` };
}
