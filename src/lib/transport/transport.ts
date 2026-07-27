/* ============================================================================
   Module « Transport d'élèves » — types & logique de créneaux.

   Géolocalisation temps réel du car (Leaflet/OpenStreetMap). Le conducteur émet
   sa position pendant les créneaux paramétrés ; les abonnés la voient sur la
   carte. Tarification FCFA + équivalent EUR (réutilise lib/formations/pricing).
   ========================================================================== */

export type SlotDirection = "aller" | "retour";

/** Formule d'abonnement choisie par le parent. */
export type SubscriptionPeriod = "month" | "year";

export interface TransportSettings {
  /** Tarif de la formule mensuelle (FCFA). */
  priceMonthFcfa: number;
  /** Tarif de la formule annuelle (FCFA). */
  priceYearFcfa: number;
  /** Pénalité d'équité (%) appliquée au passage mensuel → annuel. */
  upgradePenaltyPct: number;
  /** Périodicité du bip de rappel, en minutes (défaut 5). */
  beepIntervalMin: number;
  centerLat: number | null;
  centerLng: number | null;
}

/** État d'abonnement d'un utilisateur (avec échéance). */
export interface TransportSubscription {
  subscribed: boolean;
  period: SubscriptionPeriod | null;
  /** ISO de fin de validité, ou null (abonnement legacy sans échéance). */
  expiresAt: string | null;
}

export const PERIOD_LABEL: Record<SubscriptionPeriod, string> = {
  month: "Mensuel",
  year: "Annuel",
};

/** Tarif correspondant à la formule choisie. */
export function priceForPeriod(
  settings: Pick<TransportSettings, "priceMonthFcfa" | "priceYearFcfa"> | null,
  period: SubscriptionPeriod,
): number {
  if (!settings) return 0;
  return period === "year" ? settings.priceYearFcfa : settings.priceMonthFcfa;
}

