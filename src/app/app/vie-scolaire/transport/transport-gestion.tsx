"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bus, Clock, Coins, Wallet, UserCog, Trash2, Check, X } from "lucide-react";
import {
  type TransportBus,
  type TransportDriver,
  type TransportPayment,
  type TransportSettings,
  type TransportSlot,
  WEEKDAYS,
  DIRECTION_LABEL,
  slotSummary,
} from "@/lib/transport/transport";
import {
  ajouterBusAction,
  supprimerBusAction,
  ajouterCreneauAction,
  supprimerCreneauAction,
  enregistrerReglagesAction,
  confirmerPaiementAction,
  rejeterPaiementAction,
  ajouterConducteurAction,
  retirerConducteurAction,
} from "@/lib/transport/actions";
import { Card } from "@/components/app/ui";
import { BoutonAction } from "./transport-client";

function fcfa(n: number): string {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}
const inputCls =
  "w-full rounded-2xl border border-cream-300 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:border-forest-400 focus:ring-2 focus:ring-forest-200";

export function TransportGestion({
  settings,
  slots,
  buses,
  paiementsEnAttente,
  conducteurs,
  apercu,
}: {
  settings: TransportSettings | null;
  slots: TransportSlot[];
  buses: TransportBus[];
  paiementsEnAttente: TransportPayment[];
  conducteurs: TransportDriver[];
  apercu: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null);

  const lancer = React.useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string }>, succes: string) => {
      setMessage(null);
      startTransition(async () => {
        const r = await fn();
        setMessage(r.ok ? { ok: true, texte: succes } : { ok: false, texte: r.error ?? "Échec." });
        if (r.ok) router.refresh();
      });
    },
    [router],
  );

  if (apercu) {
    return (
      <Card>
        <p className="text-sm text-ink-700/70">Mode aperçu : la gestion du transport est en lecture seule.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.ok ? "border-forest-200 bg-forest-50 text-forest-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.texte}
        </div>
      )}

      <PaiementsSection paiements={paiementsEnAttente} pending={pending} lancer={lancer} />
      <BusSection buses={buses} pending={pending} lancer={lancer} />
      <CreneauxSection slots={slots} pending={pending} lancer={lancer} />
      <ConducteursSection conducteurs={conducteurs} pending={pending} lancer={lancer} />
      <ReglagesSection settings={settings} pending={pending} lancer={lancer} />
    </div>
  );
}

type Lancer = (fn: () => Promise<{ ok: boolean; error?: string }>, succes: string) => void;

