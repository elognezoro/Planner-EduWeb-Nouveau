"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  const zoneCompte = useRef<HTMLDivElement>(null);
  const titrePublie = useSyncExternalStore(sabonnerTitrePage, lireTitrePage, titrePageServeur);
  const animationReduite = useReducedMotion();
  // Barre d'outils et cloche : montées ICI seulement sur téléphone — sur ordinateur, elles
  // restent celles de l'en-tête historique, qui ne bouge pas (voir lib/mobile/appareil.ts).
  const surTelephone = useSousSeuilMobile();

  // Fermeture du menu compte : touche Échap et appui hors de la zone. L'astuce habituelle du
  // voile « fixed inset-0 » ne marche PAS ici : l'en-tête porte un flou d'arrière-plan
  // (backdrop-filter), qui fait de lui le bloc conteneur de ses descendants fixes — le voile
  // ne couvrirait que la bande de l'en-tête.
  useEffect(() => {
    if (!compte) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCompte(false);
    };
    const surAppui = (e: PointerEvent) => {
      if (!zoneCompte.current?.contains(e.target as Node)) setCompte(false);
    };
    document.addEventListener("keydown", surTouche);
    document.addEventListener("pointerdown", surAppui);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("pointerdown", surAppui);
    };
  }, [compte]);

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
              <BarreOutils sections={sections} outils={outils} />
              <ClocheNotifications
                notificationsInitiales={notificationsInitiales}
                nonLuesInitiales={nonLuesInitiales}
              />
            </>
          )}
          <div className="relative" ref={zoneCompte}>
            <button
              type="button"
              onClick={() => setCompte((v) => !v)}
              aria-expanded={compte}
              aria-label="Mon compte"
              className="flex h-11 w-11 items-center justify-center rounded-full"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-800 text-xs font-bold text-gold-300">
                {utilisateur.nomComplet.slice(0, 1).toUpperCase()}
              </span>
            </button>
            <AnimatePresence>
              {compte && (
                <>
                  <motion.div
                    initial={animationReduite ? false : { opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={animationReduite ? { opacity: 1 } : { opacity: 0, y: -8 }}
                    transition={{ duration: animationReduite ? 0 : 0.15 }}
                    className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft"
                  >
                    <div className="border-b border-cream-200 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-forest-900">{utilisateur.nomComplet}</p>
                      <p className="truncate text-xs text-ink-700/60">{utilisateur.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link
                        href="/app/mon-profil"
                        onClick={() => setCompte(false)}
                        className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm text-forest-800 active:bg-forest-50"
                      >
                        <Icons.UserCircle size={18} /> Mon profil
                      </Link>
                      <Link
                        href="/app/mon-identification"
                        onClick={() => setCompte(false)}
                        className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm text-forest-800 active:bg-forest-50"
                      >
                        <Icons.IdCard size={18} /> Mon identification
                      </Link>
                      <form action={seDeconnecter}>
                        <button
                          type="submit"
                          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-red-600 active:bg-red-50"
                        >
                          <Icons.LogOut size={18} /> Se déconnecter
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
