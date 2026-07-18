/**
 * Plan comptable OHADA SIMPLIFIÉ (classes 6 et 7) — imputation des dépenses/recettes.
 * La comptabilité OHADA complète (grand livre, balance, bilan) est prévue en phase 2.
 * (Module séparé des actions : un fichier « use server » ne peut exporter que des fonctions.)
 */
export const CATEGORIES_OHADA = [
  { code: "601", libelle: "Achats de fournitures scolaires", sens: "depense" },
  { code: "604", libelle: "Achats stockés (économat, cantine)", sens: "depense" },
  { code: "605", libelle: "Eau, électricité et énergie", sens: "depense" },
  { code: "61", libelle: "Transports", sens: "depense" },
  { code: "62", libelle: "Services extérieurs (loyers, entretien)", sens: "depense" },
  { code: "63", libelle: "Autres services (communication, banque)", sens: "depense" },
  { code: "64", libelle: "Impôts et taxes", sens: "depense" },
  { code: "66", libelle: "Charges de personnel", sens: "depense" },
  { code: "67", libelle: "Frais financiers", sens: "depense" },
  { code: "65", libelle: "Autres charges", sens: "depense" },
  { code: "706", libelle: "Prestations (droits d'examen, activités)", sens: "recette" },
  { code: "707", libelle: "Ventes de marchandises (économat)", sens: "recette" },
  { code: "71", libelle: "Subventions d'exploitation", sens: "recette" },
  { code: "75", libelle: "Autres produits (dons, locations)", sens: "recette" },
  { code: "77", libelle: "Revenus financiers", sens: "recette" },
] as const;
