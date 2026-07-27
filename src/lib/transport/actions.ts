"use server";

/* ============================================================================
   SERVER ACTIONS Transport — frontière navigateur ↔ serveur.

   Le navigateur (composants clients) appelle ces actions ; elles résolvent le
   Caller (identité + établissement) depuis la session, refusent le mode aperçu
   pour toute écriture, puis délèguent au service Prisma. Le PÉRIMÈTRE des
   mutations est TOUJOURS dérivé de l'appelant (jamais d'un paramètre client),
   pour empêcher toute action inter-établissements.
   ========================================================================== */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { BusPosition, SubscriptionPeriod, TransportSettings } from "./transport";
import type { Caller } from "./transport-auth";
import * as svc from "./transport-service";
import { getCaller, getCallerEcriture } from "./session";

const CHEMIN = "/app/vie-scolaire/transport";

export interface Resultat {
  ok: boolean;
  error?: string;
}

/** Enrobe une mutation : appelant (écriture), exécution, revalidation, erreur sérialisable. */
async function muter(fn: (c: Caller) => Promise<void>): Promise<Resultat> {
  try {
    const caller = await getCallerEcriture();
    await fn(caller);
    revalidatePath(CHEMIN);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

/* ---- Lecture temps réel (polling) --------------------------------------- */
/** Positions VISIBLES par l'appelant (paywall appliqué côté service). Jamais throw. */
export async function rafraichirPositionsAction(): Promise<BusPosition[]> {
  try {
    const caller = await getCaller();
    return await svc.listVisiblePositions(prisma, caller);
  } catch {
    return [];
  }
}

/* ---- Émission de position (conducteur) ---------------------------------- */
export async function emettrePositionAction(p: {
  busId: string;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  direction?: string | null;
}): Promise<Resultat> {
  return muter((c) => svc.upsertPosition(prisma, c, p));
}

/* ---- Abonnement (parent) ------------------------------------------------- */
export async function souscrireAction(p: {
  period: SubscriptionPeriod;
  reference?: string | null;
  payerEmail?: string | null;
}): Promise<Resultat> {
  return muter((c) => svc.submitPayment(prisma, c, p));
}

export async function passerAnnuelAction(reference: string): Promise<Resultat> {
  return muter(async (c) => {
    await svc.submitUpgrade(prisma, c, reference);
  });
}

/* ---- Gestion (admin = « Général », chef/ACE = leur établissement) -------- */
export async function ajouterBusAction(bus: { matricule: string; label?: string }): Promise<Resultat> {
  return muter((c) => svc.addBus(prisma, c, { ...bus, etablissementId: c.etablissementId }));
}
export async function supprimerBusAction(id: string): Promise<Resultat> {
  return muter((c) => svc.deleteBus(prisma, c, id));
}

export async function ajouterCreneauAction(slot: {
  label?: string;
  direction: "aller" | "retour";
  days: number[];
  startTime: string;
  endTime: string;
  active: boolean;
}): Promise<Resultat> {
  return muter((c) => svc.addSlot(prisma, c, { ...slot, etablissementId: c.etablissementId }));
}
export async function supprimerCreneauAction(id: string): Promise<Resultat> {
  return muter((c) => svc.deleteSlot(prisma, c, id));
}

export async function enregistrerReglagesAction(s: TransportSettings): Promise<Resultat> {
  return muter((c) => svc.saveSettings(prisma, c, svc.settingsScopeKey(c.etablissementId), s));
}

export async function confirmerPaiementAction(paymentId: string): Promise<Resultat> {
  return muter(async (c) => {
    await svc.confirmPayment(prisma, c, paymentId);
  });
}
export async function rejeterPaiementAction(paymentId: string): Promise<Resultat> {
  return muter((c) => svc.rejectPayment(prisma, c, paymentId));
}

/** Désigne un conducteur par son e-mail (résolu vers son compte, dans le périmètre du gestionnaire). */
export async function ajouterConducteurAction(email: string): Promise<Resultat> {
  return muter(async (c) => {
    const cible = email.trim().toLowerCase();
    const compte = await prisma.utilisateur.findUnique({
      where: { email: cible },
      select: { id: true, email: true },
    });
    if (!compte) {
      throw new Error("Aucun compte avec cette adresse e-mail. Le conducteur doit d'abord avoir un compte.");
    }
    await svc.addDriver(prisma, c, {
      userId: compte.id,
      email: compte.email,
      etablissementId: c.etablissementId,
    });
  });
}
export async function retirerConducteurAction(userId: string): Promise<Resultat> {
  return muter((c) => svc.removeDriver(prisma, c, userId));
}
