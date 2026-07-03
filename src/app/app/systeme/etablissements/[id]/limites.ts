/**
 * Limites de téléversement des documents officiels (armoiries, logo, cachet, signature).
 * Contrôlées côté client (message immédiat) ET côté serveur (défense en profondeur) ;
 * la limite de corps des Server Actions est alignée dans next.config.ts (4,5 Mo,
 * plafond des fonctions Vercel).
 */
export const TAILLE_MAX_DOCUMENT = 4 * 1024 * 1024; // 4 Mo
export const TAILLE_MAX_DOCUMENT_LIBELLE = "4 Mo";
