"use server";

/**
 * Action serveur du sous-module RAPPORTS (18) : génération à la demande d'un rapport du
 * catalogue, avec contrôle RBAC STRICT (RM-1500/1502 : l'utilisateur ne peut générer que les
 * rapports autorisés par son profil). La génération lit les chargeurs des sous-modules (aucune
 * donnée recréée). L'historisation persistée et la planification sont des reports documentés
 * (RM-1501 : le journal d'audit trace déjà les exports via la route CSV/JSON).
 * Fichier "use server" : exports async uniquement (types dans rapports/catalogue.ts).
 */

import { prisma } from "@/lib/prisma";
import { exigerPermissionFinance } from "./commun/rbac";
import { CATALOGUE_RAPPORTS, type RapportGenere } from "./rapports/catalogue";
import { genererRapport } from "./rapports/serveur";

export interface ResultatRapport {
  ok: boolean;
  message?: string;
  rapport?: RapportGenere;
}

async function exerciceDe(etablissementId: string): Promise<string> {
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissementId },
    select: { anneeScolaire: true },
  });
  return etab?.anneeScolaire ?? String(new Date().getFullYear());
}

/** Génère un rapport pour l'aperçu (RBAC vérifié : périmètre + permission de la définition). */
export async function genererRapportApercu(input: { etablissementId: string; code: string }): Promise<ResultatRapport> {
  const etablissementId = String(input?.etablissementId ?? "").slice(0, 50);
  const code = String(input?.code ?? "").slice(0, 60);
  const def = CATALOGUE_RAPPORTS.find((r) => r.code === code);
  if (!def) return { ok: false, message: "Rapport inexistant." };
  const u = await exigerPermissionFinance(etablissementId, def.permission);
  if (!u) return { ok: false, message: "Accès refusé à ce rapport (RM-1500)." };
  try {
    const exercice = await exerciceDe(etablissementId);
    const rapport = await genererRapport(etablissementId, code, exercice);
    if (!rapport) return { ok: false, message: "Rapport inexistant." };
    return { ok: true, rapport };
  } catch (e) {
    console.error("[rapports] génération :", e);
    return { ok: false, message: "Génération impossible (données indisponibles)." };
  }
}
