"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { libelleOnglet, ongletsPour } from "@/lib/mobile/onglets";
import { appliquerTerme } from "@/lib/cafop-terme";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import { segmentNavActif, type RoleId, type SectionNav } from "@/lib/rbac";
import { lireNavigation, navigationServeur, sabonnerNavigation } from "@/lib/mobile/navigation";

function Icone({ nom, className }: { nom: string; className?: string }) {
  const Composant = (Icons as unknown as Record<string, Icons.LucideIcon>)[nom] ?? Icons.Circle;
  return <Composant className={className} />;
}

function hrefDe(segment: string): string {
  return segment ? `/app/${segment}` : "/app";
}

/**
 * BARRE D'ONGLETS DU BAS — la navigation principale au téléphone.
 *
 * N'existe QUE sous 1024 px (`lg:hidden`) : sur ordinateur, ce composant ne rend rien de
 * visible et la barre latérale reste seule maîtresse. Masquée à l'impression.
 *
 * Les quatre onglets sont déduits des droits réels de l'utilisateur (voir lib/mobile/onglets.ts) ;
 * le cinquième, « Plus », ouvre le menu complet.
 */
export function BarreOnglets({
  role,
  sections,
  segmentActif,
  onPlus,
  onFermerMenu,
  menuOuvert,
  termeCafop = "CAFOP",
  termeApfc = "APFC",
}: {
  role: RoleId;
  /** Navigation DÉJÀ filtrée par la matrice des droits (prop `sections` de la coquille). */
  sections: SectionNav[];
  /** Segment de la page courante, calculé par la coquille (`segmentNavActif`). */
  segmentActif: string | null;
  onPlus: () => void;
  /** Referme le menu complet : un appui sur un onglet navigue ET rend la page visible. */
  onFermerMenu: () => void;
  menuOuvert: boolean;
  termeCafop?: string;
  termeApfc?: string;
}) {
  const onglets = ongletsPour(role, sections);
  // Pendant une navigation, c'est la DESTINATION qui est allumée : le retour visuel est
  // immédiat, même si la page met une seconde à arriver.
  const nav = useSyncExternalStore(sabonnerNavigation, lireNavigation, navigationServeur);
  const segmentAffiche =
    nav.destination && !nav.horsLigne
      ? segmentNavActif(nav.destination.split("?")[0], sections.flatMap((s) => s.items))
      : segmentActif;
  const surUnOnglet = onglets.some((o) => o.segment === segmentAffiche);
  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, termeCafop), termeApfc);

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-200 bg-cream-50/95 backdrop-blur-md lg:hidden print:hidden"
      style={{
        paddingBottom: "var(--marge-sure-bas, 0px)",
        paddingLeft: "var(--marge-sure-gauche, 0px)",
        paddingRight: "var(--marge-sure-droite, 0px)",
      }}
    >
      <ul className="flex items-stretch">
        {onglets.map((item) => {
          const actif = item.segment === segmentAffiche;
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={hrefDe(item.segment)}
                onClick={onFermerMenu}
                title={T(item.libelle)}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors",
                  actif ? "text-forest-800" : "text-ink-700/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    actif && "bg-forest-100",
                  )}
                >
                  <Icone nom={item.icone} className="h-5 w-5" />
                </span>
                <span className={cn("line-clamp-1 text-[0.7rem] leading-tight", actif && "font-semibold")}>
                  {T(libelleOnglet(item))}
                </span>
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onPlus}
            aria-expanded={menuOuvert}
            aria-controls="tiroir-navigation"
            aria-haspopup="dialog"
            aria-label="Ouvrir le menu complet"
            className={cn(
              "flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors",
              !surUnOnglet || menuOuvert ? "text-forest-800" : "text-ink-700/60",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                (!surUnOnglet || menuOuvert) && "bg-forest-100",
              )}
            >
              <Icons.Menu className="h-5 w-5" />
            </span>
            <span className={cn("text-[0.7rem] leading-tight", (!surUnOnglet || menuOuvert) && "font-semibold")}>
              Plus
            </span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
