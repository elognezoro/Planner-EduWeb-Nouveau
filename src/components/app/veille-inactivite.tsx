"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, LogOut, ShieldCheck } from "lucide-react";
import { seDeconnecter } from "@/app/app/actions";
import { unlockAudio, playTripleBeep } from "@/components/app/transport/transport-beep";
import { lireActivitePartagee, ecrireActivitePartagee } from "@/lib/inactivite-partagee";

/* ============================================================================
   Veilleur d'INACTIVITÉ — monté par le layout /app quand l'admin système a
   activé la déconnexion automatique (Système › Configuration générale).

   - Toute activité (clic, clavier, souris, défilement, toucher) réarme le
     compteur ; l'activité dans un AUTRE onglet EduWeb compte aussi (horodatage
     partagé via localStorage, module inactivite-partagee).
   - À « délai − préavis », une ALERTE VISUELLE (modale + compte à rebours) et
     SONORE (bip Web Audio, rejoué dans les 10 dernières secondes) prévient
     l'utilisateur, avec un bouton « Rester connecté ».
   - À l'expiration, la déconnexion passe par la Server Action `seDeconnecter`
     (journal de sécurité + signOut + redirection /connexion) — le chemin
     canonique de déconnexion de l'application.

   Garanties issues de la revue adversariale :
   - Une expiration atteinte PENDANT une absence (onglet déchargé par le
     navigateur, F5 tardif, machine en veille) est appliquée AU RETOUR : au
     montage comme au premier geste, l'échéance est vérifiée AVANT de réarmer.
     Le formulaire de connexion horodate la connexion pour qu'une session
     fraîche ne soit jamais jugée expirée par l'horodatage d'une session passée.
   - Échec réseau de la déconnexion (poste hors ligne au réveil) : repli en
     navigation dure vers /connexion — jamais de modale bloquée qui prétendrait
     la session fermée.
   - Les clics/touches DANS la boîte d'alerte ne referment pas l'alerte : ses
     deux boutons gardent la main (pas de « clic au travers »).
   - Plusieurs onglets expirés = UNE seule déconnexion journalisée (verrou
     best-effort partagé), les autres onglets suivent en navigation dure.

   Règle projet : pas de dialogue natif (window.confirm/alert) — vraie modale.
   ========================================================================== */

/** Fréquence maximale d'écriture de l'horodatage partagé (ms) — ménage le stockage. */
const ECRITURE_MIN_MS = 5_000;
/** Verrou partagé de déconnexion (un seul onglet appelle l'action → une seule entrée au journal). */
const CLE_VERROU = "eduweb.deconnexion-inactivite";

/** Test-and-set best-effort : true si CET onglet doit mener la déconnexion. */
function poserVerrouDeconnexion(): boolean {
  try {
    const t = Number(window.localStorage.getItem(CLE_VERROU)) || 0;
    if (Date.now() - t < 10_000) return false; // un autre onglet s'en charge déjà
    window.localStorage.setItem(CLE_VERROU, String(Date.now()));
    return true;
  } catch {
    return true; // stockage indisponible : on se déconnecte quand même
  }
}

