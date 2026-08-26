import type { ReactNode } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

/**
 * Variante REPLIABLE d'un bloc de configuration : le contenu se plie/déplie sous le TITRE du bloc
 * (accordéon natif `<details>`). Utilisé pour les blocs à longue liste (ex. « Désignation des salles »
 * sur les grands établissements). Natif `<details>` : aucun JS, et — contrairement à un bouton —
 * la bascule reste utilisable même quand la config est verrouillée (le `<fieldset disabled>` du
 * verrou ne désactive pas un `<summary>`, qui n'est pas un contrôle de formulaire) : on peut donc
 * TOUJOURS déplier pour CONSULTER, tandis que les champs à l'intérieur restent, eux, désactivés.
 */
export function BlocRepliable({
  id,
  titre,
  sousTitre,
  essentiel,
  resume,
  defautOuvert = false,
  children,
}: {
  id: string;
  titre: string;
  sousTitre?: string;
  essentiel?: boolean;
  /** Court résumé affiché à côté du titre quand le bloc est replié (ex. « 46 salles »). */
  resume?: string;
  /** Ouvert par défaut ? (défaut : REPLIÉ). */
  defautOuvert?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={defautOuvert}
      className={`group scroll-mt-24 rounded-2xl border bg-white p-6 shadow-soft ${
        essentiel ? "border-gold-300 ring-1 ring-gold-200" : "border-cream-200"
      }`}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={18}
          className="shrink-0 text-ink-700/45 transition-transform -rotate-90 group-open:rotate-0"
        />
        <h2 className="font-display text-lg font-bold text-forest-900">{titre}</h2>
        {essentiel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gold-800 ring-1 ring-gold-300">
            <Sparkles size={12} /> Essentiel pour l&apos;emploi du temps
          </span>
        )}
        {resume && <span className="ml-auto text-sm text-ink-700/55">{resume}</span>}
      </summary>
      {sousTitre && <p className="mt-3 mb-4 text-sm text-ink-700/65">{sousTitre}</p>}
      {!sousTitre && <div className="mb-4" />}
      {children}
    </details>
  );
}
