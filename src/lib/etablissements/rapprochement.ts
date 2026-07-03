import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Rapprochement d'un nom d'établissement saisi en texte libre vers l'établissement
 * au nom le plus proche déjà présent sur la plateforme, DANS LE PAYS DONNÉ.
 * Utilisé à la validation du compte (approbation de la demande de rôle) pour
 * transformer « lycee moderne cocody » en l'établissement réel correspondant.
 */

function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Similarité de Dice sur les bigrammes (0..1) — robuste aux fautes et inversions. */
function similarite(a: string, b: string): number {
  const bigrammes = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const A = bigrammes(a);
  const B = bigrammes(b);
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0;
  let commun = 0;
  for (const [bg, n] of A) commun += Math.min(n, B.get(bg) ?? 0);
  let totalA = 0;
  for (const n of A.values()) totalA += n;
  let totalB = 0;
  for (const n of B.values()) totalB += n;
  return (2 * commun) / (totalA + totalB);
}

export interface EtabRapproche {
  id: string;
  nom: string;
  ville: string | null;
  score: number; // 0..1
}

/**
 * Meilleur établissement correspondant au texte saisi, dans le pays donné.
 * Renvoie null si rien d'assez proche (score < 0,45).
 */
export async function rapprocherEtablissement(
  texte: string | null | undefined,
  pays: string,
): Promise<EtabRapproche | null> {
  const brut = (texte ?? "").trim();
  if (brut.length < 3) return null;
  const cible = normaliser(brut);

  // 1. Candidats : chaque mot significatif doit apparaître (nom/ville), pays imposé.
  const termes = cible.split(" ").filter((t) => t.length >= 3);
  const ou = termes.length > 0 ? termes : [cible];
  const candidats = await prisma.etablissement.findMany({
    where: {
      pays: { equals: pays, mode: "insensitive" },
      OR: ou.map((t) => ({
        OR: [
          { nom: { contains: t, mode: "insensitive" as const } },
          { ville: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, nom: true, ville: true },
    take: 200,
  });
  if (candidats.length === 0) return null;

  // 2. Score : similarité sur le nom, avec bonus si la ville saisie correspond.
  let meilleur: EtabRapproche | null = null;
  for (const c of candidats) {
    const scoreNom = similarite(cible, normaliser(c.nom));
    const scoreNomVille = c.ville ? similarite(cible, normaliser(`${c.nom} ${c.ville}`)) : 0;
    const score = Math.max(scoreNom, scoreNomVille);
    if (!meilleur || score > meilleur.score) meilleur = { id: c.id, nom: c.nom, ville: c.ville, score };
  }
  return meilleur && meilleur.score >= 0.45 ? meilleur : null;
}