export function VeilleInactivite({
  delaiMinutes,
  avertissementSecondes,
}: {
  delaiMinutes: number;
  avertissementSecondes: number;
}) {
  const delaiMs = delaiMinutes * 60_000;
  const avertissementMs = avertissementSecondes * 1_000;

  // Semée dans l'effet (depuis l'horodatage partagé) AVANT la pose des écouteurs.
  const derniereActiviteRef = useRef<number>(0);
  const derniereEcritureRef = useRef<number>(0);
  const alerteOuverteRef = useRef(false);
  const rappelSonoreRef = useRef(false);
  const deconnexionRef = useRef(false);

  /** Secondes restantes avant la coupure (null = pas d'alerte affichée). */
  const [restant, setRestant] = useState<number | null>(null);
  const [deconnexion, setDeconnexion] = useState(false);

  const btnResterRef = useRef<HTMLButtonElement | null>(null);
  const btnDeconnecterRef = useRef<HTMLButtonElement | null>(null);

  const enregistrerActivite = useCallback(() => {
    const t = Date.now();
    derniereActiviteRef.current = t;
    if (t - derniereEcritureRef.current >= ECRITURE_MIN_MS) {
      derniereEcritureRef.current = t;
      ecrireActivitePartagee(t);
    }
  }, []);

  const fermerAlerte = useCallback(() => {
    alerteOuverteRef.current = false;
    rappelSonoreRef.current = false;
    setRestant(null);
  }, []);

  /**
   * Déconnexion effective. `verrouiller` = expiration automatique (plusieurs onglets peuvent
   * expirer ensemble : un seul appelle l'action, les autres suivent en navigation dure) ;
   * false = demande explicite de l'utilisateur (bouton), appel direct.
   * L'échec réseau (poste hors ligne) est rattrapé par une navigation dure vers /connexion :
   * jamais de modale bloquée prétendant la session fermée.
   */
  const deconnecter = useCallback((verrouiller: boolean) => {
    if (deconnexionRef.current) return;
    deconnexionRef.current = true;
    setDeconnexion(true);
    // Page courante (chemin + filtres) transmise à la déconnexion : à la RECONNEXION,
    // l'utilisateur revient directement dessus (validée côté serveur — anti open-redirect).
    const retour = window.location.pathname + window.location.search;
    const urlConnexion = `/connexion?retour=${encodeURIComponent(retour)}`;
    if (!verrouiller || poserVerrouDeconnexion()) {
      seDeconnecter(retour).catch(() => {
        window.location.assign(urlConnexion);
      });
    } else {
      // Un autre onglet mène la déconnexion (une seule entrée au journal de sécurité) ;
      // repli dur au cas où il n'aboutirait pas — chaque onglet garde SA page de retour.
      window.setTimeout(() => window.location.assign(urlConnexion), 4_000);
    }
  }, []);

  /** « Rester connecté » : réarme le compteur (partagé immédiatement) et ferme l'alerte. */
  const resterConnecte = useCallback(() => {
    derniereEcritureRef.current = 0; // force le partage immédiat aux autres onglets
    enregistrerActivite();
    fermerAlerte();
  }, [enregistrerActivite, fermerAlerte]);

  const deconnecterMaintenant = useCallback(() => deconnecter(false), [deconnecter]);

  useEffect(() => {
    // ── Échéance déjà dépassée à l'ARRIVÉE (onglet déchargé/rechargé, F5 tardif, navigateur
    // relancé) : la session a expiré pendant l'absence → déconnexion immédiate, pas de réarmement.
    // Une connexion toute fraîche est protégée : le formulaire de connexion vient d'écrire
    // l'horodatage partagé, donc `partage` est récent.
    const partage = lireActivitePartagee();
    const maintenant = Date.now();
    if (partage > 0 && maintenant - partage >= delaiMs) {
      deconnecter(true);
      return; // ni écouteurs ni minuteur : la déconnexion est en cours
    }
    // Point de départ : la dernière activité CONNUE (partagée), sinon l'arrivée sur la page.
    derniereActiviteRef.current = partage > 0 ? partage : maintenant;

    /** L'évènement vise-t-il l'intérieur de la boîte d'alerte ? (ses boutons gardent la main). */
    const dansAlerte = (cible: EventTarget | null) =>
      alerteOuverteRef.current &&
      cible instanceof Element &&
      cible.closest("[data-veille-alerte]") !== null;

    /**
     * Si le délai est DÉJÀ écoulé au moment du geste (retour après une longue absence, machine
     * sortie de veille : le geste peut précéder le prochain tick), ce geste ne réarme pas la
     * session — il déclenche la déconnexion. Renvoie true si la déconnexion a été engagée.
     */
    const expirationAuRetour = (t: number): boolean => {
      if (t - derniereActiviteRef.current < delaiMs) return false;
      if (t - Math.max(derniereActiviteRef.current, lireActivitePartagee()) < delaiMs) return false;
      deconnecter(true);
      return true;
    };

    // Activité « FORTE » (clic, clavier, toucher) : compte toujours — pendant l'alerte, elle
    // vaut « je suis là » et referme l'avertissement, SAUF dans la boîte d'alerte elle-même
    // (sinon le clic sur « Se déconnecter maintenant » refermerait la modale avant d'agir).
    // Elle débloque aussi l'audio (le navigateur n'autorise le son qu'après un geste).
    const forte = (e: Event) => {
      unlockAudio();
      if (deconnexionRef.current) return;
      if (dansAlerte(e.target)) return;
      if (expirationAuRetour(Date.now())) return;
      enregistrerActivite();
      if (alerteOuverteRef.current) fermerAlerte();
    };
    // Activité « LÉGÈRE » (déplacement de souris, défilement) : compte seulement HORS alerte,
    // pour qu'un frôlement de souris ne fasse pas disparaître l'avertissement avant que
    // l'utilisateur l'ait vu.
    const legere = () => {
      if (deconnexionRef.current || alerteOuverteRef.current) return;
      if (expirationAuRetour(Date.now())) return;
      enregistrerActivite();
    };

    window.addEventListener("pointerdown", forte);
    window.addEventListener("keydown", forte);
    window.addEventListener("touchstart", forte, { passive: true });
    window.addEventListener("mousemove", legere);
    window.addEventListener("wheel", legere, { passive: true });
    window.addEventListener("scroll", legere, { passive: true });

    const tique = window.setInterval(() => {
      if (deconnexionRef.current) return;
      // Dernière activité : la plus récente entre CET onglet et les autres (stockage partagé) —
      // travailler dans un autre onglet EduWeb maintient la session partout.
      const partageCourant = lireActivitePartagee();
      const derniere = Math.max(derniereActiviteRef.current, partageCourant);
      const inactifMs = Date.now() - derniere;

      if (inactifMs >= delaiMs) {
        deconnecter(true);
        return;
      }
      if (inactifMs >= delaiMs - avertissementMs) {
        const secondes = Math.max(1, Math.ceil((delaiMs - inactifMs) / 1000));
        if (!alerteOuverteRef.current) {
          // Convergence inter-onglets : la toute dernière activité locale peut être en retard
          // de ≤5 s dans le stockage (throttle). La partager MAINTENANT aligne l'échéance de
          // tous les onglets — aucun ne déconnectera quelques secondes trop tôt.
          if (derniereActiviteRef.current > partageCourant) {
            derniereEcritureRef.current = Date.now();
            ecrireActivitePartagee(derniereActiviteRef.current);
          }
          alerteOuverteRef.current = true;
          rappelSonoreRef.current = false;
          playTripleBeep(); // alerte SONORE à l'ouverture…
        } else if (secondes <= 10 && !rappelSonoreRef.current) {
          rappelSonoreRef.current = true;
          playTripleBeep(); // …et rappel dans les 10 dernières secondes.
        }
        setRestant(secondes);
      } else if (alerteOuverteRef.current) {
        fermerAlerte(); // activité détectée dans un autre onglet : refermer ici aussi.
      }
    }, 1_000);

    return () => {
      window.removeEventListener("pointerdown", forte);
      window.removeEventListener("keydown", forte);
      window.removeEventListener("touchstart", forte);
      window.removeEventListener("mousemove", legere);
      window.removeEventListener("wheel", legere);
      window.removeEventListener("scroll", legere);
      window.clearInterval(tique);
    };
  }, [delaiMs, avertissementMs, enregistrerActivite, fermerAlerte, deconnecter]);

  if (restant === null && !deconnexion) return null;

  const deux = (n: number) => String(n).padStart(2, "0");
  const minutes = Math.floor((restant ?? 0) / 60);
  const secondes = (restant ?? 0) % 60;
  const progression = Math.max(0, Math.min(100, ((restant ?? 0) / avertissementSecondes) * 100));

  /** Piège à focus minimal : Tab / Maj+Tab circulent entre les deux boutons de l'alerte. */
  const piegerFocus = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const actif = document.activeElement;
    (actif === btnResterRef.current ? btnDeconnecterRef.current : btnResterRef.current)?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titre-veille-inactivite"
      aria-describedby="desc-veille-inactivite"
    >
      <div
        data-veille-alerte
        onKeyDown={piegerFocus}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlarmClock size={22} />
          </span>
          <div>
            <h2 id="titre-veille-inactivite" className="font-display text-lg font-bold text-forest-900">
              {deconnexion ? "Déconnexion en cours…" : "Toujours là ?"}
            </h2>
            <p id="desc-veille-inactivite" className="mt-1 text-sm text-ink-700/70">
              {deconnexion
                ? "Fermeture de votre session pour cause d'inactivité. Vous allez être redirigé(e) vers la page de connexion."
                : "Sans action de votre part, vous serez déconnecté(e) automatiquement pour protéger votre compte."}
            </p>
          </div>
        </div>

        {deconnexion ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-ink-700/70">
            <LogOut size={15} className="animate-pulse" /> Fermeture de la session… Si rien ne se
            passe, rechargez la page.
          </p>
        ) : (
          <>
            <p className="mt-5 text-center font-display text-4xl font-bold tabular-nums text-red-600" role="timer">
              {deux(minutes)}:{deux(secondes)}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-200" aria-hidden="true">
              <div
                className="h-full rounded-full bg-red-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progression}%` }}
              />
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                ref={btnDeconnecterRef}
                type="button"
                onClick={deconnecterMaintenant}
                className="rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-700/70 hover:bg-cream-100"
              >
                Se déconnecter maintenant
              </button>
              <button
                ref={btnResterRef}
                type="button"
                onClick={resterConnecte}
                autoFocus
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-forest-800 px-5 py-2 text-sm font-semibold text-cream-50 hover:bg-forest-700"
              >
                <ShieldCheck size={15} /> Rester connecté
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
