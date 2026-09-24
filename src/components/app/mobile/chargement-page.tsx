"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { WifiOff, Hourglass } from "lucide-react";
import {
  demarrerNavigation,
  lireNavigation,
  navigationServeur,
  sabonnerNavigation,
  signalerHorsLigne,
  terminerNavigation,
} from "@/lib/mobile/navigation";

/** Délai avant d'afficher les zones grisées : une page qui arrive vite ne clignote pas. */
const DELAI_SQUELETTE = 120;
/** Au-delà, on dit que le réseau est lent et on laisse la main à l'utilisateur. */
const DELAI_LENT = 8_000;

/** Une barre grise « pulsée » (neutralisée si l'utilisateur demande moins d'animations). */
function Barre({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-full bg-cream-200 ${className}`} />;
}

/** Le serveur répond-il vraiment ? (« navigator.onLine » peut être vrai sur un réseau mort.) */
async function reseauDisponible(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const reponse = await fetch("/api/version", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    return reponse.ok;
  } catch {
    return false;
  }
}

/**
 * CHARGEMENT D'UNE PAGE (téléphone) — zones grisées, réseau lent, absence de réseau.
 *
 * Occupe l'emprise du CONTENU (sous l'en-tête et les éventuels bandeaux — mode assistance,
 * hors ligne —, au-dessus de la barre d'onglets) pendant qu'une page est demandée au serveur.
 * N'existe que sous le seuil mobile (`actif`), et reste masqué à l'impression.
 */
export function ChargementPage({ actif }: { actif: boolean }) {
  const router = useRouter();
  const nav = useSyncExternalStore(sabonnerNavigation, lireNavigation, navigationServeur);
  // Tous les états ci-dessous sont indexés par le NUMÉRO de navigation : une navigation
  // nouvelle repart de zéro, même vers la même destination.
  const [visiblePour, setVisiblePour] = useState(-1);
  const [lentPour, setLentPour] = useState(-1);
  const [echecPour, setEchecPour] = useState(-1);
  const [verificationPour, setVerificationPour] = useState(-1);
  const [haut, setHaut] = useState<number | null>(null);
  // Numéro de la dernière navigation dont les zones grisées ont été affichées : en cas de
  // double appui, la seconde navigation les garde à l'écran au lieu de les faire clignoter.
  const dernierVisible = useRef(-1);

  useEffect(() => {
    if (!nav.destination) return;
    const id = nav.id;
    const destination = nav.destination;
    // Sous l'en-tête ET sous les bandeaux : on se cale sur le haut réel du contenu.
    const mesure = window.setTimeout(() => {
      const contenu = document.querySelector("main[data-contenu-coquille]");
      const enTete = document.querySelector("header.lg\\:hidden");
      const basEnTete = enTete ? enTete.getBoundingClientRect().bottom : 0;
      const hautContenu = contenu ? contenu.getBoundingClientRect().top : basEnTete;
      setHaut(Math.max(basEnTete, Math.min(hautContenu, window.innerHeight / 2)));
    }, 0);
    if (nav.horsLigne) return () => window.clearTimeout(mesure);
    const enchainement = dernierVisible.current === id - 1;
    const apparition = window.setTimeout(
      () => {
        dernierVisible.current = id;
        setVisiblePour(id);
      },
      enchainement ? 0 : DELAI_SQUELETTE,
    );
    const lenteur = window.setTimeout(() => setLentPour(id), DELAI_LENT);
    // Le réseau tombe pendant le chargement : écran « Pas de connexion ».
    const surCoupure = () => signalerHorsLigne(destination);
    window.addEventListener("offline", surCoupure);
    return () => {
      window.clearTimeout(mesure);
      window.clearTimeout(apparition);
      window.clearTimeout(lenteur);
      window.removeEventListener("offline", surCoupure);
    };
  }, [nav.id, nav.destination, nav.horsLigne]);

  if (!actif || !nav.destination) return null;

  const id = nav.id;
  const destination = nav.destination;
  const zone = "fixed inset-x-0 z-20 bg-background lg:hidden print:hidden";
  const place = {
    top: haut !== null ? `${haut}px` : "calc(3.5rem + var(--marge-sure-haut, 0px))",
    bottom: "var(--hauteur-barre-onglets, 0px)",
  };

  /** Abandonne VRAIMENT la page demandée : le routeur remplace la navigation en attente. */
  function rester() {
    terminerNavigation();
    router.replace(window.location.pathname + window.location.search, { scroll: false });
  }

  // ── Pas de réseau ──
  if (nav.horsLigne) {
    const enVerification = verificationPour === id;
    return (
      <div className={`${zone} flex flex-col items-center justify-center gap-4 px-8 text-center`} style={place}>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-700" aria-hidden>
          <WifiOff size={28} />
        </span>
        <div className="space-y-1.5" role="alert">
          <p className="font-display text-xl font-bold text-forest-900">Pas de connexion</p>
          <p className="text-sm text-ink-700/75">
            La page n&apos;a pas pu s&apos;ouvrir. Vérifiez le Wi-Fi ou les données mobiles, puis réessayez.
          </p>
          {echecPour === id && <p className="text-sm font-semibold text-gold-800">Toujours aucun réseau.</p>}
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            disabled={enVerification}
            onClick={async () => {
              setVerificationPour(id);
              const ok = await reseauDisponible();
              setVerificationPour(-1);
              if (!ok) {
                setEchecPour(id);
                return;
              }
              demarrerNavigation(destination);
              router.push(destination);
            }}
            className="min-h-12 rounded-full bg-forest-800 px-6 font-semibold text-cream-50 active:bg-forest-700 disabled:opacity-60"
          >
            {enVerification ? "Vérification…" : "Réessayer"}
          </button>
          <button
            type="button"
            onClick={() => terminerNavigation()}
            className="min-h-12 rounded-full px-6 font-medium text-forest-800 active:bg-cream-200"
          >
            Rester sur cette page
          </button>
        </div>
      </div>
    );
  }

  if (visiblePour !== id) return null;
  const lent = lentPour === id;

  // ── Zones grisées : la silhouette d'une page (description, puis cartes) ──
  return (
    <div className={`${zone} overflow-hidden px-4 py-6`} style={place}>
      <span className="sr-only" role="status">
        {lent ? "Le réseau est lent, la page arrive." : "Chargement de la page…"}
      </span>
      {lent ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-gold-300/60 bg-gold-50 px-4 py-3">
          <Hourglass size={18} className="mt-0.5 shrink-0 text-gold-700" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gold-900">Le réseau est lent.</p>
            <p className="text-sm text-gold-900/80">La page arrive. Vous pouvez aussi rester sur la page actuelle.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={rester}
                className="min-h-11 rounded-full bg-forest-800 px-4 text-sm font-semibold text-cream-50"
              >
                Rester ici
              </button>
              <button
                type="button"
                onClick={() => window.location.assign(destination)}
                className="min-h-11 rounded-full px-4 text-sm font-medium text-forest-800"
              >
                Recharger
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Barre className="mb-6 h-4 w-3/4" />
      )}
      <div className="space-y-4" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-3xl border border-cream-200 bg-white p-6">
            <Barre className="h-4 w-1/2" />
            <Barre className="h-3 w-full" />
            <Barre className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
