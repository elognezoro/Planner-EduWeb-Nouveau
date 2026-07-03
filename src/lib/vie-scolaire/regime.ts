/**
 * Régime de notation d'un établissement : trimestriel (3), semestriel (2) ou
 * séquentiel (6 ou 8 séquences, au choix du chef d'établissement).
 * L'établissement peut ne rien choisir (null) : le régime de la Configuration
 * générale s'applique alors.
 */

export type RegimeValeur = "trimestre" | "semestre" | "sequence";

export interface InfosRegime {
  regime: RegimeValeur;
  /** Nombre de périodes de notation dans l'année (3, 2, 6 ou 8). */
  nbPeriodes: number;
  /** Libellé complet — « Trimestriel (3 trimestres) ». */
  libelle: string;
  /** Libellé d'une période — « Trimestre », « Semestre », « Séquence ». */
  libellePeriode: string;
  /** Libellé court de l'en-tête de bulletin — « Trimestriel »… */
  apercu: string;
}

export function infosRegime(
  regimeEtablissement?: string | null,
  nbSequences?: number | null,
  regimeGlobal?: string | null,
): InfosRegime {
  const regime = (regimeEtablissement ?? regimeGlobal ?? "trimestre") as RegimeValeur;
  if (regime === "semestre") {
    return { regime, nbPeriodes: 2, libelle: "Semestriel (2 semestres)", libellePeriode: "Semestre", apercu: "Semestriel" };
  }
  if (regime === "sequence") {
    const nb = nbSequences === 8 ? 8 : 6;
    return { regime, nbPeriodes: nb, libelle: `Séquentiel (${nb} séquences)`, libellePeriode: "Séquence", apercu: "Séquentiel" };
  }
  return { regime: "trimestre", nbPeriodes: 3, libelle: "Trimestriel (3 trimestres)", libellePeriode: "Trimestre", apercu: "Trimestriel" };
}
