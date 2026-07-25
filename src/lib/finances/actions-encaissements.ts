"use server";

/**
 * Actions serveur du sous-module ENCAISSEMENTS (08 + 05B/02B) : règlement VENTILÉ d'une ou
 * plusieurs factures (07) en un seul paiement — reçu numéroté via les séquences de la
 * fondation, trop-perçu conservé en AVANCE (crédit du compte élève, 06), cohérence
 * créances/factures recalculée DANS la même transaction.
 *
 * Le flux d'encaissement historique (encaisserPaiement — saisie libre ou par frais) reste
 * inchangé dans actions.ts : le 08 l'ENRICHIT (détails des moyens de paiement, séquences).
 * Fichier "use server" : exports async uniquement (types dans encaissements/types.ts).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { refusEssaiPour } from "@/lib/premium/garde-essai";
import type { EtatForm } from "./actions";
import { journaliserFinance } from "./commun/audit";
import { exigerPermissionFinance } from "./commun/rbac";
import { prochainNumero } from "./commun/numerotation";
import { dateValide, detailsMoyenPaiement, modeValide, montantValide, texteCourt } from "./commun/validation";
import { majStatutFactures, restesFactures } from "./facturation/serveur";
import { controleSessionEspeces } from "./caisse/serveur";

const CHEMIN = "/app/vie-scolaire/finances";

/** Dernière fin d'exercice CLÔTURÉ (contrôle du 08 : « paiement sur un exercice clôturé » refusé). */
async function finExerciceClos(etablissementId: string): Promise<Date | null> {
  const derniere = await prisma.clotureExercice.findFirst({
    where: { etablissementId, annuleLe: null },
    orderBy: { finPeriode: "desc" },
    select: { finPeriode: true },
  });
  return derniere?.finPeriode ?? null;
}

/**
 * ENCAISSE un paiement VENTILÉ sur les factures ouvertes choisies de l'élève (08 :
 * « un seul paiement peut solder plusieurs factures ») :
 *  - UN reçu numéroté (séquences RM-014), UN mode de paiement par encaissement (le
 *    multi-mode du 08 = plusieurs encaissements successifs sur la même facture) ;
 *  - répartition dans l'ordre des échéances (la plus proche d'abord) sur le RESTE DÛ de
 *    chaque facture choisie ;
 *  - TROP-PERÇU → AvanceEleve (« conserver le solde pour une prochaine facture »,
 *    comportement par défaut du 08 — les autres comportements viendront avec le paramétrage) ;
 *  - statuts des factures recalculés DANS la transaction (07).
 */
