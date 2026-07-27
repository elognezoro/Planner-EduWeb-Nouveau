import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SerieMois } from "./catalogue";

/**
 * Domaine TABLEAU DE BORD (19) — le cockpit dérive à 100 % des vues déjà chargées par la page
 * (aucune requête dupliquée). Seule agrégation dédiée : la SÉRIE MENSUELLE recettes/dépenses
 * des 12 derniers mois pour la courbe d'évolution (données validées uniquement — RM-1601).
 */

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * Série des 12 derniers mois : recettes (scolarité + économat + opérations recette) et dépenses.
 *
 * Scalabilité : c'est une COURBE DE TENDANCE HISTORIQUE affichée sur l'onglet par défaut (donc à
 * CHAQUE ouverture de la page Finances, pour tout rôle). On la met en cache inter-requêtes court
 * (unstable_cache, TTL 120 s, clé/ tag par établissement) : 3 findMany + agrégation sortent du
 * chemin critique de rendu. La péremption est INOFFENSIVE ici (les mois passés ne bougent pas ;
 * le mois courant a au pire ~2 min de retard sur un graphe de tendance, jamais un total d'argent
 * actionnable). En bonus, chaque action finance appelle déjà revalidatePath("/app/vie-scolaire/
 * finances"), dont le softTag de chemin invalide aussi cette entrée à l'écriture.
 */
export async function serieMensuelleFinances(etablissementId: string): Promise<SerieMois[]> {
  return unstable_cache(
    () => calculerSerieMensuelle(etablissementId),
    ["finances-serie-mensuelle", etablissementId],
    { revalidate: 120, tags: [`finances:${etablissementId}`] },
  )();
}

async function calculerSerieMensuelle(etablissementId: string): Promise<SerieMois[]> {
  const maintenant = new Date();
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 11, 1));

  const [paiements, ventes, operations] = await Promise.all([
    prisma.paiementScolarite.findMany({
      where: { etablissementId, annule: false, date: { gte: debut } },
      select: { date: true, montant: true },
    }),
    prisma.mouvementStock.findMany({
      where: { etablissementId, type: "vente", annuleLe: null, date: { gte: debut } },
      select: { date: true, montant: true },
    }),
    prisma.operationFinanciere.findMany({
      where: { etablissementId, annule: false, date: { gte: debut } },
      select: { date: true, sens: true, montant: true },
    }),
  ]);

  // Squelette des 12 mois (du plus ancien au plus récent).
  const series = new Map<string, SerieMois>();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + i, 1));
    const cle = d.toISOString().slice(0, 7);
    series.set(cle, { mois: cle, libelle: `${MOIS_COURTS[d.getUTCMonth()]} ${d.getUTCFullYear()}`, recettes: 0, depenses: 0 });
  }
  const cleDe = (d: Date) => d.toISOString().slice(0, 7);
  const ajouter = (d: Date, champ: "recettes" | "depenses", montant: number) => {
    const s = series.get(cleDe(d));
    if (s) s[champ] += montant;
  };

  for (const p of paiements) ajouter(p.date, "recettes", p.montant);
  for (const v of ventes) ajouter(v.date, "recettes", v.montant ?? 0);
  for (const o of operations) ajouter(o.date, o.sens === "recette" ? "recettes" : "depenses", o.montant);

  return [...series.values()];
}
