/* ============================================================================
   SERVICE Transport pour Neon + Prisma (SERVEUR uniquement).

   Remplace `lib/transport-server.ts` (Supabase) : toutes les fonctions prennent
   un `PrismaClient` + le `Caller` (identité serveur) et appliquent l'AUTORISATION
   dans le code (le RLS Supabase n'existe pas sur Neon). La logique des anciennes
   RPC (`submit_transport_upgrade`, `confirm_transport_payment`) et du trigger
   anti-forge est réimplémentée ici, dans des transactions Prisma.

   À appeler DEPUIS le serveur (server actions / route handlers) — jamais du
   navigateur (Prisma n'y tourne pas).
   ========================================================================== */

import "server-only";
import type { PrismaClient } from "@prisma/client";
import {
  type BusPosition,
  type SubscriptionPeriod,
  type TransportBus,
  type TransportDriver,
  type TransportPayment,
  type TransportSettings,
  type TransportSlot,
  type TransportSubscription,
  trimTime,
} from "./transport";
import { type Caller, assertCanManage, canManageTransport, TransportError } from "./transport-auth";

export function settingsScopeKey(etablissementId: string | null): string {
  return etablissementId ?? "global";
}

/* ---- Mappers Prisma → interfaces UI ------------------------------------- */
type AnyRow = Record<string, unknown>;
const iso = (d: unknown): string => (d instanceof Date ? d.toISOString() : (d as string) ?? "");

