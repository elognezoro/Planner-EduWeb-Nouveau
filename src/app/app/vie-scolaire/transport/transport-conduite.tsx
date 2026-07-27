"use client";

import * as React from "react";
import { Bus, Play, Square, Volume2, Navigation } from "lucide-react";
import type { TransportBus } from "@/lib/transport/transport";
import { emettrePositionAction } from "@/lib/transport/actions";
import { unlockAudio, playTripleBeep } from "@/components/app/transport/transport-beep";
import { Card } from "@/components/app/ui";

/**
 * Poste conducteur : émet la position GPS du navigateur pendant le trajet.
 * Un bip de rappel « bip-bip-bip » retentit périodiquement (rappel de vigilance/arrêt).
 */
export function TransportConduite({
  buses,
  beepIntervalMin,
  apercu,
}: {
  buses: TransportBus[];
  beepIntervalMin: number;
  apercu: boolean;
}) {
  const [busId, setBusId] = React.useState<string>(buses[0]?.id ?? "");
  const [enCours, setEnCours] = React.useState(false);
  const [derniere, setDerniere] = React.useState<{ lat: number; lng: number; a: string } | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [audioActif, setAudioActif] = React.useState(false);

  const watchRef = React.useRef<number | null>(null);
  const beepRef = React.useRef<number | null>(null);
  const busIdRef = React.useRef(busId);
  busIdRef.current = busId;

  const arreter = React.useCallback(() => {
    if (watchRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (beepRef.current != null) {
      window.clearInterval(beepRef.current);
      beepRef.current = null;
    }
    setEnCours(false);
  }, []);

  // Nettoyage à la sortie de l'écran.
  React.useEffect(() => arreter, [arreter]);

  function demarrer() {
    setErreur(null);
    if (!busId) {
      setErreur("Choisissez d'abord votre car.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErreur("La géolocalisation n'est pas disponible sur cet appareil / navigateur.");
      return;
    }
    unlockAudio();
    setAudioActif(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        void emettrePositionAction({
          busId: busIdRef.current,
          lat: latitude,
          lng: longitude,
          heading: Number.isFinite(heading) ? heading : null,
          speed: Number.isFinite(speed) ? speed : null,
        }).then((r) => {
          if (!r.ok) setErreur(r.error ?? "Émission refusée.");
        });
        setDerniere({ lat: latitude, lng: longitude, a: new Date().toLocaleTimeString("fr-FR") });
      },
      (err) => setErreur(err.message || "Impossible d'obtenir la position."),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    const intervalle = Math.max(1, beepIntervalMin) * 60 * 1000;
    beepRef.current = window.setInterval(() => playTripleBeep(), intervalle);
    setEnCours(true);
  }

  if (apercu) {
    return (
      <Card>
        <p className="text-sm text-ink-700/70">Mode aperçu : l'émission de position est désactivée.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Bus size={20} className="text-forest-700" />
        <h2 className="font-display text-base font-bold text-forest-900">Poste conducteur</h2>
      </div>

      {buses.length === 0 ? (
        <p className="rounded-xl bg-cream-100 px-4 py-6 text-center text-sm text-ink-700/60">
          Aucun car n'est enregistré pour votre établissement. Demandez à la direction d'en ajouter (onglet Gestion).
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Votre car</label>
            <select
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              disabled={enCours}
              className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200 disabled:opacity-60"
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label ? `${b.label} — ${b.matricule}` : b.matricule}
                </option>
              ))}
            </select>
          </div>

          {erreur && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>}

          <div className="flex flex-wrap items-center gap-3">
            {!enCours ? (
              <button
                type="button"
                onClick={demarrer}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-800 px-6 text-sm font-semibold text-cream-50 hover:bg-forest-700"
              >
                <Play size={16} /> Démarrer l'émission
              </button>
            ) : (
              <button
                type="button"
                onClick={arreter}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-6 text-sm font-semibold text-cream-50 hover:bg-red-700"
              >
                <Square size={16} /> Arrêter
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-700/60">
              <Volume2 size={14} /> {audioActif ? `bip toutes les ${Math.max(1, beepIntervalMin)} min` : "son activé au démarrage"}
            </span>
          </div>

          {enCours && (
            <div className="flex items-center gap-2 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
              <Navigation size={16} className="shrink-0 animate-pulse" />
              {derniere
                ? <>Position émise à {derniere.a} — {derniere.lat.toFixed(5)}, {derniere.lng.toFixed(5)}</>
                : "En attente du signal GPS…"}
            </div>
          )}

          <p className="text-xs text-ink-700/60">
            Gardez cet écran ouvert et l'appareil sous tension pendant le trajet. La position n'est visible que
            des familles abonnées de l'établissement.
          </p>
        </div>
      )}
    </Card>
  );
}
