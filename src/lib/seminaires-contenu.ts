/**
 * Registre du CONTENU des séminaires « figés » (pages statiques autonomes) et de leur
 * mise sous condition d'inscription.
 *
 * RÈGLE MÉTIER : le contenu d'une formation n'est consultable que par un INSCRIT (ou un
 * administrateur / tuteur). Les séminaires statiques ne vivent plus sous `public/`
 * (librement servis par le CDN) mais sous `content/seminaires/` ; ils sont servis par la
 * route authentifiée `src/app/seminaires/[...chemin]/route.ts`, qui vérifie l'inscription
 * au cours-miroir correspondant (même règle que le lecteur LMS). Les GUIDES d'utilisateurs
 * ne sont PAS des séminaires : ils restent librement consultables via le lecteur LMS.
 *
 * Chaque séminaire mappe un ou plusieurs PRÉFIXES de chemin (fichier d'entrée + dossiers
 * d'assets) vers le `slug` de son cours-miroir (cf. prisma/seed-seminaires-cours.ts).
 */
export type SeminaireContenu = {
  /** slug du cours-miroir (Cours.slug) servant à vérifier l'inscription. */
  coursSlug: string;
  /** Titre lisible (journalisation / pages de repli). */
  titre: string;
  /** Page d'entrée (chemin relatif à content/seminaires). */
  entree: string;
  /** Préfixes de chemin (relatifs à content/seminaires) appartenant à ce séminaire. */
  prefixes: string[];
};

export const SEMINAIRES_CONTENU: SeminaireContenu[] = [
  {
    coursSlug: "magnifica-humanitas",
    titre: "Magnifica Humanitas",
    entree: "magnifica-humanitas.html",
    prefixes: ["magnifica-humanitas.html", "magnifica/"],
  },
  {
    coursSlug: "communication-pastorale",
    titre: "Le numérique au service de la communication éducative et pastorale",
    entree: "communication-numerique-pastorale.html",
    prefixes: ["communication-numerique-pastorale.html"],
  },
  {
    coursSlug: "ia-communication-pastorale",
    titre: "L'IA au service de la communication éducative et pastorale",
    entree: "ia-communication/formation.html",
    prefixes: ["ia-communication/"],
  },
  {
    coursSlug: "fetrag-setrag",
    titre: "FETRAG-SETRAG — Droit du travail gabonais",
    entree: "fetrag-setrag.html",
    prefixes: ["fetrag-setrag.html"],
  },
];

/** Normalise un chemin relatif (retire les « / » de tête, refuse toute remontée « .. »). */
export function cheminSeminaireSur(segments: string[]): string | null {
  const rel = segments.join("/");
  if (!rel) return null;
  // Refuse toute tentative de remontée de répertoire ou d'octet nul.
  if (rel.includes("..") || rel.includes("\0") || rel.includes("\\")) return null;
  return rel.replace(/^\/+/, "");
}

/** Retourne le slug du cours-miroir dont relève un chemin de contenu, ou null si inconnu. */
export function coursSlugPourChemin(rel: string): string | null {
  for (const s of SEMINAIRES_CONTENU) {
    for (const p of s.prefixes) {
      if (p.endsWith("/") ? rel.startsWith(p) : rel === p) return s.coursSlug;
    }
  }
  return null;
}

/** Type MIME d'après l'extension (liste fermée : contenu servi contrôlé). */
export function typeMimeSeminaire(rel: string): string {
  const ext = rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "html": return "text/html; charset=utf-8";
    case "css": return "text/css; charset=utf-8";
    case "js": return "text/javascript; charset=utf-8";
    case "json": return "application/json; charset=utf-8";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "svg": return "image/svg+xml";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "pdf": return "application/pdf";
    case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default: return "application/octet-stream";
  }
}
