import { estHtmlRiche, CLASSE_HTML_RICHE } from "@/lib/lms";
import { cn } from "@/lib/utils";

/**
 * Affiche un contenu de champ « éditeur riche » : HTML riche (⚠️ déjà SANITISÉ à
 * l'enregistrement via sanitiserHtmlRiche) ou, en héritage, texte brut (pré-ligne).
 * Ne JAMAIS passer ici une valeur non sanitisée.
 */
export function RenduRiche({ contenu, className }: { contenu: string | null | undefined; className?: string }) {
  if (!contenu) return null;
  if (!estHtmlRiche(contenu)) {
    return <p className={cn("whitespace-pre-line", className)}>{contenu}</p>;
  }
  return <div className={cn(CLASSE_HTML_RICHE, className)} dangerouslySetInnerHTML={{ __html: contenu }} />;
}