/** Date d'échéance formatée (fr-FR) ou null. */
export function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Devis de passage mensuel → annuel (avec pénalité d'équité). */
export interface UpgradeQuote {
  /** Tarif annuel plein. */
  annual: number;
  /** Jours encore couverts par le mois en cours. */
  remainingDays: number;
  /** Crédit des jours non consommés du mois en cours (déduit). */
  creditUnused: number;
  /** Reste à payer vers l'annuel, avant pénalité (≥ 0). */
  baseRemaining: number;
  /** Pénalité (%). */
  penaltyPct: number;
  /** Montant de la pénalité. */
  penaltyAmount: number;
  /** Montant total à régler pour l'upgrade. */
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calcule le devis d'upgrade mensuel → annuel (AFFICHAGE), ou null si
 * l'utilisateur n'est pas un abonné mensuel actif.
 *
 * ⚠️ Le montant AUTORITATIF est recalculé côté serveur (RPC
 * `submit_transport_upgrade`, migration 017) ; cette fonction doit en être le
 * miroir EXACT pour que le parent voie le bon montant à régler.
 *
 * Équité : le crédit des jours restants est valorisé au TARIF ANNUEL journalier
 * (price_year/365), pas au tarif mensuel. Ainsi, même à pénalité 0 %,
 * l'upgradeur ne paie jamais moins, à couverture identique, qu'un abonné annuel
 * direct (ses jours déjà couverts ont été payés au tarif mensuel, plus cher).
 */
export function computeUpgradeQuote(
  settings: Pick<
    TransportSettings,
    "priceMonthFcfa" | "priceYearFcfa" | "upgradePenaltyPct"
  > | null,
  subscription: Pick<TransportSubscription, "subscribed" | "period" | "expiresAt">,
  now: Date,
): UpgradeQuote | null {
  if (!settings) return null;
  if (!subscription.subscribed || subscription.period !== "month") return null;
  if (!subscription.expiresAt) return null;

  const exp = new Date(subscription.expiresAt).getTime();
  if (Number.isNaN(exp)) return null;

  const annual = settings.priceYearFcfa;
  const remainingDays = Math.min(
    365,
    Math.max(0, Math.ceil((exp - now.getTime()) / DAY_MS)),
  );
  // Crédit au TARIF ANNUEL journalier (équité, cf. RPC serveur).
  const creditUnused = Math.round((annual * remainingDays) / 365);
  const baseRemaining = Math.max(0, annual - creditUnused);
  const penaltyPct = Math.max(0, Math.min(100, settings.upgradePenaltyPct ?? 0));
  const penaltyAmount = Math.round((baseRemaining * penaltyPct) / 100);
  const total = baseRemaining + penaltyAmount;

  return {
    annual,
    remainingDays,
    creditUnused,
    baseRemaining,
    penaltyPct,
    penaltyAmount,
    total,
  };
}

export interface TransportSlot {
  id: string;
  /** Périmètre établissement (null = « Général »). */
  etablissementId?: string | null;
  label?: string;
  direction: SlotDirection;
  /** Jours d'émission : 1 = lundi … 7 = dimanche. */
  days: number[];
  /** "HH:MM" (heure locale). */
  startTime: string;
  endTime: string;
  active: boolean;
}

/** Un car de transport (un terminal émetteur) identifié par son matricule. */
export interface TransportBus {
  id: string;
  /** Périmètre établissement (null = « Général »). */
  etablissementId?: string | null;
  matricule: string;
  label?: string;
  active: boolean;
}

export interface BusPosition {
  busId: string;
  driverId?: string | null;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  direction?: string | null;
  updatedAt: string;
}

/** Conducteur désigné (autorisé à émettre une position). */
export interface TransportDriver {
  userId: string;
  email?: string | null;
}

export type PaymentStatus = "pending" | "confirmed" | "rejected";

export interface TransportPayment {
  id: string;
  userId: string;
  payerEmail?: string | null;
  amountFcfa: number;
  method: string;
  reference?: string | null;
  status: PaymentStatus;
  /** Formule payée (mensuel / annuel). */
  period: SubscriptionPeriod;
  /** Ce paiement est un passage mensuel → annuel. */
  isUpgrade: boolean;
  createdAt: string;
}

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Lundi", short: "Lun" },
  { value: 2, label: "Mardi", short: "Mar" },
  { value: 3, label: "Mercredi", short: "Mer" },
  { value: 4, label: "Jeudi", short: "Jeu" },
  { value: 5, label: "Vendredi", short: "Ven" },
  { value: 6, label: "Samedi", short: "Sam" },
  { value: 7, label: "Dimanche", short: "Dim" },
];

export const DIRECTION_LABEL: Record<SlotDirection, string> = {
  aller: "Aller (vers l'établissement)",
  retour: "Retour (depuis l'établissement)",
};

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date locale. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

/** Heure « HH:MM » → minutes depuis minuit (heure locale courante). */
export function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Un créneau est-il actif maintenant (jour + fenêtre horaire) ? */
export function isWithinSlot(slot: TransportSlot, now: Date): boolean {
  if (!slot.active) return false;
  if (!slot.days.includes(isoWeekday(now))) return false;
  const cur = nowMinutes(now);
  return cur >= hhmmToMinutes(slot.startTime) && cur <= hhmmToMinutes(slot.endTime);
}

/** Premier créneau actif à l'instant donné, ou null. */
export function activeSlot(slots: TransportSlot[], now: Date): TransportSlot | null {
  return slots.find((s) => isWithinSlot(s, now)) ?? null;
}

/** Normalise une heure Postgres ("HH:MM:SS") en "HH:MM". */
export function trimTime(t: string): string {
  return (t ?? "").slice(0, 5);
}

/** Libellé court d'un créneau (ex. « Aller · Lun-Ven · 06:30–07:30 »). */
export function slotSummary(slot: TransportSlot): string {
  const dir = slot.direction === "aller" ? "Aller" : "Retour";
  const days = slot.days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.short ?? d)
    .join(", ");
  return `${dir} · ${days} · ${trimTime(slot.startTime)}–${trimTime(slot.endTime)}`;
}
