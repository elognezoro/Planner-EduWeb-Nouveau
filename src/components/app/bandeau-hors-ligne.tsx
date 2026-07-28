"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, Loader2, Check, WifiOff } from "lucide-react";
import { nombreEnAttente, surChangementFile, synchroniser } from "@/lib/hors-ligne/file";

/**
 * BANDEAU HORS LIGNE — informer, et surtout RASSURER.
 *
 * Règle de rédaction : ne jamais promettre ce qui n'est pas vrai. Le message change donc selon
 * qu'il y a, ou non, des saisies réellement en attente :
 *  - hors ligne SANS saisie en attente : on prévient que les enregistrements ne partiront pas ;
 *  - hors ligne AVEC saisies en attente : on promet l'envoi automatique, car la file existe ;
 *  - retour de connexion : on montre l'envoi, puis sa confirmation.
 *
 * Un bandeau qui annoncerait « vos données seront synchronisées » alors qu'aucun écran n'alimente
 * la file induirait l'utilisateur en erreur — exactement ce qu'il ne faut pas faire à quelqu'un
 * qui vient de saisir une heure d'appel.
 */
export function BandeauHorsLigne() {
  const [horsLigne, setHorsLigne] = useState(false);
  const [enAttente, setEnAttente] = useState(0);
  const [etat, etatSet] = useState<"repos" | "envoi" | "envoye">("repos");
  const [envoyees, setEnvoyees] = useState(0);

  const rafraichir = useCallback(() => setEnAttente(nombreEnAttente()), []);

  const lancerSynchro = useCallback(async () => {
    if (nombreEnAttente() === 0) return;
    etatSet("envoi");
    const r = await synchroniser();
    setEnAttente(r.restantes);
    setEnvoyees(r.envoyees);
    etatSet(r.envoyees > 0 ? "envoye" : "repos");
    if (r.envoyees > 0) window.setTimeout(() => etatSet("repos"), 6000);
  }, []);

  useEffect(() => {
    // `navigator.onLine` n'est lu qu'ICI (après montage) : au rendu serveur il n'existe pas, et
    // supposer « en ligne » par défaut évite un bandeau qui clignote au chargement.
    setHorsLigne(!navigator.onLine);
    rafraichir();
    const desabonner = surChangementFile(rafraichir);
    const versHorsLigne = () => setHorsLigne(true);
    const versEnLigne = () => {
      setHorsLigne(false);
      void lancerSynchro();
    };
    window.addEventListener("offline", versHorsLigne);
    window.addEventListener("online", versEnLigne);
    // Filet : `online` ne se déclenche pas toujours (bascule Wi-Fi/données mobiles).
    const minuteur = window.setInterval(() => {
      if (navigator.onLine && nombreEnAttente() > 0) void lancerSynchro();
    }, 30_000);
    return () => {
      desabonner();
      window.removeEventListener("offline", versHorsLigne);
      window.removeEventListener("online", versEnLigne);
      window.clearInterval(minuteur);
    };
  }, [rafraichir, lancerSynchro]);

  if (!horsLigne && etat === "repos" && enAttente === 0) return null;

  const attente = `${enAttente} saisie${enAttente > 1 ? "s" : ""}`;

  return (
    <div
      aria-live="polite"
      className={
        horsLigne
          ? "flex items-start gap-2.5 border-b border-gold-400/60 bg-gradient-to-r from-gold-100 to-gold-50 px-4 py-2.5 text-sm text-gold-900 sm:px-6 print:hidden"
          : "flex items-start gap-2.5 border-b border-forest-300/60 bg-gradient-to-r from-forest-50 to-cream-50 px-4 py-2.5 text-sm text-forest-900 sm:px-6 print:hidden"
      }
    >
      {horsLigne ? (
        <>
          <WifiOff size={17} className="mt-0.5 shrink-0 text-gold-600" />
          <p>
            <strong>Vous êtes hors connexion.</strong>{" "}
            {enAttente > 0 ? (
              <>
                {attente} en attente : <strong>elles seront envoyées automatiquement</strong> dès le
                retour du réseau. Ne fermez pas l&apos;application, et ne ressaisissez rien.
              </>
            ) : (
              <>
                Vous pouvez continuer à consulter les pages déjà ouvertes. Les écrans qui
                fonctionnent hors connexion conserveront vos saisies ; ailleurs, attendez le retour
                du réseau avant d&apos;enregistrer.
              </>
            )}
          </p>
        </>
      ) : etat === "envoi" ? (
        <>
          <Loader2 size={17} className="mt-0.5 shrink-0 animate-spin text-forest-600" />
          <p>
            Connexion rétablie — <strong>envoi de vos saisies en cours…</strong>
          </p>
        </>
      ) : etat === "envoye" ? (
        <>
          <Check size={17} className="mt-0.5 shrink-0 text-forest-600" />
          <p>
            <strong>
              {envoyees} saisie{envoyees > 1 ? "s" : ""} synchronisée{envoyees > 1 ? "s" : ""}.
            </strong>{" "}
            Tout est enregistré. ✅
          </p>
        </>
      ) : (
        <>
          <CloudOff size={17} className="mt-0.5 shrink-0 text-forest-600" />
          <p>
            {attente} en attente d&apos;envoi.{" "}
            <button type="button" onClick={() => void lancerSynchro()} className="font-semibold underline">
              Envoyer maintenant
            </button>
          </p>
        </>
      )}
    </div>
  );
}
