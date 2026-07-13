/**
 * Registre des séminaires « figés » (pages statiques), source unique pour :
 * la page de paramétrage administrateur, l'endpoint public /api/seminaire/config
 * et l'affichage des cartes (couverture). Le `slug` sert de clé dans ConfigSeminaire.
 */
export type SeminaireRef = { slug: string; titre: string; url: string | null };

export const SEMINAIRES_REF: SeminaireRef[] = [
  { slug: "magnifica-humanitas", titre: "Magnifica Humanitas — Rester humains à l'ère de l'intelligence artificielle", url: "/seminaires/magnifica-humanitas.html" },
  { slug: "communication-pastorale", titre: "Le numérique au service de la communication éducative et pastorale", url: "/seminaires/communication-numerique-pastorale.html" },
  { slug: "ia-communication-pastorale", titre: "L'intelligence artificielle au service de la communication éducative et pastorale", url: null },
];

export const SLUGS_SEMINAIRES = new Set(SEMINAIRES_REF.map((s) => s.slug));

/** Types d'images paramétrables d'un séminaire → champ correspondant de ConfigSeminaire. */
export const IMAGES_SEMINAIRE = {
  couverture: "couvertureUrl",
  logo: "logoUrl",
  signature: "signatureUrl",
  cachet: "cachetUrl",
  qr: "qrImageUrl",
} as const;
export type TypeImageSeminaire = keyof typeof IMAGES_SEMINAIRE;
