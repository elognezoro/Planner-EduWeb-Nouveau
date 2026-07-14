import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bouton « Envoyer un message » réutilisable — ouvre la conversation avec un utilisateur dans
 * la messagerie interne (`/app/vie-scolaire/communication?avec=<id>`). À placer partout où une
 * fiche/ligne de profil s'affiche (comptes, approbations, participants, membres…). L'autorisation
 * d'écrire est vérifiée côté serveur à l'envoi (cf. peutContacter) — ce bouton n'est qu'un accès.
 */
export function BoutonMessage({
  destinataireId,
  nom,
  variante = "bouton",
  className,
}: {
  destinataireId: string;
  /** Nom du destinataire (pour l'aria-label / le title). */
  nom?: string;
  /** « bouton » = icône + libellé ; « icone » = icône seule (lignes de tableau compactes). */
  variante?: "bouton" | "icone";
  className?: string;
}) {
  const href = `/app/vie-scolaire/communication?avec=${destinataireId}`;
  const libelleAria = nom ? `Envoyer un message à ${nom}` : "Envoyer un message";

  if (variante === "icone") {
    return (
      <Link
        href={href}
        title={libelleAria}
        aria-label={libelleAria}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cream-300 bg-white text-forest-700 transition-colors hover:border-forest-400 hover:bg-forest-50",
          className,
        )}
      >
        <MessageSquare size={15} />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={libelleAria}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-1.5 text-sm font-medium text-forest-700 transition-colors hover:border-forest-400 hover:bg-forest-50",
        className,
      )}
    >
      <MessageSquare size={15} /> Message
    </Link>
  );
}
