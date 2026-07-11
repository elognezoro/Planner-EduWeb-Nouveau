"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";
import { NAVIGATION, cheminNavEffectif, type SectionNav, type ItemNav } from "@/lib/rbac";
import { appliquerTerme } from "@/lib/cafop-terme";

function hrefDe(segment: string): string {
  return segment ? `/app/${segment}` : "/app";
}

/** Retrouve la section + l'item de navigation correspondant au chemin (correspondance la plus précise). */
function localiser(pathname: string): { section: SectionNav; item: ItemNav } | null {
  // Alias appliqués (ex. pages de cours → « Formations ») avant la correspondance par préfixe.
  const cible = hrefDe(cheminNavEffectif(pathname));
  let best: { section: SectionNav; item: ItemNav } | null = null;
  let bestLen = -1;
  for (const section of NAVIGATION) {
    for (const item of section.items) {
      const href = hrefDe(item.segment);
      const match = href === "/app" ? cible === "/app" : cible === href || cible.startsWith(href + "/");
      if (match && href.length > bestLen) {
        best = { section, item };
        bestLen = href.length;
      }
    }
  }
  return best;
}

/** Fil d'Ariane élégant et fonctionnel, dérivé de la route courante. */
export function FilAriane({ termeCafop = "CAFOP" }: { termeCafop?: string }) {
  const pathname = usePathname();
  const loc = localiser(pathname);

  const sep = <ChevronRight size={15} className="shrink-0 text-ink-700/30" />;

  return (
    <nav aria-label="Fil d'Ariane" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
      <Link
        href="/app"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-forest-700 transition-colors hover:bg-forest-50"
        aria-label="Tableau de bord"
      >
        <Home size={16} />
      </Link>

      {loc && loc.item.segment !== "" && (
        <>
          {sep}
          <span className="max-w-[9rem] truncate font-medium text-ink-700/55">{appliquerTerme(loc.section.libelle, termeCafop)}</span>
          {sep}
          <Link
            href={hrefDe(loc.item.segment)}
            className="truncate font-semibold text-forest-900 hover:text-forest-700"
          >
            {appliquerTerme(loc.item.libelle, termeCafop)}
          </Link>
        </>
      )}
      {(!loc || loc.item.segment === "") && (
        <>
          {sep}
          <span className="font-semibold text-forest-900">Tableau de bord</span>
        </>
      )}
    </nav>
  );
}
