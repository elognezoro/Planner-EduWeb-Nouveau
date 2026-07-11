import sanitizeHtml from "sanitize-html";

/**
 * Sanitisation SERVEUR du HTML produit par l'éditeur riche (liste blanche stricte).
 * ⚠️ Toute valeur issue d'un champ « éditeur riche » DOIT passer ici avant d'être
 * enregistrée en base — le client n'est jamais digne de confiance. Le rendu
 * (`RenduRiche`) n'affiche que du contenu déjà sanitisé à l'enregistrement.
 *
 * Module serveur uniquement (ne pas importer depuis un composant client).
 */
export function sanitiserHtmlRiche(html: string | null | undefined): string {
  if (!html) return "";
  const propre = sanitizeHtml(html, {
    allowedTags: ["p", "div", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "strike", "ul", "ol", "li", "br", "a", "span", "blockquote"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
        "text-align": [/^(left|right|center|justify)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
    disallowedTagsMode: "discard",
  }).trim();
  // Contenu « visuellement vide » (texte blanc, <br> ou <p> vides seuls) → chaîne vide,
  // pour ne pas accepter un dépôt/consigne vide ni valider une leçon sur du contenu factice.
  const texteSeul = sanitizeHtml(propre, { allowedTags: [], allowedAttributes: {} }).trim();
  return texteSeul === "" && !/<(ul|ol)[\s>]/.test(propre) ? "" : propre;
}
