import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sensMouvementCaisse,
  type CaisseVue, type LigneJournalCaisse, type MouvementCaisseVue, type SessionCaisseVue,
  type TableauBordCaisseVue,
} from "./types";

/**
 * Domaine CAISSE (09) — calculs et chargeurs serveur (aucune action ici, cf. 02B).
 *
 * Périmètre du SOLDE de caisse : seuls les flux en ESPÈCES modifient le tiroir —
 * paiements espèces rattachés (RM-504), opérations du journal OHADA en espèces rattachées,
 * et mouvements internes (approvisionnements, décaissements, transferts, versements/retraits
 * banque, régularisations). Les encaissements d'autres modes restent au journal des paiements.
 * RM-503 : le solde théorique d'une session OUVERTE est CALCULÉ ; il n'est FIGÉ qu'à la
 * clôture (RM-505 : plus rien ne bouge ensuite).
 */

/** L'établissement utilise-t-il des caisses PHYSIQUES actives ? (active le contrôle du 08). */
export async function etablissementUtiliseCaisses(
  db: Prisma.TransactionClient,
  etablissementId: string,
): Promise<boolean> {
  const n = await db.caisseEtablissement.count({
    where: { etablissementId, type: "physique", statut: "active", annuleLe: null },
  });
  return n > 0;
}

/** Session OUVERTE du caissier courant (unique par caissier — index partiel). */
export async function sessionOuverteDuCaissier(
  db: Prisma.TransactionClient,
  etablissementId: string,
  utilisateurId: string,
): Promise<{ id: string; caisseId: string } | null> {
  return db.sessionCaisse.findFirst({
    where: { etablissementId, caissierId: utilisateurId, statut: "ouverte", annuleLe: null },
    select: { id: true, caisseId: true },
  });
}

/**
 * CONTRÔLE « caisse fermée » (RM-500, promis au 08) pour un encaissement en ESPÈCES :
 * - l'établissement n'utilise PAS de caisses physiques → aucun contrôle (compatibilité) ;
 * - sinon, une session OUVERTE du caissier courant est exigée (le paiement y est rattaché).
 */
export async function controleSessionEspeces(
  db: Prisma.TransactionClient,
  etablissementId: string,
  utilisateurId: string,
): Promise<{ sessionId: string | null; erreur: string | null }> {
  if (!(await etablissementUtiliseCaisses(db, etablissementId))) {
    return { sessionId: null, erreur: null };
  }
  const session = await sessionOuverteDuCaissier(db, etablissementId, utilisateurId);
  if (!session) {
    return {
      sessionId: null,
      erreur: "Caisse fermée : ouvrez d'abord votre session de caisse (onglet Caisses) pour encaisser en espèces.",
    };
  }
  return { sessionId: session.id, erreur: null };
}

export interface TotauxSession {
  totalEncaissements: number;
  totalDecaissements: number;
  soldeTheorique: number;
}

/** Totaux et solde THÉORIQUE d'une session (RM-503) — espèces uniquement. */
export async function totauxSession(
  db: Prisma.TransactionClient,
  sessionId: string,
  fondsInitial: number,
): Promise<TotauxSession> {
  const [paiements, operations, mouvements] = await Promise.all([
    db.paiementScolarite.aggregate({
      where: { sessionCaisseId: sessionId, annule: false, mode: "especes" },
      _sum: { montant: true },
    }),
    db.operationFinanciere.groupBy({
      by: ["sens"],
      where: { sessionCaisseId: sessionId, annule: false, mode: "especes" },
      _sum: { montant: true },
    }),
    db.mouvementCaisse.findMany({
      where: { sessionId, annuleLe: null },
      select: { type: true, montant: true },
    }),
  ]);
  let totalEncaissements = paiements._sum.montant ?? 0;
  let totalDecaissements = 0;
  for (const o of operations) {
    if (o.sens === "recette") totalEncaissements += o._sum.montant ?? 0;
    else totalDecaissements += o._sum.montant ?? 0;
  }
  for (const m of mouvements) {
    const sens = sensMouvementCaisse(m.type);
    if (sens > 0) totalEncaissements += m.montant;
    else if (sens < 0) totalDecaissements += m.montant;
  }
  return {
    totalEncaissements,
    totalDecaissements,
    soldeTheorique: fondsInitial + totalEncaissements - totalDecaissements,
  };
}

const nomPersonne = (p: { nom: string | null; prenoms: string | null } | null) =>
  p ? [p.prenoms, p.nom].filter(Boolean).join(" ").trim() || "—" : "—";