function mapSettings(r: AnyRow): TransportSettings {
  const legacy = Number(r.priceFcfa ?? 0);
  return {
    priceMonthFcfa: Number(r.priceMonthFcfa ?? legacy),
    priceYearFcfa: Number(r.priceYearFcfa ?? 0),
    upgradePenaltyPct: Number(r.upgradePenaltyPct ?? 20),
    beepIntervalMin: Number(r.beepIntervalMin ?? 5),
    centerLat: (r.centerLat as number | null) ?? null,
    centerLng: (r.centerLng as number | null) ?? null,
  };
}
function mapSlot(r: AnyRow): TransportSlot {
  return {
    id: r.id as string,
    etablissementId: (r.etablissementId as string | null) ?? null,
    label: (r.label as string) ?? undefined,
    direction: ((r.direction as string) ?? "aller") as TransportSlot["direction"],
    days: Array.isArray(r.days) ? (r.days as number[]) : [],
    startTime: trimTime(r.startTime as string),
    endTime: trimTime(r.endTime as string),
    active: Boolean(r.active),
  };
}
function mapBus(r: AnyRow): TransportBus {
  return {
    id: r.id as string,
    etablissementId: (r.etablissementId as string | null) ?? null,
    matricule: (r.matricule as string) ?? "",
    label: (r.label as string) ?? undefined,
    active: Boolean(r.active),
  };
}
function mapPosition(r: AnyRow): BusPosition {
  return {
    busId: r.busId as string,
    driverId: (r.driverId as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    heading: (r.heading as number | null) ?? null,
    speed: (r.speed as number | null) ?? null,
    direction: (r.direction as string | null) ?? null,
    updatedAt: iso(r.updatedAt),
  };
}
function mapPayment(r: AnyRow): TransportPayment {
  return {
    id: r.id as string,
    userId: r.userId as string,
    payerEmail: (r.payerEmail as string | null) ?? null,
    amountFcfa: Number(r.amountFcfa ?? 0),
    method: (r.method as string) ?? "mobile_money",
    reference: (r.reference as string | null) ?? null,
    status: ((r.status as string) ?? "pending") as TransportPayment["status"],
    period: ((r.period as string) ?? "month") as SubscriptionPeriod,
    isUpgrade: Boolean(r.isUpgrade),
    createdAt: iso(r.createdAt),
  };
}

/* ==== Réglages & créneaux ================================================= */
export async function getSettings(db: PrismaClient, scopeKey: string): Promise<TransportSettings | null> {
  const r = await db.transportSettings.findUnique({ where: { id: scopeKey } });
  return r ? mapSettings(r as AnyRow) : null;
}

export async function saveSettings(
  db: PrismaClient,
  caller: Caller,
  scopeKey: string,
  s: TransportSettings,
): Promise<void> {
  assertCanManage(caller, scopeKey === "global" ? null : scopeKey);
  await db.transportSettings.upsert({
    where: { id: scopeKey },
    create: {
      id: scopeKey,
      priceFcfa: s.priceMonthFcfa,
      priceMonthFcfa: s.priceMonthFcfa,
      priceYearFcfa: s.priceYearFcfa,
      upgradePenaltyPct: s.upgradePenaltyPct,
      beepIntervalMin: s.beepIntervalMin,
      centerLat: s.centerLat,
      centerLng: s.centerLng,
    },
    update: {
      priceFcfa: s.priceMonthFcfa,
      priceMonthFcfa: s.priceMonthFcfa,
      priceYearFcfa: s.priceYearFcfa,
      upgradePenaltyPct: s.upgradePenaltyPct,
      beepIntervalMin: s.beepIntervalMin,
      centerLat: s.centerLat,
      centerLng: s.centerLng,
    },
  });
}

export async function listSlots(db: PrismaClient, etablissementId: string | null): Promise<TransportSlot[]> {
  const rows = await db.transportSlot.findMany({
    where: { etablissementId },
    orderBy: { startTime: "asc" },
  });
  return rows.map((r) => mapSlot(r as AnyRow));
}
export async function addSlot(db: PrismaClient, caller: Caller, slot: Omit<TransportSlot, "id">): Promise<void> {
  assertCanManage(caller, slot.etablissementId ?? null);
  await db.transportSlot.create({
    data: {
      etablissementId: slot.etablissementId ?? null,
      label: slot.label ?? null,
      direction: slot.direction,
      days: slot.days,
      startTime: slot.startTime,
      endTime: slot.endTime,
      active: slot.active,
    },
  });
}
export async function deleteSlot(db: PrismaClient, caller: Caller, id: string): Promise<void> {
  const row = await db.transportSlot.findUnique({ where: { id }, select: { etablissementId: true } });
  if (!row) return;
  assertCanManage(caller, row.etablissementId);
  await db.transportSlot.delete({ where: { id } });
}

/* ==== Cars =============================================================== */
export async function listBuses(db: PrismaClient, etablissementId: string | null): Promise<TransportBus[]> {
  const rows = await db.transportBus.findMany({ where: { etablissementId }, orderBy: { matricule: "asc" } });
  return rows.map((r) => mapBus(r as AnyRow));
}
export async function addBus(
  db: PrismaClient,
  caller: Caller,
  bus: { matricule: string; label?: string; etablissementId?: string | null },
): Promise<void> {
  assertCanManage(caller, bus.etablissementId ?? null);
  await db.transportBus.create({
    data: { matricule: bus.matricule, label: bus.label ?? null, etablissementId: bus.etablissementId ?? null },
  });
}
export async function deleteBus(db: PrismaClient, caller: Caller, id: string): Promise<void> {
  const row = await db.transportBus.findUnique({ where: { id }, select: { etablissementId: true } });
  if (!row) return;
  assertCanManage(caller, row.etablissementId);
  await db.transportBus.delete({ where: { id } });
}

/* ==== Positions (avec PAYWALL serveur) =================================== */

/**
 * Cache TRÈS COURT des positions par établissement (mémoire du process serverless).
 * Le suivi étant du polling ~5 s, tous les parents d'un même établissement partagent UNE lecture
 * base de données par intervalle au lieu d'une chacun (cf. audit de scalabilité — verrou temps réel).
 * Multi-instances : chaque instance a son cache (pas de cohérence forte requise pour un suivi live).
 */
const CACHE_POSITIONS_MS = 4000;
const cachePositions = new Map<string, { a: number; data: BusPosition[] }>();

async function positionsEtablissement(db: PrismaClient, etab: string): Promise<BusPosition[]> {
  const maintenant = Date.now();
  const hit = cachePositions.get(etab);
  if (hit && maintenant - hit.a < CACHE_POSITIONS_MS) return hit.data;
  const rows = await db.busPosition.findMany({
    where: { bus: { etablissementId: etab } }, // borné via l'index TransportBus.etablissementId
    include: { bus: { select: { etablissementId: true } } },
  });
  const data = rows.map((r) => mapPosition(r as AnyRow));
  cachePositions.set(etab, { a: maintenant, data });
  return data;
}

/**
 * Positions VISIBLES par l'appelant : gestionnaire, OU même établissement + abonné actif.
 * Paywall D'ABORD (un non-abonné ne déclenche AUCUNE lecture de position) et requête BORNÉE à
 * l'établissement (jamais un scan de toutes les positions de la plateforme).
 */
export async function listVisiblePositions(db: PrismaClient, caller: Caller): Promise<BusPosition[]> {
  // Admin (peu nombreux) : vue globale, non mise en cache.
  if (caller.isAdmin) {
    const rows = await db.busPosition.findMany({ include: { bus: { select: { etablissementId: true } } } });
    return rows.map((r) => mapPosition(r as AnyRow));
  }
  const etab = caller.etablissementId;
  if (!etab) return [];
  // Ni gestionnaire de cet établissement, ni abonné actif → aucune position (et aucune requête).
  const autorise = canManageTransport(caller, etab) || (await hasActiveSubscription(db, caller.userId));
  if (!autorise) return [];
  return positionsEtablissement(db, etab);
}

/** Émission d'une position : admin OU conducteur du MÊME établissement que le car. */
export async function upsertPosition(
  db: PrismaClient,
  caller: Caller,
  p: { busId: string; lat: number; lng: number; heading?: number | null; speed?: number | null; direction?: string | null },
): Promise<void> {
  const bus = await db.transportBus.findUnique({ where: { id: p.busId }, select: { etablissementId: true } });
  if (!bus) throw new TransportError("Car introuvable.");
  let ok = caller.isAdmin;
  if (!ok) {
    const driver = await db.transportDriver.findUnique({ where: { userId: caller.userId }, select: { etablissementId: true } });
    ok = !!driver && driver.etablissementId === bus.etablissementId; // is-not-distinct-from (null==null)
  }
  if (!ok) throw new TransportError("Émission réservée au conducteur de cet établissement.");
  await db.busPosition.upsert({
    where: { busId: p.busId },
    create: { busId: p.busId, driverId: caller.userId, lat: p.lat, lng: p.lng, heading: p.heading ?? null, speed: p.speed ?? null, direction: p.direction ?? null },
    update: { driverId: caller.userId, lat: p.lat, lng: p.lng, heading: p.heading ?? null, speed: p.speed ?? null, direction: p.direction ?? null, updatedAt: new Date() },
  });
}

/* ==== Abonnement ========================================================= */
export async function hasActiveSubscription(db: PrismaClient, userId: string): Promise<boolean> {
  const s = await db.transportSubscription.findUnique({ where: { userId } });
  if (!s || !s.active) return false;
  return s.expiresAt == null || s.expiresAt.getTime() > Date.now();
}
export async function getSubscription(db: PrismaClient, userId: string): Promise<TransportSubscription> {
  const s = await db.transportSubscription.findUnique({ where: { userId } });
  const valid = !!s && s.active && (s.expiresAt == null || s.expiresAt.getTime() > Date.now());
  return { subscribed: valid, period: (s?.period as SubscriptionPeriod | null) ?? null, expiresAt: s?.expiresAt ? s.expiresAt.toISOString() : null };
}

/* ==== Paiements (Mobile Money, validation manuelle) ====================== */
/** Soumission d'une SOUSCRIPTION : établissement = celui du payeur, MONTANT recalculé serveur. */
export async function submitPayment(
  db: PrismaClient,
  caller: Caller,
  p: { period: SubscriptionPeriod; reference?: string | null; method?: string; payerEmail?: string | null },
): Promise<void> {
  const scope = settingsScopeKey(caller.etablissementId);
  let settings = await db.transportSettings.findUnique({ where: { id: scope } });
  if (!settings) settings = await db.transportSettings.findUnique({ where: { id: "global" } });
  const amount = p.period === "year" ? (settings?.priceYearFcfa ?? 0) : (settings?.priceMonthFcfa ?? settings?.priceFcfa ?? 0);
  await db.transportPayment.create({
    data: {
      userId: caller.userId,
      etablissementId: caller.etablissementId,
      payerEmail: p.payerEmail ?? null,
      amountFcfa: amount,
      period: p.period,
      isUpgrade: false,
      method: p.method ?? "mobile_money",
      reference: p.reference ?? null,
      status: "pending",
    },
  });
}

/** Passage MENSUEL → ANNUEL : montant calculé serveur (équité au tarif annuel journalier). */
export async function submitUpgrade(
  db: PrismaClient,
  caller: Caller,
  reference: string,
): Promise<{ amountFcfa: number }> {
  return db.$transaction(async (tx) => {
    const sub = await tx.transportSubscription.findUnique({ where: { userId: caller.userId } });
    if (!sub || sub.period !== "month" || !sub.expiresAt || sub.expiresAt.getTime() <= Date.now()) {
      throw new TransportError("Le passage à l'annuel est réservé aux abonnés mensuels actifs.");
    }
    const pending = await tx.transportPayment.count({ where: { userId: caller.userId, isUpgrade: true, status: "pending" } });
    if (pending > 0) throw new TransportError("Un passage à l'annuel est déjà en attente de validation.");

    const scope = settingsScopeKey(caller.etablissementId);
    let settings = await tx.transportSettings.findUnique({ where: { id: scope } });
    if (!settings) settings = await tx.transportSettings.findUnique({ where: { id: "global" } });
    const priceYear = settings?.priceYearFcfa ?? 0;
    const penalty = Math.min(100, Math.max(0, settings?.upgradePenaltyPct ?? 20));

    const DAY = 86_400_000;
    const days = Math.min(365, Math.max(0, Math.ceil((sub.expiresAt.getTime() - Date.now()) / DAY)));
    const credit = Math.round((priceYear * days) / 365);
    const base = Math.max(0, priceYear - credit);
    const total = base + Math.round((base * penalty) / 100);

    await tx.transportPayment.create({
      data: {
        userId: caller.userId,
        etablissementId: caller.etablissementId,
        payerEmail: caller.userId, // remplace par l'e-mail réel si dispo
        amountFcfa: total,
        period: "year",
        isUpgrade: true,
        method: "mobile_money",
        reference: reference.trim() || null,
        status: "pending",
      },
    });
    return { amountFcfa: total };
  });
}

export async function myLatestPayment(db: PrismaClient, userId: string): Promise<TransportPayment | null> {
  const r = await db.transportPayment.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  return r ? mapPayment(r as AnyRow) : null;
}

export async function listPendingPayments(db: PrismaClient, caller: Caller, etablissementId: string | null): Promise<TransportPayment[]> {
  assertCanManage(caller, etablissementId);
  const rows = await db.transportPayment.findMany({ where: { status: "pending", etablissementId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => mapPayment(r as AnyRow));
}

/** Confirme un paiement ET prolonge l'abonnement (transactionnel). */
export async function confirmPayment(db: PrismaClient, caller: Caller, paymentId: string): Promise<Date> {
  return db.$transaction(async (tx) => {
    const pay = await tx.transportPayment.findUnique({ where: { id: paymentId } });
    if (!pay) throw new TransportError("Paiement introuvable.");
    if (!(caller.isAdmin || canManageTransport(caller, pay.etablissementId))) {
      throw new TransportError("Accès refusé : réservé au gestionnaire de cet établissement.");
    }
    await tx.transportPayment.update({
      where: { id: paymentId },
      data: { status: "confirmed", confirmedAt: new Date(), confirmedBy: caller.userId },
    });
    const sub = await tx.transportSubscription.findUnique({ where: { userId: pay.userId } });
    const now = new Date();
    const cur = sub?.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
    let next: Date;
    if (pay.isUpgrade) {
      const oneYear = new Date(now.getTime()); oneYear.setFullYear(oneYear.getFullYear() + 1);
      next = cur > oneYear ? cur : oneYear; // ne raccourcit jamais
    } else {
      next = new Date(cur.getTime());
      if (pay.period === "year") next.setFullYear(next.getFullYear() + 1);
      else next.setMonth(next.getMonth() + 1);
    }
    await tx.transportSubscription.upsert({
      where: { userId: pay.userId },
      create: { userId: pay.userId, active: true, period: pay.period, expiresAt: next, etablissementId: pay.etablissementId },
      update: { active: true, period: pay.period, expiresAt: next, etablissementId: pay.etablissementId },
    });
    return next;
  });
}

export async function rejectPayment(db: PrismaClient, caller: Caller, paymentId: string): Promise<void> {
  const pay = await db.transportPayment.findUnique({ where: { id: paymentId }, select: { etablissementId: true } });
  if (!pay) return;
  assertCanManage(caller, pay.etablissementId);
  await db.transportPayment.update({ where: { id: paymentId }, data: { status: "rejected" } });
}

/* ==== Conducteurs ======================================================== */
export async function isDriver(db: PrismaClient, userId: string): Promise<boolean> {
  return (await db.transportDriver.count({ where: { userId } })) > 0;
}
export async function listDrivers(db: PrismaClient, caller: Caller, etablissementId: string | null): Promise<TransportDriver[]> {
  assertCanManage(caller, etablissementId);
  const rows = await db.transportDriver.findMany({ where: { etablissementId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ userId: (r as AnyRow).userId as string, email: ((r as AnyRow).email as string | null) ?? null }));
}
/**
 * Désigne un conducteur. La résolution e-mail → userId dépend de TA table
 * utilisateurs : passe directement le `userId` (résolu en amont via ton User).
 */
export async function addDriver(
  db: PrismaClient,
  caller: Caller,
  d: { userId: string; email?: string | null; etablissementId: string | null },
): Promise<void> {
  assertCanManage(caller, d.etablissementId);
  await db.transportDriver.upsert({
    where: { userId: d.userId },
    create: { userId: d.userId, email: d.email ?? null, etablissementId: d.etablissementId },
    update: { email: d.email ?? null, etablissementId: d.etablissementId },
  });
}
export async function removeDriver(db: PrismaClient, caller: Caller, userId: string): Promise<void> {
  const row = await db.transportDriver.findUnique({ where: { userId }, select: { etablissementId: true } });
  if (!row) return;
  assertCanManage(caller, row.etablissementId);
  await db.transportDriver.delete({ where: { userId } });
}
