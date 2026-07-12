import { estHtmlRiche, CLASSE_HTML_RICHE, rendreTexteRiche } from "@/lib/lms";
import { cn } from "@/lib/utils";

/**
 * Affiche un contenu de champ « éditeur riche » :
 *  - HTML riche (⚠️ déjà SANITISÉ à l'enregistrement via sanitiserHtmlRiche) → injecté tel quel ;
 *  - sinon (héritage / consignes en Markdown) → rendu Markdown léger via rendreTexteRiche
 *    (gras **…**, italique, titres, listes, liens). rendreTexteRiche ÉCHAPPE le HTML avant
 *    d'appliquer une liste blanche : sûr même sur du contenu non fiable.
 * Ne JAMAIS passer une valeur HTML non sanitisée dans la branche HTML.
 */
export function RenduRiche({ contenu, className }: { contenu: string | null | undefined; className?: string }) {
  if (!contenu) return null;
  const html = estHtmlRiche(contenu) ? contenu : rendreTexteRiche(contenu);
  return <div className={cn(CLASSE_HTML_RICHE, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
