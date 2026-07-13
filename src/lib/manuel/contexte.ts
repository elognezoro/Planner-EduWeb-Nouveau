import { trouverPays, armoiriesUrl } from "@/lib/referentiels/pays";
import type { CtxManuel } from "./html";

/** Contexte d'entête du manuel (pays officiel, ministère, logos absolus). */
export function contexteManuel(origin: string, paysNom: string | null | undefined): CtxManuel {
  const pays = trouverPays(paysNom) ?? trouverPays("Côte d'Ivoire");
  const dateGeneration = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  return {
    intitulePays: pays?.intitule ?? "République de Côte d'Ivoire",
    devise: pays?.devise ?? "Union – Discipline – Travail",
    ministere: pays?.ministere ?? "Ministère de l'Éducation Nationale et de l'Alphabétisation",
    emblemeUrl: pays ? armoiriesUrl(pays.code) : undefined,
    logoUrl: `${origin}/logo.png`,
    dateGeneration,
  };
}
