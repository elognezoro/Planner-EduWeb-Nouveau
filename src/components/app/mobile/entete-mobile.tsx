"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FeuilleBas } from "@/components/app/mobile/feuille-bas";
import * as Icons from "lucide-react";
import { seDeconnecter } from "@/app/app/actions";
import { ClocheNotifications } from "@/components/app/notifications/cloche";
import { BarreOutils, type OutilsBarre } from "@/components/app/barre-outils";
import { localiserItemNav } from "@/components/app/breadcrumb";
import { lireTitrePage, sabonnerTitrePage, titrePageServeur } from "@/lib/mobile/titre-page";
import { useSousSeuilMobile } from "@/lib/mobile/appareil";
import { appliquerTerme } from "@/lib/cafop-terme";
import { appliquerTermeApfc } from "@/lib/apfc-terme";
import type { NotificationItem } from "@/lib/notifications/actions";
import type { SectionNav } from "@/lib/rbac";

/**
 * EN-TÊTE MOBILE — titre de la page et retour, comme dans une application.
 *
 * N'existe QUE sous 1024 px (`lg:hidden`) : au-dessus, l'en-tête historique reprend la main,
 * inchangé. Masqué à l'impression.
 *
 * Le titre vient de `PageHeader` quand la page en a un (magasin lib/mobile/titre-page.ts) ;
 * sinon, du libellé de la navigation — jamais d'en-tête muet.
 */
export function EnteteMobile({
  sections,
  outils,
  notificationsInitiales,
  nonLuesInitiales,
  utilisateur,
  termeCafop = "CAFOP",
  termeApfc = "APFC",
}: {
  sections: SectionNav[];
  outils: OutilsBarre;
  notificationsInitiales: NotificationItem[];
  nonLuesInitiales: number;
  utilisateur: { nomComplet: string; email: string };
  termeCafop?: string;
  termeApfc?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [compte, setCompte] = useState(false);
  const titrePublie = useSyncExternalStore(sabonnerTitrePage, lireTitrePage, titrePageServeur);
  // Barre d'outils et cloche : montées ICI seulement sur téléphone — sur ordinateur, elles
  // restent celles de l'en-tête historique, qui ne bouge pas (voir lib/mobile/appareil.ts).
  const surTelephone = useSousSeuilMobile();

  const T = (s: string) => appliquerTermeApfc(appliquerTerme(s, termeCafop), termeApfc);
  const loc = localiserItemNav(pathname, sections);
  const titre = titrePublie ?? (loc && loc.item.segment !== "" ? T(loc.item.libelle) : "Tableau de bord");
  const racine = pathname === "/app";

  /** Retour : l'historique s'il existe, sinon le tableau de bord (jamais de cul-de-sac). */
  function revenir() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/app");
  }

  return (
    <header
      className="sticky top-0 z-[44] border-b border-cream-200 bg-cream-50/90 backdrop-blur-md lg:hidden print:hidden"
      style={{ paddingTop: "var(--marge-sure-haut, 0px)" }}
    >
      <div className="flex h-14 items-center gap-1 px-2">
        {racine ? (
          <span className="flex h-11 w-11 items-center justify-center text-forest-800" aria-hidden>
            <Icons.House size={20} />
          </span>
        ) : (
          <button
            type="button"
            onClick={revenir}
            aria-label="Revenir à l'écran précédent"
            className="flex h-11 w-11 items-center justify-center rounded-full text-forest-800 active:bg-forest-50"
          >
            <Icons.ChevronLeft size={24} />
          </button>
        )}

        {/* Doublon VISUEL du <h1> de la page (masqué à l'écran sur téléphone) : ce n'est donc
            ni un titre de niveau, ni quelque chose à annoncer une seconde fois. */}
        <p aria-hidden className="min-w-0 flex-1 truncate font-display text-lg font-bold text-forest-900">
          {titre}
        </p>

        <div className="outils-entete-mobile flex shrink-0 items-center gap-0.5">
          {surTelephone && (
            <>
              <BarreOutils sections={sections} outils={outils} variante="feuille" />
              <ClocheNotifications
                notificationsInitiales={notificationsInitiales}
                nonLuesInitiales={nonLuesInitiales}
                variante="feuille"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => setCompte(true)}
            aria-haspopup="dialog"
            aria-expanded={compte}
            aria-label="Mon compte"
            className="flex h-11 w-11 items-center justify-center rounded-full"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-gold-300">
              {utilisateur.nomComplet.slice(0, 1).toUpperCase()}
            </span>
          </button>

          <FeuilleBas ouvert={compte && surTelephone} onFermer={() => setCompte(false)} titre="Mon compte" hauteurMax="60dvh">
            <div className="px-2 pb-2">
              <div className="rounded-2xl bg-white px-4 py-3">
                <p className="truncate font-semibold text-forest-900">{utilisateur.nomComplet}</p>
                <p className="truncate text-sm text-ink-700/60">{utilisateur.email}</p>
              </div>
              <div className="mt-2 space-y-1">
                <Link
                  href="/app/mon-profil"
                  onClick={() => setCompte(false)}
                  className="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-forest-800 active:bg-cream-200"
                >
                  <Icons.UserCircle size={20} /> Mon profil
                </Link>
                <Link
                  href="/app/mon-identification"
                  onClick={() => setCompte(false)}
                  className="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-forest-800 active:bg-cream-200"
                >
                  <Icons.IdCard size={20} /> Mon identification
                </Link>
                <form action={seDeconnecter}>
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-red-600 active:bg-red-50"
                  >
                    <Icons.LogOut size={20} /> Se déconnecter
                  </button>
                </form>
              </div>
            </div>
          </FeuilleBas>
        </div>
      </div>
    </header>
  );
}
