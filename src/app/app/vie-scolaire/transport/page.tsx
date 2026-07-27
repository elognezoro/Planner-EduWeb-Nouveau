import type { Metadata } from "next";
import { requireAccesComplet } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCaller } from "@/lib/transport/session";
import { canManageTransport } from "@/lib/transport/transport-auth";
import * as svc from "@/lib/transport/transport-service";
import { PageHeader } from "@/components/app/ui";
import { TransportClient } from "./transport-client";

export const metadata: Metadata = { title: "Transport d'élèves" };
export const dynamic = "force-dynamic";

export default async function TransportPage() {
  const u = await requireAccesComplet();
  const caller = await getCaller();
  const etab = caller.etablissementId;
  const isManager = canManageTransport(caller, etab);
  const isDriver = await svc.isDriver(prisma, caller.userId);

  const [reglagesScope, slots, buses, positions, subscription, latestPayment] = await Promise.all([
    svc.getSettings(prisma, svc.settingsScopeKey(etab)),
    svc.listSlots(prisma, etab),
    svc.listBuses(prisma, etab),
    svc.listVisiblePositions(prisma, caller),
    svc.getSubscription(prisma, caller.userId),
    svc.myLatestPayment(prisma, caller.userId),
  ]);
  // Repli sur les réglages « Général » si le périmètre n'a pas encore les siens.
  const settings = reglagesScope ?? (await svc.getSettings(prisma, "global"));

  const pendingPayments = isManager ? await svc.listPendingPayments(prisma, caller, etab) : [];
  const drivers = isManager ? await svc.listDrivers(prisma, caller, etab) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titre="Transport d'élèves"
        description="Suivez en temps réel le car de ramassage scolaire. Le suivi est réservé aux familles abonnées de l'établissement."
      />
      <TransportClient
        capacites={{ gestionnaire: isManager, conducteur: isDriver, apercu: u.apercuActif }}
        settings={settings}
        slots={slots}
        buses={buses}
        positionsInitiales={positions}
        abonnement={subscription}
        dernierPaiement={latestPayment}
        paiementsEnAttente={pendingPayments}
        conducteurs={drivers}
      />
    </div>
  );
}
