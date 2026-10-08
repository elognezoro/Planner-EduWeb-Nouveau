import * as Icons from "lucide-react";

/**
 * Icône lucide résolue par son NOM (les cartes de navigation et de raccourcis stockent des noms).
 * Sans "use client" : utilisable par les composants serveur comme client. Décorative par défaut
 * (`aria-hidden`) — le libellé voisin porte le sens.
 */
export function IconeLucide({ nom, ...props }: { nom: string } & Icons.LucideProps) {
  const C = (Icons as unknown as Record<string, Icons.LucideIcon>)[nom] ?? Icons.Circle;
  return <C aria-hidden {...props} />;
}
