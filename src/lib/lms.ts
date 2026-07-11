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
  { v: "quiz", libelle: "Quiz (évaluation)", icone: "ListChecks" },
  { v: "devoir", libelle: "Devoir (dépôt corrigé)", icone: "FileCheck2" },
] as const;

/** Types de question de quiz (exerciseurs). */
export const TYPES_QUESTION = [
  { v: "choix_unique", libelle: "Choix unique" },
  { v: "choix_multiple", libelle: "Choix multiple" },
  { v: "vrai_faux", libelle: "Vrai / Faux" },
  { v: "association", libelle: "Association (à relier)" },
  { v: "texte_a_trous", libelle: "Texte à trous" },
  { v: "remise_en_ordre", libelle: "Remise en ordre" },
] as const;

/** Types d'exercice basés sur des propositions cochables (QCM). */
export const TYPES_CHOIX = ["choix_unique", "choix_multiple", "vrai_faux"];

/** Normalise une chaîne pour comparaison tolérante (accents, casse, espaces). */
export function normaliserReponse(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Mode d'un quiz : formatif (entraînement + feedback) ou sommatif (évaluation notée). */
export const MODES_QUIZ = [
  { v: "formatif", libelle: "Formatif (entraînement + feedback)" },
  { v: "sommatif", libelle: "Sommatif (évaluation notée)" },
] as const;

/** Politique de révélation des bonnes réponses / explications. */
export const REVELATIONS_SOLUTION = [
  { v: "apres_tentative", libelle: "Après chaque tentative" },
  { v: "apres_reussite", libelle: "Seulement après réussite" },
  { v: "toujours", libelle: "Toujours consultables (mode révision)" },
  { v: "jamais", libelle: "Jamais" },
] as const;

/** Détermine si les solutions doivent être renvoyées après une tentative. */
export function solutionsRevelables(revelation: string, reussi: boolean): boolean {
  if (revelation === "jamais") return false;
  if (revelation === "apres_reussite") return reussi;
  return true; // apres_tentative | toujours
}

export type TypeQuestion = (typeof TYPES_QUESTION)[number]["v"];

/**
 * Score d'une question : points obtenus (0 si réponse incorrecte). Pour un choix multiple,
 * la sélection doit correspondre EXACTEMENT à l'ensemble des bonnes réponses.
 */
export type ChoixScore = { id: string; texte: string; correct: boolean; apparie: string | null; ordre: number };

/**
 * Score d'une question selon son type (tout-ou-rien : `points` si entièrement juste, sinon 0).
 * Encodage de `selection` (string[]) par type :
 *  - QCM / vrai-faux : ids des propositions cochées.
 *  - association : entrées « leftChoixId=texteDroiteChoisi ».
 *  - remise_en_ordre : ids des propositions dans l'ordre proposé.
 *  - texte_a_trous : réponse saisie pour chaque trou (indexé par l'ordre des propositions).
 */
export function scoreQuestion(type: string, choix: ChoixScore[], points: number, selection: string[]): number {
  if (type === "association") {
    if (choix.length === 0) return 0;
    const rep = new Map<string, string>();
    for (const s of selection) { const i = s.indexOf("="); if (i > 0) rep.set(s.slice(0, i), s.slice(i + 1)); }
    for (const c of choix) {
      const attendu = normaliserReponse(c.apparie ?? "");
      if (!attendu || attendu !== normaliserReponse(rep.get(c.id) ?? "")) return 0;
    }
    return points;
  }
  if (type === "remise_en_ordre") {
    // Comparaison par TEXTE (jamais par id de base : les cuid v1 se trient par ordre de création).
    const attendu = [...choix].sort((a, b) => a.ordre - b.ordre).map((c) => normaliserReponse(c.texte));
    if (selection.length !== attendu.length) return 0;
    for (let i = 0; i < attendu.length; i++) if (normaliserReponse(selection[i] ?? "") !== attendu[i]) return 0;
    return points;
  }
  if (type === "texte_a_trous") {
    const trous = [...choix].sort((a, b) => a.ordre - b.ordre);
    if (trous.length === 0) return 0;
    for (let i = 0; i < trous.length; i++) {
      const t = trous[i];
      const acceptees = [t.texte, ...(t.apparie ? t.apparie.split("|") : [])].map(normaliserReponse).filter(Boolean);
      const donne = normaliserReponse(selection[i] ?? "");
      if (!donne || !acceptees.includes(donne)) return 0;
    }
    return points;
  }
  // choix_unique | choix_multiple | vrai_faux
  const bonnes = new Set(choix.filter((c) => c.correct).map((c) => c.id));
  const choisis = new Set(selection);
  if (bonnes.size !== choisis.size) return 0;
  for (const id of bonnes) if (!choisis.has(id)) return 0;
  return points;
}

/** Description lisible de la bonne réponse (types non-QCM), pour la revue de correction. */
export function descriptionSolution(type: string, choix: ChoixScore[]): string {
  if (type === "association") return choix.map((c) => `${c.texte} → ${c.apparie ?? "?"}`).join(" ; ");
  if (type === "remise_en_ordre") return [...choix].sort((a, b) => a.ordre - b.ordre).map((c, i) => `${i + 1}. ${c.texte}`).join("   ");
  if (type === "texte_a_trous") return [...choix].sort((a, b) => a.ordre - b.ordre).map((c) => c.texte).join(" · ");
  return choix.filter((c) => c.correct).map((c) => c.texte).join(" ; ");
}

export type TypeModule = (typeof TYPES_MODULE)[number]["v"];

export const NIVEAUX = [
  { v: "debutant", libelle: "Débutant" },
  { v: "intermediaire", libelle: "Intermédiaire" },
  { v: "avance", libelle: "Avancé" },
] as const;

/** Teintes de badge (parcours). `classe` = classes Tailwind (fond + texte + anneau). */
export const COULEURS_BADGE = [
  { v: "gold", libelle: "Or", classe: "bg-gold-100 text-gold-800 ring-gold-300" },
  { v: "forest", libelle: "Vert", classe: "bg-forest-100 text-forest-800 ring-forest-300" },
  { v: "rose", libelle: "Rose", classe: "bg-rose-100 text-rose-700 ring-rose-300" },
  { v: "bleu", libelle: "Bleu", classe: "bg-sky-100 text-sky-700 ring-sky-300" },
] as const;

export const classeBadge = (couleur: string) => COULEURS_BADGE.find((c) => c.v === couleur)?.classe ?? COULEURS_BADGE[0].classe;

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

// Échappe aussi les guillemets : sinon une URL Markdown avec " pourrait fermer un attribut et injecter du HTML.
const eh = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Le contenu provient-il de l'éditeur riche (HTML) plutôt que du texte brut / Markdown ? */
export function estHtmlRiche(texte: string | null | undefined): boolean {
  return /^\s*</.test(texte ?? "");
}

/**
 * URL de ressource sûre : uniquement http(s). Bloque les schémas dangereux (javascript:, data:, …)
 * avant de placer une valeur dans un `href` (leçons vidéo / lien). À valider à l'écriture ET au rendu.
 */
export function estUrlHttp(v: string | null | undefined): boolean {
  return /^https?:\/\//i.test((v ?? "").trim());
}

/** Classes de rendu du HTML riche (éditeur) — appliquées au conteneur d'affichage ET à la zone d'édition. */
export const CLASSE_HTML_RICHE =
  "[&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:font-display [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-forest-900 " +
  "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-forest-900 " +
  "[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:font-display [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-forest-900 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_a]:text-forest-700 [&_a]:underline [&_p]:my-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-forest-200 [&_blockquote]:pl-3 [&_blockquote]:italic";

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
      // URL sans espace, parenthèse NI guillemet (déjà échappé en amont) → pas d'évasion d'attribut.
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"'&]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-forest-700 underline">$1</a>');
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