/* ---- Paiements en attente ---- */
function PaiementsSection({ paiements, pending, lancer }: { paiements: TransportPayment[]; pending: boolean; lancer: Lancer }) {
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Wallet size={18} className="text-forest-700" />
        <h2 className="font-display text-base font-bold text-forest-900">Paiements à valider ({paiements.length})</h2>
      </div>
      {paiements.length === 0 ? (
        <p className="text-sm text-ink-700/60">Aucun paiement en attente.</p>
      ) : (
        <ul className="divide-y divide-cream-100">
          {paiements.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <div className="font-semibold text-forest-900">
                  {fcfa(p.amountFcfa)} · {p.period === "year" ? "Annuel" : "Mensuel"}
                  {p.isUpgrade ? " (passage à l'annuel)" : ""}
                </div>
                <div className="text-xs text-ink-700/60">
                  {p.payerEmail ?? "—"} · réf. {p.reference || "—"} · {new Date(p.createdAt).toLocaleString("fr-FR")}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => lancer(() => confirmerPaiementAction(p.id), "Paiement confirmé, abonnement prolongé.")}
                  className="inline-flex items-center gap-1 rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-forest-700 disabled:opacity-60"
                >
                  <Check size={14} /> Confirmer
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => lancer(() => rejeterPaiementAction(p.id), "Paiement rejeté.")}
                  className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <X size={14} /> Rejeter
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---- Cars ---- */
function BusSection({ buses, pending, lancer }: { buses: TransportBus[]; pending: boolean; lancer: Lancer }) {
  const [matricule, setMatricule] = React.useState("");
  const [label, setLabel] = React.useState("");
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Bus size={18} className="text-forest-700" />
        <h2 className="font-display text-base font-bold text-forest-900">Cars ({buses.length})</h2>
      </div>
      {buses.length > 0 && (
        <ul className="mb-4 divide-y divide-cream-100">
          {buses.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-forest-900">{b.label ? `${b.label} — ${b.matricule}` : b.matricule}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => lancer(() => supprimerBusAction(b.id), "Car supprimé.")}
                className="text-ink-700/50 hover:text-red-600 disabled:opacity-60"
                aria-label="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Matricule</label>
          <input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="ex. 1234 AB 01" className={inputCls} />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Libellé (facultatif)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Car Nord" className={inputCls} />
        </div>
        <BoutonAction
          pending={pending}
          libelle="Ajouter"
          onClick={() => {
            if (!matricule.trim()) return;
            lancer(() => ajouterBusAction({ matricule: matricule.trim(), label: label.trim() || undefined }), "Car ajouté.");
            setMatricule("");
            setLabel("");
          }}
        />
      </div>
    </Card>
  );
}

/* ---- Créneaux ---- */
function CreneauxSection({ slots, pending, lancer }: { slots: TransportSlot[]; pending: boolean; lancer: Lancer }) {
  const [direction, setDirection] = React.useState<"aller" | "retour">("aller");
  const [days, setDays] = React.useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = React.useState("06:30");
  const [endTime, setEndTime] = React.useState("07:30");

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Clock size={18} className="text-forest-700" />
        <h2 className="font-display text-base font-bold text-forest-900">Créneaux d'émission ({slots.length})</h2>
      </div>
      {slots.length > 0 && (
        <ul className="mb-4 divide-y divide-cream-100">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-forest-900">{slotSummary(s)}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => lancer(() => supprimerCreneauAction(s.id), "Créneau supprimé.")}
                className="text-ink-700/50 hover:text-red-600 disabled:opacity-60"
                aria-label="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Sens</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as "aller" | "retour")} className={inputCls}>
              <option value="aller">{DIRECTION_LABEL.aller}</option>
              <option value="retour">{DIRECTION_LABEL.retour}</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Début</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-forest-900">Fin</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-forest-900">Jours</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => toggleDay(w.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  days.includes(w.value) ? "bg-forest-800 text-cream-50" : "border border-cream-300 text-forest-800 hover:bg-cream-100"
                }`}
              >
                {w.short}
              </button>
            ))}
          </div>
        </div>
        <BoutonAction
          pending={pending}
          libelle="Ajouter le créneau"
          onClick={() => {
            if (days.length === 0) return;
            lancer(
              () => ajouterCreneauAction({ direction, days: [...days].sort((a, b) => a - b), startTime, endTime, active: true }),
              "Créneau ajouté.",
            );
          }}
        />
      </div>
    </Card>
  );
}

/* ---- Conducteurs ---- */
function ConducteursSection({ conducteurs, pending, lancer }: { conducteurs: TransportDriver[]; pending: boolean; lancer: Lancer }) {
  const [email, setEmail] = React.useState("");
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <UserCog size={18} className="text-forest-700" />
        <h2 className="font-display text-base font-bold text-forest-900">Conducteurs ({conducteurs.length})</h2>
      </div>
      {conducteurs.length > 0 && (
        <ul className="mb-4 divide-y divide-cream-100">
          {conducteurs.map((d) => (
            <li key={d.userId} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-forest-900">{d.email ?? d.userId}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => lancer(() => retirerConducteurAction(d.userId), "Conducteur retiré.")}
                className="text-ink-700/50 hover:text-red-600 disabled:opacity-60"
                aria-label="Retirer"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-forest-900">E-mail du conducteur (compte existant)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="conducteur@exemple.ci" className={inputCls} />
        </div>
        <BoutonAction
          pending={pending}
          libelle="Désigner"
          onClick={() => {
            if (!email.trim()) return;
            lancer(() => ajouterConducteurAction(email.trim()), "Conducteur désigné.");
            setEmail("");
          }}
        />
      </div>
    </Card>
  );
}

/* ---- Réglages ---- */
function ReglagesSection({ settings, pending, lancer }: { settings: TransportSettings | null; pending: boolean; lancer: Lancer }) {
  const [priceMonth, setPriceMonth] = React.useState(String(settings?.priceMonthFcfa ?? 0));
  const [priceYear, setPriceYear] = React.useState(String(settings?.priceYearFcfa ?? 0));
  const [penalty, setPenalty] = React.useState(String(settings?.upgradePenaltyPct ?? 20));
  const [beep, setBeep] = React.useState(String(settings?.beepIntervalMin ?? 5));
  const [lat, setLat] = React.useState(settings?.centerLat != null ? String(settings.centerLat) : "");
  const [lng, setLng] = React.useState(settings?.centerLng != null ? String(settings.centerLng) : "");

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Coins size={18} className="text-forest-700" />
        <h2 className="font-display text-base font-bold text-forest-900">Tarifs & réglages</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ label="Tarif mensuel (FCFA)" value={priceMonth} setValue={setPriceMonth} type="number" />
        <Champ label="Tarif annuel (FCFA)" value={priceYear} setValue={setPriceYear} type="number" />
        <Champ label="Pénalité d'équité upgrade (%)" value={penalty} setValue={setPenalty} type="number" />
        <Champ label="Intervalle du bip conducteur (min)" value={beep} setValue={setBeep} type="number" />
        <Champ label="Latitude de centrage (facultatif)" value={lat} setValue={setLat} type="text" />
        <Champ label="Longitude de centrage (facultatif)" value={lng} setValue={setLng} type="text" />
      </div>
      <div className="mt-4">
        <BoutonAction
          pending={pending}
          libelle="Enregistrer les réglages"
          onClick={() =>
            lancer(
              () =>
                enregistrerReglagesAction({
                  priceMonthFcfa: Number(priceMonth) || 0,
                  priceYearFcfa: Number(priceYear) || 0,
                  upgradePenaltyPct: Number(penalty) || 0,
                  beepIntervalMin: Number(beep) || 5,
                  centerLat: num(lat),
                  centerLng: num(lng),
                }),
              "Réglages enregistrés.",
            )
          }
        />
      </div>
    </Card>
  );
}

function Champ({
  label,
  value,
  setValue,
  type,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  type: "number" | "text";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-forest-900">{label}</label>
      <input type={type} value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} />
    </div>
  );
}
