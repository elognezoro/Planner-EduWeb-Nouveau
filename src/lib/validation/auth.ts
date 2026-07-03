import { z } from "zod";
import { estRoleValide } from "@/lib/rbac";
import { capitaliserPrenoms, majusculesNom } from "@/lib/texte";

/** Rôle demandé à l'inscription : un rôle valide, sauf `admin` (compte d'amorçage interne). */
const roleSouhaite = z
  .string()
  .refine((v) => estRoleValide(v) && v !== "admin", {
    message: "Rôle souhaité invalide.",
  });

const motDePasse = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(100, "Mot de passe trop long.");

export const schemaInscription = z
  .object({
    // Casse normalisée aussi côté serveur (le client ne fait qu'assister la saisie) :
    // Prénoms en « Première Lettre Majuscule », NOM tout en MAJUSCULES.
    prenoms: z.string().trim().min(1, "Prénoms requis.").max(80).transform(capitaliserPrenoms),
    nom: z.string().trim().min(1, "Nom requis.").max(80).transform(majusculesNom),
    email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
    telephone: z.string().trim().max(30).optional().or(z.literal("")),
    roleSouhaite,
    structureDeclaree: z.string().trim().max(160).optional().or(z.literal("")),
    motDePasse,
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export const schemaConnexion = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  motDePasse: z.string().min(1, "Mot de passe requis."),
});

export const schemaDemandeReset = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
});

export const schemaReset = z
  .object({
    token: z.string().min(1),
    motDePasse,
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export type DonneesInscription = z.infer<typeof schemaInscription>;
