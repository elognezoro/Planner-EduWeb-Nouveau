"use client";

import * as React from "react";
import { MapPin, Bus, Settings2, Info, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import {
  type BusPosition,
  type SubscriptionPeriod,
  type TransportBus,
  type TransportDriver,
  type TransportPayment,
  type TransportSettings,
  type TransportSlot,
  type TransportSubscription,
  PERIOD_LABEL,
  priceForPeriod,
  formatExpiry,
  computeUpgradeQuote,
} from "@/lib/transport/transport";
import { rafraichirPositionsAction, souscrireAction, passerAnnuelAction } from "@/lib/transport/actions";
import { Card } from "@/components/app/ui";
import { BusMap, type BusMarker } from "@/components/app/transport/bus-map";
import { TransportConduite } from "./transport-conduite";
import { TransportGestion } from "./transport-gestion";

export interface Capacites {
  gestionnaire: boolean;
  conducteur: boolean;
  apercu: boolean;
}

interface Props {
  capacites: Capacites;
  settings: TransportSettings | null;
  slots: TransportSlot[];
  buses: TransportBus[];
  positionsInitiales: BusPosition[];
  abonnement: TransportSubscription;
  dernierPaiement: TransportPayment | null;
  paiementsEnAttente: TransportPayment[];
  conducteurs: TransportDriver[];
}

function fcfa(n: number): string {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

type Onglet = "suivi" | "conduite" | "gestion";

export function TransportClient(props: Props) {
  const { capacites, settings } = props;
  const [onglet, setOnglet] = React.useState<Onglet>("suivi");

  const onglets: { id: Onglet; libelle: string; icone: React.ReactNode; visible: boolean }[] = [
    { id: "suivi", libelle: "Suivi en direct", icone: <MapPin size={16} />, visible: true },
    { id: "conduite", libelle: "Conduite", icone: <Bus size={16} />, visible: capacites.conducteur },
    { id: "gestion", libelle: "Gestion", icone: <Settings2 size={16} />, visible: capacites.gestionnaire },
  ];

  return (
    <div className="space-y-6">
      {capacites.apercu && (
        <div className="flex items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-forest-800">
          <Info size={16} className="shrink-0" /> Mode aperçu : consultation uniquement (aucune action).
        </div>
      )}

      {onglets.filter((o) => o.visible).length > 1 && (
        <div className="flex flex-wrap gap-2">
          {onglets
            .filter((o) => o.visible)
            .map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOnglet(o.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  onglet === o.id
                    ? "bg-forest-800 text-cream-50"
                    : "border border-cream-300 text-forest-800 hover:bg-cream-100"
                }`}
              >
                {o.icone} {o.libelle}
              </button>
            ))}
        </div>
      )}

      {onglet === "suivi" && <Suivi {...props} />}
      {onglet === "conduite" && capacites.conducteur && (
        <TransportConduite buses={props.buses} beepIntervalMin={settings?.beepIntervalMin ?? 5} apercu={capacites.apercu} />
      )}
      {onglet === "gestion" && capacites.gestionnaire && (
        <TransportGestion
          settings={settings}
          slots={props.slots}
          buses={props.buses}
          paiementsEnAttente={props.paiementsEnAttente}
          conducteurs={props.conducteurs}
          apercu={capacites.apercu}
        />
      )}
    </div>
  );
}

/* ============================ Suivi en direct ============================= */
function Suivi({ settings, positionsInitiales, abonnement, dernierPaiement, buses, capacites }: Props) {
  const [positions, setPositions] = React.useState<BusPosition[]>(positionsInitiales);
  // On n'interroge le serveur QUE si l'appelant a de quoi voir (abonné actif ou gestionnaire) :
  // un visiteur non abonné ne déclenche aucune tempête de requêtes (cf. audit de scalabilité).
  const peutSuivre = abonnement.subscribed || capacites.gestionnaire;

  // Rafraîchissement ~5 s avec GIGUE (désynchronise la foule) et PAUSE quand l'onglet est masqué.
  React.useEffect(() => {
    if (!peutSuivre) return;
    let vivant = true;
    let timer: number | undefined;
    const planifier = () => {
      const delai = 5000 + Math.floor((Math.random() - 0.5) * 3000); // 5 s ± 1,5 s
      timer = window.setTimeout(tic, delai);
    };
    const tic = async () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        const p = await rafraichirPositionsAction();
        if (vivant) setPositions(p);
      }
      if (vivant) planifier();
    };
    planifier();
    return () => {
      vivant = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [peutSuivre]);

  const nomBus = React.useMemo(() => new Map(buses.map((b) => [b.id, b.label || b.matricule])), [buses]);
  const markers: BusMarker[] = positions.map((p) => ({
    id: p.busId,
    lat: p.lat,
    lng: p.lng,
    label: nomBus.get(p.busId) ?? "Car",
  }));

  const center = settings?.centerLat != null && settings?.centerLng != null
    ? { lat: settings.centerLat, lng: settings.centerLng }
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-forest-900">Position des cars</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-700/60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-forest-500" /> mise à jour toutes les 5 s
          </span>
        </div>
        {markers.length === 0 ? (
          <p className="rounded-xl bg-cream-100 px-4 py-6 text-center text-sm text-ink-700/60">
            Aucun car en circulation visible pour le moment{" "}
            {abonnement.subscribed ? "" : "— l'abonnement donne accès au suivi lorsque le car émet sa position."}
          </p>
        ) : (
          <BusMap markers={markers} center={center} height={420} />
        )}
      </Card>

      <AbonnementCarte
        settings={settings}
        abonnement={abonnement}
        dernierPaiement={dernierPaiement}
        apercu={capacites.apercu}
      />
    </div>
  );
}

/* ============================ Abonnement ================================== */
function AbonnementCarte({
  settings,
  abonnement,
  dernierPaiement,
  apercu,
}: {
  settings: TransportSettings | null;
  abonnement: TransportSubscription;
  dernierPaiement: TransportPayment | null;
  apercu: boolean;
}) {
  const [period, setPeriod] = React.useState<SubscriptionPeriod>("month");
  const [reference, setReference] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null);

  const enAttente = dernierPaiement?.status === "pending";
  const devisUpgrade = computeUpgradeQuote(settings, abonnement, new Date());

  function souscrire() {
    setMessage(null);
    startTransition(async () => {
      const r = await souscrireAction({ period, reference: reference.trim() || null });
      setMessage(
        r.ok
          ? { ok: true, texte: "Demande d'abonnement enregistrée. Elle sera validée après réception du paiement Mobile Money." }
          : { ok: false, texte: r.error ?? "Échec." },
      );
      if (r.ok) setReference("");
    });
  }
  function passerAnnuel() {
    setMessage(null);
    startTransition(async () => {
      const r = await passerAnnuelAction(reference.trim());
      setMessage(
        r.ok
          ? { ok: true, texte: "Passage à l'annuel enregistré. Il sera validé après réception du paiement." }
          : { ok: false, texte: r.error ?? "Échec." },
      );
      if (r.ok) setReference("");
    });
  }

  return (
    <Card>
      <h2 className="mb-1 font-display text-base font-bold text-forest-900">Mon abonnement au suivi</h2>

      {abonnement.subscribed ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-800">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest-600" />
          <span>
            Abonnement <strong>{abonnement.period ? PERIOD_LABEL[abonnement.period] : ""}</strong> actif
            {formatExpiry(abonnement.expiresAt) ? <> — jusqu'au <strong>{formatExpiry(abonnement.expiresAt)}</strong></> : null}.
          </span>
        </div>
      ) : (
        <p className="mb-4 text-sm text-ink-700/70">
          Abonnez-vous pour suivre le car en temps réel sur la carte pendant les trajets.
        </p>
      )}

      {enAttente && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-forest-800">
          <Clock size={16} className="shrink-0" /> Un paiement de {fcfa(dernierPaiement!.amountFcfa)} est en attente de validation par l'établissement.
        </div>
      )}

      {message && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            message.ok ? "border-forest-200 bg-forest-50 text-forest-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <Info size={16} className="mt-0.5 shrink-0" />}
          <span>{message.texte}</span>
        </div>
      )}

      {!apercu && !abonnement.subscribed && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["month", "year"] as SubscriptionPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  period === p ? "border-forest-500 bg-forest-50" : "border-cream-300 hover:bg-cream-100"
                }`}
              >
                <div className="font-semibold text-forest-900">{PERIOD_LABEL[p]}</div>
                <div className="text-ink-700/70">{fcfa(priceForPeriod(settings, p))}</div>
              </button>
            ))}
          </div>
          <ChampReference reference={reference} setReference={setReference} />
          <BoutonAction onClick={souscrire} pending={pending} libelle="M'abonner (Mobile Money)" />
        </div>
      )}

      {!apercu && abonnement.subscribed && devisUpgrade && (
        <div className="mt-2 space-y-3 rounded-2xl border border-cream-300 bg-cream-50 p-4">
          <p className="text-sm text-forest-900">
            <strong>Passer à l'annuel</strong> — reste à régler <strong>{fcfa(devisUpgrade.total)}</strong>{" "}
            (crédit de {devisUpgrade.remainingDays} j déduit
            {devisUpgrade.penaltyPct > 0 ? `, pénalité d'équité ${devisUpgrade.penaltyPct} %` : ""}).
          </p>
          <ChampReference reference={reference} setReference={setReference} />
          <BoutonAction onClick={passerAnnuel} pending={pending} libelle="Passer à l'annuel" />
        </div>
      )}
    </Card>
  );
}

function ChampReference({ reference, setReference }: { reference: string; setReference: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-forest-900">Référence du paiement Mobile Money</label>
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="ex. identifiant de la transaction"
        className="w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200"
      />
      <p className="mt-1 text-xs text-ink-700/60">Effectuez le paiement, puis saisissez sa référence. L'établissement validera ensuite votre abonnement.</p>
    </div>
  );
}

export function BoutonAction({
  onClick,
  pending,
  libelle,
  ton = "forest",
}: {
  onClick: () => void;
  pending: boolean;
  libelle: string;
  ton?: "forest" | "rouge";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-cream-50 shadow-soft transition disabled:opacity-60 ${
        ton === "rouge" ? "bg-red-600 hover:bg-red-700" : "bg-forest-800 hover:bg-forest-700"
      }`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}
