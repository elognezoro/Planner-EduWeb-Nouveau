import { z } from "zod";

/**
 * Politique de robustesse des mots de passe — SOURCE UNIQUE partagée entre le contrôle serveur
 * (schéma zod `motDePasseFort`) et l'affichage en direct côté client (checklist + barre de force).
 * Modifier un critère ici le répercute automatiquement partout (inscription, réinitialisation,
 * changement de mot de passe, création de comptes).
 */

export interface CritereMotDePasse {
  id: string;
  libelle: string;
  /** Le critère est-il respecté par cette valeur ? */
  teste: (valeur: string) => boolean;
}

export const LONGUEUR_MIN_MOT_DE_PASSE = 8;
export const LONGUEUR_MAX_MOT_DE_PASSE = 100;

export const CRITERES_MOT_DE_PASSE: CritereMotDePasse[] = [
  { id: "longueur", libelle: `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum`, teste: (v) => v.length >= LONGUEUR_MIN_MOT_DE_PASSE },
  { id: "majuscule", libelle: "1 lettre majuscule (A–Z)", teste: (v) => /[A-Z]/.test(v) },
  { id: "minuscule", libelle: "1 lettre minuscule (a–z)", teste: (v) => /[a-z]/.test(v) },
  { id: "chiffre", libelle: "1 chiffre (0–9)", teste: (v) => /\d/.test(v) },
  { id: "special", libelle: "1 caractère spécial (!@#…)", teste: (v) => /[^A-Za-z0-9]/.test(v) },
];

export type NiveauForce = "vide" | "tres-faible" | "faible" | "moyen" | "fort" | "tres-fort";

export interface ForceMotDePasse {
  /** Nombre de critères respectés (0 → total). */
  respectes: number;
  total: number;
  niveau: NiveauForce;
  libelle: string;
}

const LIBELLE_NIVEAU: Record<NiveauForce, string> = {
  vide: "",
  "tres-faible": "Très faible",
  faible: "Faible",
  moyen: "Moyen",
  fort: "Fort",
  "tres-fort": "Très fort",
};

/** Force globale, dérivée du nombre de critères respectés. */
export function evaluerForce(valeur: string): ForceMotDePasse {
  const total = CRITERES_MOT_DE_PASSE.length;
  if (!valeur) return { respectes: 0, total, niveau: "vide", libelle: LIBELLE_NIVEAU.vide };
  const respectes = CRITERES_MOT_DE_PASSE.filter((c) => c.teste(valeur)).length;
  const niveau: NiveauForce =
    respectes <= 1 ? "tres-faible"
    : respectes === 2 ? "faible"
    : respectes === 3 ? "moyen"
    : respectes === 4 ? "fort"
    : "tres-fort";
  return { respectes, total, niveau, libelle: LIBELLE_NIVEAU[niveau] };
}

/** Vrai lorsque TOUS les critères sont respectés. */
export function motDePasseConforme(valeur: string): boolean {
  return CRITERES_MOT_DE_PASSE.every((c) => c.teste(valeur));
}

/** Schéma zod partagé : un mot de passe respectant l'ensemble des critères de sécurité. */
export const motDePasseFort = z
  .string()
  .max(LONGUEUR_MAX_MOT_DE_PASSE, "Mot de passe trop long.")
  .superRefine((valeur, ctx) => {
    const manquants = CRITERES_MOT_DE_PASSE.filter((c) => !c.teste(valeur));
    if (manquants.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Le mot de passe doit contenir : ${manquants.map((c) => c.libelle.toLowerCase()).join(" · ")}.`,
      });
    }
  });
