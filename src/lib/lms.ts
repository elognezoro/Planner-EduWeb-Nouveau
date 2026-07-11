/**
 * Aides pures du LMS « Aide et Formation » (sans dépendance serveur) :
 * slug, rendu de texte riche (sous-ensemble Markdown sûr), et métadonnées des types de leçon.
 */

/** Types de leçon pris en charge (le champ `type` reste un String extensible côté base). */
export const TYPES_MODULE = [
  { v: "texte", libelle: "Texte", icone: "FileText" },
  { v: "video", libelle: "Vidéo (lien)", icone: "Video" },
  { v: "fichier", libelle: "Fichier (PDF…)", icone: "FileDown" },
  { v: "lien", libelle: "Lien externe", icone: "ExternalLink" },
] as const;

export type TypeModule = (typeof TYPES_MODULE)[number]["v"];

export const NIVEAUX = [
  { v: "debutant", libelle: "Débutant" },
  { v: "intermediaire", libelle: "Intermédiaire" },
  { v: "avance", libelle: "Avancé" },
] as const;

export const FORMATS_SESSION = [
  { v: "webinaire", libelle: "Webinaire" },
  { v: "atelier", libelle: "Atelier" },
  { v: "presentiel", libelle: "Présentiel" },
] as const;

/** Slug URL à partir d'un titre (accents retirés, minuscules, tirets). */
export function slugifier(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const eh = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Rendu d'un sous-ensemble Markdown SÛR (le contenu est saisi par l'admin, mais on échappe
 * toujours le HTML avant d'appliquer une liste blanche de transformations). Retourne du HTML
 * à injecter via `dangerouslySetInnerHTML`.
 */
export function rendreTexteRiche(texte: string | null | undefined): string {
  if (!texte) return "";
  const lignes = eh(texte).split(/\r?\n/);
  const html: string[] = [];
  let dansListe = false;
  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-forest-700 underline">$1</a>');
  const fermerListe = () => {
    if (dansListe) {
      html.push("</ul>");
      dansListe = false;
    }
  };
  for (const l of lignes) {
    const t = l.trim();
    if (!t) {
      fermerListe();
      continue;
    }
    if (/^###\s+/.test(t)) {
      fermerListe();
      html.push(`<h4 class="mt-4 mb-1 font-display text-sm font-bold text-forest-900">${inline(t.replace(/^###\s+/, ""))}</h4>`);
    } else if (/^##\s+/.test(t)) {
      fermerListe();
      html.push(`<h3 class="mt-5 mb-2 font-display text-base font-bold text-forest-900">${inline(t.replace(/^##\s+/, ""))}</h3>`);
    } else if (/^[-*]\s+/.test(t)) {
      if (!dansListe) {
        html.push('<ul class="my-2 list-disc space-y-1 pl-5">');
        dansListe = true;
      }
      html.push(`<li>${inline(t.replace(/^[-*]\s+/, ""))}</li>`);
    } else {
      fermerListe();
      html.push(`<p class="my-2 leading-relaxed">${inline(t)}</p>`);
    }
  }
  fermerListe();
  return html.join("");
}

/** Convertit une URL YouTube / Vimeo en URL d'intégration (iframe), sinon null. */
export function urlIntegrationVideo(url: string | null | undefined): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vi = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  return null;
}
