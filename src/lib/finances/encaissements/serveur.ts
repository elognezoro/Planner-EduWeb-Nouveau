import "server-only";
import { prisma } from "@/lib/prisma";
import type { StatistiquesEncaissementsVue } from "./types";

/**
 * Domaine ENCAISSEMENTS (08) — tableau de bord serveur : recettes du jour / du mois / de
 * l'année, répartition par moyen de paiement, top caissiers, avances disponibles,
 * remboursements payés. (Les clôtures de session et écarts de caisse relèvent du 09-Caisse ;
 * le rapprochement automatique du 10-Banque — reports documentés.)
 */
export async function statistiquesEncaissements(
  etablissementId: string,
): Promise<StatistiquesEncaissementsVue> {
  const maintenant = new Date();
  const debutJour = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  const debutMois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
  const debutAnnee = new Date(Date.UTC(maintenant.getUTCFullYear(), 0, 1));

  const [aggJour, aggMois, aggAnnee, parModeBrut, parCaissierBrut, aggAvances, aggRemboursements] =
    await Promise.all([
      prisma.paiementScolarite.aggregate({
        where: { etablissementId, annule: false, date: { gte: debutJour } },
        _sum: { montant: true },
        _count: { _all: true },
      }),
      prisma.paiementScolarite.aggregate({
        where: { etablissementId, annule: false, date: { gte: debutMois } },
        _sum: { montant: true },
      }),
      prisma.paiementScolarite.aggregate({
        where: { etablissementId, annule: false, date: { gte: debutAnnee } },
        _sum: { montant: true },
      }),
      prisma.paiementScolarite.groupBy({
        by: ["mode"],
        where: { etablissementId, annule: false, date: { gte: debutAnnee } },
        _sum: { montant: true },
      }),
      prisma.paiementScolarite.groupBy({
        by: ["encaisseParId"],
        where: { etablissementId, annule: false, date: { gte: debutAnnee }, encaisseParId: { not: null } },
        _sum: { montant: true },
      }),
      prisma.avanceEleve.aggregate({
        where: { etablissementId, annuleLe: null },
        _sum: { solde: true },
      }),
      prisma.demandeRemboursement.aggregate({
        where: { etablissementId, annuleLe: null, statut: "payee", creeLe: { gte: debutAnnee } },
        _sum: { montant: true },
      }),
    ]);

  const annee = aggAnnee._sum.montant ?? 0;
  const parMode = parModeBrut
    .map((r) => ({
      mode: r.mode,
      total: r._sum.montant ?? 0,
      pourcentage: annee > 0 ? Math.round(((r._sum.montant ?? 0) / annee) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Top 5 caissiers, noms résolus en une requête.
  const topCaissiers = [...parCaissierBrut]
    .sort((a, b) => (b._sum.montant ?? 0) - (a._sum.montant ?? 0))
    .slice(0, 5);
  const caissierIds = topCaissiers.map((c) => c.encaisseParId).filter((id): id is string => !!id);
  const caissiers = caissierIds.length
    ? await prisma.utilisateur.findMany({
        where: { id: { in: caissierIds } },
        select: { id: true, nom: true, prenoms: true },
      })
    : [];
  const nomCaissier = new Map(
    caissiers.map((c) => [c.id, [c.prenoms, c.nom].filter(Boolean).join(" ").trim() || "—"]),
  );

  return {
    jour: aggJour._sum.montant ?? 0,
    nombreJour: aggJour._count._all,
    mois: aggMois._sum.montant ?? 0,
    annee,
    parMode,
    parCaissier: topCaissiers.map((c) => ({
      nom: nomCaissier.get(c.encaisseParId ?? "") ?? "—",
      total: c._sum.montant ?? 0,
    })),
    avancesDisponibles: aggAvances._sum.solde ?? 0,
    remboursementsPayes: aggRemboursements._sum.montant ?? 0,
  };
}