export async function encaisserSurFactures(_prev: EtatForm, fd: FormData): Promise<EtatForm> {
  const etablissementId = texteCourt(fd.get("etablissementId"), 50);
  const u = await exigerPermissionFinance(etablissementId, "finance.paiements.encaisser");
  if (!u) return { ok: false, message: "Action non autorisée." };
  const rEssai = refusEssaiPour(u);
  if (rEssai) return { ok: false, message: rEssai };

  const eleve = await prisma.utilisateur.findFirst({
    where: { id: texteCourt(fd.get("eleveId"), 50), etablissementId, roleActif: { nomTechnique: "eleve" } },
    select: { id: true, nom: true, prenoms: true },
  });
  if (!eleve) return { ok: false, message: "Élève introuvable dans cet établissement." };

  const montant = montantValide(fd.get("montant"));
  if (!montant) return { ok: false, message: "Montant invalide." };
  const mode = modeValide(fd.get("mode"));
  const date = dateValide(fd.get("date"));
  const clos = await finExerciceClos(etablissementId);
  if (clos && date <= clos) {
    return { ok: false, message: "Cette date appartient à un exercice CLÔTURÉ — écriture refusée." };
  }

  let factureIds: string[] = [];
  try {
    const brut = JSON.parse(String(fd.get("factureIds") ?? "[]"));
    if (Array.isArray(brut)) factureIds = brut.map((x) => String(x)).filter(Boolean).slice(0, 20);
  } catch {
    factureIds = [];
  }
  if (factureIds.length === 0) return { ok: false, message: "Choisissez au moins une facture à régler." };

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // 09-Caisse (RM-500/504) : espèces → session ouverte exigée si caisses actives.
      let sessionCaisseId: string | null = null;
      if (mode === "especes") {
        const controle = await controleSessionEspeces(tx, etablissementId, u.id);
        if (controle.erreur) return { statut: "caisse" as const, message: controle.erreur };
        sessionCaisseId = controle.sessionId;
      }
      // Restes dus RECALCULÉS dans la transaction (cohérence avec l'allocation 06 + 07).
      const restes = (await restesFactures(tx, etablissementId, eleve.id)).filter(
        (f) => factureIds.includes(f.id) && f.reste > 0,
      );
      if (restes.length === 0) return { statut: "rien" as const };

      const { numero } = await prochainNumero(tx, etablissementId, null, "recu", "REC");
      const numeros = restes.map((f) => f.numero ?? "—").join(", ");
      const paiement = await tx.paiementScolarite.create({
        data: {
          etablissementId,
          eleveId: eleve.id,
          // fraisId VOLONTAIREMENT nul : l'affectation de ce paiement passe par ses
          // VENTILATIONS (jamais de double comptage avec l'allocation créances du 06).
          fraisId: null,
          libelle: `Règlement facture(s) ${numeros}`.slice(0, 160),
          montant, mode,
          reference: texteCourt(fd.get("reference"), 80) || null,
          ...detailsMoyenPaiement(fd, mode),
          numeroRecu: numero,
          date, dateComptable: date,
          encaisseParId: u.id, sessionCaisseId,
        },
      });

      // Ventilation dans l'ordre des échéances (restesFactures est déjà trié).
      let disponible = montant;
      const ventilations: { factureId: string; facture: string; montant: number }[] = [];
      for (const f of restes) {
        if (disponible <= 0) break;
        const affecte = Math.min(disponible, f.reste);
        disponible -= affecte;
        await tx.ventilationPaiement.create({
          data: { etablissementId, paiementId: paiement.id, factureId: f.id, montant: affecte },
        });
        ventilations.push({ factureId: f.id, facture: f.numero ?? f.objet, montant: affecte });
      }

      // TROP-PERÇU → avance (crédit conservé pour une prochaine facture, 08).
      let avanceCreee = 0;
      if (disponible > 0) {
        const avance = await tx.avanceEleve.create({
          data: {
            etablissementId, eleveId: eleve.id, montant: disponible, solde: disponible,
            mode, reference: `RECU-${String(numero).padStart(6, "0")}`, dateComptable: date,
          },
        });
        avanceCreee = disponible;
        await journaliserFinance(tx, {
          etablissementId, utilisateurId: u.id, action: "avance.creation",
          entite: "AvanceEleve", entiteId: avance.id,
          nouvelleValeur: { origine: "trop_percu", recu: numero, montant: disponible },
        });
      }

      await journaliserFinance(tx, {
        etablissementId, utilisateurId: u.id, action: "paiement.creation",
        entite: "PaiementScolarite", entiteId: paiement.id,
        nouvelleValeur: { numeroRecu: numero, montant, mode, ventilations, tropPercu: avanceCreee },
      });

      // 07 : les paiements mettent à jour automatiquement le statut des factures.
      await majStatutFactures(tx, { etablissementId, eleveId: eleve.id });

      return { statut: "ok" as const, numero, nombre: ventilations.length, avanceCreee };
    });

    if (resultat.statut === "caisse") return { ok: false, message: resultat.message };
    if (resultat.statut === "rien") {
      return { ok: false, message: "Aucun reste à payer sur les factures choisies (déjà soldées ?)." };
    }
    revalidatePath(CHEMIN);
    const nomEleve = [eleve.prenoms, eleve.nom].filter(Boolean).join(" ").trim() || "—";
    return {
      ok: true,
      message:
        `Encaissement de ${montant.toLocaleString("fr-FR")} F pour ${nomEleve} — reçu n° ${String(resultat.numero).padStart(6, "0")}, ` +
        `${resultat.nombre} facture(s) réglée(s)` +
        (resultat.avanceCreee > 0
          ? ` ; trop-perçu de ${resultat.avanceCreee.toLocaleString("fr-FR")} F conservé en avance.`
          : "."),
    };
  } catch (e) {
    console.error("[encaissements] règlement ventilé :", e);
    return { ok: false, message: "Erreur technique." };
  }
}
