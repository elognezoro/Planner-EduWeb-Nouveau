import "server-only";
import { headers } from "next/headers";
import { paysParCode, drapeauUrl, type PaysInfo } from "@/lib/referentiels/pays";
import { indicatifDe } from "@/lib/referentiels/indicatifs";
import { PAYS_DEFAUT } from "@/lib/pays-consulte";

export interface PaysDetecte {
  nom: string;
  code: string; // ISO2 minuscule (référentiel)
  indicatif: string; // ex. « +225 »
  drapeau: string; // URL du drapeau coloré (flagcdn)
}

/**
 * Pays supposé de l'utilisateur, déduit de la géolocalisation de la requête
 * (en-tête « x-vercel-ip-country » posé par Vercel ; absent en local → pays par défaut).
 * L'utilisateur peut ensuite changer son pays à tout moment dans Mon Profil.
 */
export async function paysDetecte(): Promise<PaysDetecte> {
  let info: PaysInfo | null = null;
  try {
    const h = await headers();
    info = paysParCode(h.get("x-vercel-ip-country"));
  } catch {
    /* hors requête : repli défaut */
  }
  if (!info) info = paysParCode("ci") ?? { code: "ci", nom: PAYS_DEFAUT, intitule: "", devise: "", ministere: "" };
  return {
    nom: info.nom,
    code: info.code,
    indicatif: indicatifDe(info.code),
    drapeau: drapeauUrl(info.code, 40),
  };
}