type SessionBrute = Prisma.SessionCaisseGetPayload<{
  include: {
    caisse: { select: { nom: true } };
    caissier: { select: { nom: true; prenoms: true } };
    mouvements: {
      where: { annuleLe: null };
      orderBy: { creeLe: "asc" };
      select: {
        id: true; type: true; montant: true; beneficiaire: true; motif: true;
        pieceJustificative: true; creeLe: true; annuleLe: true; version: true;
      };
    };
  };
}>;

/** Charge caisses + sessions (ouvertes et récentes) + tableau de bord — vues sérialisables. */
export async function chargerCaisses(etablissementId: string): Promise<{
  caisses: CaisseVue[];
  sessionsRecentes: SessionCaisseVue[];
  tableauBord: TableauBordCaisseVue;
}> {
  const maintenant = new Date();
  const debutJour = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  const inclusionSession = {
    caisse: { select: { nom: true } },
    caissier: { select: { nom: true, prenoms: true } },
    mouvements: {
      where: { annuleLe: null },
      orderBy: { creeLe: "asc" as const },
      select: {
        id: true, type: true, montant: true, beneficiaire: true, motif: true,
        pieceJustificative: true, creeLe: true, annuleLe: true, version: true,
      },
    },
  };

  const [caissesBrutes, sessionsOuvertes, sessionsCloturees, versementsJour, ecartsEnAttente] =
    await Promise.all([
      prisma.caisseEtablissement.findMany({
        where: { etablissementId, annuleLe: null },
        orderBy: { nom: "asc" },
        include: { responsable: { select: { nom: true, prenoms: true } } },
      }),
      prisma.sessionCaisse.findMany({
        where: { etablissementId, statut: "ouverte", annuleLe: null },
        include: inclusionSession,
      }),
      prisma.sessionCaisse.findMany({
        where: { etablissementId, statut: "cloturee", annuleLe: null },
        orderBy: { clotureeLe: "desc" },
        take: 12,
        include: inclusionSession,
      }),
      prisma.mouvementCaisse.aggregate({
        where: { etablissementId, type: "versement_banque", annuleLe: null, creeLe: { gte: debutJour } },
        _sum: { montant: true },
      }),
      prisma.sessionCaisse.count({
        where: {
          etablissementId, statut: "cloturee", annuleLe: null,
          ecart: { not: 0 }, ecartValideParId: null,
        },
      }),
    ]);

  // Journal : paiements espèces + opérations rattachées, chargés EN BLOC pour toutes les sessions.
  const idsSessions = [...sessionsOuvertes, ...sessionsCloturees].map((s) => s.id);
  const [paiementsRattaches, operationsRattachees] = await Promise.all([
    idsSessions.length
      ? prisma.paiementScolarite.findMany({
          where: { sessionCaisseId: { in: idsSessions }, mode: "especes" },
          orderBy: { creeLe: "asc" },
          take: 2000,
          select: {
            id: true, sessionCaisseId: true, numeroRecu: true, montant: true, annule: true,
            creeLe: true, eleve: { select: { nom: true, prenoms: true } },
          },
        })
      : Promise.resolve([]),
    idsSessions.length
      ? prisma.operationFinanciere.findMany({
          where: { sessionCaisseId: { in: idsSessions }, mode: "especes" },
          orderBy: { creeLe: "asc" },
          take: 2000,
          select: { id: true, sessionCaisseId: true, sens: true, libelle: true, montant: true, annule: true, creeLe: true },
        })
      : Promise.resolve([]),
  ]);

  async function versVue(s: SessionBrute): Promise<SessionCaisseVue> {
    const mouvements: MouvementCaisseVue[] = s.mouvements.map((m) => ({
      id: m.id, type: m.type, montant: m.montant, beneficiaire: m.beneficiaire, motif: m.motif,
      pieceJustificative: m.pieceJustificative, creeLe: m.creeLe.toISOString(),
      annule: m.annuleLe !== null, version: m.version,
    }));
    const journal: LigneJournalCaisse[] = [
      ...paiementsRattaches
        .filter((p) => p.sessionCaisseId === s.id)
        .map((p) => ({
          id: `p-${p.id}`,
          heure: p.creeLe.toISOString(),
          libelle: `Reçu n° ${String(p.numeroRecu).padStart(6, "0")} — ${nomPersonne(p.eleve)}`,
          categorie: "Encaissement",
          sens: 1 as const,
          montant: p.montant,
          annule: p.annule,
        })),
      ...operationsRattachees
        .filter((o) => o.sessionCaisseId === s.id)
        .map((o) => ({
          id: `o-${o.id}`,
          heure: o.creeLe.toISOString(),
          libelle: o.libelle,
          categorie: o.sens === "recette" ? "Recette diverse" : "Dépense",
          sens: (o.sens === "recette" ? 1 : -1) as 1 | -1,
          montant: o.montant,
          annule: o.annule,
        })),
      ...s.mouvements.map((m) => ({
        id: `m-${m.id}`,
        heure: m.creeLe.toISOString(),
        libelle: [m.motif, m.beneficiaire].filter(Boolean).join(" — ") || m.type,
        categorie: m.type,
        sens: (sensMouvementCaisse(m.type) >= 0 ? 1 : -1) as 1 | -1,
        montant: m.montant,
        annule: m.annuleLe !== null,
      })),
    ].sort((a, b) => a.heure.localeCompare(b.heure));

    // Session ouverte : solde CALCULÉ (RM-503) ; clôturée : totaux FIGÉS (RM-505).
    const totaux =
      s.statut === "ouverte"
        ? await totauxSession(prisma, s.id, s.fondsInitial)
        : {
            totalEncaissements: s.totalEncaissements ?? 0,
            totalDecaissements: s.totalDecaissements ?? 0,
            soldeTheorique: s.soldeTheorique ?? s.fondsInitial,
          };

    return {
      id: s.id,
      caisseId: s.caisseId,
      caisseNom: s.caisse.nom,
      caissierId: s.caissierId,
      caissierNom: nomPersonne(s.caissier),
      statut: s.statut,
      fondsInitial: s.fondsInitial,
      observations: s.observations,
      ouverteLe: s.ouverteLe.toISOString(),
      clotureeLe: s.clotureeLe ? s.clotureeLe.toISOString() : null,
      soldeTheorique: totaux.soldeTheorique,
      totalEncaissements: totaux.totalEncaissements,
      totalDecaissements: totaux.totalDecaissements,
      soldeReel: s.soldeReel,
      ecart: s.ecart,
      typeEcart: s.typeEcart,
      motifEcart: s.motifEcart,
      ecartValide: s.ecartValideParId !== null,
      montantAVerser: s.montantAVerser,
      version: s.version,
      mouvements,
      journal,
    };
  }

  const vuesOuvertes = await Promise.all(sessionsOuvertes.map(versVue));
  const sessionsRecentes = await Promise.all(sessionsCloturees.map(versVue));
  const ouverteParCaisse = new Map(vuesOuvertes.map((v) => [v.caisseId, v]));
  const dernierSoldeReelParCaisse = new Map<string, number>();
  for (const s of sessionsCloturees) {
    if (!dernierSoldeReelParCaisse.has(s.caisseId) && s.soldeReel !== null) {
      dernierSoldeReelParCaisse.set(s.caisseId, s.soldeReel);
    }
  }

  const caisses: CaisseVue[] = caissesBrutes.map((c) => {
    const sessionOuverte = ouverteParCaisse.get(c.id) ?? null;
    const alertes: string[] = [];
    if (sessionOuverte) {
      if (c.plafond !== null && sessionOuverte.soldeTheorique > c.plafond) {
        alertes.push(`Plafond dépassé (${c.plafond.toLocaleString("fr-FR")} F)`);
      }
      if (sessionOuverte.soldeTheorique < 0) alertes.push("Solde théorique négatif");
      const ouverteDepuis = Date.now() - new Date(sessionOuverte.ouverteLe).getTime();
      if (ouverteDepuis > 24 * 3600 * 1000) alertes.push("Session non clôturée depuis plus de 24 h");
    }
    return {
      id: c.id,
      nom: c.nom,
      code: c.code,
      type: c.type,
      responsableId: c.responsableId,
      responsableNom: c.responsable ? nomPersonne(c.responsable) : null,
      plafond: c.plafond,
      decouvertAutorise: c.decouvertAutorise,
      statut: c.statut,
      ouverte: sessionOuverte !== null, // DÉRIVÉ — jamais stocké (09)
      sessionOuverte,
      dernierSoldeReel: dernierSoldeReelParCaisse.get(c.id) ?? null,
      alertes,
      version: c.version,
    };
  });

  return {
    caisses,
    sessionsRecentes,
    tableauBord: {
      caissesOuvertes: vuesOuvertes.length,
      caissesTotal: caisses.length,
      montantEnCaisse: vuesOuvertes.reduce((s, v) => s + v.soldeTheorique, 0),
      versementsDuJour: versementsJour._sum.montant ?? 0,
      ecartsEnAttente,
    },
  };
}
